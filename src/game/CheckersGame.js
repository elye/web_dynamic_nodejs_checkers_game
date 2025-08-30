/**
 * Checkers Game Logic
 * 
 * This class handles all the game logic for a checkers game including:
 * - Board initialization and management
 * - Player management
 * - Move validation and execution
 * - Game state management
 * - Turn order selection
 * - Win condition checking
 */

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

module.exports = CheckersGame;
