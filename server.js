const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// In-memory storage for demo purposes (replace with database in production)
let users = [];
let locks = [];

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'TikStake Backend API is running!' });
});

// Register endpoint
app.post('/api/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }
    
    // Check if user already exists
    const existingUser = users.find(user => user.email === email || user.username === username);
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email or username already exists' 
      });
    }
    
    // Create new user
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password, // In production, hash the password
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Return user without password
    const { password: _, ...userResponse } = newUser;
    res.status(201).json({ 
      message: 'User registered successfully', 
      user: userResponse 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }
    
    // Find user
    const user = users.find(user => user.email === email && user.password === password);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    // Return user without password
    const { password: _, ...userResponse } = user;
    res.json({ 
      message: 'Login successful', 
      user: userResponse 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all locks
app.get('/api/locks', (req, res) => {
  try {
    res.json({ locks });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new lock
app.post('/api/locks', (req, res) => {
  try {
    const { title, description, userId, targetAmount } = req.body;
    
    if (!title || !userId) {
      return res.status(400).json({ 
        error: 'Title and userId are required' 
      });
    }
    
    const newLock = {
      id: locks.length + 1,
      title,
      description: description || '',
      userId,
      targetAmount: targetAmount || 0,
      currentAmount: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    locks.push(newLock);
    
    res.status(201).json({ 
      message: 'Lock created successfully', 
      lock: newLock 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`TikStake Backend server is running on port ${PORT}`);
});

module.exports = app;