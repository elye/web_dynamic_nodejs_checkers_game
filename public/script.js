/**
 * Online Checkers Game Client
 * Handles UI interactions, WebSocket communication, and game state management
 */

class CheckersClient {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.selectedPiece = null;
        this.possibleMoves = [];
        this.playerColor = null;
        this.playerName = '';
        this.roomCode = '';
        this.isMyTurn = false;
        this.hasRequestedNewGame = false; // Track if current player has requested new game
        this.hasShownNonSelectorMessage = false; // Track if we've shown the non-selector message
        
        this.initializeElements();
        this.attachEventListeners();
        this.connectSocket();
    }

    initializeElements() {
        // Room selection elements
        this.roomSelection = document.getElementById('room-selection');
        this.gameContainer = document.getElementById('game-container');
        this.playerNameInput = document.getElementById('player-name');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.createRoomBtn = document.getElementById('create-room');
        this.joinRoomBtn = document.getElementById('join-room');

        // Game elements
        this.gameBoard = document.getElementById('game-board');
        this.currentRoomCode = document.getElementById('current-room-code');
        this.turnDisplay = document.getElementById('turn-display');
        this.redPlayerName = document.getElementById('red-player-name');
        this.blackPlayerName = document.getElementById('black-player-name');
        
        // Control elements
        this.resetGameBtn = document.getElementById('reset-game');
        this.leaveRoomBtn = document.getElementById('leave-room');
        this.copyRoomCodeBtn = document.getElementById('copy-room-code');
        
        // Status and messages
        this.gameMessages = document.getElementById('game-messages');
        this.toastContainer = document.getElementById('toast-container');
        this.connectionStatus = document.getElementById('connection-status');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        
        // Modal elements
        this.gameOverModal = document.getElementById('game-over-modal');
        this.modalContent = document.getElementById('modal-content');
        this.gameOverTitle = document.getElementById('game-over-title');
        this.gameOverMessage = document.getElementById('game-over-message');
        this.consolationMessage = document.getElementById('consolation-message');
        this.playAgainBtn = document.getElementById('play-again');
        this.closeModalBtn = document.getElementById('close-modal');
        
        // Turn Order Modal elements
        this.turnOrderModal = document.getElementById('turn-order-modal');
        this.playerStartsFirstBtn = document.getElementById('player-starts-first');
        this.opponentStartsFirstBtn = document.getElementById('opponent-starts-first');
        
        // Confetti container
        this.confettiContainer = document.getElementById('confetti-container');
    }

    attachEventListeners() {
        // Room management
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        this.copyRoomCodeBtn.addEventListener('click', () => this.copyRoomCode());
        
        // Game controls
        this.resetGameBtn.addEventListener('click', () => this.resetGame());
        
        // Modal controls
        this.playAgainBtn.addEventListener('click', () => this.playAgain());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        
        // Turn Order Modal controls
        this.playerStartsFirstBtn.addEventListener('click', () => this.selectTurnOrder('self'));
        this.opponentStartsFirstBtn.addEventListener('click', () => this.selectTurnOrder('opponent'));
        
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

        // Prevent context menu on game board
        this.gameBoard.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    connectSocket() {
        this.socket = io();
        
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

        // Game event listeners
        this.socket.on('player-joined', (data) => this.handlePlayerJoined(data));
        this.socket.on('player-left', (data) => this.handlePlayerLeft(data));
        this.socket.on('game-state', (data) => this.handleGameState(data));
        this.socket.on('move-made', (data) => this.handleMoveMade(data));
        this.socket.on('move-error', (data) => this.handleMoveError(data));
        this.socket.on('game-over', (data) => this.handleGameOver(data));
        this.socket.on('game-reset', (data) => this.handleGameReset(data));
        this.socket.on('new-game-requested', (data) => this.handleNewGameRequested(data));
        this.socket.on('new-game-request-cancelled', (data) => this.handleNewGameRequestCancelled(data));
        this.socket.on('show-turn-order-selection', (data) => this.handleShowTurnOrderSelection(data));
        this.socket.on('turn-order-selected', (data) => this.handleTurnOrderSelected(data));
        this.socket.on('possible-moves', (data) => this.handlePossibleMoves(data));
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
            this.clearGameState();
        }
    }

    resetGame() {
        const playerCount = Object.keys(this.gameState?.players || {}).length;
        
        if (playerCount < 2) {
            // Single player or no other player, allow immediate reset
            if (confirm('Are you sure you want to start a new game?')) {
                this.socket.emit('request-new-game');
            }
            return;
        }

        // Two players - need agreement
        if (this.hasRequestedNewGame) {
            // User wants to cancel their request
            if (confirm('Cancel your new game request?')) {
                this.socket.emit('cancel-new-game-request');
            }
        } else {
            // User wants to request new game
            if (confirm('Request a new game? The other player must also agree.')) {
                this.socket.emit('request-new-game');
            }
        }
    }

    playAgain() {
        this.closeModal();
        
        // Use the same logic as resetGame for consistency
        const playerCount = Object.keys(this.gameState?.players || {}).length;
        
        if (playerCount < 2) {
            // Single player - immediate reset
            this.socket.emit('request-new-game');
        } else {
            // Two players - show confirmation and request
            if (confirm('Request a new game? The other player must also agree.')) {
                this.socket.emit('request-new-game');
            }
        }
    }

    closeModal() {
        this.gameOverModal.classList.add('hidden');
        // Also hide confetti when closing modal
        this.confettiContainer.classList.add('hidden');
        this.confettiContainer.innerHTML = '';
    }

    closeTurnOrderModal() {
        this.turnOrderModal.classList.add('hidden');
    }

    selectTurnOrder(choice) {
        // Send turn order choice to server (server will validate if player can choose)
        console.log('Player selected turn order:', choice);
        this.socket.emit('select-turn-order', { choice });
        this.closeTurnOrderModal();
        
        const message = choice === 'self' ? 'You chose to start first!' : 'You let your opponent start first!';
        this.showMessage(message, 'info');
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

    clearGameState() {
        this.gameState = null;
        this.selectedPiece = null;
        this.possibleMoves = [];
        this.playerColor = null;
        this.roomCode = '';
        this.hasRequestedNewGame = false;
        this.hasShownNonSelectorMessage = false;
        this.currentRoomCode.textContent = '-';
        this.clearBoard();
        this.clearMessages();
        // Clear confetti when clearing game state
        this.confettiContainer.classList.add('hidden');
        this.confettiContainer.innerHTML = '';
    }

    // Socket event handlers
    handlePlayerJoined(data) {
        console.log('Player joined:', data);
        this.updateGameState(data.gameState);
        this.showMessage(`Player joined the room`, 'info');
        this.showGameContainer();
    }

    handlePlayerLeft(data) {
        console.log('Player left:', data);
        this.updateGameState(data.gameState);
        this.showMessage('Player left the room', 'info');
    }

    handleGameState(data) {
        console.log('Game state received:', data);
        this.updateGameState(data);
        this.showGameContainer();
    }

    handleMoveMade(data) {
        console.log('Move made:', data);
        this.updateGameState(data.gameState);
        this.clearSelection();
        
        if (data.capturedPiece) {
            this.showMessage('Piece captured!', 'info');
        }
        
        if (data.promoted) {
            this.showMessage('Piece promoted to king!', 'success');
        }
        
        // Auto-select piece for continued capturing
        if (this.gameState.mustCapture && this.gameState.capturingPiece && this.isMyTurn) {
            this.autoSelectCapturingPiece();
        }
    }

    handleMoveError(data) {
        console.log('Move error:', data);
        this.showMessage(data.message, 'error');
    }

    handleGameOver(data) {
        console.log('Game over:', data);
        this.updateGameState(data.gameState);
        
        const winner = data.winner;
        const isWinner = this.playerColor === winner;
        
        // Reset modal classes
        this.modalContent.className = 'modal-content';
        this.gameOverTitle.className = '';
        this.consolationMessage.classList.add('hidden');
        
        if (isWinner) {
            // Winner styling and confetti
            this.modalContent.classList.add('winner');
            this.gameOverTitle.className = 'winner-title';
            this.gameOverTitle.textContent = '🎉 Congratulations! You Win! 🎉';
            this.gameOverMessage.textContent = `Amazing victory! ${winner.charAt(0).toUpperCase() + winner.slice(1)} player conquers the board!`;
            
            // Trigger confetti animation
            this.createConfetti();
            
            // Show winner message
            this.showMessage('🏆 Victory! You are the Checkers Champion! 🏆', 'success');
        } else {
            // Loser styling and consolation
            this.modalContent.classList.add('loser');
            this.gameOverTitle.className = 'loser-title';
            this.gameOverTitle.textContent = 'Game Over - Keep Fighting!';
            this.gameOverMessage.textContent = `${winner.charAt(0).toUpperCase() + winner.slice(1)} player wins this round.`;
            
            // Show consolation message
            const consolationMessages = [
                "Never give up! Every master was once a beginner. 💪",
                "Champions are made in defeat. Come back stronger! 🚀",
                "This is just practice for your future victory! ⭐",
                "Every loss is a lesson in disguise. You've got this! 🎯",
                "The best players lose games but win hearts. Keep playing! ❤️",
                "Failure is the stepping stone to success. Try again! 🌟",
                "Great players aren't made in comfort zones. Keep pushing! 🔥",
                "Today's defeat is tomorrow's comeback story! 📈",
                "Every grandmaster has lost thousands of games. Your turn to learn! 🧠",
                "The only real failure is giving up. Keep fighting! ⚔️",
                "Resilience is your superpower. Use it wisely! ⚡",
                "This game ends, but your journey has just begun! 🌟"
            ];
            
            const randomMessage = consolationMessages[Math.floor(Math.random() * consolationMessages.length)];
            this.consolationMessage.textContent = randomMessage;
            this.consolationMessage.classList.remove('hidden');
            
            // Show encouraging message
            this.showMessage('💪 Don\'t give up! Every game makes you stronger!', 'info');
        }
        
        this.gameOverModal.classList.remove('hidden');
        this.showMessage(`Game Over! ${winner} player wins!`, isWinner ? 'success' : 'info');
    }

    createConfetti() {
        // Clear any existing confetti
        this.confettiContainer.innerHTML = '';
        this.confettiContainer.classList.remove('hidden');
        
        // Create multiple waves of confetti
        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                this.createConfettiWave();
            }, wave * 500);
        }
        
        // Hide confetti container after animation completes
        setTimeout(() => {
            this.confettiContainer.classList.add('hidden');
            this.confettiContainer.innerHTML = '';
        }, 4000);
    }

    createConfettiWave() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'];
        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            
            // Random positioning and timing
            const startX = Math.random() * window.innerWidth;
            const animationDuration = 3 + Math.random() * 2; // 3-5 seconds
            const delay = Math.random() * 1000; // 0-1 second delay
            
            confetti.style.left = startX + 'px';
            confetti.style.animationDuration = animationDuration + 's';
            confetti.style.animationDelay = delay + 'ms';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            // Random size and shape variation
            const size = 8 + Math.random() * 6; // 8-14px
            confetti.style.width = size + 'px';
            confetti.style.height = size + 'px';
            
            // Add random rotation for more dynamic effect
            const rotation = Math.random() * 360;
            confetti.style.transform = `rotate(${rotation}deg)`;
            
            // Add random border-radius for shape variety
            if (Math.random() > 0.5) {
                confetti.style.borderRadius = '50%';
            } else {
                confetti.style.borderRadius = `${Math.random() * 50}%`;
            }
            
            this.confettiContainer.appendChild(confetti);
            
            // Remove confetti piece after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, (animationDuration + 1) * 1000 + delay);
        }
    }

    handleGameReset(data) {
        console.log('Game reset:', data);
        this.updateGameState(data.gameState);
        this.clearSelection();
        this.closeModal();
        this.hasRequestedNewGame = false;
        this.updateNewGameButton();
        this.showMessage(data.message || 'New game started!', 'success');
    }

    handleNewGameRequested(data) {
        console.log('New game requested:', data);
        this.updateGameState(data.gameState);
        
        // Update our tracking of who has requested
        this.updateNewGameRequestStatus();
        this.updateNewGameButton();
        
        if (this.hasRequestedNewGame) {
            this.showMessage(`Waiting for other player to agree to new game...`, 'info');
        } else {
            this.showMessage(`${data.requesterName} wants to start a new game. Click "New Game" to agree!`, 'info');
        }
    }

    handleNewGameRequestCancelled(data) {
        console.log('New game request cancelled:', data);
        this.updateGameState(data.gameState);
        
        // Update our tracking
        this.updateNewGameRequestStatus();
        this.updateNewGameButton();
        
        this.showMessage(`${data.requesterName} cancelled their new game request.`, 'info');
    }

    handleShowTurnOrderSelection(data) {
        console.log('Show turn order selection:', data);
        console.log('Turn order modal element:', this.turnOrderModal);
        
        if (this.turnOrderModal) {
            // Show the turn order selection modal (only called for players who can choose)
            this.turnOrderModal.classList.remove('hidden');
            console.log('Turn order modal shown successfully');
            console.log('Modal classes after show:', this.turnOrderModal.className);
            
            // Add a bright red border to make it very visible for debugging
            this.turnOrderModal.style.border = '5px solid red';
            this.turnOrderModal.style.zIndex = '9999';
            
            // Update the modal content for the chooser
            const modalTitle = this.turnOrderModal.querySelector('h2');
            const buttons = this.turnOrderModal.querySelectorAll('.turn-option');
            
            modalTitle.textContent = '🎮 Choose Who Starts First';
            buttons.forEach(btn => btn.disabled = false);
            
            // Show prominent message for the chooser
            this.showMessage('🎮 YOU get to choose who starts first! Check the dialog box.', 'success');
        } else {
            console.error('Turn order modal element not found!');
        }
    }

    // Test method to manually show the modal (for debugging)
    testShowModal() {
        console.log('Test: Showing turn order modal');
        if (this.turnOrderModal) {
            this.turnOrderModal.classList.remove('hidden');
            console.log('Test modal shown');
        }
    }

    handleTurnOrderSelected(data) {
        console.log('Turn order selected:', data);
        this.updateGameState(data.gameState);
        
        // Reset the non-selector message flag since turn order is now selected
        this.hasShownNonSelectorMessage = false;
        
        // Show message about who is starting
        const message = `${data.startingPlayerName} (${data.currentPlayer}) will start the game!`;
        this.showMessage(message, 'success');
    }

    handlePossibleMoves(data) {
        console.log('Possible moves:', data);
        
        // Convert server coordinates to display coordinates
        const shouldRotate = this.playerColor === 'red';
        this.possibleMoves = data.moves.map(move => ({
            row: shouldRotate ? (7 - move.row) : move.row,
            col: shouldRotate ? (7 - move.col) : move.col
        }));
        
        this.highlightPossibleMoves();
    }

    handleError(data) {
        console.log('Error:', data);
        this.showMessage(data.message, 'error');
    }

    // Game state management
    updateGameState(gameState) {
        this.gameState = gameState;
        this.roomCode = gameState.roomCode;
        this.currentRoomCode.textContent = this.roomCode;
        
        // Update player color
        const playerData = Object.entries(gameState.players).find(([id, _]) => id === this.socket.id);
        if (playerData) {
            this.playerColor = playerData[1].color;
        }
        
        // Update player names
        const redPlayer = Object.values(gameState.players).find(p => p.color === 'red');
        const blackPlayer = Object.values(gameState.players).find(p => p.color === 'black');
        
        this.redPlayerName.textContent = redPlayer ? redPlayer.name : 'Waiting...';
        this.blackPlayerName.textContent = blackPlayer ? blackPlayer.name : 'Waiting...';
        
        // Update turn indicator
        this.updateTurnDisplay();
        
        // Update board
        this.updateBoard();
        
        // Update piece visuals after board update
        setTimeout(() => {
            this.updatePieceVisuals();
        }, 50);
        
        // Auto-select capturing piece if it's our turn and we must continue capturing
        if (this.gameState.mustCapture && this.gameState.capturingPiece && this.isMyTurn && !this.selectedPiece) {
            // Use a small timeout to ensure the board is updated first
            setTimeout(() => {
                this.autoSelectCapturingPiece();
            }, 100);
        }
    }

    updateTurnDisplay() {
        if (!this.gameState) return;
        
        const turnIndicator = this.turnDisplay.parentElement;
        
        if (this.gameState.gameState === 'waiting') {
            this.turnDisplay.textContent = 'Waiting for players...';
            turnIndicator.className = 'turn-indicator';
        } else if (this.gameState.gameState === 'turn_selection') {
            if (this.gameState.turnOrderSelector === this.socket.id) {
                this.turnDisplay.textContent = 'Choose who starts first!';
            } else {
                this.turnDisplay.textContent = 'Waiting for turn order selection...';
                // Show message for non-selector when they see the turn selection state
                if (!this.hasShownNonSelectorMessage) {
                    this.showMessage('Your opponent is choosing who starts first...', 'info');
                    this.hasShownNonSelectorMessage = true;
                }
            }
            turnIndicator.className = 'turn-indicator';
        } else if (this.gameState.gameState === 'finished') {
            this.turnDisplay.textContent = 'Game finished';
            turnIndicator.className = 'turn-indicator';
        } else {
            this.isMyTurn = this.gameState.currentPlayer === this.playerColor;
            
            if (this.isMyTurn) {
                this.turnDisplay.textContent = 'Your turn';
            } else {
                this.turnDisplay.textContent = `${this.gameState.currentPlayer} player's turn`;
            }
            
            turnIndicator.className = `turn-indicator ${this.gameState.currentPlayer}-turn`;
        }
        
        // Update piece visuals when turn changes
        this.updatePieceVisuals();
        
        // Update new game request status
        this.updateNewGameRequestStatus();
        this.updateNewGameButton();
    }

    updateNewGameRequestStatus() {
        if (this.gameState && this.gameState.newGameRequests) {
            this.hasRequestedNewGame = this.gameState.newGameRequests.includes(this.socket.id);
        } else {
            this.hasRequestedNewGame = false;
        }
    }

    updateNewGameButton() {
        const playerCount = Object.keys(this.gameState?.players || {}).length;
        
        if (playerCount < 2) {
            // Single player or no other player - simple new game
            this.resetGameBtn.textContent = 'New Game';
            this.resetGameBtn.classList.remove('requested', 'pending');
            return;
        }

        // Two players - show request status
        if (this.hasRequestedNewGame) {
            this.resetGameBtn.textContent = 'Cancel Request';
            this.resetGameBtn.classList.add('requested');
            this.resetGameBtn.classList.remove('pending');
        } else {
            const otherPlayerRequested = this.gameState?.newGameRequests && 
                                       this.gameState.newGameRequests.length > 0;
            
            if (otherPlayerRequested) {
                this.resetGameBtn.textContent = 'Agree to New Game';
                this.resetGameBtn.classList.add('pending');
                this.resetGameBtn.classList.remove('requested');
            } else {
                this.resetGameBtn.textContent = 'Request New Game';
                this.resetGameBtn.classList.remove('requested', 'pending');
            }
        }
    }

    updatePieceVisuals() {
        // Re-evaluate piece selectability and update visual indicators
        const pieces = document.querySelectorAll('.piece');
        let captureableCount = 0;
        let hasMandatory = false;
        
        pieces.forEach(pieceElement => {
            const serverRow = parseInt(pieceElement.dataset.serverRow);
            const serverCol = parseInt(pieceElement.dataset.serverCol);
            const piece = this.gameState.board[serverRow][serverCol];
            
            if (piece && this.isMyTurn && piece.color === this.playerColor && this.gameState.gameState === 'playing') {
                // Remove existing state classes
                pieceElement.classList.remove('disabled', 'must-capture');
                
                if (this.gameState.mustCapture && this.gameState.capturingPiece) {
                    // If we must continue capturing with a specific piece
                    const capturingPiece = this.gameState.capturingPiece;
                    if (serverRow === capturingPiece.row && serverCol === capturingPiece.col) {
                        pieceElement.classList.add('must-capture');
                        pieceElement.draggable = true;
                        captureableCount = 1;
                    } else {
                        pieceElement.classList.add('disabled');
                        pieceElement.draggable = false;
                    }
                    hasMandatory = true;
                } else {
                    // Check for mandatory captures
                    const mandatoryCaptures = this.hasMandatoryCaptures();
                    if (mandatoryCaptures) {
                        hasMandatory = true;
                        if (this.pieceHasCaptures(serverRow, serverCol)) {
                            pieceElement.classList.add('must-capture');
                            pieceElement.draggable = true;
                            captureableCount++;
                        } else {
                            pieceElement.classList.add('disabled');
                            pieceElement.draggable = false;
                        }
                    } else {
                        // No mandatory captures, piece is selectable
                        pieceElement.draggable = true;
                    }
                }
            } else {
                // Not our turn or not our piece - remove all state classes and disable dragging
                pieceElement.classList.remove('disabled', 'must-capture');
                if (piece && piece.color !== this.playerColor) {
                    pieceElement.draggable = false;
                }
            }
        });
    }

    // Board management
    clearBoard() {
        this.gameBoard.innerHTML = '';
    }

    updateBoard() {
        if (!this.gameState) return;
        
        this.clearBoard();
        
        // Determine if we should rotate the board (for red player)
        const shouldRotate = this.playerColor === 'red';
        
        // Add visual class to indicate rotation
        if (shouldRotate) {
            this.gameBoard.classList.add('rotated-for-red');
        } else {
            this.gameBoard.classList.remove('rotated-for-red');
        }
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                // Calculate display position (rotate for red player)
                const displayRow = shouldRotate ? (7 - row) : row;
                const displayCol = shouldRotate ? (7 - col) : col;
                
                const square = this.createSquare(displayRow, displayCol, row, col);
                this.gameBoard.appendChild(square);
                
                const piece = this.gameState.board[row][col];
                if (piece) {
                    const pieceElement = this.createPiece(piece, displayRow, displayCol, row, col);
                    square.appendChild(pieceElement);
                }
            }
        }
    }

    createSquare(displayRow, displayCol, serverRow, serverCol) {
        const square = document.createElement('div');
        square.className = `square ${(displayRow + displayCol) % 2 === 0 ? 'light' : 'dark'}`;
        square.dataset.displayRow = displayRow;
        square.dataset.displayCol = displayCol;
        square.dataset.serverRow = serverRow;
        square.dataset.serverCol = serverCol;
        
        square.addEventListener('click', (e) => this.handleSquareClick(displayRow, displayCol, serverRow, serverCol, e));
        
        return square;
    }

    createPiece(piece, displayRow, displayCol, serverRow, serverCol) {
        const pieceElement = document.createElement('div');
        let pieceClass = `piece ${piece.color}${piece.king ? ' king' : ''}`;
        
        // Add visual indicators for piece selectability
        if (this.isMyTurn && piece.color === this.playerColor && this.gameState.gameState === 'playing') {
            if (this.gameState.mustCapture && this.gameState.capturingPiece) {
                // If we must continue capturing with a specific piece
                const capturingPiece = this.gameState.capturingPiece;
                if (serverRow === capturingPiece.row && serverCol === capturingPiece.col) {
                    pieceClass += ' must-capture';
                } else {
                    pieceClass += ' disabled';
                }
            } else {
                // Check for mandatory captures
                const hasMandatory = this.hasMandatoryCaptures();
                if (hasMandatory) {
                    if (this.pieceHasCaptures(serverRow, serverCol)) {
                        pieceClass += ' must-capture';
                    } else {
                        pieceClass += ' disabled';
                    }
                }
            }
        }
        
        pieceElement.className = pieceClass;
        pieceElement.dataset.displayRow = displayRow;
        pieceElement.dataset.displayCol = displayCol;
        pieceElement.dataset.serverRow = serverRow;
        pieceElement.dataset.serverCol = serverCol;
        
        // Add drag and drop support (only if piece is not disabled)
        if (!pieceClass.includes('disabled')) {
            pieceElement.draggable = true;
            pieceElement.addEventListener('dragstart', (e) => this.handleDragStart(e, displayRow, displayCol, serverRow, serverCol));
            pieceElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
        } else {
            pieceElement.draggable = false;
        }
        
        return pieceElement;
    }

    handleSquareClick(displayRow, displayCol, serverRow, serverCol, event) {
        event.stopPropagation();
        
        if (!this.isMyTurn || this.gameState.gameState !== 'playing') {
            return;
        }

        const piece = this.gameState.board[serverRow][serverCol];
        
        // If clicking on own piece, check if it can be selected
        if (piece && piece.color === this.playerColor) {
            // If must capture with specific piece, only allow that piece to be selected
            if (this.gameState.mustCapture && this.gameState.capturingPiece) {
                const capturingPiece = this.gameState.capturingPiece;
                
                // If clicking on a piece that's not the capturing piece, prevent selection
                if (serverRow !== capturingPiece.row || serverCol !== capturingPiece.col) {
                    this.showMessage('⚠️ Must continue capturing with the highlighted piece!', 'error');
                    return;
                }
            } else {
                // Check if there are mandatory captures and this piece has no captures
                if (this.hasMandatoryCaptures() && !this.pieceHasCaptures(serverRow, serverCol)) {
                    this.showMessage('⚠️ Must capture when possible!', 'error');
                    return;
                }
            }
            
            this.selectPiece(displayRow, displayCol, serverRow, serverCol);
            return;
        }
        
        // If clicking on empty square and have selected piece, try to move
        if (!piece && this.selectedPiece) {
            const isPossibleMove = this.possibleMoves.some(move => move.row === displayRow && move.col === displayCol);
            if (isPossibleMove) {
                this.makeMove(this.selectedPiece.serverRow, this.selectedPiece.serverCol, serverRow, serverCol);
            }
            return;
        }
        
        // Otherwise, clear selection
        this.clearSelection();
    }

    hasMandatoryCaptures() {
        if (!this.gameState || !this.gameState.board) return false;
        
        // Check if any of the current player's pieces can capture
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.gameState.board[row][col];
                if (piece && piece.color === this.playerColor) {
                    if (this.pieceHasCaptures(row, col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    pieceHasCaptures(row, col) {
        if (!this.gameState || !this.gameState.board) return false;
        
        const piece = this.gameState.board[row][col];
        if (!piece || piece.color !== this.playerColor) return false;

        // Define movement directions based on piece type
        const directions = piece.king ? 
            [[-1, -1], [-1, 1], [1, -1], [1, 1]] : 
            piece.color === 'red' ? 
                [[1, -1], [1, 1]] : 
                [[-1, -1], [-1, 1]];

        // Check each direction for possible captures
        for (const [dRow, dCol] of directions) {
            const captureRow = row + dRow;
            const captureCol = col + dCol;
            const landRow = row + 2 * dRow;
            const landCol = col + 2 * dCol;

            // Check if positions are within bounds
            if (landRow >= 0 && landRow < 8 && landCol >= 0 && landCol < 8) {
                const capturedPiece = this.gameState.board[captureRow][captureCol];
                const landSquare = this.gameState.board[landRow][landCol];

                // Check if there's an opponent piece to capture and landing square is empty
                if (capturedPiece && 
                    capturedPiece.color !== piece.color && 
                    !landSquare) {
                    return true;
                }
            }
        }

        return false;
    }

    handleDragStart(event, displayRow, displayCol, serverRow, serverCol) {
        if (!this.isMyTurn || this.gameState.gameState !== 'playing') {
            event.preventDefault();
            return;
        }
        
        const piece = this.gameState.board[serverRow][serverCol];
        if (!piece || piece.color !== this.playerColor) {
            event.preventDefault();
            return;
        }
        
        // If must capture with specific piece, only allow that piece to be dragged
        if (this.gameState.mustCapture && this.gameState.capturingPiece) {
            const capturingPiece = this.gameState.capturingPiece;
            if (serverRow !== capturingPiece.row || serverCol !== capturingPiece.col) {
                event.preventDefault();
                this.showMessage('⚠️ Must continue capturing with the highlighted piece!', 'error');
                return;
            }
        } else {
            // Check if there are mandatory captures and this piece has no captures
            if (this.hasMandatoryCaptures() && !this.pieceHasCaptures(serverRow, serverCol)) {
                event.preventDefault();
                this.showMessage('⚠️ Must capture when possible!', 'error');
                return;
            }
        }
        
        this.selectPiece(displayRow, displayCol, serverRow, serverCol);
        event.target.classList.add('dragging');
        
        // Set drag data
        event.dataTransfer.setData('text/plain', JSON.stringify({ displayRow, displayCol, serverRow, serverCol }));
        event.dataTransfer.effectAllowed = 'move';
        
        // Add drop listeners to valid targets
        setTimeout(() => this.addDropListeners(), 0);
    }

    handleDragEnd(event) {
        event.target.classList.remove('dragging');
        this.removeDropListeners();
    }

    addDropListeners() {
        const squares = document.querySelectorAll('.square');
        squares.forEach(square => {
            square.addEventListener('dragover', this.handleDragOver);
            square.addEventListener('drop', this.handleDrop);
        });
    }

    removeDropListeners() {
        const squares = document.querySelectorAll('.square');
        squares.forEach(square => {
            square.removeEventListener('dragover', this.handleDragOver);
            square.removeEventListener('drop', this.handleDrop);
        });
    }

    handleDragOver = (event) => {
        const displayRow = parseInt(event.currentTarget.dataset.displayRow);
        const displayCol = parseInt(event.currentTarget.dataset.displayCol);
        
        const isPossibleMove = this.possibleMoves.some(move => move.row === displayRow && move.col === displayCol);
        if (isPossibleMove) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        }
    }

    handleDrop = (event) => {
        event.preventDefault();
        
        const displayRow = parseInt(event.currentTarget.dataset.displayRow);
        const displayCol = parseInt(event.currentTarget.dataset.displayCol);
        const serverRow = parseInt(event.currentTarget.dataset.serverRow);
        const serverCol = parseInt(event.currentTarget.dataset.serverCol);
        
        if (this.selectedPiece) {
            const isPossibleMove = this.possibleMoves.some(move => move.row === displayRow && move.col === displayCol);
            if (isPossibleMove) {
                this.makeMove(this.selectedPiece.serverRow, this.selectedPiece.serverCol, serverRow, serverCol);
            }
        }
    }

    selectPiece(displayRow, displayCol, serverRow, serverCol) {
        this.clearSelection();
        
        this.selectedPiece = { displayRow, displayCol, serverRow, serverCol };
        
        // Highlight selected square using display coordinates
        const square = document.querySelector(`[data-display-row="${displayRow}"][data-display-col="${displayCol}"]`);
        if (square) {
            square.classList.add('selected');
        }
        
        // Get possible moves using server coordinates
        this.socket.emit('get-possible-moves', { row: serverRow, col: serverCol });
    }

    clearSelection() {
        this.selectedPiece = null;
        this.possibleMoves = [];
        
        // Clear visual highlights
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'possible-move');
        });
    }

    autoSelectCapturingPiece() {
        if (!this.gameState.capturingPiece) return;
        
        const { row: serverRow, col: serverCol } = this.gameState.capturingPiece;
        
        // Calculate display coordinates (rotate for red player)
        const shouldRotate = this.playerColor === 'red';
        const displayRow = shouldRotate ? (7 - serverRow) : serverRow;
        const displayCol = shouldRotate ? (7 - serverCol) : serverCol;
        
        // Auto-select the capturing piece
        this.selectPiece(displayRow, displayCol, serverRow, serverCol);
                
        // Add special highlighting to indicate forced selection
        const square = document.querySelector(`[data-display-row="${displayRow}"][data-display-col="${displayCol}"]`);
        if (square) {
            square.classList.add('forced-selection');
            // Remove the special class after a few seconds
            setTimeout(() => {
                square.classList.remove('forced-selection');
            }, 3000);
        }
    }

    highlightPossibleMoves() {
        // Clear existing highlights
        document.querySelectorAll('.square.possible-move').forEach(square => {
            square.classList.remove('possible-move');
        });
        
        // Add highlights for possible moves using display coordinates
        this.possibleMoves.forEach(move => {
            const square = document.querySelector(`[data-display-row="${move.row}"][data-display-col="${move.col}"]`);
            if (square) {
                square.classList.add('possible-move');
            }
        });
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        console.log(`Making move: (${fromRow},${fromCol}) -> (${toRow},${toCol})`);
        this.socket.emit('make-move', { fromRow, fromCol, toRow, toCol });
        this.clearSelection();
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

    clearMessages() {
        this.gameMessages.innerHTML = '';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CheckersClient();
});
