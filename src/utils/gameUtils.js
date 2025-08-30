/**
 * Utility functions for the checkers game
 */

/**
 * Generate unique room code
 * @returns {string} A 6-character uppercase alphanumeric room code
 */
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

/**
 * Clean up old rooms periodically
 * @param {Map} games - Map of active games
 * @param {Map} rooms - Map of room metadata
 * @param {number} maxAgeHours - Maximum age in hours before cleanup (default: 1)
 */
function cleanupOldRooms(games, rooms, maxAgeHours = 1) {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [roomCode, room] of rooms.entries()) {
        if (room.created < cutoffTime) {
            games.delete(roomCode);
            rooms.delete(roomCode);
            console.log(`Cleaned up old room: ${roomCode}`);
        }
    }
}

module.exports = {
    generateRoomCode,
    cleanupOldRooms
};
