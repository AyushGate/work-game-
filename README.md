# 🎮 M2 BGame - Real-Time Video Streaming & Betting Game

[![Status](https://img.shields.io/badge/status-ready-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D14-blue)]()
[![Videos](https://img.shields.io/badge/videos-36-orange)]()
[![Build](https://img.shields.io/badge/build-493MB-red)]()

> Real-time synchronized video streaming game where multiple players watch the same video at exactly the same time and place bets.

---

## 🚀 Quick Start

```bash
npm start
open public/index.html
```

**That's it!** Server starts and you can play immediately.

---

## 📖 Documentation

- **[START_HERE.md](START_HERE.md)** ⭐ **Begin here!** Quick start guide
- **[NEW_README.md](NEW_README.md)** 📖 Complete documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** 🚀 Production deployment
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** 📊 Build summary

---

## ✨ Features

- ✅ **Perfect Sync** - All players see same moment
- ✅ **19s Betting** - Automatic timer
- ✅ **6 Colors** - Red, Blue, Green, Yellow, Black, White
- ✅ **Auto-Reconnect** - Close browser, reopen = auto-sync
- ✅ **36 Videos** - Random selection each round
- ✅ **Production Ready** - 493MB build included

---

## 📦 What's Included

```
✓ Complete source code
✓ Production build (dist/)
✓ Portable package (493MB zip)
✓ 36 video files
✓ Build & deploy scripts
✓ Complete documentation
```

---

## 🎯 Tech Stack

- **Backend**: Node.js + WebSocket
- **Frontend**: HTML5 + Vanilla JS
- **Video**: HTML5 Video API
- **No Database**: Stateless design
- **No Framework**: Pure JavaScript

---

## 🔧 Commands

```bash
npm start          # Start server
npm run dev        # Dev mode with reload
npm run build      # Build for production
npm run build:zip  # Create portable zip
./build.sh         # Full build script
./deploy.sh        # Deploy with PM2
```

---

## 🌐 URLs

- **Client**: `public/index.html`
- **Health**: http://localhost:8081/health
- **WebSocket**: ws://localhost:8080
- **HTTP**: http://localhost:8081

---

## 📊 Current Status

🟢 **Server**: Running  
🟢 **Build**: Complete (493MB)  
🟢 **Videos**: 36 files ready  
🟢 **Docs**: 100% complete  
🟢 **Production**: Ready to deploy

---

## 🎮 How It Works

1. Server selects random video
2. Broadcasts to all clients
3. Everyone watches synchronized
4. Bet opens for 19 seconds
5. Players place bets
6. Betting closes automatically
7. Round completes
8. New round starts

**Perfect sync** achieved through WebSocket time synchronization every 2 seconds.

---

## 🚀 Deployment

### Quick Deploy

```bash
# Use the included zip file
unzip m2-bgame-build.zip
cd m2-bgame-build
npm install
./deploy.sh
```

### Production with PM2

```bash
./deploy.sh
pm2 status
pm2 logs m2-bgame
```

---

## 🧪 Testing

```bash
# Test single player
npm start
open public/index.html

# Test multiplayer sync
# Open public/index.html in 3+ tabs
# All tabs show same video at same time!
```

---

## 📁 Structure

```
M2 BGame/
├── src/server.js       # Main server
├── public/             # Web client
│   ├── index.html
│   ├── style.css
│   └── app.js
├── videos/             # 36 video files
├── dist/               # Production build
└── *.zip               # Portable package
```

---

## ⚙️ Configuration

Edit `.env`:

```env
WS_PORT=8080              # WebSocket port
HTTP_PORT=8081            # HTTP port
BETTING_DURATION=19000    # 19 seconds
ROUND_DURATION=30000      # 30 seconds
```

---

## 🐛 Troubleshooting

**Videos not playing?**
- Click video to enable autoplay
- Check browser console (F12)

**Connection issues?**
- Verify server is running
- Check ports: `lsof -i :8080`

**Need help?**
- Check `START_HERE.md`
- Read `NEW_README.md`
- Test: `curl http://localhost:8081/health`

---

## 📞 Support

- Full docs: `NEW_README.md`
- Quick start: `START_HERE.md`
- Deploy guide: `DEPLOYMENT.md`
- Summary: `PROJECT_SUMMARY.md`

---

## 🎉 Ready to Go!

Everything is set up and tested:

- ✅ 36 videos included
- ✅ Production build ready
- ✅ 493MB portable package
- ✅ Complete documentation
- ✅ Working and tested

Just run `npm start` and open `public/index.html`!

---

**Built with ❤️ for real-time gaming**

*Last updated: October 31, 2025*
