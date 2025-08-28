/**
 * Online Checkers Game Server
 * 
 * Setup Instructions:
 * 1. Install dependencies: npm install
 * 2. Start server: npm start (or npm run dev for development)
 * 3. Open http://localhost:3000 in your browser
 * 4. Create or join a room to start playing
 * 
 * Features:
 * - Real-time multiplayer checkers
 * - Room-based gameplay with unique codes
 * - Complete checkers rules implementation
 * - Player reconnection support
 * - Multiple concurrent games
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory storage for games and rooms
const games = new Map();
const rooms = new Map();

// Checkers game class
class CheckersGame {
    constructor(roomCode) {
        this.roomCode = roomCode;
        this.players = {};
        this.currentPlayer = 'red'; // Default, can be changed by turn order selection
        this.gameState = 'waiting'; // waiting, playing, finished, turn_selection
        this.winner = null;
        this.board = this.initializeBoard();
        this.selectedPiece = null;
        this.mustCapture = false;
        this.capturingPiece = null;
        this.newGameRequests = new Set(); // Track players who want a new game
        this.turnOrderSelector = null; // Player who gets to choose turn order
        this.waitingForTurnOrderSelection = false;
    }

    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Place red pieces (top of board)
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { color: 'red', king: false };
                }
            }
        }
        
        // Place black pieces (bottom of board)
        for (let row = 5; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    board[row][col] = { color: 'black', king: false };
                }
            }
        }
        
        return board;
    }

    addPlayer(playerId, playerName) {
        if (Object.keys(this.players).length >= 2) {
            return false;
        }

        const color = Object.keys(this.players).length === 0 ? 'red' : 'black';
        this.players[playerId] = { name: playerName, color: color };
        
        if (Object.keys(this.players).length === 2) {
            // Both players joined - prepare for turn order selection
            this.gameState = 'turn_selection';
            this.waitingForTurnOrderSelection = true;
            
            // The first player (red) gets to choose turn order
            const redPlayer = Object.entries(this.players).find(([id, player]) => player.color === 'red');
            this.turnOrderSelector = redPlayer[0];
        }
        
        return true;
    }

    removePlayer(playerId) {
        delete this.players[playerId];
        if (this.newGameRequests) {
            this.newGameRequests.delete(playerId);
        }
        if (Object.keys(this.players).length === 0) {
            this.gameState = 'finished';
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol, playerId) {
        // Check if it's player's turn
        if (this.players[playerId].color !== this.currentPlayer) {
            return { valid: false, reason: 'Not your turn' };
        }

        // Check if source position has a piece
        const piece = this.board[fromRow][fromCol];
        if (!piece || piece.color !== this.currentPlayer) {
            return { valid: false, reason: 'Invalid source position' };
        }

        // Check if destination is empty
        if (this.board[toRow][toCol] !== null) {
            return { valid: false, reason: 'Destination not empty' };
        }

        // Check if move is on dark squares only
        if ((toRow + toCol) % 2 === 0) {
            return { valid: false, reason: 'Can only move to dark squares' };
        }

        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);

        // Check if there are mandatory captures
        if (this.mustCapture && this.capturingPiece && 
            (fromRow !== this.capturingPiece.row || fromCol !== this.capturingPiece.col)) {
            return { valid: false, reason: 'Must continue capturing with the same piece' };
        }

        // Regular move (one diagonal square)
        if (Math.abs(rowDiff) === 1 && colDiff === 1) {
            // Check direction for non-king pieces
            if (!piece.king) {
                const expectedDirection = piece.color === 'red' ? 1 : -1;
                if (rowDiff !== expectedDirection) {
                    return { valid: false, reason: 'Invalid move direction' };
                }
            }

            // Check if there are available captures (mandatory)
            const captures = this.getAvailableCaptures(this.currentPlayer);
            if (captures.length > 0) {
                return { valid: false, reason: 'Must capture when possible' };
            }

            return { valid: true, type: 'move' };
        }

        // Capture move (two diagonal squares)
        if (Math.abs(rowDiff) === 2 && colDiff === 2) {
            // Check direction for non-king pieces
            if (!piece.king) {
                const expectedDirection = piece.color === 'red' ? 1 : -1;
                if (Math.sign(rowDiff) !== expectedDirection) {
                    return { valid: false, reason: 'Invalid capture direction' };
                }
            }

            const middleRow = fromRow + Math.sign(rowDiff);
            const middleCol = fromCol + Math.sign(toCol - fromCol);
            const middlePiece = this.board[middleRow][middleCol];

            // Check if there's an opponent piece to capture
            if (!middlePiece || middlePiece.color === this.currentPlayer) {
                return { valid: false, reason: 'No piece to capture' };
            }

            return { valid: true, type: 'capture', capturedRow: middleRow, capturedCol: middleCol };
        }

        return { valid: false, reason: 'Invalid move distance' };
    }

    getAvailableCaptures(color) {
        const captures = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const pieceCaptues = this.getPieceCaptues(row, col);
                    captures.push(...pieceCaptues);
                }
            }
        }
        
        return captures;
    }

    getPieceCaptues(row, col) {
        const captures = [];
        const piece = this.board[row][col];
        const directions = piece.king ? 
            [[-1, -1], [-1, 1], [1, -1], [1, 1]] : 
            piece.color === 'red' ? 
                [[1, -1], [1, 1]] : 
                [[-1, -1], [-1, 1]];

        for (const [dRow, dCol] of directions) {
            const captureRow = row + dRow;
            const captureCol = col + dCol;
            const landRow = row + 2 * dRow;
            const landCol = col + 2 * dCol;

            if (landRow >= 0 && landRow < 8 && landCol >= 0 && landCol < 8) {
                const capturedPiece = this.board[captureRow][captureCol];
                const landSquare = this.board[landRow][landCol];

                if (capturedPiece && 
                    capturedPiece.color !== piece.color && 
                    !landSquare) {
                    captures.push({
                        from: { row, col },
                        to: { row: landRow, col: landCol },
                        captured: { row: captureRow, col: captureCol }
                    });
                }
            }
        }

        return captures;
    }

    makeMove(fromRow, fromCol, toRow, toCol, playerId) {
        const validation = this.isValidMove(fromRow, fromCol, toRow, toCol, playerId);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }

        const piece = this.board[fromRow][fromCol];
        
        // Move the piece
        this.board[toRow][toCol] = { ...piece };
        this.board[fromRow][fromCol] = null;

        let capturedPiece = null;
        let continueCapturing = false;

        // Handle capture
        if (validation.type === 'capture') {
            capturedPiece = this.board[validation.capturedRow][validation.capturedCol];
            this.board[validation.capturedRow][validation.capturedCol] = null;

            // Check for additional captures with the same piece
            const additionalCaptures = this.getPieceCaptues(toRow, toCol);
            if (additionalCaptures.length > 0) {
                this.mustCapture = true;
                this.capturingPiece = { row: toRow, col: toCol };
                continueCapturing = true;
            } else {
                this.mustCapture = false;
                this.capturingPiece = null;
            }
        } else {
            this.mustCapture = false;
            this.capturingPiece = null;
        }

        // Promote to king
        let promoted = false;
        if (!piece.king) {
            if ((piece.color === 'red' && toRow === 7) || 
                (piece.color === 'black' && toRow === 0)) {
                this.board[toRow][toCol].king = true;
                promoted = true;
                // Kings cannot continue capturing in the same turn after promotion
                if (continueCapturing) {
                    this.mustCapture = false;
                    this.capturingPiece = null;
                    continueCapturing = false;
                }
            }
        }

        // Switch turns if not continuing a capture sequence
        if (!continueCapturing) {
            this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        }

        // Check for game over
        const winner = this.checkGameOver();
        if (winner) {
            this.gameState = 'finished';
            this.winner = winner;
        }

        return {
            success: true,
            capturedPiece,
            promoted,
            continueCapturing,
            winner: this.winner,
            gameState: this.gameState
        };
    }

    checkGameOver() {
        const redPieces = this.countPieces('red');
        const blackPieces = this.countPieces('black');
        
        // Check if a player has no pieces left
        if (redPieces === 0) return 'black';
        if (blackPieces === 0) return 'red';
        
        // Check if current player has no valid moves
        const validMoves = this.getValidMovesForPlayer(this.currentPlayer);
        if (validMoves.length === 0) {
            return this.currentPlayer === 'red' ? 'black' : 'red';
        }
        
        return null;
    }

    countPieces(color) {
        let count = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.board[row][col] && this.board[row][col].color === color) {
                    count++;
                }
            }
        }
        return count;
    }

    getValidMovesForPlayer(color) {
        const moves = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const pieceMoves = this.getValidMovesForPiece(row, col);
                    moves.push(...pieceMoves);
                }
            }
        }
        
        return moves;
    }

    getValidMovesForPiece(row, col) {
        const moves = [];
        const piece = this.board[row][col];
        
        if (!piece) return moves;

        const directions = piece.king ? 
            [[-1, -1], [-1, 1], [1, -1], [1, 1]] : 
            piece.color === 'red' ? 
                [[1, -1], [1, 1]] : 
                [[-1, -1], [-1, 1]];

        // Check regular moves
        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && 
                !this.board[newRow][newCol]) {
                moves.push({ from: { row, col }, to: { row: newRow, col: newCol }, type: 'move' });
            }

            // Check capture moves
            const captureRow = row + 2 * dRow;
            const captureCol = col + 2 * dCol;
            
            if (captureRow >= 0 && captureRow < 8 && captureCol >= 0 && captureCol < 8) {
                const capturedPiece = this.board[newRow][newCol];
                const landSquare = this.board[captureRow][captureCol];
                
                if (capturedPiece && capturedPiece.color !== piece.color && !landSquare) {
                    moves.push({ 
                        from: { row, col }, 
                        to: { row: captureRow, col: captureCol }, 
                        type: 'capture',
                        captured: { row: newRow, col: newCol }
                    });
                }
            }
        }
        
        return moves;
    }

    selectTurnOrder(playerId, choice) {
        // Only the designated selector can choose turn order
        if (playerId !== this.turnOrderSelector || !this.waitingForTurnOrderSelection) {
            return { success: false, reason: 'Not authorized to select turn order' };
        }

        const selectorPlayer = this.players[playerId];
        
        if (choice === 'self') {
            // Selector starts first - keep their color as current player
            this.currentPlayer = selectorPlayer.color;
        } else if (choice === 'opponent') {
            // Opponent starts first - set opponent's color as current player
            this.currentPlayer = selectorPlayer.color === 'red' ? 'black' : 'red';
        } else {
            return { success: false, reason: 'Invalid choice' };
        }

        // Game is now ready to start
        this.gameState = 'playing';
        this.waitingForTurnOrderSelection = false;
        this.turnOrderSelector = null;

        return { 
            success: true, 
            currentPlayer: this.currentPlayer,
            startingPlayerName: this.players[Object.keys(this.players).find(id => this.players[id].color === this.currentPlayer)]?.name
        };
    }

    resetGame() {
        this.currentPlayer = 'red'; // Default, will be changed by turn order selection
        this.winner = null;
        this.board = this.initializeBoard();
        this.selectedPiece = null;
        this.mustCapture = false;
        this.capturingPiece = null;
        this.newGameRequests = new Set(); // Clear any pending requests
        
        const playerCount = Object.keys(this.players).length;
        if (playerCount === 2) {
            // Both players present - require turn order selection
            this.gameState = 'turn_selection';
            this.waitingForTurnOrderSelection = true;
            
            // The red player gets to choose turn order (or we can randomize this)
            const redPlayer = Object.entries(this.players).find(([id, player]) => player.color === 'red');
            this.turnOrderSelector = redPlayer ? redPlayer[0] : Object.keys(this.players)[0];
        } else {
            // Single player or no players
            this.gameState = playerCount === 1 ? 'waiting' : 'waiting';
            this.waitingForTurnOrderSelection = false;
            this.turnOrderSelector = null;
        }
    }

    requestNewGame(playerId) {
        if (!this.newGameRequests) {
            this.newGameRequests = new Set();
        }
        
        this.newGameRequests.add(playerId);
        
        // Check if both players have requested a new game
        const playerCount = Object.keys(this.players).length;
        if (playerCount === 2 && this.newGameRequests.size === 2) {
            // Both players agreed, reset the game
            this.resetGame();
            return { approved: true, bothAgreed: true };
        } else if (playerCount === 1) {
            // Only one player in room, allow immediate reset
            this.resetGame();
            return { approved: true, bothAgreed: false, reason: 'single_player' };
        } else {
            // Waiting for other player's agreement
            return { approved: false, waitingForOther: true };
        }
    }

    cancelNewGameRequest(playerId) {
        if (this.newGameRequests) {
            this.newGameRequests.delete(playerId);
        }
    }

    getGameState() {
        return {
            roomCode: this.roomCode,
            players: this.players,
            currentPlayer: this.currentPlayer,
            gameState: this.gameState,
            winner: this.winner,
            board: this.board,
            mustCapture: this.mustCapture,
            capturingPiece: this.capturingPiece,
            newGameRequests: this.newGameRequests ? Array.from(this.newGameRequests) : [],
            waitingForTurnOrderSelection: this.waitingForTurnOrderSelection,
            turnOrderSelector: this.turnOrderSelector
        };
    }
}

// Generate unique room code
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// API Routes
// Health check endpoint for monitoring
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Checkers Game Server Running',
        timestamp: new Date().toISOString(),
        activeRooms: games.size
    });
});

app.post('/api/create-room', (req, res) => {
    const roomCode = generateRoomCode();
    const game = new CheckersGame(roomCode);
    
    games.set(roomCode, game);
    rooms.set(roomCode, { playerCount: 0, created: new Date() });
    
    res.json({ roomCode });
});

app.get('/api/room/:code', (req, res) => {
    const { code } = req.params;
    const game = games.get(code);
    
    if (!game) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
        roomCode: code,
        playerCount: Object.keys(game.players).length,
        gameState: game.gameState
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join-room', ({ roomCode, playerName }) => {
        const game = games.get(roomCode);
        
        if (!game) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Add player to game
        const success = game.addPlayer(socket.id, playerName);
        
        if (!success) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        // Join socket room
        socket.join(roomCode);
        socket.roomCode = roomCode;

        // Notify all players in room
        io.to(roomCode).emit('player-joined', {
            players: game.players,
            gameState: game.getGameState()
        });

        // Send initial game state to the joining player
        socket.emit('game-state', game.getGameState());
        
        // Check if we need to show turn order selection
        if (game.waitingForTurnOrderSelection) {
            console.log(`Turn order selection needed. Selector: ${game.turnOrderSelector}, Current socket: ${socket.id}`);
            
            // Show the dialog to both players, but indicate who can choose
            const canChoose = game.turnOrderSelector === socket.id;
            socket.emit('show-turn-order-selection', { canChoose });
            
            if (canChoose) {
                console.log(`Showing turn order selection to selector: ${socket.id}`);
            } else {
                console.log(`Showing turn order selection (view-only) to non-selector: ${socket.id}`);
            }
            
            // Also notify the selector if they're different from the joining player
            if (game.turnOrderSelector && game.turnOrderSelector !== socket.id) {
                const selectorSocket = io.sockets.sockets.get(game.turnOrderSelector);
                if (selectorSocket) {
                    console.log(`Notifying existing selector: ${game.turnOrderSelector}`);
                    selectorSocket.emit('show-turn-order-selection', { canChoose: true });
                } else {
                    console.log(`Selector socket not found: ${game.turnOrderSelector}`);
                }
            }
        } else {
            console.log(`No turn order selection needed. Game state: ${game.gameState}`);
        }
        
        console.log(`Player ${playerName} joined room ${roomCode}`);
    });

    // Handle move
    socket.on('make-move', ({ fromRow, fromCol, toRow, toCol }) => {
        if (!socket.roomCode) return;

        const game = games.get(socket.roomCode);
        if (!game) return;

        const result = game.makeMove(fromRow, fromCol, toRow, toCol, socket.id);
        
        if (result.success) {
            // Broadcast the move to all players in the room
            io.to(socket.roomCode).emit('move-made', {
                fromRow,
                fromCol,
                toRow,
                toCol,
                capturedPiece: result.capturedPiece,
                promoted: result.promoted,
                gameState: game.getGameState()
            });

            // If game is finished, announce winner
            if (result.winner) {
                io.to(socket.roomCode).emit('game-over', {
                    winner: result.winner,
                    gameState: game.getGameState()
                });
            }
        } else {
            socket.emit('move-error', { message: result.reason });
        }
    });

    // Handle turn order selection
    socket.on('select-turn-order', ({ choice }) => {
        if (!socket.roomCode) return;

        const game = games.get(socket.roomCode);
        if (!game) return;

        const result = game.selectTurnOrder(socket.id, choice);
        
        if (result.success) {
            // Broadcast game state update to all players
            io.to(socket.roomCode).emit('turn-order-selected', {
                choice,
                currentPlayer: result.currentPlayer,
                startingPlayerName: result.startingPlayerName,
                gameState: game.getGameState()
            });
            
            console.log(`Turn order selected in room ${socket.roomCode}: ${choice}, starting player: ${result.currentPlayer}`);
        } else {
            socket.emit('move-error', { message: result.reason });
        }
    });

    // Reset game (now requires agreement from both players)
    socket.on('request-new-game', () => {
        if (!socket.roomCode) return;

        const game = games.get(socket.roomCode);
        if (!game) return;

        const result = game.requestNewGame(socket.id);
        
        if (result.approved) {
            if (result.bothAgreed) {
                // Both players agreed, reset the game
                io.to(socket.roomCode).emit('game-reset', {
                    gameState: game.getGameState(),
                    message: 'Both players agreed to start a new game!'
                });
                
                // Check if we need to show turn order selection
                if (game.waitingForTurnOrderSelection && game.turnOrderSelector) {
                    const selectorSocket = io.sockets.sockets.get(game.turnOrderSelector);
                    if (selectorSocket) {
                        selectorSocket.emit('show-turn-order-selection', { canChoose: true });
                    }
                }
                
                console.log(`New game started in room ${socket.roomCode} - both players agreed`);
            } else if (result.reason === 'single_player') {
                // Only one player in room, allow immediate reset
                io.to(socket.roomCode).emit('game-reset', {
                    gameState: game.getGameState(),
                    message: 'New game started!'
                });
                console.log(`New game started in room ${socket.roomCode} - single player`);
            }
        } else if (result.waitingForOther) {
            // Notify all players about the pending request
            const requesterName = game.players[socket.id]?.name || 'Player';
            io.to(socket.roomCode).emit('new-game-requested', {
                requesterName,
                gameState: game.getGameState()
            });
            console.log(`New game requested by ${requesterName} in room ${socket.roomCode}`);
        }
    });

    // Cancel new game request
    socket.on('cancel-new-game-request', () => {
        if (!socket.roomCode) return;

        const game = games.get(socket.roomCode);
        if (!game) return;

        game.cancelNewGameRequest(socket.id);
        
        const requesterName = game.players[socket.id]?.name || 'Player';
        io.to(socket.roomCode).emit('new-game-request-cancelled', {
            requesterName,
            gameState: game.getGameState()
        });
        console.log(`New game request cancelled by ${requesterName} in room ${socket.roomCode}`);
    });

    // Legacy reset game handler (kept for backward compatibility but now just calls request-new-game)
    socket.on('reset-game', () => {
        // Trigger the same logic as request-new-game
        if (!socket.roomCode) return;

        const game = games.get(socket.roomCode);
        if (!game) return;

        const result = game.requestNewGame(socket.id);
        
        if (result.approved) {
            if (result.bothAgreed) {
                // Both players agreed, reset the game
                io.to(socket.roomCode).emit('game-reset', {
                    gameState: game.getGameState(),
                    message: 'Both players agreed to start a new game!'
                });
                
                // Check if we need to show turn order selection
                if (game.waitingForTurnOrderSelection && game.turnOrderSelector) {
                    const selectorSocket = io.sockets.sockets.get(game.turnOrderSelector);
                    if (selectorSocket) {
                        selectorSocket.emit('show-turn-order-selection', { canChoose: true });
                    }
                }
                
                console.log(`New game started in room ${socket.roomCode} - both players agreed`);
            } else if (result.reason === 'single_player') {
                // Only one player in room, allow immediate reset
                io.to(socket.roomCode).emit('game-reset', {
                    gameState: game.getGameState(),
                    message: 'New game started!'
                });
                console.log(`New game started in room ${socket.roomCode} - single player`);
            }
        } else if (result.waitingForOther) {
            // Notify all players about the pending request
            const requesterName = game.players[socket.id]?.name || 'Player';
            io.to(socket.roomCode).emit('new-game-requested', {
                requesterName,
                gameState: game.getGameState()
            });
            console.log(`New game requested by ${requesterName} in room ${socket.roomCode}`);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        if (socket.roomCode) {
            const game = games.get(socket.roomCode);
            if (game) {
                game.removePlayer(socket.id);
                
                // Notify remaining players
                io.to(socket.roomCode).emit('player-left', {
                    players: game.players,
                    gameState: game.getGameState()
                });

                // Clean up empty rooms
                if (Object.keys(game.players).length === 0) {
                    games.delete(socket.roomCode);
                    rooms.delete(socket.roomCode);
                    console.log(`Removed empty room ${socket.roomCode}`);
                }
            }
        }
    });

    // Get possible moves for a piece
    socket.on('get-possible-moves', ({ row, col }) => {
        if (!socket.roomCode) return;

        const game = games.get(socket.roomCode);
        if (!game) return;

        const piece = game.board[row][col];
        if (!piece || piece.color !== game.players[socket.id]?.color) {
            socket.emit('possible-moves', { moves: [] });
            return;
        }

        // If must capture and this isn't the capturing piece, no moves
        if (game.mustCapture && game.capturingPiece && 
            (game.capturingPiece.row !== row || game.capturingPiece.col !== col)) {
            socket.emit('possible-moves', { moves: [] });
            return;
        }

        const moves = game.getValidMovesForPiece(row, col);
        
        // Filter out regular moves if captures are available
        const captures = moves.filter(move => move.type === 'capture');
        const finalMoves = captures.length > 0 ? captures : moves;

        socket.emit('possible-moves', { 
            moves: finalMoves.map(move => ({ row: move.to.row, col: move.to.col }))
        });
    });
});

// Clean up old rooms periodically (every hour)
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [roomCode, room] of rooms.entries()) {
        if (room.created < oneHourAgo) {
            games.delete(roomCode);
            rooms.delete(roomCode);
            console.log(`Cleaned up old room: ${roomCode}`);
        }
    }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Checkers game server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play`);
});
