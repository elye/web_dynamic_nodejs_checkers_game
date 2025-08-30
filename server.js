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

// Import our modularized components
const GameController = require('./src/controllers/GameController');
const SocketController = require('./src/controllers/SocketController');
const createApiRoutes = require('./src/routes/api');
const { cleanupOldRooms } = require('./src/utils/gameUtils');

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

// Initialize controllers
const gameController = new GameController();
const socketController = new SocketController(io, gameController);

// Setup routes
const apiRoutes = createApiRoutes(gameController);
app.use('/', apiRoutes);

// Initialize socket handlers
socketController.initialize();

// Clean up old rooms periodically (every hour)
setInterval(() => {
    cleanupOldRooms(gameController.games, gameController.rooms, 1);
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Checkers game server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play`);
});
