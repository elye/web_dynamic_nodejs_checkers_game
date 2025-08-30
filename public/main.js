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
        
        // Cross-reference the managers
        this.roomManager.setGameManager(this.gameManager);
        this.gameManager.setRoomManager(this.roomManager);
        
        this.connectSocket();
    }

    connectSocket() {
        this.socket = io();
        
        // Set the socket for both managers
        this.roomManager.setSocket(this.socket);
        this.gameManager.setSocket(this.socket);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CheckersClient();
});
