class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connections = [];
        this.isHost = false;
        this.isConnected = false;
        this.myPlayerId = null;
        this.playerNames = {};
        this.roomCode = null;
        
        // Network sync settings - Heavily optimized for performance
        this.updateRate = 3; // Only 3 updates per second to prevent FPS issues
        this.lastUpdate = 0;
        this.syncInterval = 1000 / this.updateRate;
        
        // Separate update intervals for different data types
        this.playerUpdateInterval = 100; // 10 FPS for player movement
        this.gameStateUpdateInterval = 500; // 2 FPS for game state
        this.lastPlayerUpdate = 0;
        this.lastGameStateUpdate = 0;
        
        // Player data cache
        this.remotePlayers = {};
        this.lastPlayerData = null;
        this.lastSentPlayerData = null;
        
        this.setupUI();
        
        // Disable frequent debug logging
        this.enableDebugLogging = false;
    }

    setupUI() {
        // Get UI elements
        this.multiplayerMenu = document.getElementById('multiplayerMenu');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.roomCodeInput = document.getElementById('roomCodeInput');
        this.roomInfo = document.getElementById('roomInfo');
        this.codeDisplay = document.getElementById('codeDisplay');
        this.copyCodeBtn = document.getElementById('copyCodeBtn');
        this.playerCount = document.getElementById('playerCount');
        this.playerListUL = document.getElementById('playerListUL');
        this.startGameBtn = document.getElementById('startGameBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusText = document.getElementById('statusText');

        // Event listeners
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        this.startGameBtn.addEventListener('click', () => this.startMultiplayerGame());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // Enter key to join room
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Allow normal typing - no interference
        this.roomCodeInput.addEventListener('keydown', (e) => {
            // Don't prevent any keystrokes - let user type freely
            // Only format when they finish typing (on blur)
        });
        
        // Less aggressive auto-format - only on blur/paste to avoid blocking normal typing
        this.roomCodeInput.addEventListener('blur', (e) => {
            this.formatRoomCodeInput(e.target);
        });
        
        this.roomCodeInput.addEventListener('paste', (e) => {
            setTimeout(() => this.formatRoomCodeInput(e.target), 0);
        });
    }

    formatRoomCodeInput(input) {
        // Get current cursor position before formatting
        const cursorPos = input.selectionStart;
        
        // Clean and format the input
        let value = input.value.replace(/[^A-Z0-9-]/gi, ''); // Allow letters, numbers, and dashes
        value = value.toUpperCase(); // Convert to uppercase
        
        // Remove existing dashes for reformatting
        value = value.replace(/-/g, '');
        
        // Add dashes at positions 3 and 6 only if we have enough characters
        if (value.length > 3) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        }
        if (value.length > 7) {
            value = value.slice(0, 7) + '-' + value.slice(7);
        }
        
        // Limit to 11 characters (3-3-3 format)
        if (value.length > 11) {
            value = value.slice(0, 11);
        }
        
        input.value = value;
        
        // Try to restore cursor position (approximate)
        if (cursorPos <= input.value.length) {
            input.setSelectionRange(cursorPos, cursorPos);
        }
    }

    showMultiplayerMenu() {
        this.multiplayerMenu.classList.remove('hidden');
        this.updateStatus('Disconnected', 'default');
    }

    hideMultiplayerMenu() {
        this.multiplayerMenu.classList.add('hidden');
    }

    createRoom() {
        this.updateStatus('Creating room...', 'connecting');
        this.createRoomBtn.disabled = true;
        
        // Generate a shorter, memorable room code
        const roomId = this.generateRoomCode();
        
        try {
            this.peer = new Peer(roomId, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
            
            this.peer.on('open', (id) => {
                this.myPlayerId = id;
                this.roomCode = id;
                this.isHost = true;
                this.isConnected = true;
                
                this.codeDisplay.textContent = id;
                this.roomInfo.classList.remove('hidden');
                this.updateStatus('Room created! Waiting for players...', 'connected');
                this.updatePlayerList();
                this.startGameBtn.disabled = false; // Host can start anytime
                
                console.log('Room created with code:', id);
            });

            this.peer.on('connection', (conn) => {
                console.log('New player connecting:', conn.peer);
                this.addConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.updateStatus('Failed to create room', 'error');
                this.createRoomBtn.disabled = false;
            });

        } catch (error) {
            console.error('Failed to create peer:', error);
            this.updateStatus('Failed to create room', 'error');
            this.createRoomBtn.disabled = false;
        }
    }

    joinRoom() {
        let roomCode = this.roomCodeInput.value.trim();
        
        // Clean and normalize the room code - be very lenient
        roomCode = roomCode.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
        
        // Remove all dashes to get clean code
        const cleanCode = roomCode.replace(/-/g, '');
        
        if (cleanCode.length < 6) {
            alert('Please enter a valid room code (at least 6 characters like ABC123XYZ)');
            return;
        }
        
        // Use the clean code directly for connection (PeerJS uses the original format)
        roomCode = cleanCode.length >= 9 ? 
            cleanCode.slice(0, 3) + '-' + cleanCode.slice(3, 6) + '-' + cleanCode.slice(6, 9) :
            cleanCode;

        console.log('Attempting to join room with code:', roomCode);
        this.updateStatus('Joining room...', 'connecting');
        this.joinRoomBtn.disabled = true;

        try {
            this.peer = new Peer(null, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.myPlayerId = id;
                console.log('Connecting to room:', roomCode);
                
                const conn = this.peer.connect(roomCode);
                this.addConnection(conn);
                this.roomCode = roomCode;
            });

            this.peer.on('error', (err) => {
                console.error('Join error:', err);
                this.updateStatus('Failed to join room', 'error');
                this.joinRoomBtn.disabled = false;
                alert('Failed to join room. Please check the room code and try again.');
            });

        } catch (error) {
            console.error('Failed to create peer:', error);
            this.updateStatus('Failed to join room', 'error');
            this.joinRoomBtn.disabled = false;
            alert('Connection failed. Please try again.');
        }
    }

    addConnection(conn) {
        conn.on('open', () => {
            console.log('Data connection opened with:', conn.peer);
            this.connections.push(conn);
            this.isConnected = true;
            
            if (!this.isHost) {
                this.roomInfo.classList.remove('hidden');
                this.codeDisplay.textContent = this.roomCode;
            }
            
            this.updateStatus('Connected!', 'connected');
            this.updatePlayerList();
            
            // Send initial player info
            this.sendPlayerInfo();
            
            // If we're the host and game is running, send full game state to new player
            if (this.isHost && this.game.gameState === 'playing') {
                setTimeout(() => {
                    conn.send({ type: 'startGame' });
                    this.sendFullGameState(conn);
                }, 100);
            }
            
            // Send initial player join message
            conn.send({
                type: 'playerJoin',
                playerId: this.myPlayerId,
                x: 200,
                y: 420,
                health: 100
            });
        });

        conn.on('data', (data) => {
            this.handleNetworkData(data);
        });

        conn.on('close', () => {
            console.log('Player disconnected:', conn.peer);
            this.connections = this.connections.filter(c => c !== conn);
            delete this.remotePlayers[conn.peer];
            delete this.playerNames[conn.peer];
            this.updatePlayerList();
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    sendPlayerInfo() {
        const playerInfo = {
            type: 'playerInfo',
            playerId: this.myPlayerId,
            name: `Player${this.myPlayerId.slice(-3)}`,
            isHost: this.isHost
        };
        this.broadcast(playerInfo);
        this.playerNames[this.myPlayerId] = playerInfo.name;
    }

    handleNetworkData(data) {
        switch (data.type) {
            case 'playerInfo':
                this.playerNames[data.playerId] = data.name;
                this.updatePlayerList();
                break;
                
            case 'playerJoin':
                console.log('Player joined:', data.playerId);
                this.updateRemotePlayer(data);
                break;
                
            case 'playerUpdate':
                this.updateRemotePlayer(data);
                break;
                
            case 'startGame':
                if (!this.isHost) {
                    console.log('Received start game signal from host');
                    // Ensure we're ready to start
                    this.hideMultiplayerMenu();
                    // Force game to menu state first, then start multiplayer
                    this.game.gameState = 'menu';
                    setTimeout(() => {
                        this.game.startMultiplayerGame(this.connections.length + 1);
                    }, 100); // Small delay to ensure state transition
                }
                break;
                
            case 'fullGameState':
                if (!this.isHost) {
                    this.applyFullGameState(data);
                }
                break;
                
            case 'gameState':
                if (!this.isHost) {
                    this.syncGameState(data);
                }
                break;
                
            case 'bulletFired':
                this.handleRemoteBullet(data);
                break;
                
            case 'enemyKilled':
                this.handleEnemyKilled(data);
                break;
                
            case 'destructibleDestroyed':
                this.handleDestructibleDestroyed(data);
                break;
                
            case 'playerHit':
                this.handlePlayerHit(data);
                break;
                
            case 'gameEvent':
                this.handleGameEvent(data);
                break;
        }
    }

    updateRemotePlayer(data) {
        if (data.playerId && data.playerId !== this.myPlayerId) {
            // Store complete player data
            this.remotePlayers[data.playerId] = {
                x: data.x,
                y: data.y,
                direction: data.direction || 0,
                facing: data.facing || 0,
                rotation: data.rotation || 0,
                health: data.health || 100,
                lives: data.lives || 4,
                alive: data.alive !== false,
                respawning: data.respawning || false,
                lastUpdate: Date.now()
            };
            
            // Update game's remote player tracking
            this.game.updateOrCreateRemotePlayer(data.playerId, this.remotePlayers[data.playerId]);
        }
    }

    handleGameEvent(data) {
        // Handle bullets, explosions, enemy spawns, etc.
        switch (data.event) {
            case 'bulletFired':
                // Create bullet from remote player
                break;
            case 'enemyKilled':
                // Sync enemy death
                break;
            case 'explosion':
                // Show explosion effect
                break;
        }
    }

    sendPlayerUpdate() {
        if (!this.isConnected || !this.game.players[0]) return;
        
        const now = performance.now();
        
        // Strict throttling for player updates
        if (now - this.lastPlayerUpdate < this.playerUpdateInterval) return;
        
        const player = this.game.players[0];
        
        // Create lightweight player data
        const newPlayerData = {
            x: Math.round(player.position.x * 10) / 10, // Reduce precision
            y: Math.round(player.position.y * 10) / 10,
            direction: Math.round(player.direction * 100) / 100,
            health: player.health,
            alive: player.alive,
            respawning: player.respawning
        };
        
        // Only send if data actually changed
        if (this.hasPlayerDataChanged(newPlayerData)) {
            const playerData = {
                type: 'playerUpdate',
                playerId: this.myPlayerId,
                ...newPlayerData,
                timestamp: now
            };
            
            this.broadcast(playerData);
            this.lastSentPlayerData = newPlayerData;
        }
        
        this.lastPlayerUpdate = now;
    }

    hasPlayerDataChanged(newData) {
        const last = this.lastSentPlayerData;
        if (!last) return true;
        
        return (
            Math.abs(newData.x - last.x) > 2 || // Larger threshold
            Math.abs(newData.y - last.y) > 2 ||
            Math.abs(newData.direction - last.direction) > 0.1 ||
            newData.health !== last.health ||
            newData.alive !== last.alive ||
            newData.respawning !== last.respawning
        );
    }

    broadcast(data) {
        this.connections.forEach(conn => {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (err) {
                    console.error('Failed to send data:', err);
                }
            }
        });
    }

    startMultiplayerGame() {
        if (this.isHost) {
            // Host broadcasts start signal
            this.broadcast({ type: 'startGame' });
            
            // Send initial full game state after a short delay
            setTimeout(() => {
                this.sendFullGameState();
            }, 500);
        }
        
        // Start the game
        this.hideMultiplayerMenu();
        this.game.startMultiplayerGame(this.connections.length + 1);
        console.log(`Starting multiplayer game with ${this.connections.length + 1} players`);
    }

    leaveRoom() {
        if (this.peer) {
            this.peer.destroy();
        }
        this.cleanup();
        this.hideMultiplayerMenu();
    }

    cleanup() {
        this.connections = [];
        this.remotePlayers = {};
        this.playerNames = {};
        this.isHost = false;
        this.isConnected = false;
        this.myPlayerId = null;
        this.roomCode = null;
        
        this.roomInfo.classList.add('hidden');
        this.createRoomBtn.disabled = false;
        this.joinRoomBtn.disabled = false;
        this.startGameBtn.disabled = true;
    }

    generateRoomCode() {
        // Generate an 11-character room code (3 groups of 3 with dashes: ABC-123-XYZ)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 9; i++) {
            if (i === 3 || i === 6) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    copyRoomCode() {
        if (navigator.clipboard && this.roomCode) {
            navigator.clipboard.writeText(this.roomCode);
            this.copyCodeBtn.textContent = '✓ Copied!';
            setTimeout(() => {
                this.copyCodeBtn.textContent = '📋 Copy Code';
            }, 2000);
        }
    }

    updatePlayerList() {
        const playerList = this.playerListUL;
        playerList.innerHTML = '';
        
        // Add self
        const selfItem = document.createElement('li');
        selfItem.className = this.isHost ? 'player-host' : '';
        selfItem.innerHTML = `
            <span>${this.playerNames[this.myPlayerId] || 'You'}</span>
            <span>${this.isHost ? '👑 Host' : '🎮 Player'}</span>
        `;
        playerList.appendChild(selfItem);
        
        // Add connected players
        this.connections.forEach(conn => {
            const item = document.createElement('li');
            item.innerHTML = `
                <span>${this.playerNames[conn.peer] || `Player${conn.peer.slice(-3)}`}</span>
                <span>🎮 Player</span>
            `;
            playerList.appendChild(item);
        });
        
        this.playerCount.textContent = this.connections.length + 1;
    }

    updateStatus(message, type) {
        this.statusText.textContent = message;
        this.connectionStatus.className = `connection-status ${type}`;
    }

    // Update is now handled by separate intervals, not per-frame
    update() {
        // No longer needed - updates are handled by intervals in startSyncingUpdates()
        // This prevents the 1 FPS issue caused by excessive per-frame network calls
    }

    // Send authoritative game state (host only)
    sendGameState() {
        if (!this.isHost || !this.isConnected) return;
        
        const now = Date.now();
        if (now - this.lastGameStateUpdate < this.gameStateUpdateInterval) return;
        
        const gameState = {
            type: 'gameState',
            enemies: this.game.enemies.map(e => ({
                id: e.id,
                x: e.position.x,
                y: e.position.y,
                type: e.enemyType,
                health: e.health,
                alive: e.alive
            })),
            stage: this.game.stage,
            totalKilled: this.game.totalEnemiesKilled,
            timestamp: now
        };
        
        this.broadcast(gameState);
        this.lastGameStateUpdate = now;
    }

    // Sync game state from host
    syncGameState(data) {
        // Update enemy positions from host
        data.enemies.forEach(enemyData => {
            const enemy = this.game.enemies.find(e => e.id === enemyData.id);
            if (enemy && enemy.alive !== enemyData.alive) {
                if (!enemyData.alive) {
                    enemy.destroy();
                }
            }
        });
        
        // Sync stage and kill count
        this.game.stage = data.stage;
        this.game.totalEnemiesKilled = data.totalKilled;
    }

    // Handle bullet fired by remote player
    handleRemoteBullet(data) {
        this.game.createBulletFromNetwork(data);
    }

    // Handle enemy killed by remote player
    handleEnemyKilled(data) {
        const enemy = this.game.enemies.find(e => e.id === data.enemyId);
        if (enemy && enemy.alive) {
            enemy.destroy();
            this.game.totalEnemiesKilled++;
        }
    }

    // Handle destructible destroyed by remote player
    handleDestructibleDestroyed(data) {
        if (data.carId) {
            const car = this.game.cars.find(c => c.id === data.carId);
            if (car && car.alive) {
                car.destroy();
            }
        }
    }

    // Handle player hit
    handlePlayerHit(data) {
        if (data.playerId === this.myPlayerId) {
            const player = this.game.players[0];
            if (player && player.alive) {
                player.takeDamage(data.damage);
            }
        }
    }

    // Send bullet fired event
    sendBulletFired(bullet) {
        if (!this.isConnected) return;
        
        this.broadcast({
            type: 'bulletFired',
            playerId: this.myPlayerId,
            x: bullet.position.x,
            y: bullet.position.y,
            direction: {
                x: bullet.direction.x,
                y: bullet.direction.y
            },
            speed: bullet.speed,
            damage: bullet.damage
        });
    }

    // Send enemy killed event
    sendEnemyKilled(enemyId) {
        if (!this.isConnected) return;
        
        this.broadcast({
            type: 'enemyKilled',
            playerId: this.myPlayerId,
            enemyId: enemyId
        });
    }

    // Send destructible destroyed event
    sendDestructibleDestroyed(entityId, entityType) {
        if (!this.isConnected) return;
        
        this.broadcast({
            type: 'destructibleDestroyed',
            playerId: this.myPlayerId,
            [`${entityType}Id`]: entityId
        });
    }

    // Send full game state to new players or for sync
    sendFullGameState(conn) {
        if (!this.isHost) return;
        
        const gameState = {
            type: 'fullGameState',
            stage: this.game.stage,
            enemies: this.game.enemies.map(e => ({
                id: e.id,
                x: e.position.x,
                y: e.position.y,
                type: e.enemyType,
                health: e.health,
                alive: e.alive
            })),
            cars: this.game.cars.map(c => ({
                id: c.id,
                alive: c.alive
            })),
            totalKilled: this.game.totalEnemiesKilled,
            timestamp: Date.now()
        };
        
        if (conn) {
            conn.send(gameState);
        } else {
            this.broadcast(gameState);
        }
    }

    // Apply full game state from host
    applyFullGameState(data) {
        console.log('Applying full game state from host');
        
        // Clear and recreate enemies to match host
        this.game.enemies.forEach(e => {
            this.game.collisionSystem.removeEntity(e);
            this.game.renderSystem.removeEntity(e);
        });
        this.game.enemies = [];
        
        // Create enemies from host state
        data.enemies.forEach(enemyData => {
            if (!enemyData.alive) return; // Skip dead enemies
            
            const enemy = new Enemy(enemyData.x, enemyData.y, enemyData.type);
            enemy.id = enemyData.id;
            enemy.health = enemyData.health;
            enemy.game = this.game;
            
            // Set sprite based on enemy type
            if (enemy.enemyType === 'boss') {
                enemy.spriteName = 'enemy2';
                enemy.sprite = this.game.assetLoader.getImage('enemy2');
            } else if (enemy.enemyType === 'flame') {
                enemy.spriteName = 'enemy3';
                enemy.sprite = this.game.assetLoader.getImage('enemy3');
            } else {
                enemy.spriteName = 'enemy1';
                enemy.sprite = this.game.assetLoader.getImage('enemy1');
            }
            
            this.game.enemies.push(enemy);
            this.game.renderSystem.addEntity(enemy);
            this.game.collisionSystem.addEntity(enemy);
        });
        
        // Sync car states
        data.cars.forEach(carData => {
            const car = this.game.cars.find(c => c.id === carData.id);
            if (car && !carData.alive && car.alive) {
                car.destroy();
            }
        });
        
        this.game.totalEnemiesKilled = data.totalKilled;
        this.game.stage = data.stage;
    }

    // Enhanced sync for ongoing game state updates
    syncGameState(data) {
        // Update enemy positions and states from host
        data.enemies.forEach(enemyData => {
            const enemy = this.game.enemies.find(e => e.id === enemyData.id);
            if (enemy) {
                // Smooth position interpolation for less jitter
                enemy.position.x = enemy.position.x * 0.7 + enemyData.x * 0.3;
                enemy.position.y = enemy.position.y * 0.7 + enemyData.y * 0.3;
                enemy.health = enemyData.health;
                
                if (!enemyData.alive && enemy.alive) {
                    enemy.destroy();
                }
            }
        });
        
        this.game.stage = data.stage;
        this.game.totalEnemiesKilled = data.totalKilled;
    }

    // Get remote player data for rendering
    getRemotePlayers() {
        // Clean up old data
        const now = Date.now();
        for (let playerId in this.remotePlayers) {
            if (now - this.remotePlayers[playerId].lastUpdate > 5000) {
                delete this.remotePlayers[playerId];
            }
        }
        return this.remotePlayers;
    }
}
