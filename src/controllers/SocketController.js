/**
 * Socket Controller
 * Handles all Socket.IO events and game interactions
 */

class SocketController {
    constructor(io, gameController) {
        this.io = io;
        this.gameController = gameController;
    }

    /**
     * Initialize socket event handlers
     */
    initialize() {
        this.io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            // Join room
            socket.on('join-room', ({ roomCode, playerName }) => {
                this.handleJoinRoom(socket, roomCode, playerName);
            });

            // Handle move
            socket.on('make-move', ({ fromRow, fromCol, toRow, toCol }) => {
                this.handleMakeMove(socket, fromRow, fromCol, toRow, toCol);
            });

            // Handle turn order selection
            socket.on('select-turn-order', ({ choice }) => {
                this.handleSelectTurnOrder(socket, choice);
            });

            // Request new game
            socket.on('request-new-game', () => {
                this.handleRequestNewGame(socket);
            });

            // Cancel new game request
            socket.on('cancel-new-game-request', () => {
                this.handleCancelNewGameRequest(socket);
            });

            // Legacy reset game handler
            socket.on('reset-game', () => {
                this.handleRequestNewGame(socket);
            });

            // Get possible moves for a piece
            socket.on('get-possible-moves', ({ row, col }) => {
                this.handleGetPossibleMoves(socket, row, col);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    /**
     * Handle player joining a room
     */
    handleJoinRoom(socket, roomCode, playerName) {
        const game = this.gameController.getGame(roomCode);
        
        if (!game) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const success = game.addPlayer(socket.id, playerName);
        
        if (!success) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;

        this.io.to(roomCode).emit('player-joined', {
            players: game.players,
            gameState: game.getGameState()
        });

        socket.emit('game-state', game.getGameState());
        
        if (game.waitingForTurnOrderSelection) {
            if (game.turnOrderSelector === socket.id) {
                socket.emit('show-turn-order-selection', { canChoose: true });
            } else {
                socket.emit('game-state', game.getGameState());
            }
            
            if (game.turnOrderSelector && game.turnOrderSelector !== socket.id) {
                const selectorSocket = this.io.sockets.sockets.get(game.turnOrderSelector);
                if (selectorSocket) {
                    selectorSocket.emit('show-turn-order-selection', { canChoose: true });
                }
            }
        }
        
        console.log(`Player ${playerName} joined room ${roomCode}`);
    }

    /**
     * Handle player making a move
     */
    handleMakeMove(socket, fromRow, fromCol, toRow, toCol) {
        if (!socket.roomCode) return;

        const game = this.gameController.getGame(socket.roomCode);
        if (!game) return;

        const result = game.makeMove(fromRow, fromCol, toRow, toCol, socket.id);
        
        if (result.success) {
            this.io.to(socket.roomCode).emit('move-made', {
                fromRow,
                fromCol,
                toRow,
                toCol,
                capturedPiece: result.capturedPiece,
                promoted: result.promoted,
                gameState: game.getGameState()
            });

            if (result.winner) {
                this.io.to(socket.roomCode).emit('game-over', {
                    winner: result.winner,
                    gameState: game.getGameState()
                });
            }
        } else {
            socket.emit('move-error', { message: result.reason });
        }
    }

    /**
     * Handle turn order selection
     */
    handleSelectTurnOrder(socket, choice) {
        if (!socket.roomCode) return;

        const game = this.gameController.getGame(socket.roomCode);
        if (!game) return;

        const result = game.selectTurnOrder(socket.id, choice);
        
        if (result.success) {
            this.io.to(socket.roomCode).emit('turn-order-selected', {
                choice,
                currentPlayer: result.currentPlayer,
                startingPlayerName: result.startingPlayerName,
                gameState: game.getGameState()
            });
            
            console.log(`Turn order selected in room ${socket.roomCode}: ${choice}, starting player: ${result.currentPlayer}`);
        } else {
            socket.emit('move-error', { message: result.reason });
        }
    }

    /**
     * Handle new game request
     */
    handleRequestNewGame(socket) {
        if (!socket.roomCode) return;

        const game = this.gameController.getGame(socket.roomCode);
        if (!game) return;

        const result = game.requestNewGame(socket.id);
        
        if (result.approved) {
            if (result.bothAgreed) {
                this.io.to(socket.roomCode).emit('game-reset', {
                    gameState: game.getGameState(),
                    message: 'Both players agreed to start a new game!'
                });
                
                if (game.waitingForTurnOrderSelection && game.turnOrderSelector) {
                    const selectorSocket = this.io.sockets.sockets.get(game.turnOrderSelector);
                    if (selectorSocket) {
                        selectorSocket.emit('show-turn-order-selection', { canChoose: true });
                    }
                }
                
                console.log(`New game started in room ${socket.roomCode} - both players agreed`);
            } else if (result.reason === 'single_player') {
                this.io.to(socket.roomCode).emit('game-reset', {
                    gameState: game.getGameState(),
                    message: 'New game started!'
                });
                console.log(`New game started in room ${socket.roomCode} - single player`);
            }
        } else if (result.waitingForOther) {
            const requesterName = game.players[socket.id]?.name || 'Player';
            this.io.to(socket.roomCode).emit('new-game-requested', {
                requesterName,
                gameState: game.getGameState()
            });
            console.log(`New game requested by ${requesterName} in room ${socket.roomCode}`);
        }
    }

    /**
     * Handle canceling new game request
     */
    handleCancelNewGameRequest(socket) {
        if (!socket.roomCode) return;

        const game = this.gameController.getGame(socket.roomCode);
        if (!game) return;

        game.cancelNewGameRequest(socket.id);
        
        const requesterName = game.players[socket.id]?.name || 'Player';
        this.io.to(socket.roomCode).emit('new-game-request-cancelled', {
            requesterName,
            gameState: game.getGameState()
        });
        console.log(`New game request cancelled by ${requesterName} in room ${socket.roomCode}`);
    }

    /**
     * Handle getting possible moves for a piece
     */
    handleGetPossibleMoves(socket, row, col) {
        if (!socket.roomCode) return;

        const game = this.gameController.getGame(socket.roomCode);
        if (!game) return;

        const piece = game.board[row][col];
        if (!piece || piece.color !== game.players[socket.id]?.color) {
            socket.emit('possible-moves', { moves: [] });
            return;
        }

        if (game.mustCapture && game.capturingPiece && 
            (game.capturingPiece.row !== row || game.capturingPiece.col !== col)) {
            socket.emit('possible-moves', { moves: [] });
            return;
        }

        const moves = game.getValidMovesForPiece(row, col);
        const captures = moves.filter(move => move.type === 'capture');
        const finalMoves = captures.length > 0 ? captures : moves;

        socket.emit('possible-moves', { 
            moves: finalMoves.map(move => ({ row: move.to.row, col: move.to.col }))
        });
    }

    /**
     * Handle player disconnecting
     */
    handleDisconnect(socket) {
        console.log('User disconnected:', socket.id);

        if (socket.roomCode) {
            const game = this.gameController.getGame(socket.roomCode);
            if (game) {
                game.removePlayer(socket.id);
                
                this.io.to(socket.roomCode).emit('player-left', {
                    players: game.players,
                    gameState: game.getGameState()
                });

                this.gameController.cleanupRoom(socket.roomCode);
            }
        }
    }
}

module.exports = SocketController;
