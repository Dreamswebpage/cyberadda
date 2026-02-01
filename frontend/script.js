// Frontend Configuration
const BACKEND_URLS = {
  production: "https://cyberadda.onrender.com",
  development: "http://localhost:3001"
};

// Current backend URL (auto-detect)
const CURRENT_BACKEND = window.location.hostname === 'localhost' 
  ? BACKEND_URLS.development 
  : BACKEND_URLS.production;

class RealTimeCyberDashboard {
    constructor() {
        this.backendUrl = CURRENT_BACKEND;
        this.socket = null;
        this.userId = this.generateUserId();
        this.isConnected = false;
        this.isUnderAttack = false;
        this.timeLeft = 3600;
        this.localTimer = null;
        
        this.initializeElements();
        this.connectToServer();
        this.setupEventListeners();
        this.startNormalAnimations();
        
        console.log('🔧 Backend URL:', this.backendUrl);
    }
    
    generateUserId() {
        const prefix = 'user_';
        const random = Math.random().toString(36).substr(2, 9);
        return prefix + random;
    }
    
    initializeElements() {
        // Attack elements
        this.attackAlert = document.getElementById('attackAlert');
        this.redLight = document.getElementById('redLight');
        this.timerDisplay = document.getElementById('timer');
        this.statusText = document.getElementById('statusText');
        this.statusDot = document.getElementById('statusDot');
        this.sirenAudio = document.getElementById('sirenAudio');
        
        // Log display
        this.logDisplay = document.getElementById('logDisplay');
        if (!this.logDisplay) {
            console.error('Log display element not found');
        }
        
        // User count
        this.userCountElement = document.getElementById('userCount');
        this.attackerInfo = document.getElementById('attackerInfo');
        
        // Buttons
        this.simulateAttackBtn = document.getElementById('simulateAttack');
        this.stopAttackBtn = document.getElementById('stopAttack');
        this.resetSystemBtn = document.getElementById('resetSystem');
        this.testSirenBtn = document.getElementById('testSiren');
        
        // Global functions for console
        window.simulateCyberAttack = () => this.triggerAttack();
        window.stopCyberAttack = () => this.stopAttack();
        window.resetCyberSystem = () => this.resetSystem();
        window.getDashboard = () => this;
        
        console.log('✅ Elements initialized');
    }
    
    connectToServer() {
        try {
            // Check if socket.io is loaded
            if (typeof io === 'undefined') {
                throw new Error('Socket.io library not loaded');
            }
            
            console.log('🔌 Connecting to:', this.backendUrl);
            
            this.socket = io(this.backendUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            
            // Connection established
            this.socket.on('connect', () => {
                this.isConnected = true;
                console.log('✅ Connected to backend server');
                this.addLogEntry('🟢 Connected to security network');
                
                // Request current state
                this.socket.emit('get_state');
            });
            
            // Connection error
            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error.message);
                this.isConnected = false;
                this.addLogEntry('🔴 Connection failed - Running offline');
            });
            
            // Reconnect
            this.socket.on('reconnect', () => {
                console.log('Reconnected to server');
                this.isConnected = true;
                this.addLogEntry('🔄 Reconnected to network');
                this.socket.emit('get_state');
            });
            
            // Setup event listeners
            this.setupSocketListeners();
            
        } catch (error) {
            console.error('Failed to initialize socket:', error);
            this.addLogEntry('⚠️ Real-time features disabled');
        }
    }
    
    setupSocketListeners() {
        if (!this.socket) return;
        
        // Initial state from server
        this.socket.on('initial_state', (state) => {
            console.log('Received initial state:', state);
            if (state.isUnderAttack) {
                this.showAttackAlert({
                    attackerId: state.activeAttackers[0] || 'Unknown',
                    attackType: 'Ongoing',
                    timer: state.timer
                });
                this.startLocalTimer(state.timer);
                this.addLogEntry('⚠️ Joined during active attack');
            }
        });
        
        // Global attack started
        this.socket.on('attack_started', (data) => {
            console.log('Global attack detected:', data);
            this.showAttackAlert(data);
            this.startLocalTimer(data.timer);
            this.addLogEntry(`🚨 GLOBAL ATTACK by: ${data.attackerId}`);
            this.addLogEntry(`⚡ Type: ${data.attackType}`);
        });
        
        // Global attack stopped
        this.socket.on('attack_stopped', (data) => {
            console.log('Global defense activated:', data);
            this.hideAttackAlert();
            this.stopLocalTimer();
            this.addLogEntry(`✅ DEFENDED by: ${data.defenderId}`);
        });
        
        // Timer updates
        this.socket.on('timer_update', (data) => {
            this.updateTimerDisplay(data.timeLeft);
        });
        
        // User count updates
        this.socket.on('user_count_update', (count) => {
            if (this.userCountElement) {
                this.userCountElement.textContent = count;
            }
        });
        
        // System compromised
        this.socket.on('system_compromised', () => {
            this.systemFailure();
        });
        
        // System reset
        this.socket.on('system_reset', () => {
            this.resetSystemUI();
            this.addLogEntry('🔄 System reset globally');
        });
        
        // Attacker info
        this.socket.on('attacker_update', (attackers) => {
            if (this.attackerInfo && attackers.length > 0) {
                this.attackerInfo.textContent = `Attacker: ${attackers[0]}`;
            }
        });
    }
    
    async triggerAttack() {
        if (this.isConnected && this.socket) {
            try {
                // Send via socket
                this.socket.emit('client_attack', {
                    attackerId: this.userId,
                    attackType: 'manual'
                });
                
                // Also send API request as backup
                const response = await fetch(`${this.backendUrl}/api/attack`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attackerId: this.userId,
                        attackType: 'manual'
                    })
                });
                
                const data = await response.json();
                console.log('Attack API response:', data);
                
            } catch (error) {
                console.warn('Server attack failed, using local mode');
                this.localAttack();
            }
        } else {
            console.warn('Not connected to server, using local mode');
            this.localAttack();
        }
    }
    
    async stopAttack() {
        if (this.isConnected && this.socket) {
            try {
                // Send via socket
                this.socket.emit('client_defend', {
                    defenderId: this.userId
                });
                
                // API backup
                await fetch(`${this.backendUrl}/api/defend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ defenderId: this.userId })
                });
                
            } catch (error) {
                console.warn('Server defense failed, using local mode');
                this.localDefense();
            }
        } else {
            this.localDefense();
        }
    }
    
    localAttack() {
        if (this.isUnderAttack) return;
        
        this.isUnderAttack = true;
        this.showAttackAlert({
            attackerId: this.userId,
            attackType: 'Local',
            timer: 3600
        });
        this.startLocalTimer(3600);
        this.addLogEntry('⚠️ LOCAL attack (offline mode)');
    }
    
    localDefense() {
        this.hideAttackAlert();
        this.stopLocalTimer();
        this.addLogEntry('⚠️ LOCAL defense (offline mode)');
    }
    
    showAttackAlert(data) {
        this.isUnderAttack = true;
        
        // Show overlay
        if (this.attackAlert) {
            this.attackAlert.style.display = 'block';
        }
        
        // Animate red light
        if (this.redLight) {
            this.redLight.style.animation = 'blink 0.3s infinite';
        }
        
        // Update timer
        if (this.timerDisplay) {
            this.updateTimerDisplay(data.timer || 3600);
        }
        
        // Update status
        this.updateStatus('UNDER ATTACK', '#ff0000');
        
        // Play siren
        this.playSiren();
        
        // Update attacker info
        if (this.attackerInfo && data.attackerId) {
            this.attackerInfo.textContent = `Attacker: ${data.attackerId}`;
        }
        
        console.log('Attack alert shown for:', data.attackerId);
    }
    
    hideAttackAlert() {
        this.isUnderAttack = false;
        
        if (this.attackAlert) {
            this.attackAlert.style.display = 'none';
        }
        
        if (this.redLight) {
            this.redLight.style.animation = 'none';
        }
        
        this.stopSiren();
        this.updateStatus('SYSTEM SECURE', '#00ff41');
        
        if (this.attackerInfo) {
            this.attackerInfo.textContent = 'None';
        }
        
        console.log('Attack alert hidden');
    }
    
    startLocalTimer(initialTime) {
        this.stopLocalTimer();
        this.timeLeft = initialTime;
        
        this.localTimer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.updateTimerDisplay(this.timeLeft);
                
                if (this.timeLeft <= 0) {
                    this.systemFailure();
                }
            }
        }, 1000);
    }
    
    stopLocalTimer() {
        if (this.localTimer) {
            clearInterval(this.localTimer);
            this.localTimer = null;
        }
    }
    
    updateTimerDisplay(seconds) {
        if (!this.timerDisplay) return;
        
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    playSiren() {
        if (this.sirenAudio) {
            this.sirenAudio.currentTime = 0;
            this.sirenAudio.play().catch(e => {
                console.log('Siren autoplay blocked, user interaction needed');
                // Enable siren on next user interaction
                document.addEventListener('click', () => {
                    this.sirenAudio.play();
                }, { once: true });
            });
        }
    }
    
    stopSiren() {
        if (this.sirenAudio) {
            this.sirenAudio.pause();
            this.sirenAudio.currentTime = 0;
        }
    }
    
    updateStatus(text, color) {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
        if (this.statusDot) {
            this.statusDot.style.background = color;
            this.statusDot.style.animation = color === '#ff0000' ? 'pulse 0.5s infinite' : 'pulse 2s infinite';
        }
    }
    
    addLogEntry(message) {
        if (!this.logDisplay) {
            console.log('Log:', message);
            return;
        }
        
        const time = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
        
        this.logDisplay.appendChild(logEntry);
        this.logDisplay.scrollTop = this.logDisplay.scrollHeight;
        
        console.log(`[${time}] ${message}`);
    }
    
    systemFailure() {
        this.stopLocalTimer();
        this.updateStatus('SYSTEM FAILURE', '#ff0000');
        this.addLogEntry('💀 SYSTEM COMPROMISED!');
        
        if (this.timerDisplay) {
            this.timerDisplay.textContent = 'FAILED';
            this.timerDisplay.style.color = '#ff0000';
        }
    }
    
    resetSystemUI() {
        this.hideAttackAlert();
        this.stopLocalTimer();
        this.updateStatus('SYSTEM SECURE', '#00ff41');
        
        if (this.timerDisplay) {
            this.timerDisplay.textContent = '60:00';
            this.timerDisplay.style.color = '#ffffff';
        }
        
        // Clear logs but keep first few
        if (this.logDisplay) {
            const time = new Date().toLocaleTimeString();
            this.logDisplay.innerHTML = `
                <div class="log-entry"><span class="time">[${time}]</span> System initialized</div>
                <div class="log-entry"><span class="time">[${time}]</span> Security network active</div>
            `;
        }
        
        console.log('System reset');
    }
    
    resetSystem() {
        this.resetSystemUI();
        if (this.isConnected && this.socket) {
            this.socket.emit('client_reset');
        }
    }
    
    setupEventListeners() {
        // Simulate Attack
        if (this.simulateAttackBtn) {
            this.simulateAttackBtn.addEventListener('click', () => {
                this.triggerAttack();
            });
        }
        
        // Stop Attack
        if (this.stopAttackBtn) {
            this.stopAttackBtn.addEventListener('click', () => {
                this.stopAttack();
            });
        }
        
        // Reset System
        if (this.resetSystemBtn) {
            this.resetSystemBtn.addEventListener('click', () => {
                this.resetSystem();
            });
        }
        
        // Test Siren
        if (this.testSirenBtn) {
            this.testSirenBtn.addEventListener('click', () => {
                this.playSiren();
                setTimeout(() => this.stopSiren(), 3000);
                this.addLogEntry('🔔 Alarm test completed');
            });
        }
        
        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl + A = Attack
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.triggerAttack();
            }
            // Ctrl + D = Defend
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.stopAttack();
            }
            // Ctrl + R = Reset
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.resetSystem();
            }
        });
        
        console.log('✅ Event listeners setup complete');
    }
    
    startNormalAnimations() {
        // Random status updates
        setInterval(() => {
            if (!this.isUnderAttack && Math.random() > 0.7) {
                const messages = [
                    'Security scan completed - No threats',
                    'Firewall rules verified',
                    'Network traffic normal',
                    'System integrity check passed',
                    'Encryption protocols active'
                ];
                this.addLogEntry(messages[Math.floor(Math.random() * messages.length)]);
            }
        }, 20000);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.cyberDashboard = new RealTimeCyberDashboard();
    console.log('🚀 Cyber Dashboard initialized');
});