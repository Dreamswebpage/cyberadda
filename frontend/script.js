class RealTimeCyberDashboard {
    constructor() {
        this.backendUrl = 'https://your-backend.herokuapp.com'; // Change this
        this.socket = null;
        this.userId = this.generateUserId();
        
        this.initializeElements();
        this.connectToServer();
        this.setupEventListeners();
    }
    
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }
    
    initializeElements() {
        // All previous elements
        this.attackAlert = document.getElementById('attackAlert');
        this.redLight = document.getElementById('redLight');
        this.timerDisplay = document.getElementById('timer');
        this.statusText = document.getElementById('statusText');
        this.statusDot = document.getElementById('statusDot');
        
        // New elements for real-time
        this.userCountElement = document.getElementById('userCount');
        this.attackerListElement = document.getElementById('attackerList');
        
        // Buttons
        this.simulateAttackBtn = document.getElementById('simulateAttack');
        this.stopAttackBtn = document.getElementById('stopAttack');
        this.resetSystemBtn = document.getElementById('resetSystem');
    }
    
    async connectToServer() {
        try {
            // Connect to Socket.io server
            this.socket = io(this.backendUrl);
            
            this.socket.on('connect', () => {
                console.log('Connected to real-time server:', this.socket.id);
                this.addLogEntry('🟢 Connected to security network');
            });
            
            // Listen for global attack start
            this.socket.on('attack_started', (data) => {
                console.log('Global attack detected!', data);
                this.showAttackAlert(data);
                this.startLocalTimer(data.timer);
                this.addLogEntry(`🚨 GLOBAL ATTACK by: ${data.attackerId}`);
                this.addLogEntry(`⚡ Attack type: ${data.attackType}`);
            });
            
            // Listen for global attack stop
            this.socket.on('attack_stopped', (data) => {
                console.log('Global defense activated!', data);
                this.hideAttackAlert();
                this.stopLocalTimer();
                this.addLogEntry(`✅ GLOBAL DEFENSE by: ${data.defenderId}`);
            });
            
            // Listen for timer updates
            this.socket.on('timer_update', (data) => {
                this.updateTimerDisplay(data.timeLeft);
            });
            
            // Listen for initial state
            this.socket.on('initial_state', (state) => {
                console.log('Initial state received:', state);
                if (state.isUnderAttack) {
                    this.showAttackAlert({
                        attackerId: 'System',
                        attackType: 'Ongoing',
                        timer: state.timer
                    });
                    this.startLocalTimer(state.timer);
                }
            });
            
            // User count updates
            this.socket.on('user_count_update', (count) => {
                if (this.userCountElement) {
                    this.userCountElement.textContent = count;
                }
                this.addLogEntry(`👥 Total users online: ${count}`);
            });
            
            // System compromised
            this.socket.on('system_compromised', () => {
                this.systemFailure();
            });
            
            // System reset
            this.socket.on('system_reset', () => {
                this.resetSystem();
            });
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.addLogEntry('🔴 Disconnected from security network');
            this.addLogEntry('⚠️ Running in local mode only');
        }
    }
    
    async triggerAttack() {
        try {
            const response = await fetch(`${this.backendUrl}/api/attack`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    attackerId: this.userId,
                    attackType: 'manual'
                })
            });
            
            const data = await response.json();
            console.log('Attack response:', data);
            
            // The actual UI update will happen via socket event
            // So all users see it simultaneously
            
        } catch (error) {
            console.error('Attack failed:', error);
            // Fallback to local attack
            this.localAttack();
        }
    }
    
    async stopAttack() {
        try {
            const response = await fetch(`${this.backendUrl}/api/defend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    defenderId: this.userId
                })
            });
            
            // UI will update via socket event
            
        } catch (error) {
            console.error('Defense failed:', error);
            this.localDefense();
        }
    }
    
    async resetSystem() {
        try {
            await fetch(`${this.backendUrl}/api/reset`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Reset failed:', error);
        }
        
        // Local reset
        this.hideAttackAlert();
        this.stopLocalTimer();
        this.updateStatus('SYSTEM SECURE', '#00ff41');
        this.addLogEntry('🔄 System reset complete');
    }
    
    showAttackAlert(data) {
        this.attackAlert.style.display = 'block';
        this.redLight.style.animation = 'blink 0.3s infinite';
        this.playSiren();
        this.updateStatus('UNDER ATTACK', '#ff0000');
        
        // Show attacker info
        const attackerInfo = document.getElementById('attackerInfo');
        if (attackerInfo) {
            attackerInfo.textContent = `Attacker: ${data.attackerId}`;
        }
    }
    
    hideAttackAlert() {
        this.attackAlert.style.display = 'none';
        this.redLight.style.animation = 'none';
        this.sirenAudio.pause();
        this.sirenAudio.currentTime = 0;
        this.updateStatus('SYSTEM SECURE', '#00ff41');
    }
    
    startLocalTimer(initialTime) {
        clearInterval(this.localTimer);
        this.timeLeft = initialTime;
        
        this.localTimer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.updateTimerDisplay(this.timeLeft);
            }
        }, 1000);
    }
    
    stopLocalTimer() {
        clearInterval(this.localTimer);
    }
    
    updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ... [Previous methods: playSiren, updateStatus, addLogEntry, etc.]
    
    setupEventListeners() {
        this.simulateAttackBtn.addEventListener('click', () => {
            this.triggerAttack();
        });
        
        this.stopAttackBtn.addEventListener('click', () => {
            this.stopAttack();
        });
        
        this.resetSystemBtn.addEventListener('click', () => {
            this.resetSystem();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.triggerAttack();
            }
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.stopAttack();
            }
        });
    }
    
    // Fallback methods if server is down
    localAttack() {
        this.showAttackAlert({ attackerId: this.userId, attackType: 'local' });
        this.startLocalTimer(3600);
        this.addLogEntry('⚠️ Local attack (server offline)');
    }
    
    localDefense() {
        this.hideAttackAlert();
        this.stopLocalTimer();
        this.addLogEntry('⚠️ Local defense (server offline)');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new RealTimeCyberDashboard();
});