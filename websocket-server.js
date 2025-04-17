const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');
const User = require('./models/user.model');
const Conversation = require('./models/conversation.model');
const Message = require('./models/message.model');
const dotenv = require('dotenv');

dotenv.config();

// Connected clients map (userId -> WebSocket connection)
const clients = new Map();

// Start WebSocket server
const startWebSocketServer = () => {
  const server = http.createServer();
  const wss = new WebSocket.Server({ 
    server,
    cors: {
      origin: ['http://localhost:5000', 'http://localhost:5173', 'http://127.0.0.1:5000', 'http://127.0.0.1:5173'],
      credentials: true
    }
  });

  wss.on('connection', (ws) => {
    console.log('New client connected');
    let userId = null;

    // Welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to HomeServe WebSocket server',
      messageId: `welcome-${Date.now()}`
    }));

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log('Received message:', data.type);

        // Handle authentication
        if (data.type === 'auth') {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
            userId = decoded.userId;
            
            // Store connection in clients map
            clients.set(userId, ws);
            
            console.log(`User ${userId} authenticated`);
            
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
          .populate('participants', 'firstName lastName profileImage userType')
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
          const receiverWs = clients.get(receiverId);
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
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format',
          messageId: `error-${Date.now()}`
        }));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  const port = process.env.WS_PORT || 8081;
  server.listen(port, () => {
    console.log(`WebSocket server started on port ${port}`);
  });
};

module.exports = { startWebSocketServer };
