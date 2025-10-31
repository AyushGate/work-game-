const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// Configuration
const WS_PORT = process.env.WS_PORT || 8080;
const HTTP_PORT = process.env.HTTP_PORT || 8081;
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(__dirname, '../videos');
const BETTING_DURATION = parseInt(process.env.BETTING_DURATION) || 19000; // 19 seconds
const ROUND_DURATION = parseInt(process.env.ROUND_DURATION) || 30000; // 30 seconds
const ROUND_GAP = parseInt(process.env.ROUND_GAP) || 5000; // 5 seconds between rounds

console.log('=== M2 BGame Server Starting ===');
console.log(`Video Directory: ${VIDEO_DIR}`);
console.log(`WebSocket Port: ${WS_PORT}`);
console.log(`HTTP Port: ${HTTP_PORT}`);

// Create HTTP server for video files
const httpServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve static files from public directory
  if (pathname === '/' || pathname === '/index.html') {
    const filePath = path.join(__dirname, '../public/index.html');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fileContent);
    return;
  }

  if (pathname === '/style.css') {
    const filePath = path.join(__dirname, '../public/style.css');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(fileContent);
    return;
  }

  if (pathname === '/app.js') {
    const filePath = path.join(__dirname, '../public/app.js');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(fileContent);
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      game: gameState.isPlaying ? 'active' : 'waiting',
      clients: clients.size
    }));
    return;
  }

  if (pathname.startsWith('/video/')) {
    const videoName = decodeURIComponent(pathname.replace('/video/', ''));
    const videoPath = path.join(VIDEO_DIR, videoName);

    if (!fs.existsSync(videoPath)) {
      console.error(`Video not found: ${videoPath}`);
      res.writeHead(404);
      res.end('Video not found');
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });

      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      });

      fs.createReadStream(videoPath).pipe(res);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`✓ HTTP server running on http://localhost:${HTTP_PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });

// Game state
let gameState = {
  currentVideo: null,
  videoName: null,
  startTime: null,
  isPlaying: false,
  bettingOpen: true,
  roundDuration: ROUND_DURATION,
  bettingDuration: BETTING_DURATION,
  roundNumber: 0,
  bets: new Map() // playerId -> bet
};

const clients = new Set();

// Get all video files
function getVideoFiles() {
  if (!fs.existsSync(VIDEO_DIR)) {
    console.error(`Video directory not found: ${VIDEO_DIR}`);
    return [];
  }

  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
  const files = fs.readdirSync(VIDEO_DIR)
    .filter(file => videoExtensions.includes(path.extname(file).toLowerCase()));
  
  console.log(`Found ${files.length} video files`);
  return files;
}

// Start a new game round
function startNewRound() {
  console.log('\n=== Starting New Round ===');
  
  const videoFiles = getVideoFiles();
  if (videoFiles.length === 0) {
    console.error('❌ No video files found!');
    console.error(`Please add video files to: ${VIDEO_DIR}`);
    setTimeout(() => startNewRound(), 5000);
    return;
  }
  
  // Select random video
  const randomVideo = videoFiles[Math.floor(Math.random() * videoFiles.length)];
  console.log(`Selected video: ${randomVideo}`);
  
  gameState.currentVideo = randomVideo;
  gameState.videoName = randomVideo;
  gameState.startTime = Date.now();
  gameState.isPlaying = true;
  gameState.bettingOpen = true;
  gameState.roundNumber++;
  gameState.bets.clear();
  
  // Broadcast game start to all clients
  broadcast({
    type: 'game_start',
    videoName: randomVideo,
    videoUrl: `http://localhost:${HTTP_PORT}/video/${encodeURIComponent(randomVideo)}`,
    startTime: gameState.startTime,
    serverTime: Date.now(),
    roundNumber: gameState.roundNumber
  });
  
  console.log(`✓ Game started at: ${new Date(gameState.startTime).toISOString()}`);
  console.log(`  Round #${gameState.roundNumber}`);
  console.log(`  Connected clients: ${clients.size}`);
  
  // Close betting after specified duration
  setTimeout(() => {
    gameState.bettingOpen = false;
    broadcast({
      type: 'betting_closed',
      message: 'Betting is now closed!',
      serverTime: Date.now(),
      totalBets: gameState.bets.size
    });
    console.log(`✓ Betting closed! Total bets: ${gameState.bets.size}`);
  }, gameState.bettingDuration);
  
  // End round after specified duration
  setTimeout(() => {
    gameState.isPlaying = false;
    
    // Calculate bet statistics
    const betStats = {};
    gameState.bets.forEach((bet) => {
      betStats[bet] = (betStats[bet] || 0) + 1;
    });
    
    broadcast({
      type: 'game_end',
      message: 'Round complete!',
      serverTime: Date.now(),
      betStats: betStats
    });
    
    console.log('✓ Round complete!');
    console.log('  Bet statistics:', betStats);
    
    // Start new round after gap
    console.log(`Waiting ${ROUND_GAP / 1000}s before next round...`);
    setTimeout(() => {
      startNewRound();
    }, ROUND_GAP);
  }, gameState.roundDuration);
  
  // Send time sync updates every second
  const syncInterval = setInterval(() => {
    if (!gameState.isPlaying) {
      clearInterval(syncInterval);
      return;
    }
    
    const elapsed = Date.now() - gameState.startTime;
    broadcast({
      type: 'time_sync',
      elapsed: elapsed,
      serverTime: Date.now(),
      bettingOpen: gameState.bettingOpen
    });
  }, 1000);
}

// Broadcast message to all clients
function broadcast(data) {
  const message = JSON.stringify(data);
  let successCount = 0;
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        successCount++;
      } catch (error) {
        console.error('Error broadcasting to client:', error.message);
      }
    }
  });
  
  // console.log(`Broadcasted ${data.type} to ${successCount} clients`);
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const clientId = `${clientIp}-${Date.now()}`;
  
  console.log(`✓ New client connected: ${clientIp}`);
  clients.add(ws);
  ws.clientId = clientId;
  
  // Send current game state to new client
  if (gameState.isPlaying) {
    const elapsed = Date.now() - gameState.startTime;
    ws.send(JSON.stringify({
      type: 'game_sync',
      videoName: gameState.videoName,
      videoUrl: `http://localhost:${HTTP_PORT}/video/${encodeURIComponent(gameState.videoName)}`,
      startTime: gameState.startTime,
      elapsed: elapsed,
      bettingOpen: gameState.bettingOpen,
      serverTime: Date.now(),
      roundNumber: gameState.roundNumber
    }));
    console.log(`  Synced client with elapsed time: ${(elapsed / 1000).toFixed(1)}s`);
  } else {
    ws.send(JSON.stringify({
      type: 'waiting',
      message: 'Waiting for next round...',
      serverTime: Date.now()
    }));
  }
  
  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'place_bet') {
        if (gameState.bettingOpen) {
          gameState.bets.set(clientId, data.bet);
          console.log(`✓ Bet placed: ${data.bet} by ${clientIp}`);
          ws.send(JSON.stringify({
            type: 'bet_confirmed',
            bet: data.bet,
            message: 'Bet placed successfully!',
            serverTime: Date.now()
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'bet_rejected',
            message: 'Betting is closed!',
            serverTime: Date.now()
          }));
        }
      } else if (data.type === 'time_request') {
        // Client requesting time sync
        const elapsed = gameState.isPlaying ? Date.now() - gameState.startTime : 0;
        ws.send(JSON.stringify({
          type: 'time_sync',
          elapsed: elapsed,
          serverTime: Date.now(),
          bettingOpen: gameState.bettingOpen
        }));
      }
    } catch (error) {
      console.error('Error handling message:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log(`✗ Client disconnected: ${clientIp}`);
    clients.delete(ws);
    gameState.bets.delete(clientId);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientIp}:`, error.message);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket Server error:', error);
});

console.log(`✓ WebSocket server running on ws://localhost:${WS_PORT}`);
console.log('\n=== Server Ready ===');
console.log('Waiting 3 seconds before starting first round...\n');

// Start first round after 3 seconds
setTimeout(() => {
  startNewRound();
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n=== Shutting down server ===');
  
  broadcast({
    type: 'server_shutdown',
    message: 'Server is shutting down'
  });
  
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

