/**
 * Game Controller
 * Handles game-related business logic and interactions between routes and game models
 */

const CheckersGame = require('../game/CheckersGame');
const { generateRoomCode } = require('../utils/gameUtils');

class GameController {
    constructor() {
        this.games = new Map();
        this.rooms = new Map();
    }

    /**
     * Create a new game room
     * @returns {Object} Object containing the room code
     */
    createRoom() {
        const roomCode = generateRoomCode();
        const game = new CheckersGame(roomCode);
        
        this.games.set(roomCode, game);
        this.rooms.set(roomCode, { playerCount: 0, created: new Date() });
        
        return { roomCode };
    }

    /**
     * Get room information
     * @param {string} roomCode - The room code to look up
     * @returns {Object|null} Room information or null if not found
     */
    getRoomInfo(roomCode) {
        const game = this.games.get(roomCode);
        
        if (!game) {
            return null;
        }
        
        return {
            roomCode,
            playerCount: Object.keys(game.players).length,
            gameState: game.gameState
        };
    }

    /**
     * Get a game instance by room code
     * @param {string} roomCode - The room code
     * @returns {CheckersGame|null} The game instance or null if not found
     */
    getGame(roomCode) {
        return this.games.get(roomCode) || null;
    }

    /**
     * Clean up empty rooms
     * @param {string} roomCode - The room code to potentially clean up
     */
    cleanupRoom(roomCode) {
        const game = this.games.get(roomCode);
        if (game && Object.keys(game.players).length === 0) {
            this.games.delete(roomCode);
            this.rooms.delete(roomCode);
            console.log(`Removed empty room ${roomCode}`);
        }
    }

    /**
     * Get current game and room statistics
     * @returns {Object} Statistics about active games and rooms
     */
    getStats() {
        return {
            activeRooms: this.games.size,
            totalPlayers: Array.from(this.games.values())
                .reduce((total, game) => total + Object.keys(game.players).length, 0)
        };
    }
}

module.exports = GameController;
