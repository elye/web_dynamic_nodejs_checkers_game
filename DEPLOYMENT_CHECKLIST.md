# 🚀 Render.com Deployment Checklist

## Before You Deploy

### ✅ Code Preparation
- [ ] All code committed and pushed to GitHub
- [ ] `package.json` has correct `start` script: `"start": "node server.js"`
- [ ] Server listens on `process.env.PORT || 3000`
- [ ] All dependencies in `dependencies` (not `devDependencies`)
- [ ] `.gitignore` excludes `node_modules/`

### ✅ GitHub Repository
- [ ] Repository is public or you have Render connected to private repos
- [ ] Latest code pushed to main branch
- [ ] Repository contains all necessary files

## Deployment Steps

### 1. Create Render Account
- [ ] Sign up at [render.com](https://render.com)
- [ ] Connect your GitHub account

### 2. Create Web Service
- [ ] Click "New" → "Web Service"
- [ ] Select your checkers game repository
- [ ] Configure settings:
  - **Name**: `checkers-game` (or your choice)
  - **Runtime**: `Node`
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`

### 3. Deploy & Test
- [ ] Click "Create Web Service"
- [ ] Wait for build to complete (2-5 minutes)
- [ ] Test your live URL: `https://your-app-name.onrender.com`
- [ ] Create a room and test multiplayer functionality

## Post-Deployment

### ✅ Functionality Tests
- [ ] Website loads correctly
- [ ] Can create new rooms
- [ ] Can join existing rooms
- [ ] Real-time moves work between players
- [ ] Game rules work correctly (captures, kings, etc.)
- [ ] Mobile responsiveness works
- [ ] Room codes can be shared and work

### ✅ Optional Enhancements
- [ ] Set up custom domain (if you have one)
- [ ] Configure environment variables (if needed)
- [ ] Set up monitoring (UptimeRobot for free tier)
- [ ] Upgrade to paid plan (to eliminate cold starts)

## Troubleshooting

### Build Fails?
- [ ] Check build logs in Render dashboard
- [ ] Verify `package.json` scripts are correct
- [ ] Ensure Node.js version compatibility

### App Won't Start?
- [ ] Check application logs
- [ ] Verify server listens on correct port
- [ ] Test `npm start` locally

### WebSocket Issues?
- [ ] Render supports WebSockets natively - should work automatically
- [ ] Check browser console for connection errors

## 🎉 Success!

Once all items are checked:
- ✅ Your checkers game is live on the internet
- ✅ Players can access it 24/7
- ✅ Real-time multiplayer works globally
- ✅ Automatic HTTPS and security
- ✅ Auto-deploys when you push code changes

**Share your game**: `https://your-app-name.onrender.com`

---

**Need help?** Check `RENDER_DEPLOYMENT.md` for detailed instructions!
