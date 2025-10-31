// Configuration - Auto-detect environment
const getWebSocketURL = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.hostname === 'localhost' ? ':8080' : '';
  return `${protocol}//${host}${port}`;
};

const WS_URL = getWebSocketURL();
const SYNC_CHECK_INTERVAL = 2000; // 2 seconds
const MAX_SYNC_DIFF = 0.5; // 0.5 seconds

console.log('WebSocket URL:', WS_URL); // Debug log

// State
let ws;
let currentBet = null;
let bettingOpen = false;
let bettingTimer = null;
let gameStartTime = null;
let syncCheckInterval = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// DOM Elements
const videoPlayer = document.getElementById('videoPlayer');
const videoOverlay = document.getElementById('videoOverlay');
const connectionStatus = document.getElementById('connectionStatus');
const roundInfo = document.getElementById('roundInfo');
const videoInfo = document.getElementById('videoInfo');
const videoName = document.getElementById('videoName');
const syncInfo = document.getElementById('syncInfo');
const bettingTimerEl = document.getElementById('bettingTimer');
const betStatus = document.getElementById('betStatus');
const progressBar = document.getElementById('progressBar');
const logsContainer = document.getElementById('logs');

// Utility Functions
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    logsContainer.appendChild(entry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Keep only last 100 logs
    while (logsContainer.children.length > 100) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

function clearLogs() {
    logsContainer.innerHTML = '';
    log('Logs cleared', 'info');
}

function updateConnectionStatus(status, text) {
    connectionStatus.className = `status ${status}`;
    connectionStatus.textContent = text;
}

function showBetStatus(message, show = true) {
    betStatus.textContent = message;
    betStatus.className = show ? 'bet-status active' : 'bet-status';
}

// WebSocket Functions
function connectWebSocket() {
    log('Connecting to server...', 'info');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        log('✓ Connected to server', 'success');
        updateConnectionStatus('connected', '🟢 Connected');
        reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error('Error parsing message:', error);
            log('Error parsing server message', 'error');
        }
    };

    ws.onclose = () => {
        log('Disconnected from server', 'error');
        updateConnectionStatus('disconnected', '🔴 Disconnected');
        
        // Clear sync interval
        if (syncCheckInterval) {
            clearInterval(syncCheckInterval);
        }
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            log(`Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${maxReconnectAttempts})`, 'warning');
            setTimeout(connectWebSocket, delay);
        } else {
            log('Max reconnection attempts reached. Please refresh page.', 'error');
        }
    };

    ws.onerror = (error) => {
        log('WebSocket error occurred', 'error');
        console.error('WebSocket error:', error);
    };
}

// Message Handlers
function handleMessage(data) {
    console.log('Message received:', data);

    switch (data.type) {
        case 'game_start':
            log(`🎮 New game started: ${data.videoName}`, 'success');
            roundInfo.textContent = `Round #${data.roundNumber}`;
            startGame(data.videoUrl, data.videoName, data.startTime);
            break;

        case 'game_sync':
            log(`🔄 Syncing with game: ${data.videoName}`, 'info');
            roundInfo.textContent = `Round #${data.roundNumber}`;
            syncGame(data.videoUrl, data.videoName, data.elapsed, data.bettingOpen);
            break;

        case 'time_sync':
            updateTimeSync(data.elapsed, data.bettingOpen);
            break;

        case 'betting_closed':
            log('⏰ ' + data.message, 'warning');
            bettingOpen = false;
            updateBettingUI();
            if (bettingTimer) {
                clearInterval(bettingTimer);
            }
            bettingTimerEl.textContent = 'BETTING CLOSED';
            bettingTimerEl.classList.add('closed');
            break;

        case 'bet_confirmed':
            log(`✓ Bet placed: ${data.bet.toUpperCase()}`, 'success');
            currentBet = data.bet;
            showBetStatus(`Your bet: ${data.bet.toUpperCase()} 🎯`);
            updateBettingUI();
            break;

        case 'bet_rejected':
            log('✗ ' + data.message, 'error');
            break;

        case 'game_end':
            log('🏁 ' + data.message, 'info');
            if (data.betStats) {
                log(`Bet stats: ${JSON.stringify(data.betStats)}`, 'info');
            }
            bettingTimerEl.style.display = 'none';
            
            // Clear sync interval
            if (syncCheckInterval) {
                clearInterval(syncCheckInterval);
            }
            
            // Reset bet for next round
            setTimeout(() => {
                currentBet = null;
                showBetStatus('', false);
            }, 2000);
            break;

        case 'waiting':
            log('⏳ ' + data.message, 'info');
            updateConnectionStatus('waiting', '⏳ Waiting');
            videoOverlay.style.display = 'flex';
            videoOverlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div>${data.message}</div>
            `;
            videoInfo.style.display = 'none';
            bettingTimerEl.style.display = 'none';
            break;

        case 'server_shutdown':
            log('⚠️ Server is shutting down', 'warning');
            break;
    }
}

// Game Functions
function startGame(videoUrl, name, startTime) {
    videoName.textContent = `Video: ${name}`;
    videoInfo.style.display = 'block';
    videoOverlay.style.display = 'none';
    bettingOpen = true;
    currentBet = null;
    gameStartTime = startTime;
    showBetStatus('', false);
    
    updateBettingUI();
    startBettingTimer(19);
    
    // Load and play video
    videoPlayer.src = videoUrl;
    videoPlayer.load();
    
    const playPromise = videoPlayer.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                log('Video playing', 'success');
            })
            .catch(error => {
                log('Autoplay blocked - click video to play', 'warning');
                console.error('Play error:', error);
            });
    }
    
    // Start periodic sync checks
    startSyncCheck();
}

function syncGame(videoUrl, name, elapsed, isBettingOpen) {
    videoName.textContent = `Video: ${name}`;
    videoInfo.style.display = 'block';
    videoOverlay.style.display = 'none';
    bettingOpen = isBettingOpen;
    
    // Load video and seek to current position
    videoPlayer.src = videoUrl;
    videoPlayer.load();
    
    const onMetadataLoaded = () => {
        const seekTime = elapsed / 1000;
        videoPlayer.currentTime = seekTime;
        
        const playPromise = videoPlayer.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    log(`✓ Synced to ${seekTime.toFixed(2)}s`, 'success');
                })
                .catch(error => {
                    log('Autoplay blocked - click video to play', 'warning');
                    console.error('Play error:', error);
                });
        }
    };
    
    if (videoPlayer.readyState >= 1) {
        onMetadataLoaded();
    } else {
        videoPlayer.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });
    }
    
    // Update betting UI
    const remaining = Math.max(0, 19 - Math.floor(elapsed / 1000));
    if (bettingOpen && remaining > 0) {
        startBettingTimer(remaining);
    } else {
        bettingOpen = false;
        bettingTimerEl.textContent = 'BETTING CLOSED';
        bettingTimerEl.classList.add('closed');
        bettingTimerEl.style.display = 'block';
    }
    
    updateBettingUI();
    startSyncCheck();
}

function updateTimeSync(elapsed, isBettingOpen) {
    const remaining = Math.max(0, 19 - Math.floor(elapsed / 1000));
    if (isBettingOpen && remaining > 0 && bettingTimerEl.style.display !== 'none') {
        bettingTimerEl.textContent = `BETTING OPEN: ${remaining}s`;
    }
}

function startSyncCheck() {
    // Clear existing interval
    if (syncCheckInterval) {
        clearInterval(syncCheckInterval);
    }
    
    // Check sync every few seconds
    syncCheckInterval = setInterval(() => {
        if (!gameStartTime || videoPlayer.paused) return;
        
        const serverElapsed = (Date.now() - gameStartTime) / 1000;
        const playerTime = videoPlayer.currentTime;
        const diff = Math.abs(serverElapsed - playerTime);
        
        if (diff > MAX_SYNC_DIFF && diff < 5) {
            // More than threshold but less than 5 seconds - resync
            log(`Resyncing: diff ${diff.toFixed(2)}s`, 'warning');
            videoPlayer.currentTime = serverElapsed;
        }
        
        // Update sync info
        if (diff < 0.3) {
            syncInfo.textContent = 'Sync: Perfect ✓';
            syncInfo.style.color = '#10b981';
        } else if (diff < 1) {
            syncInfo.textContent = `Sync: Good (${diff.toFixed(2)}s)`;
            syncInfo.style.color = '#f59e0b';
        } else {
            syncInfo.textContent = 'Sync: Adjusting...';
            syncInfo.style.color = '#ef4444';
        }
    }, SYNC_CHECK_INTERVAL);
}

function startBettingTimer(seconds) {
    bettingTimerEl.style.display = 'block';
    bettingTimerEl.classList.remove('closed');
    
    let remaining = seconds;
    bettingTimerEl.textContent = `BETTING OPEN: ${remaining}s`;

    if (bettingTimer) {
        clearInterval(bettingTimer);
    }

    bettingTimer = setInterval(() => {
        remaining--;
        if (remaining >= 0) {
            bettingTimerEl.textContent = `BETTING OPEN: ${remaining}s`;
        }

        if (remaining <= 0) {
            clearInterval(bettingTimer);
        }
    }, 1000);
}

function updateBettingUI() {
    const buttons = document.querySelectorAll('.bet-btn');
    buttons.forEach(btn => {
        btn.disabled = !bettingOpen || currentBet !== null;
    });
}

function placeBet(color) {
    if (!bettingOpen) {
        log('✗ Betting is closed!', 'error');
        return;
    }

    if (currentBet) {
        log('✗ You have already placed a bet!', 'error');
        return;
    }

    if (ws.readyState !== WebSocket.OPEN) {
        log('✗ Not connected to server', 'error');
        return;
    }

    ws.send(JSON.stringify({
        type: 'place_bet',
        bet: color
    }));

    log(`Placing bet on ${color.toUpperCase()}...`, 'info');
}

// Video Event Handlers
videoPlayer.addEventListener('playing', () => {
    if (videoPlayer.currentTime > 1) { // Not initial play
        log('Video resumed', 'info');
    }
});

videoPlayer.addEventListener('pause', () => {
    if (!videoPlayer.ended) {
        log('Video paused', 'warning');
    }
});

videoPlayer.addEventListener('waiting', () => {
    log('Buffering...', 'warning');
});

videoPlayer.addEventListener('canplay', () => {
    // Video can play
});

videoPlayer.addEventListener('error', (e) => {
    const error = videoPlayer.error;
    let errorMessage = 'Video error occurred';
    
    if (error) {
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                errorMessage = 'Video loading aborted';
                break;
            case error.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error while loading video';
                break;
            case error.MEDIA_ERR_DECODE:
                errorMessage = 'Video decoding error';
                break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Video format not supported';
                break;
        }
    }
    
    log(`✗ ${errorMessage}`, 'error');
    console.error('Video error:', error);
});

// Update progress bar
videoPlayer.addEventListener('timeupdate', () => {
    if (videoPlayer.duration && videoPlayer.duration > 0) {
        const progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    log('Application initialized', 'success');
    log('Connecting to server...', 'info');
    connectWebSocket();
});

// Visibility change handler - sync when tab becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ws && ws.readyState === WebSocket.OPEN && gameStartTime) {
        log('Tab visible - requesting sync', 'info');
        ws.send(JSON.stringify({ type: 'time_request' }));
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
    if (syncCheckInterval) {
        clearInterval(syncCheckInterval);
    }
    if (bettingTimer) {
        clearInterval(bettingTimer);
    }
});

