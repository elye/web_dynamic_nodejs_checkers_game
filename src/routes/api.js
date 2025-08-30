/**
 * API Routes for the checkers game
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize routes with game controller
 * @param {GameController} gameController - The game controller instance
 * @returns {express.Router} Configured router
 */
function createApiRoutes(gameController) {
    // Health check endpoint for monitoring
    router.get('/', (req, res) => {
        const stats = gameController.getStats();
        res.json({ 
            status: 'ok', 
            message: 'Checkers Game Server Running',
            timestamp: new Date().toISOString(),
            activeRooms: stats.activeRooms,
            totalPlayers: stats.totalPlayers
        });
    });

    // Create a new room
    router.post('/api/create-room', (req, res) => {
        try {
            const result = gameController.createRoom();
            res.json(result);
        } catch (error) {
            console.error('Error creating room:', error);
            res.status(500).json({ error: 'Failed to create room' });
        }
    });

    // Get room information
    router.get('/api/room/:code', (req, res) => {
        try {
            const { code } = req.params;
            const roomInfo = gameController.getRoomInfo(code);
            
            if (!roomInfo) {
                return res.status(404).json({ error: 'Room not found' });
            }
            
            res.json(roomInfo);
        } catch (error) {
            console.error('Error getting room info:', error);
            res.status(500).json({ error: 'Failed to get room information' });
        }
    });

    return router;
}

module.exports = createApiRoutes;
