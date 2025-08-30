# Checkers Game - Modular Structure

This document describes the refactored modular structure of the checkers game server.

## Project Structure

```
project-root/
├── server.js                    # Main server entry point
├── package.json                 # Project dependencies
├── /src                         # Source code
│   ├── /game                    # Game logic
│   │   └── CheckersGame.js      # Checkers game class and rules
│   ├── /routes                  # API routes
│   │   └── api.js               # HTTP API endpoints
│   ├── /controllers             # Business logic controllers
│   │   ├── GameController.js    # Game management controller
│   │   └── SocketController.js  # Socket.IO event handling
│   └── /utils                   # Utility functions
│       └── gameUtils.js         # Game utility functions
├── /public                      # Static files (HTML, CSS, JS)
├── /views                       # Views (if using templating engine)
```

## Architecture Overview

### Components

1. **server.js** - Main entry point that orchestrates all components
2. **CheckersGame.js** - Pure game logic with no external dependencies
3. **GameController.js** - Manages game instances and room lifecycle
4. **SocketController.js** - Handles all Socket.IO events and real-time communication
5. **api.js** - REST API endpoints for HTTP requests
6. **gameUtils.js** - Utility functions for room management

### Benefits of This Structure

- **Separation of Concerns**: Each file has a single responsibility
- **Testability**: Pure game logic can be tested independently
- **Maintainability**: Easy to locate and modify specific functionality
- **Scalability**: Easy to add new features or modify existing ones
- **Code Reusability**: Components can be reused or replaced independently

### Key Design Patterns

- **Controller Pattern**: Separates business logic from routes
- **Dependency Injection**: Controllers receive dependencies through constructors
- **Single Responsibility**: Each class/module has one primary purpose
- **Encapsulation**: Game state and logic is contained within the CheckersGame class

## Usage

The refactored server maintains the same external API and WebSocket interface, so no changes are needed to the client-side code.

To run the server:
```bash
npm start
```

All existing functionality is preserved:
- Real-time multiplayer gameplay
- Room-based sessions
- Turn order selection
- Game state management
- Player reconnection
- New game requests
