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
        this.toastContainer = document.getElementById('toast-container');
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
        
        // Show helpful message when mandatory captures are detected
        if (this.isMyTurn && hasMandatory && captureableCount > 0) {
            if (this.gameState.mustCapture && this.gameState.capturingPiece) {
                // Continue capturing message is already shown in autoSelectCapturingPiece
            } else {
                // New mandatory capture situation
                const message = captureableCount === 1 ? 
                    '⚡ Mandatory capture! Click on the glowing piece to capture.' : 
                    `⚡ Mandatory captures available! ${captureableCount} pieces can capture.`;
                this.showMessage(message, 'info');
            }
        }
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
        
        // Show message to user with enhanced styling
        this.showMessage('🎯 Piece auto-selected for continued capturing! Make your next capture move.', 'success');
        
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
