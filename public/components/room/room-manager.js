/**
 * Room Manager
 * Handles room creation, joining, and basic room management functionality
 */

class RoomManager {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.roomCode = '';
        this.sessionId = null;
        this.gameManager = null; // Will be set by main script
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.disconnectTimers = {}; // Track disconnection timers for players
        this.disconnectCountdowns = {}; // Track current countdown values for each player
        
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

    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected', 'Connected');
            
            // Load persisted room data
            const savedRoomCode = localStorage.getItem('checkers_room_code');
            const savedPlayerName = localStorage.getItem('checkers_player_name');
            
            // If we have saved room data, try to rejoin automatically
            // The server will validate if we can rejoin or if we were removed
            if (savedRoomCode && savedPlayerName) {
                console.log('Attempting to rejoin room:', savedRoomCode);
                this.roomCode = savedRoomCode;
                this.playerName = savedPlayerName;
                // Don't call joinRoomWithCode here to avoid re-saving to localStorage
                // Just emit the join event
                this.socket.emit('join-room', { 
                    roomCode: savedRoomCode, 
                    playerName: savedPlayerName, 
                    sessionId: this.sessionId 
                });
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server. Reason:', reason);
            this.updateConnectionStatus('disconnected', 'Disconnected');
            Utils.showToast('Connection lost. Attempting to reconnect...', 'error');
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            this.reconnectAttempts = attemptNumber;
            this.updateConnectionStatus('reconnecting', `Reconnecting... (${attemptNumber}/${this.maxReconnectAttempts})`);
            console.log(`Reconnection attempt ${attemptNumber}`);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected after ${attemptNumber} attempts`);
            this.updateConnectionStatus('connected', 'Reconnected');
            Utils.showToast('Reconnected successfully!', 'success');
        });

        this.socket.on('reconnect_failed', () => {
            console.log('Reconnection failed');
            this.updateConnectionStatus('disconnected', 'Connection Failed');
            Utils.showToast('Unable to reconnect. Please refresh the page.', 'error');
        });

        this.socket.on('connect_error', () => {
            console.log('Connection error');
            this.updateConnectionStatus('disconnected', 'Connection Error');
        });
        
        // Handle server request to clear session data
        this.socket.on('clear-session-data', () => {
            console.log('Clearing session data as requested by server');
            localStorage.removeItem('checkers_room_code');
            localStorage.removeItem('checkers_player_name');
            this.roomCode = '';
            this.playerName = '';
            this.showRoomSelection();
        });

        // Room-specific events
        this.socket.on('player-joined', (data) => this.handlePlayerJoined(data));
        this.socket.on('player-left', (data) => this.handlePlayerLeft(data));
        this.socket.on('player-disconnected', (data) => this.handlePlayerDisconnected(data));
        this.socket.on('player-reconnected', (data) => this.handlePlayerReconnected(data));
        this.socket.on('player-removed', (data) => this.handlePlayerRemoved(data));
        this.socket.on('session-removed', (data) => this.handleSessionRemoved(data));
        this.socket.on('reconnected', (data) => this.handleReconnected(data));
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
            Utils.showToast('Please enter your name', 'error');
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
            Utils.showToast('Error creating room. Please try again.', 'error');
        }
    }

    joinRoom() {
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        const playerName = this.playerNameInput.value.trim();
        
        if (!playerName) {
            Utils.showToast('Please enter your name', 'error');
            return;
        }
        
        if (!roomCode) {
            Utils.showToast('Please enter room code', 'error');
            return;
        }

        this.joinRoomWithCode(roomCode, playerName);
    }

    joinRoomWithCode(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode;
        
        // Persist room data for auto-reconnection
        localStorage.setItem('checkers_room_code', roomCode);
        localStorage.setItem('checkers_player_name', playerName);
        
        this.socket.emit('join-room', { roomCode, playerName, sessionId: this.sessionId });
    }

    leaveRoom() {
        if (confirm('Are you sure you want to leave the room?')) {
            // Clear persisted room data
            localStorage.removeItem('checkers_room_code');
            localStorage.removeItem('checkers_player_name');
            
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
        Utils.copyToClipboard(this.roomCode).then(success => {
            if (success) {
                Utils.showToast('Room code copied to clipboard!', 'success');
            } else {
                Utils.showToast('Could not copy room code', 'error');
            }
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
        Utils.showToast(`Player joined the room`, 'info');
        this.showGameContainer();
    }

    handlePlayerLeft(data) {
        console.log('Player left:', data);
        if (this.gameManager) {
            this.gameManager.updateGameState(data.gameState);
        }
        Utils.showToast('Player left the room', 'info');
    }

    handlePlayerDisconnected(data) {
        console.log('Player disconnected:', data);
        
        // Clear any existing timer for this player
        if (this.disconnectTimers[data.sessionId]) {
            clearInterval(this.disconnectTimers[data.sessionId]);
        }
        
        // Start countdown timer
        const gracePeriodSeconds = Math.floor(data.gracePeriod / 1000);
        let remainingSeconds = gracePeriodSeconds;
        
        // Store countdown state BEFORE updating game state
        this.disconnectCountdowns[data.sessionId] = remainingSeconds;
        
        // Update game state (this will now have access to countdown state)
        if (this.gameManager) {
            this.gameManager.updateGameState(data.gameState);
        }
        
        // Show initial message
        Utils.showToast(`${data.playerName} disconnected. Waiting ${remainingSeconds}s for reconnection...`, 'warning');
        
        // Update countdown every second
        this.disconnectTimers[data.sessionId] = setInterval(() => {
            remainingSeconds--;
            this.disconnectCountdowns[data.sessionId] = remainingSeconds;
            
            if (remainingSeconds > 0) {
                // Update player name display with countdown
                if (this.gameManager) {
                    this.gameManager.updatePlayerNames();
                }
            } else {
                clearInterval(this.disconnectTimers[data.sessionId]);
                delete this.disconnectTimers[data.sessionId];
                delete this.disconnectCountdowns[data.sessionId];
            }
        }, 1000);
    }

    handlePlayerReconnected(data) {
        console.log('Player reconnected:', data);
        
        // Find which player reconnected (not disconnected anymore)
        // Only clear timer for players who are no longer disconnected
        const sessionIds = Object.keys(data.players);
        for (const sessionId of sessionIds) {
            const player = data.players[sessionId];
            // If this player has a timer BUT is no longer disconnected, clear it
            if (this.disconnectTimers[sessionId] && !player.disconnected) {
                clearInterval(this.disconnectTimers[sessionId]);
                delete this.disconnectTimers[sessionId];
                delete this.disconnectCountdowns[sessionId];
            }
        }
        
        if (this.gameManager) {
            this.gameManager.updateGameState(data.gameState);
            // Explicitly update player names to refresh countdown display
            this.gameManager.updatePlayerNames();
        }
        
        Utils.showToast('Opponent reconnected!', 'success');
    }

    handlePlayerRemoved(data) {
        console.log('Player removed after timeout:', data);
        
        // Clear timer if exists
        if (this.disconnectTimers[data.sessionId]) {
            clearInterval(this.disconnectTimers[data.sessionId]);
            delete this.disconnectTimers[data.sessionId];
            delete this.disconnectCountdowns[data.sessionId];
        }
        
        // If the removed player is us, clear our room data
        if (data.sessionId === this.sessionId) {
            localStorage.removeItem('checkers_room_code');
            localStorage.removeItem('checkers_player_name');
            this.roomCode = '';
            this.playerName = '';
            this.showRoomSelection();
            Utils.showToast('You were removed from the room due to disconnection. Please rejoin.', 'warning');
        } else {
            if (this.gameManager) {
                this.gameManager.updateGameState(data.gameState);
            }
            Utils.showToast(`${data.playerName} was removed due to disconnection timeout`, 'info');
        }
    }

    handleSessionRemoved(data) {
        console.log('Session removed:', data);
        
        // If this is our session, clear localStorage
        if (data.sessionId === this.sessionId) {
            localStorage.removeItem('checkers_room_code');
            localStorage.removeItem('checkers_player_name');
            this.roomCode = '';
            this.playerName = '';
        }
    }

    handleReconnected(data) {
        console.log('Successfully reconnected to game:', data);
        
        if (this.gameManager) {
            this.gameManager.updateGameState(data.gameState);
            this.gameManager.setSessionId(data.sessionId);
        }
        
        // Re-initialize countdown timers for any players who are still disconnected
        if (data.disconnectedPlayers) {
            for (const disconnectedPlayer of data.disconnectedPlayers) {
                const { sessionId, remainingSeconds } = disconnectedPlayer;
                
                // Initialize countdown state
                this.disconnectCountdowns[sessionId] = remainingSeconds;
                
                // Start countdown interval
                if (this.disconnectTimers[sessionId]) {
                    clearInterval(this.disconnectTimers[sessionId]);
                }
                
                this.disconnectTimers[sessionId] = setInterval(() => {
                    if (this.disconnectCountdowns[sessionId] !== undefined) {
                        this.disconnectCountdowns[sessionId]--;
                        
                        if (this.gameManager) {
                            this.gameManager.updatePlayerNames();
                        }
                        
                        if (this.disconnectCountdowns[sessionId] <= 0) {
                            clearInterval(this.disconnectTimers[sessionId]);
                            delete this.disconnectTimers[sessionId];
                            delete this.disconnectCountdowns[sessionId];
                        }
                    }
                }, 1000);
            }
            
            // Update display to show countdown
            if (this.gameManager) {
                this.gameManager.updatePlayerNames();
            }
        }
        
        // Ensure we're showing the game container
        this.showGameContainer();
        
        Utils.showToast(data.message, 'success');
    }

    handleError(data) {
        console.log('Error:', data);
        
        // If we get specific errors, clear the room data so we don't auto-rejoin
        if (data.message === 'Room not found' || 
            data.message === 'Room is full' ||
            data.message === 'You are already in this room' ||
            data.message.includes('removed')) {
            localStorage.removeItem('checkers_room_code');
            localStorage.removeItem('checkers_player_name');
            this.roomCode = '';
            this.playerName = '';
            
            // Make sure we show the room selection page
            if (!this.roomSelection.classList.contains('hidden')) {
                // Already showing, just display error
            } else {
                this.showRoomSelection();
            }
        }
        
        Utils.showToast(data.message, 'error');
    }

    updateRoomCode(roomCode) {
        this.roomCode = roomCode;
        this.currentRoomCode.textContent = roomCode;
    }
    
    getDisconnectCountdowns() {
        return this.disconnectCountdowns;
    }
}
