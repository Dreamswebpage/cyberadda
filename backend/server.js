const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins (change in production)
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store global attack state
let globalState = {
  isUnderAttack: false,
  timer: 3600, // 60 minutes in seconds
  attackStartedAt: null,
  totalUsers: 0,
  activeAttackers: []
};

// API endpoint to trigger attack
app.post('/api/attack', (req, res) => {
  const { attackerId, attackType = 'manual' } = req.body;
  
  if (!globalState.isUnderAttack) {
    globalState.isUnderAttack = true;
    globalState.attackStartedAt = Date.now();
    globalState.activeAttackers.push(attackerId);
    
    // Broadcast to ALL connected clients
    io.emit('attack_started', {
      attackerId,
      attackType,
      timer: globalState.timer,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🚨 Attack started by: ${attackerId}`);
    
    // Start countdown
    startGlobalTimer();
  }
  
  res.json({
    success: true,
    message: 'Attack triggered globally',
    state: globalState
  });
});

// API endpoint to stop attack
app.post('/api/defend', (req, res) => {
  const { defenderId } = req.body;
  
  globalState.isUnderAttack = false;
  globalState.attackStartedAt = null;
  globalState.activeAttackers = [];
  
  // Broadcast defense to ALL clients
  io.emit('attack_stopped', {
    defenderId,
    timestamp: new Date().toISOString()
  });
  
  console.log(`✅ Attack stopped by: ${defenderId}`);
  
  res.json({
    success: true,
    message: 'Attack stopped globally'
  });
});

// Get current state
app.get('/api/state', (req, res) => {
  res.json(globalState);
});

// Reset everything
app.post('/api/reset', (req, res) => {
  globalState = {
    isUnderAttack: false,
    timer: 3600,
    attackStartedAt: null,
    totalUsers: 0,
    activeAttackers: []
  };
  
  io.emit('system_reset');
  res.json({ success: true, message: 'System reset globally' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  globalState.totalUsers++;
  
  // Send current state to new user
  socket.emit('initial_state', globalState);
  
  // Update all users about new connection
  io.emit('user_count_update', globalState.totalUsers);
  
  // User triggered attack
  socket.on('user_attack', (data) => {
    console.log(`User ${socket.id} triggered attack:`, data);
    // This will be handled by API call
  });
  
  // User defended
  socket.on('user_defend', (data) => {
    console.log(`User ${socket.id} defended:`, data);
  });
  
  // User disconnected
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    globalState.totalUsers--;
    io.emit('user_count_update', globalState.totalUsers);
  });
});

// Global countdown timer
function startGlobalTimer() {
  if (globalState.isUnderAttack) {
    const timerInterval = setInterval(() => {
      if (globalState.isUnderAttack && globalState.timer > 0) {
        globalState.timer--;
        
        // Broadcast timer update to ALL clients
        io.emit('timer_update', {
          timeLeft: globalState.timer,
          minutes: Math.floor(globalState.timer / 60),
          seconds: globalState.timer % 60
        });
        
        // Auto-stop when timer reaches 0
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
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`🌐 Real-time attack synchronization ready`);
});