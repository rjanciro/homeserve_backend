const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');
const User = require('./models/user.model');
const Conversation = require('./models/conversation.model');
const Message = require('./models/message.model');
const dotenv = require('dotenv');

dotenv.config();

// Connected clients map (userId -> {connectionCount, connections[]})
const clientsStore = new Map();

// Start WebSocket server
const startWebSocketServer = () => {
  const server = http.createServer();
  const wss = new WebSocket.Server({ 
    server,
    cors: {
      origin: [
        'http://localhost:5000', 
        'http://localhost:5173', 
        'http://127.0.0.1:5000', 
        'http://127.0.0.1:5173',
        'https://homeserve.host',
        process.env.CLIENT_URL // Use the client URL from environment
      ],
      credentials: true
    }
  });

  wss.on('connection', (ws) => {
    console.log('New client connected');
    let userId = null;

    // Add custom ID to websocket for debugging
    ws.id = Math.random().toString(36).substring(2, 10);
    console.log(`Assigned connection ID: ${ws.id}`);

    // Welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to HomeServe WebSocket server',
      messageId: `welcome-${Date.now()}`
    }));

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`Received message (${ws.id}):`, data.type);

        // Handle authentication
        if (data.type === 'auth') {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
            userId = decoded.userId;
            
            console.log(`User ${userId} authenticated on connection ${ws.id}`);
            
            // Add connection to user's connections
            if (!clientsStore.has(userId)) {
              console.log(`Creating new connection record for user ${userId}`);
              clientsStore.set(userId, {
                connectionCount: 0,
                connections: []
              });
            }
            
            const userConnections = clientsStore.get(userId);
            userConnections.connectionCount++;
            userConnections.connections.push(ws);
            
            console.log(`User ${userId} now has ${userConnections.connectionCount} active connections`);
            
            // Update user's online status in database if they weren't already online
            const user = await User.findById(userId);
            if (!user.isOnline) {
              console.log(`Marking user ${userId} as online in database`);
              user.isOnline = true;
              user.lastSeen = new Date();
              await user.save();
              
              // Broadcast user's online status to other connected users
              broadcastUserStatus(userId, true);
            }
            
            // Send authentication success response
            ws.send(JSON.stringify({
              type: 'auth_success',
              userId,
              messageId: `auth-success-${Date.now()}`
            }));
            
          } catch (error) {
            console.error('Authentication error:', error);
            ws.send(JSON.stringify({
              type: 'auth_error',
              error: 'Invalid token',
              messageId: `auth-error-${Date.now()}`
            }));
          }
        }
        
        // Handle user manually setting their status
        else if (data.type === 'set_status') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          const { isOnline } = data;
          
          // Update user's online status in database
          await User.findByIdAndUpdate(userId, {
            isOnline: isOnline,
            lastSeen: isOnline ? new Date() : new Date()
          });
          
          // Broadcast user's online status to other connected users
          broadcastUserStatus(userId, isOnline);
          
          ws.send(JSON.stringify({
            type: 'status_updated',
            isOnline,
            messageId: `status-${Date.now()}`
          }));
        }
        
        // Handle ping messages to keep connection alive
        else if (data.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            messageId: `pong-${Date.now()}`
          }));
        }
        
        // Get all conversations for user
        else if (data.type === 'get_conversations') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          const conversations = await Conversation.find({ 
            participants: userId 
          })
          .populate('participants', 'firstName lastName profileImage userType isOnline lastSeen')
          .populate('lastMessage')
          .sort('-updatedAt')
          .exec();
          
          ws.send(JSON.stringify({
            type: 'conversations',
            conversations,
            messageId: `conversations-${Date.now()}`
          }));
        }
        
        // Get all messages for a conversation
        else if (data.type === 'get_messages') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          const { conversationId } = data;
          
          // Check if user is part of this conversation
          const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
          });
          
          if (!conversation) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Conversation not found or access denied',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'firstName lastName profileImage')
            .sort('createdAt')
            .exec();
          
          ws.send(JSON.stringify({
            type: 'messages',
            conversationId,
            messages,
            messageId: `messages-${Date.now()}`
          }));
          
          // Mark messages as read
          await Message.updateMany(
            { 
              conversation: conversationId,
              receiver: userId,
              read: false
            },
            { read: true }
          );
        }
        
        // Send new message
        else if (data.type === 'send_message') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          const { receiverId, content } = data;
          
          // Find or create conversation
          let conversation = await Conversation.findOne({
            participants: { $all: [userId, receiverId] }
          });
          
          if (!conversation) {
            conversation = new Conversation({
              participants: [userId, receiverId],
            });
            await conversation.save();
          }
          
          // Create message
          const message = new Message({
            conversation: conversation._id,
            sender: userId,
            receiver: receiverId,
            content
          });
          
          await message.save();
          
          // Update conversation's lastMessage
          conversation.lastMessage = message._id;
          conversation.updatedAt = Date.now();
          await conversation.save();
          
          // Populate message with sender info
          const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'firstName lastName profileImage')
            .exec();
          
          // Send message to sender (confirmation)
          ws.send(JSON.stringify({
            type: 'message_sent',
            message: populatedMessage,
            conversationId: conversation._id,
            messageId: `message-sent-${Date.now()}`
          }));
          
          // Send message to receiver if online
          const receiverWs = clientsStore.get(receiverId)?.connections.find(conn => conn.readyState === WebSocket.OPEN);
          if (receiverWs) {
            receiverWs.send(JSON.stringify({
              type: 'new_message',
              message: populatedMessage,
              conversationId: conversation._id,
              messageId: `new-message-${Date.now()}`
            }));
          }
        }
        
        // Get all available users
        else if (data.type === 'get_users') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          // Get all users except current user
          const users = await User.find({ _id: { $ne: userId } })
            .select('firstName lastName profileImage userType')
            .exec();
          
          ws.send(JSON.stringify({
            type: 'users',
            users,
            messageId: `users-${Date.now()}`
          }));
        }
        
        // Start new conversation
        else if (data.type === 'start_conversation') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }
          
          const { receiverId } = data;
          
          // Find or create conversation
          let conversation = await Conversation.findOne({
            participants: { $all: [userId, receiverId] }
          });
          
          if (!conversation) {
            conversation = new Conversation({
              participants: [userId, receiverId],
            });
            await conversation.save();
          }
          
          // Populate conversation with participant info
          const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'firstName lastName profileImage userType')
            .exec();
          
          ws.send(JSON.stringify({
            type: 'conversation_started',
            conversation: populatedConversation,
            messageId: `conversation-started-${Date.now()}`
          }));
        }
        
        // Get messages by otherUserId (find conversation then get messages)
        else if (data.type === 'get_conversation') {
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Not authenticated',
              messageId: `error-${Date.now()}`
            }));
            return;
          }

          const { otherUserId } = data;
          
          // Find the conversation between current user and other user
          const conversation = await Conversation.findOne({
            participants: { $all: [userId, otherUserId] }
          });

          if (!conversation) {
            // Conversation doesn't exist yet, send empty messages array
            ws.send(JSON.stringify({
              type: 'messages',
              messages: [],
              messageId: `messages-empty-${Date.now()}`
            }));
            return;
          }

          // Fetch messages for this conversation
          const messages = await Message.find({ conversation: conversation._id })
            .populate('sender', 'firstName lastName profileImage')
            .sort('createdAt')
            .exec();

          ws.send(JSON.stringify({
            type: 'messages',
            conversationId: conversation._id,
            messages,
            messageId: `messages-${Date.now()}`
          }));

          // Mark messages as read
          await Message.updateMany(
            {
              conversation: conversation._id,
              receiver: userId,
              read: false
            },
            { read: true }
          );
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    // Handle client disconnection
    ws.on('close', async () => {
      if (userId) {
        console.log(`Connection ${ws.id} for user ${userId} closed`);
        
        // Remove this connection from user's connections
        if (clientsStore.has(userId)) {
          const userConnections = clientsStore.get(userId);
          
          // Remove this specific connection
          userConnections.connections = userConnections.connections.filter(conn => conn !== ws);
          userConnections.connectionCount = Math.max(0, userConnections.connectionCount - 1);
          
          console.log(`User ${userId} now has ${userConnections.connectionCount} active connections`);
          
          // If user has no more connections, mark them as offline
          if (userConnections.connectionCount === 0) {
            console.log(`User ${userId} has no more connections, marking as offline`);
            
            // Update user status in database
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: new Date()
            });
            
            // Remove user from clients store
            clientsStore.delete(userId);
            
            // Broadcast user's offline status
            broadcastUserStatus(userId, false);
          }
        }
      }
    });
  });
  
  // Function to broadcast user status change to other connected users
  const broadcastUserStatus = async (userId, isOnline) => {
    const user = await User.findById(userId).select('firstName lastName userType profileImage');
    
    if (!user) return;
    
    console.log(`Broadcasting status change: ${user.firstName} ${user.lastName} is now ${isOnline ? 'online' : 'offline'}`);
    
    // Prepare status update message
    const statusUpdate = {
      type: 'user_status_change',
      user: {
        _id: userId,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        profileImage: user.profileImage
      },
      isOnline,
      timestamp: Date.now(),
      messageId: `status-update-${Date.now()}`
    };
    
    // Send to all connected users across all connections except the user's own connections
    for (const [clientId, clientData] of clientsStore.entries()) {
      if (clientId !== userId) {
        for (const clientWs of clientData.connections) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(statusUpdate));
          }
        }
      }
    }
  };

  const port = process.env.WS_PORT || 8081;
  server.listen(port, () => {
    console.log(`WebSocket server started on port ${port}`);
  });
};

module.exports = { startWebSocketServer };
