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
        this.connectionStatus = document.getElementById('connection-status');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        
        // Modal elements
        this.gameOverModal = document.getElementById('game-over-modal');
        this.gameOverTitle = document.getElementById('game-over-title');
        this.gameOverMessage = document.getElementById('game-over-message');
        this.playAgainBtn = document.getElementById('play-again');
        this.closeModalBtn = document.getElementById('close-modal');
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
        if (confirm('Are you sure you want to start a new game?')) {
            this.socket.emit('reset-game');
        }
    }

    playAgain() {
        this.closeModal();
        this.resetGame();
    }

    closeModal() {
        this.gameOverModal.classList.add('hidden');
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
        this.currentRoomCode.textContent = '-';
        this.clearBoard();
        this.clearMessages();
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
        
        this.gameOverTitle.textContent = isWinner ? 'You Win!' : 'You Lose';
        this.gameOverMessage.textContent = `${winner.charAt(0).toUpperCase() + winner.slice(1)} player wins!`;
        this.gameOverModal.classList.remove('hidden');
        
        this.showMessage(`Game Over! ${winner} player wins!`, 'success');
    }

    handleGameReset(data) {
        console.log('Game reset:', data);
        this.updateGameState(data);
        this.clearSelection();
        this.closeModal();
        this.showMessage('New game started!', 'info');
    }

    handlePossibleMoves(data) {
        console.log('Possible moves:', data);
        this.possibleMoves = data.moves;
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
    }

    updateTurnDisplay() {
        if (!this.gameState) return;
        
        const turnIndicator = this.turnDisplay.parentElement;
        
        if (this.gameState.gameState === 'waiting') {
            this.turnDisplay.textContent = 'Waiting for players...';
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
    }

    // Board management
    clearBoard() {
        this.gameBoard.innerHTML = '';
    }

    updateBoard() {
        if (!this.gameState) return;
        
        this.clearBoard();
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = this.createSquare(row, col);
                this.gameBoard.appendChild(square);
                
                const piece = this.gameState.board[row][col];
                if (piece) {
                    const pieceElement = this.createPiece(piece, row, col);
                    square.appendChild(pieceElement);
                }
            }
        }
    }

    createSquare(row, col) {
        const square = document.createElement('div');
        square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
        square.dataset.row = row;
        square.dataset.col = col;
        
        square.addEventListener('click', (e) => this.handleSquareClick(row, col, e));
        
        return square;
    }

    createPiece(piece, row, col) {
        const pieceElement = document.createElement('div');
        pieceElement.className = `piece ${piece.color}${piece.king ? ' king' : ''}`;
        pieceElement.dataset.row = row;
        pieceElement.dataset.col = col;
        
        // Add drag and drop support
        pieceElement.draggable = true;
        pieceElement.addEventListener('dragstart', (e) => this.handleDragStart(e, row, col));
        pieceElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        return pieceElement;
    }

    handleSquareClick(row, col, event) {
        event.stopPropagation();
        
        if (!this.isMyTurn || this.gameState.gameState !== 'playing') {
            return;
        }

        const piece = this.gameState.board[row][col];
        
        // If clicking on own piece, select it
        if (piece && piece.color === this.playerColor) {
            this.selectPiece(row, col);
            return;
        }
        
        // If clicking on empty square and have selected piece, try to move
        if (!piece && this.selectedPiece) {
            const isPossibleMove = this.possibleMoves.some(move => move.row === row && move.col === col);
            if (isPossibleMove) {
                this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
            }
            return;
        }
        
        // Otherwise, clear selection
        this.clearSelection();
    }

    handleDragStart(event, row, col) {
        if (!this.isMyTurn || this.gameState.gameState !== 'playing') {
            event.preventDefault();
            return;
        }
        
        const piece = this.gameState.board[row][col];
        if (!piece || piece.color !== this.playerColor) {
            event.preventDefault();
            return;
        }
        
        this.selectPiece(row, col);
        event.target.classList.add('dragging');
        
        // Set drag data
        event.dataTransfer.setData('text/plain', JSON.stringify({ row, col }));
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
        const row = parseInt(event.currentTarget.dataset.row);
        const col = parseInt(event.currentTarget.dataset.col);
        
        const isPossibleMove = this.possibleMoves.some(move => move.row === row && move.col === col);
        if (isPossibleMove) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        }
    }

    handleDrop = (event) => {
        event.preventDefault();
        
        const row = parseInt(event.currentTarget.dataset.row);
        const col = parseInt(event.currentTarget.dataset.col);
        
        if (this.selectedPiece) {
            const isPossibleMove = this.possibleMoves.some(move => move.row === row && move.col === col);
            if (isPossibleMove) {
                this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
            }
        }
    }

    selectPiece(row, col) {
        this.clearSelection();
        
        this.selectedPiece = { row, col };
        
        // Highlight selected square
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (square) {
            square.classList.add('selected');
        }
        
        // Get possible moves
        this.socket.emit('get-possible-moves', { row, col });
    }

    clearSelection() {
        this.selectedPiece = null;
        this.possibleMoves = [];
        
        // Clear visual highlights
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'possible-move');
        });
    }

    highlightPossibleMoves() {
        // Clear existing highlights
        document.querySelectorAll('.square.possible-move').forEach(square => {
            square.classList.remove('possible-move');
        });
        
        // Add highlights for possible moves
        this.possibleMoves.forEach(move => {
            const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
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
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        this.gameMessages.appendChild(messageElement);
        
        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 5000);
        
        // Scroll to bottom
        this.gameMessages.scrollTop = this.gameMessages.scrollHeight;
    }

    clearMessages() {
        this.gameMessages.innerHTML = '';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CheckersClient();
});
