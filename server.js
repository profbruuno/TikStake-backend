require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: function (req, file, cb) {
    // Allow common image and video formats
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|wmv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// In-memory user database
let users = [];
let locks = [];
let nextUserId = 1;
let nextLockId = 1;

// Helper function to find user by username
const findUserByUsername = (username) => {
  return users.find(user => user.username === username);
};

// Helper function to find user by ID
const findUserById = (id) => {
  return users.find(user => user.id === id);
};

// API Routes

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'TikStake Backend is running',
    timestamp: new Date().toISOString()
  });
});

// User Registration
app.post('/api/v1/register', (req, res) => {
  const { username, email, password } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Username, email, and password are required'
    });
  }

  // Check if user already exists
  if (findUserByUsername(username)) {
    return res.status(409).json({
      error: 'User already exists',
      message: 'Username is already taken'
    });
  }

  // Create new user
  const newUser = {
    id: nextUserId++,
    username,
    email,
    password, // In production, this should be hashed
    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  // Return user without password
  const { password: _, ...userResponse } = newUser;
  res.status(201).json({
    message: 'User registered successfully',
    user: userResponse
  });
});

// User Login
app.post('/api/v1/login', (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({
      error: 'Missing credentials',
      message: 'Username and password are required'
    });
  }

  // Find user and validate password
  const user = findUserByUsername(username);
  if (!user || user.password !== password) {
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Username or password is incorrect'
    });
  }

  // Return user without password
  const { password: _, ...userResponse } = user;
  res.json({
    message: 'Login successful',
    user: userResponse
  });
});

// Get all locks
app.get('/api/v1/locks', (req, res) => {
  res.json({
    message: 'Locks retrieved successfully',
    locks: locks,
    count: locks.length
  });
});

// Add new lock (with optional file upload)
app.post('/api/v1/locks', upload.single('file'), (req, res) => {
  const { title, description, userId } = req.body;

  // Basic validation
  if (!title || !userId) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Title and userId are required'
    });
  }

  // Validate user exists
  const user = findUserById(parseInt(userId));
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'Invalid userId provided'
    });
  }

  // Create new lock
  const newLock = {
    id: nextLockId++,
    title,
    description: description || '',
    userId: parseInt(userId),
    username: user.username,
    filePath: req.file ? req.file.path : null,
    fileName: req.file ? req.file.originalname : null,
    fileSize: req.file ? req.file.size : null,
    createdAt: new Date().toISOString()
  };

  locks.push(newLock);

  res.status(201).json({
    message: 'Lock created successfully',
    lock: newLock
  });
});

// Get locks by user ID
app.get('/api/v1/users/:userId/locks', (req, res) => {
  const userId = parseInt(req.params.userId);

  // Validate user exists
  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'Invalid userId provided'
    });
  }

  const userLocks = locks.filter(lock => lock.userId === userId);

  res.json({
    message: 'User locks retrieved successfully',
    locks: userLocks,
    count: userLocks.length
  });
});

// Get user information
app.get('/api/v1/users/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = findUserById(userId);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'Invalid userId provided'
    });
  }

  // Return user without password
  const { password: _, ...userResponse } = user;
  res.json({
    message: 'User retrieved successfully',
    user: userResponse
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size exceeds the maximum allowed limit'
      });
    }
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TikStake Backend server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
});

module.exports = app;