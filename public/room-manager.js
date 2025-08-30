/**
 * Room Manager
 * Handles room creation, joining, and basic room management functionality
 */

class RoomManager {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.roomCode = '';
        this.gameManager = null; // Will be set by main script
        
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Room selection elements
        this.roomSelection = document.getElementById('room-selection');
        this.gameContainer = document.getElementById('game-container');
        this.playerNameInput = document.getElementById('player-name');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.createRoomBtn = document.getElementById('create-room');
        this.joinRoomBtn = document.getElementById('join-room');
        this.leaveRoomBtn = document.getElementById('leave-room');
        this.copyRoomCodeBtn = document.getElementById('copy-room-code');
        
        // Status elements
        this.currentRoomCode = document.getElementById('current-room-code');
        this.toastContainer = document.getElementById('toast-container');
        this.connectionStatus = document.getElementById('connection-status');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
    }

    attachEventListeners() {
        // Room management
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        this.copyRoomCodeBtn.addEventListener('click', () => this.copyRoomCode());
        
        // Enter key support
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });
        
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Input formatting
        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    setSocket(socket) {
        this.socket = socket;
        this.setupSocketListeners();
    }

    setGameManager(gameManager) {
        this.gameManager = gameManager;
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus('connected', 'Connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.showMessage('Connection lost. Attempting to reconnect...', 'error');
        });

        this.socket.on('connect_error', () => {
            console.log('Connection error');
            this.updateConnectionStatus('disconnected', 'Connection Error');
        });

        // Room-specific events
        this.socket.on('player-joined', (data) => this.handlePlayerJoined(data));
        this.socket.on('player-left', (data) => this.handlePlayerLeft(data));
        this.socket.on('error', (data) => this.handleError(data));

        this.updateConnectionStatus('connecting', 'Connecting...');
    }

    updateConnectionStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    async createRoom() {
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            this.showMessage('Please enter your name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/create-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            if (data.roomCode) {
                this.joinRoomWithCode(data.roomCode, playerName);
            }
        } catch (error) {
            console.error('Error creating room:', error);
            this.showMessage('Error creating room. Please try again.', 'error');
        }
    }

    joinRoom() {
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        const playerName = this.playerNameInput.value.trim();
        
        if (!playerName) {
            this.showMessage('Please enter your name', 'error');
            return;
        }
        
        if (!roomCode) {
            this.showMessage('Please enter room code', 'error');
            return;
        }

        this.joinRoomWithCode(roomCode, playerName);
    }

    joinRoomWithCode(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode;
        this.socket.emit('join-room', { roomCode, playerName });
    }

    leaveRoom() {
        if (confirm('Are you sure you want to leave the room?')) {
            this.socket.disconnect();
            this.socket.connect();
            this.showRoomSelection();
            this.clearRoomState();
            if (this.gameManager) {
                this.gameManager.clearGameState();
            }
        }
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
            this.showMessage('Room code copied to clipboard!', 'success');
        }).catch(() => {
            this.showMessage('Could not copy room code', 'error');
        });
    }

    showRoomSelection() {
        this.roomSelection.classList.remove('hidden');
        this.gameContainer.classList.add('hidden');
        this.playerNameInput.value = '';
        this.roomCodeInput.value = '';
    }

    showGameContainer() {
        this.roomSelection.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');
    }

    clearRoomState() {
        this.roomCode = '';
        this.currentRoomCode.textContent = '-';
    }

    // Socket event handlers
    handlePlayerJoined(data) {
        console.log('Player joined:', data);
        if (this.gameManager) {
            this.gameManager.updateGameState(data.gameState);
        }
        this.showMessage(`Player joined the room`, 'info');
        this.showGameContainer();
    }

    handlePlayerLeft(data) {
        console.log('Player left:', data);
        if (this.gameManager) {
            this.gameManager.updateGameState(data.gameState);
        }
        this.showMessage('Player left the room', 'info');
    }

    handleError(data) {
        console.log('Error:', data);
        this.showMessage(data.message, 'error');
    }

    updateRoomCode(roomCode) {
        this.roomCode = roomCode;
        this.currentRoomCode.textContent = roomCode;
    }

    // UI helper methods
    showMessage(message, type = 'info') {
        // Create toast element
        const toastElement = document.createElement('div');
        toastElement.className = `toast toast-${type}`;
        toastElement.textContent = message;
        
        // Add to toast container
        this.toastContainer.appendChild(toastElement);
        
        // Trigger animation by adding show class after a brief delay
        setTimeout(() => {
            toastElement.classList.add('toast-show');
        }, 10);
        
        // Auto-remove toast after duration based on message length
        const duration = Math.max(3000, message.length * 50); // Min 3 seconds, +50ms per character
        const maxDuration = 8000; // Max 8 seconds
        const finalDuration = Math.min(duration, maxDuration);
        
        setTimeout(() => {
            toastElement.classList.add('toast-hide');
            
            // Remove from DOM after hide animation
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.parentNode.removeChild(toastElement);
                }
            }, 300);
        }, finalDuration);
    }
}
