# Online Checkers Game

A real-time multiplayer checkers game built with Node.js, Socket.io, and vanilla JavaScript. Play with friends online using unique room codes!

## Features

### 🎮 Complete Checkers Game
- Standard 8x8 checkers board
- All official checkers rules implemented
- Regular pieces and king pieces
- Mandatory captures with multiple jumps
- Piece promotion when reaching the opposite end
- Turn-based gameplay with move validation

### 🌐 Real-time Multiplayer
- Create and join rooms with unique codes
- Instant move synchronization via WebSocket
- Player connection/disconnection handling
- Multiple concurrent games support
- Room code sharing system

### 📱 User-Friendly Interface
- Drag-and-drop or click-to-move controls
- Visual feedback for valid moves and captures
- Responsive design (mobile and desktop)
- Real-time opponent move updates
- Game status indicators and turn management
- Visual highlighting of possible moves
- **🎉 Confetti celebration for winners**
- **💪 Motivational consolation messages for losers**
- Enhanced game over experience with personalized feedback

### 🔧 Technical Features
- Express.js REST API for room management
- Socket.io for real-time communication
- In-memory game state storage
- Error handling and input validation
- Production-ready code structure

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
   ```bash
   cd checkers-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

5. **Start playing!**
   - Enter your name
   - Create a new room or join an existing one
   - Share the room code with a friend
   - Enjoy the game!

## How to Play

### Game Setup
1. **Create Room**: Click "Create Room" to start a new game
2. **Join Room**: Enter a room code to join an existing game
3. **Share Code**: Copy and share the room code with your opponent

### Game Rules
- **Red pieces** start at the top, **black pieces** at the bottom
- **Red player** moves first
- Pieces move diagonally on dark squares only
- **Captures** are mandatory when available
- **Multiple jumps** must be completed in the same turn
- Pieces become **kings** when reaching the opposite end
- **Kings** can move backward and forward
- **Win** by capturing all opponent pieces or blocking all moves

### Controls
- **Click** on your piece to select it
- **Click** on a highlighted square to move
- **Drag and drop** pieces to move them
- Green dots show valid move destinations
- Gold highlight shows your selected piece

### Game End Experience
- **🏆 Winners** get a spectacular confetti celebration with animated title and victory messages
- **💪 Losers** receive motivational consolation messages encouraging them to never give up
- Dynamic modal styling that changes based on the game outcome
- Random inspirational quotes to keep players motivated for the next game

## Project Structure

```
checkers-game/
├── server.js              # Express + Socket.io backend
├── package.json           # Dependencies and scripts
├── public/                # Frontend files
│   ├── index.html         # Game interface
│   ├── style.css          # Base styling
│   ├── room-styles.css    # Room management styles
│   ├── game-styles.css    # Game board and gameplay styles
│   ├── main.js            # Entry point and coordinator
│   ├── room-manager.js    # Room creation and management logic
│   └── game-manager.js    # Game board and gameplay logic
├── README.md             # This file
└── REFACTORING_README.md # Details about the new modular structure
```

## API Endpoints

### REST API
- `POST /api/create-room` - Create a new game room
- `GET /api/room/:code` - Get room information

### WebSocket Events

#### Client → Server
- `join-room` - Join a game room
- `make-move` - Make a move
- `reset-game` - Reset the game
- `get-possible-moves` - Get valid moves for a piece

#### Server → Client  
- `player-joined` - Player joined the room
- `player-left` - Player left the room
- `game-state` - Full game state update
- `move-made` - Move was made
- `move-error` - Invalid move attempted
- `game-over` - Game finished
- `game-reset` - Game was reset
- `possible-moves` - Valid moves for selected piece

## Deployment

### 🚀 Deploy to Render.com (Recommended)

**Quick Deployment:**
1. Push your code to GitHub
2. Sign up at [render.com](https://render.com) 
3. Create new Web Service from your GitHub repo
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Deploy! Your game will be live at `https://your-app-name.onrender.com`

📚 **Detailed guide**: See `RENDER_DEPLOYMENT.md` for complete instructions

**Why Render?**
- ✅ Free tier available
- ✅ Perfect Socket.io/WebSocket support  
- ✅ Auto-deploy from Git
- ✅ Automatic HTTPS
- ✅ No configuration needed

### Local Development
The game runs on `http://localhost:3000` by default.

### Production Deployment
1. Set the `PORT` environment variable
2. Ensure Node.js is installed on your server
3. Run `npm install --production`
4. Start with `npm start`

### Environment Variables
- `PORT` - Server port (default: 3000)

## Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### Common Issues

**"Room not found" error**
- Room codes expire after 1 hour of inactivity
- Double-check the room code spelling

**Connection issues**
- Check your internet connection
- Refresh the page to reconnect
- Try a different browser

**Moves not working**
- Ensure it's your turn (check turn indicator)
- Only your pieces can be moved
- Captures are mandatory when available

### Development

**Install development dependencies**
```bash
npm install
```

**Run with auto-restart**
```bash
npm run dev
```

## Contributing

Feel free to submit issues and pull requests to improve the game!

## License

MIT License - feel free to use this project for learning or personal use.

---

**Have fun playing checkers online! 🔴⚫**
