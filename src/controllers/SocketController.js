/**
 * Socket Controller
 * Handles all Socket.IO events and game interactions
 */

class SocketController {
    constructor(io, gameController) {
        this.io = io;
        this.gameController = gameController;
        this.socketToSession = {}; // socketId -> sessionId mapping
        this.sessionToSocket = {}; // sessionId -> socketId mapping
        this.disconnectTimers = {}; // sessionId -> timer
        this.DISCONNECT_GRACE_PERIOD = 60000; // 60 seconds
    }

    /**
     * Initialize socket event handlers
     */
    initialize() {
        this.io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            // Join room (with session support)
            socket.on('join-room', ({ roomCode, playerName, sessionId }) => {
                this.handleJoinRoom(socket, roomCode, playerName, sessionId);
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
    handleJoinRoom(socket, roomCode, playerName, sessionId) {
        const game = this.gameController.getGame(roomCode);
        
        if (!game) {
            socket.emit('error', { message: 'Room not found' });
            socket.emit('clear-session-data'); // Tell client to clear localStorage
            return;
        }

        // Check if this is a reconnection (player exists and is disconnected)
        const isReconnecting = game.players[sessionId] && game.players[sessionId].disconnected;
        
        // If player exists but is NOT disconnected, they're trying to join twice - reject
        if (game.players[sessionId] && !game.players[sessionId].disconnected) {
            socket.emit('error', { message: 'You are already in this room' });
            return;
        }
        
        // If player doesn't exist and room is full, they might have been removed
        if (!game.players[sessionId] && Object.keys(game.players).length >= 2) {
            socket.emit('error', { message: 'Room is full' });
            socket.emit('clear-session-data'); // Tell client to clear old session data
            return;
        }
        
        // Clear disconnect timer if reconnecting
        if (isReconnecting && this.disconnectTimers[sessionId]) {
            clearTimeout(this.disconnectTimers[sessionId].timer);
            delete this.disconnectTimers[sessionId];
        }
        
        // Update session mappings
        const oldSocketId = this.sessionToSocket[sessionId];
        if (oldSocketId) {
            delete this.socketToSession[oldSocketId];
        }
        this.socketToSession[socket.id] = sessionId;
        this.sessionToSocket[sessionId] = socket.id;

        const result = game.addPlayer(sessionId, playerName, socket.id);
        
        if (result.success === false && !result.reconnected) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.sessionId = sessionId;

        if (result.reconnected) {
            // Player reconnected
            console.log(`Player ${playerName} (session: ${sessionId}) reconnected to room ${roomCode}`);
            
            // Get info about other disconnected players
            const disconnectedPlayers = [];
            for (const [sid, player] of Object.entries(game.players)) {
                if (player.disconnected && sid !== sessionId) {
                    const timerInfo = this.disconnectTimers[sid];
                    if (timerInfo) {
                        disconnectedPlayers.push({
                            sessionId: sid,
                            remainingSeconds: timerInfo.remainingSeconds
                        });
                    }
                }
            }
            
            // Notify the reconnected player
            socket.emit('reconnected', {
                message: 'Successfully reconnected!',
                gameState: game.getGameState(),
                sessionId: sessionId,
                disconnectedPlayers: disconnectedPlayers
            });
            
            // Notify other players
            socket.to(roomCode).emit('player-reconnected', {
                players: game.players,
                gameState: game.getGameState()
            });
            
            this.io.to(roomCode).emit('player-joined', {
                players: game.players,
                gameState: game.getGameState()
            });
        } else {
            // New player joined
            this.io.to(roomCode).emit('player-joined', {
                players: game.players,
                gameState: game.getGameState()
            });
        }

        socket.emit('game-state', game.getGameState());
        
        if (game.waitingForTurnOrderSelection) {
            if (game.turnOrderSelector === sessionId) {
                socket.emit('show-turn-order-selection', { canChoose: true });
            } else {
                socket.emit('game-state', game.getGameState());
            }
            
            if (game.turnOrderSelector) {
                // Find the socket for the turn order selector
                const selectorSocketId = this.sessionToSocket[game.turnOrderSelector];
                if (selectorSocketId) {
                    const selectorSocket = this.io.sockets.sockets.get(selectorSocketId);
                    if (selectorSocket) {
                        selectorSocket.emit('show-turn-order-selection', { canChoose: true });
                    }
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
        
        const sessionId = this.socketToSession[socket.id];
        if (!sessionId) return;

        const result = game.makeMove(fromRow, fromCol, toRow, toCol, sessionId);
        
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
        
        const sessionId = this.socketToSession[socket.id];
        if (!sessionId) return;

        const result = game.selectTurnOrder(sessionId, choice);
        
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
        
        const sessionId = this.socketToSession[socket.id];
        if (!sessionId) return;

        const result = game.requestNewGame(sessionId);
        
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
        
        const sessionId = this.socketToSession[socket.id];
        if (!sessionId) return;

        game.cancelNewGameRequest(sessionId);
        
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
        
        const sessionId = this.socketToSession[socket.id];
        if (!sessionId) return;

        const piece = game.board[row][col];
        if (!piece || piece.color !== game.players[sessionId]?.color) {
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

        const sessionId = this.socketToSession[socket.id];
        if (!sessionId) return;
        
        if (socket.roomCode) {
            const game = this.gameController.getGame(socket.roomCode);
            if (game && game.players[sessionId]) {
                const player = game.players[sessionId];
                
                // Mark player as disconnected in game
                game.markPlayerDisconnected(sessionId);
                
                console.log(`Player ${player.name} (session: ${sessionId}) disconnected from room ${socket.roomCode}`);
                
                // Notify other players about disconnection
                this.io.to(socket.roomCode).emit('player-disconnected', {
                    sessionId,
                    playerName: player.name,
                    players: game.players,
                    gameState: game.getGameState(),
                    gracePeriod: this.DISCONNECT_GRACE_PERIOD
                });
                
                // Start grace period timer and track start time
                const disconnectStartTime = Date.now();
                this.disconnectTimers[sessionId] = {
                    timer: setTimeout(() => {
                        // Check if player is still disconnected
                        if (game.players[sessionId] && game.players[sessionId].disconnected) {
                            // Player didn't reconnect, remove them
                            const removedPlayerColor = game.players[sessionId].color;
                            game.removePlayer(sessionId);
                            
                            // Notify room
                            this.io.to(socket.roomCode).emit('player-removed', {
                                sessionId,
                                playerName: player.name,
                                players: game.players,
                                gameState: game.getGameState()
                            });
                            
                            // Emit to the specific session to clear localStorage
                            // (in case they reconnect later)
                            this.io.emit('session-removed', {
                                sessionId,
                                roomCode: socket.roomCode
                            });
                            
                            // Cleanup session mappings
                            delete this.disconnectTimers[sessionId];
                            delete this.socketToSession[socket.id];
                            delete this.sessionToSocket[sessionId];
                            
                            this.gameController.cleanupRoom(socket.roomCode);
                        }
                    }, this.DISCONNECT_GRACE_PERIOD),
                    startTime: disconnectStartTime,
                    get remainingSeconds() {
                        const elapsed = Date.now() - disconnectStartTime;
                        const remaining = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
                        return remaining;
                    }
                };
            }
        }
        
        // Note: We don't delete socket mappings here since player might reconnect
    }
}

module.exports = SocketController;
