const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration for production
const io = socketIo(server, {
  path: "/socket.io",          // ✅ FIX 1
  cors: {
    origin: [
      "https://cyberadda.netlify.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket"],   // ✅ FIX 2
  allowEIO3: true,             // ✅ FIX 3
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors({
  origin: [
    "https://cyberadda.netlify.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*" // Temporary for testing
  ],
  credentials: true
}));

app.use(express.json());

// Global state
let globalState = {
  isUnderAttack: false,
  timer: 3600,
  attackStartedAt: null,
  totalUsers: 0,
  activeAttackers: [],
  attackHistory: []
};

let timerInterval = null;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Cyber Backend is running',
    timestamp: new Date().toISOString(),
    users: globalState.totalUsers,
    underAttack: globalState.isUnderAttack
  });
});

// Get current state
app.get('/api/state', (req, res) => {
  res.json(globalState);
});

// Trigger attack
app.post('/api/attack', (req, res) => {
  const { attackerId = 'api_user', attackType = 'api' } = req.body;
  
  if (!globalState.isUnderAttack) {
    globalState.isUnderAttack = true;
    globalState.attackStartedAt = Date.now();
    globalState.activeAttackers.push(attackerId);
    
    // Add to history
    globalState.attackHistory.push({
      attackerId,
      attackType,
      timestamp: new Date().toISOString(),
      duration: null
    });
    
    // Broadcast to all connected clients
    io.emit('attack_started', {
      attackerId,
      attackType,
      timer: globalState.timer,
      timestamp: new Date().toISOString()
    });
    
    startGlobalTimer();
    
    console.log(`🚨 Global attack triggered by: ${attackerId}`);
  }
  
  res.json({ 
    success: true, 
    message: 'Attack triggered globally',
    state: globalState 
  });
});

// Stop attack
app.post('/api/defend', (req, res) => {
  const { defenderId = 'api_user' } = req.body;
  
  if (globalState.isUnderAttack) {
    globalState.isUnderAttack = false;
    
    // Update last attack in history
    if (globalState.attackHistory.length > 0) {
      const lastAttack = globalState.attackHistory[globalState.attackHistory.length - 1];
      lastAttack.duration = (Date.now() - globalState.attackStartedAt) / 1000;
    }
    
    globalState.activeAttackers = [];
    
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // Broadcast defense
    io.emit('attack_stopped', {
      defenderId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Global defense by: ${defenderId}`);
  }
  
  res.json({ 
    success: true, 
    message: 'Attack stopped globally' 
  });
});

// Reset system
app.post('/api/reset', (req, res) => {
  globalState = {
    isUnderAttack: false,
    timer: 3600,
    attackStartedAt: null,
    totalUsers: globalState.totalUsers,
    activeAttackers: [],
    attackHistory: []
  };
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  io.emit('system_reset');
  
  res.json({ 
    success: true, 
    message: 'System reset globally' 
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  globalState.totalUsers++;
  
  // Send current state to new client
  socket.emit('initial_state', globalState);
  
  // Update all clients about new user
  io.emit('user_count_update', globalState.totalUsers);
  
  // Client wants to trigger attack
  socket.on('client_attack', (data) => {
    if (!globalState.isUnderAttack) {
      globalState.isUnderAttack = true;
      globalState.attackStartedAt = Date.now();
      globalState.activeAttackers.push(data.attackerId);
      
      globalState.attackHistory.push({
        attackerId: data.attackerId,
        attackType: data.attackType || 'manual',
        timestamp: new Date().toISOString(),
        duration: null
      });
      
      io.emit('attack_started', {
        attackerId: data.attackerId,
        attackType: data.attackType || 'manual',
        timer: globalState.timer,
        timestamp: new Date().toISOString()
      });
      
      startGlobalTimer();
    }
  });
  
  // Client wants to defend
  socket.on('client_defend', (data) => {
    if (globalState.isUnderAttack) {
      globalState.isUnderAttack = false;
      
      if (globalState.attackHistory.length > 0) {
        const lastAttack = globalState.attackHistory[globalState.attackHistory.length - 1];
        lastAttack.duration = (Date.now() - globalState.attackStartedAt) / 1000;
      }
      
      globalState.activeAttackers = [];
      
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      io.emit('attack_stopped', {
        defenderId: data.defenderId,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Client wants to reset
  socket.on('client_reset', () => {
    globalState = {
      isUnderAttack: false,
      timer: 3600,
      attackStartedAt: null,
      totalUsers: globalState.totalUsers,
      activeAttackers: [],
      attackHistory: []
    };
    
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    io.emit('system_reset');
  });
  
  // Get state request
  socket.on('get_state', () => {
    socket.emit('initial_state', globalState);
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    globalState.totalUsers--;
    io.emit('user_count_update', globalState.totalUsers);
    console.log('Client disconnected:', socket.id);
  });
});

// Global timer function
function startGlobalTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (globalState.isUnderAttack && globalState.timer > 0) {
      globalState.timer--;
      
      // Broadcast timer update
      io.emit('timer_update', {
        timeLeft: globalState.timer,
        minutes: Math.floor(globalState.timer / 60),
        seconds: globalState.timer % 60
      });
      
      // System compromised when timer reaches 0
      if (globalState.timer <= 0) {
        globalState.isUnderAttack = false;
        io.emit('system_compromised');
        clearInterval(timerInterval);
        console.log('💀 System compromised - Timer reached 0');
      }
    } else {
      clearInterval(timerInterval);
    }
  }, 1000);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Cyber Backend Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 WebSocket ready for real-time communication`);

});
