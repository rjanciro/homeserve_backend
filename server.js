const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const adminRoutes = require('./routes/admin.routes');
const createUploadDirs = require('./setup-uploads');
const fs = require('fs');
const { startWebSocketServer } = require('./websocket-server');
const browseRoutes = require('./routes/browse.routes');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5000', 
    'http://localhost:5173', 
    'http://127.0.0.1:5000', 
    'http://127.0.0.1:5173',
    'https://homeserve.host'
  ],
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Create uploads directory if it doesn't exist
createUploadDirs();

// Serve static files with proper headers
app.use('/uploads/verification', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads/verification')));

app.use('/uploads/profile_pictures', express.static(path.join(__dirname, 'uploads/profile_pictures')));
app.use('/uploads/services_pictures', express.static(path.join(__dirname, 'uploads/services_pictures')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/services', require('./routes/service.routes'));
app.use('/api/admin', adminRoutes);
app.use('/api/admin/verification', require('./routes/admin.verification.routes'));
app.use('/api/documents', require('./routes/document.routes'));
app.use('/api/browse', browseRoutes);
try {
  app.use('/api/bookings', require('./routes/booking.routes'));
  console.log('Booking routes loaded successfully');
} catch (error) {
  console.error('Error loading booking routes:', error);
}

// Add this route for testing file access
app.get('/check-file/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads/verification', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.send(`File exists: ${filePath}`);
  } else {
    res.status(404).send(`File does not exist: ${filePath}`);
  }
});

// Add this route to help debug the file mappings
app.get('/api/check-files', (req, res) => {
  const verificationDir = path.join(__dirname, 'uploads/verification');
  try {
    const files = fs.readdirSync(verificationDir);
    res.json({ 
      files,
      directory: verificationDir
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MongoDB connection with detailed logging
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    
    // Start WebSocket server after MongoDB connection is established
    startWebSocketServer();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Add error handler
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

// Server port
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});