// Warn user before leaving or refreshing the page to prevent accidental loss of game state
window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to leave? Your game progress will be lost.';
});

/**
 * Main Checkers Client
 * Coordinates between RoomManager and GameManager
 */

class CheckersClient {
    constructor() {
        this.socket = null;
        this.roomManager = new RoomManager();
        this.gameManager = new GameManager();
        this.sessionId = this.getOrCreateSessionId();
        
        // Cross-reference the managers
        this.roomManager.setGameManager(this.gameManager);
        this.gameManager.setRoomManager(this.roomManager);
        
        this.connectSocket();
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('checkers_session_id');
        if (!sessionId) {
            sessionId = this.generateSessionId();
            localStorage.setItem('checkers_session_id', sessionId);
        }
        return sessionId;
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    connectSocket() {
        this.socket = io({
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });
        
        // Pass session ID to managers
        this.roomManager.setSessionId(this.sessionId);
        this.gameManager.setSessionId(this.sessionId);
        
        // Set the socket for both managers
        this.roomManager.setSocket(this.socket);
        this.gameManager.setSocket(this.socket);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CheckersClient();
});
