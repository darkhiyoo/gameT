// Add hashCode method to String prototype for consistent player sprite assignment
String.prototype.hashCode = function() {
    let hash = 0;
    if (this.length === 0) return hash;
    for (let i = 0; i < this.length; i++) {
        const char = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
    // Base logical resolution the legacy coordinates were authored for
    this.baseWidth = 800;
    this.baseHeight = 600;
    this.scaleX = 1; // updated after resolution apply
        // Power-up periodic spawn timer (every 25s)
        this.powerUpIntervalMs = 25000;
        this.nextPowerUpTime = performance.now() + this.powerUpIntervalMs;
    this.scaleY = 1;
    this.entityScale = 1; // uniform scale we can optionally use for sizes later
    // Visual multipliers
    this.bulletSizeMultiplier = 2.5; // make normal bullets much bigger (visual + hitbox)
    this.missileSizeMultiplier = 1.2; // mild scale for missiles only
    this._levelScaledFlag = false; // guard to avoid double scaling
        
        // Game state
        // Add new gameState for local coop menu
        this.gameState = 'loading'; // loading, menu, playing, paused, gameOver, options, localcoop
        this.stage = 1;
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.deltaTime = 0;

        // Difficulty settings
    this.difficulty = 'normal'; // Default difficulty
        this.difficultySettings = {
            easy: {
                aiHealth: 1,
                bossHealth: 3
            },
            normal: {
                aiHealth: 2,
                bossHealth: 4
            },
            hard: {
                aiHealth: 3,
                bossHealth: 8
            }
        };
        
        console.log(`Game initialized with ${this.difficulty} difficulty (AI: ${this.difficultySettings[this.difficulty].aiHealth}, Boss: ${this.difficultySettings[this.difficulty].bossHealth})`);
        

        // Menu state
        this.selectedMenuItem = 0;
        this.menuItems = [
            { text: '🎮 Single Player', action: 'start1player' },
            { text: '� Local Co-op', action: 'localcoop' },
            { text: '�🌐 Online Multiplayer (BETA)', action: 'multiplayer' },
            { text: '⚙️ Options', action: 'options' }
        ];
        
        // Local Co-op menu state
        this.selectedCoopMenuItem = 0;
        this.coopMenuItems = [
            { text: '👥 2 Players', action: 'startlocal', players: 2 },
            { text: '👥 3 Players', action: 'startlocal', players: 3 },
            { text: '👥 4 Players', action: 'startlocal', players: 4 },
            { text: '👥 5 Players', action: 'startlocal', players: 5 },
            { text: '👥 6 Players', action: 'startlocal', players: 6 },
            { text: '👥 7 Players', action: 'startlocal', players: 7 },
            { text: '👥 8 Players', action: 'startlocal', players: 8 },
            { text: '⬅️ Back to Menu', action: 'backtomenu' }
        ];
        
        // Options menu state
        this.selectedOptionItem = 0;
        this.optionItems = [
            { text: 'Difficulty', type: 'select', value: 1, options: ['Easy', 'Normal', 'Hard'], action: 'difficulty' },
            { text: 'Resolution', type: 'select', value: 1, options: ['1280 x 720', '1920 x 1080'], action: 'resolution' },
            { text: 'Fullscreen', type: 'toggle', value: false, action: 'fullscreen' },
            { text: 'BGM Volume', type: 'slider', value: 50, min: 0, max: 100, action: 'bgmVolume' },
            { text: 'SFX Volume', type: 'slider', value: 70, min: 0, max: 100, action: 'sfxVolume' },
            { text: 'Friendly Fire: Players', type: 'toggle', value: false, action: 'friendlyFirePlayers' },
            { text: 'Friendly Fire: Enemies', type: 'toggle', value: false, action: 'friendlyFireEnemies' },
            { text: 'Back to Menu', type: 'button', action: 'backtomenu' }
        ]; // Removed Super Shooting option per request
        
        // Verify and force menu option to match our difficulty setting
        console.log(`Menu option value: ${this.optionItems[0].value} should correspond to difficulty index`);
        if (this.difficulty === 'normal') {
            this.optionItems[0].value = 1; // Make sure menu shows normal (index 1)
            console.log('FORCED menu option to value 1 (normal)');
        }
        // Sync initial Resolution/Fullscreen menu values with current state
        const resItem = this.optionItems.find(i=>i.action==='resolution');
        if (resItem) {
            // Map availableResolutions index (1=720, 2=1080) to our 0/1 menu
            resItem.value = (this.currentResolutionIndex === 1) ? 0 : 1; // default to 1080 if not 720
        }
        const fsItem = this.optionItems.find(i=>i.action==='fullscreen');
        if (fsItem) fsItem.value = !!document.fullscreenElement;
        
        // Game settings
        this.friendlyFirePlayers = false; // Players can damage each other
        this.friendlyFireEnemies = false; // Enemies can damage each other
        this.superShooting = false; // Debug super rapid fire mode
        this.uiHidden = false; // Track if UI is hidden via Shift+H
        this.keyboardControllerActive = false; // Track if keyboard/controller is being used
        // Effects system
        this.explosionEffects = [];
        this.backgroundMusic = null;
        
        // Systems
        this.assetLoader = new AssetLoader();
        this.soundManager = new SoundManager();
        this.gamepadManager = new GamepadManager();
        this.inputSystem = new InputSystem(this.gamepadManager);
        this.collisionSystem = new CollisionSystem();
        this.renderSystem = new RenderSystem(this.canvas, this.assetLoader);
        // Debug system (optional in release): only instantiate if DebugSystem is defined
        if (typeof DebugSystem !== 'undefined') {
            this.debugSystem = new DebugSystem(this.canvas);
        } else {
            // Lightweight no-op stub so calls won't fail in production build
            this.debugSystem = {
                toggle: ()=>{},
                update: ()=>{},
                render: ()=>{}
            };
        }
        this.networkManager = new NetworkManager(this); // Add multiplayer support
        
        // Game entities
        this.players = [];
        this.enemies = [];
        this.bullets = [];
        this.walls = [];
        this.cars = [];
        this.powerUps = [];
        
        // Multiplayer tracking
        this.remotePlayers = new Map(); // Track remote player data
        
        // Game settings
        this.maxPlayers = 8;
        this.activePlayerCount = 1;
        this.isMultiplayer = false; // Track if in online multiplayer mode
        this.isLocalCoop = false; // Track if in local co-op mode
        this.totalMultiplayerPlayers = 1; // Total players across all devices
        this.enemySpawnTimer = 0;
        this.enemySpawnDelay = 3000; // 3 seconds
        this.maxEnemies = 4; // Allow 4 enemies spawning at once
        this.totalEnemiesKilled = 0;
        this.enemiesNeededToWin = 20; // Need to kill 20 enemies to clear stage
        this.bossBattlePhase = false; // Track when we're in boss battle mode
        
        // Score and lives
        this.gameScore = 0;
        this.gameTime = 0;
        
        // Level data
        this.levelData = null;
        
        // Global reference
        window.game = this;

        // ================= Display / Resolution Settings =================
        this.availableResolutions = [
            { label: '800 x 600 (Legacy 4:3)', width: 800, height: 600 },
            { label: '1280 x 720 (HD 720p)', width: 1280, height: 720 },
            { label: '1920 x 1080 (Full HD 1080p)', width: 1920, height: 1080 }
        ];
        this.currentResolutionIndex = 2; // Default 1080p
        this.borderlessFullscreen = true; // Borderless by default (common in modern games)
        this.optionsOpen = false;
        this.optionsSelection = 0; // Navigation index inside custom options overlay (F2)
        // Create options overlay & apply initial resolution soon after DOM updates
        setTimeout(() => {
            this.createResolutionOptionsMenu();
            this.applyResolutionSettings();
        }, 0);
        
        this.init();
    // Stage content flags (toggle to restore original auto placements)
    // Enable default obstacles in release so deployments (e.g., Vercel) have collisions
    // even when localStorage has no saved editor data on first load.
    this.autoObstaclesEnabled = true; // create default cars/barrels/cups/boxes
    this.autoBoundaryWallsEnabled = false; // keep boundary walls user-managed via editors

        // Collision editor (F9) setup
        this.collisionEditor = {
            active: false,
            dragging: false,
            startPos: null,
            currentRect: null,
            rectangles: {}, // stage -> array of rects
            overlay: null,
            removedBaseWalls: {}, // stage -> array of removed base wall rects
            selectedRect: null
        };
        this.initCollisionEditor();

        // Sprite placement editor (F10)
        this.spriteEditor = {
            active: false,
            palette: [ 'car','wall_box','wall_cup','wall_barrel','wall_fish','stage_city','stage_island','stage_kitchen','stage_jungle' ],
            selectedIndex: 0,
            dragging: false,
            dragSprite: null,
            dragOffset: {x:0,y:0},
            placements: {}, // stage -> array of {x,y,sprite,width,height,collidable}
            overlay: null,
            spriteEntities: [],
            resizing: false,
            resizeHandle: null, // tl,tr,bl,br,move,rot
            rotateCenter: null,
            rotating: false,
            rotateHandleRadius: 8
        };
        this.initSpriteEditor();
    }

    // --- Dynamic Scaling Helpers -------------------------------------------------
    updateScale() {
        // Update scaling factors based on current canvas size
        this.scaleX = (this.canvas.width || this.baseWidth) / this.baseWidth;
        this.scaleY = (this.canvas.height || this.baseHeight) / this.baseHeight;
        this.entityScale = Math.min(this.scaleX, this.scaleY);
        // Mark that any future level builds should use new scale
        this._levelScaledFlag = true;
        console.log(`[SCALE] Updated scale factors => scaleX=${this.scaleX.toFixed(3)} scaleY=${this.scaleY.toFixed(3)} entityScale=${this.entityScale.toFixed(3)}`);
    }
    sx(v) { return v * this.scaleX; } // scale X coordinate/size
    sy(v) { return v * this.scaleY; } // scale Y coordinate/size
    sp(x, y) { return { x: this.sx(x), y: this.sy(y) }; } // scale position pair
    // -----------------------------------------------------------------------------

    async init() {
        console.log('Initializing Wildfire Tank Battle...');
        
        // Set up loading callbacks
        this.assetLoader.setLoadingCallbacks(
            (loaded, total) => this.onLoadingProgress(loaded, total),
            () => this.onLoadingComplete()
        );
        
        // Load assets
        await this.assetLoader.loadAssets();
    }

    onLoadingProgress(loaded, total) {
        const progress = (loaded / total) * 100;
        
        // Only log and update if progress is reasonable (prevent infinite loading logs)
        if (progress <= 100) {
            console.log(`Loading assets: ${Math.round(progress)}%`);
            // Update loading display
            this.renderLoadingScreen(progress);
        }
    }

    onLoadingComplete() {
        console.log('Assets loaded successfully');
        
        // Set up sprites for entities
        this.setupSprites();
        
        // Don't start intro music immediately - wait for user interaction
        // Music will be started by main.js after first click/keypress
        
    // Go to menu after assets load and start update loop
    this.gameState = 'menu';
    this.startMenu();
    }

    setupSprites() {
        // Player sprites will be set when players are created
        // Background - use the city.png from stages folder
        this.renderSystem.setBackground('stage_city');
        
        // Connect sounds to sound manager
        this.soundManager.addSound('shoot', this.assetLoader.getSound('shoot'));
        this.soundManager.addSound('explode', this.assetLoader.getSound('explode'));
        this.soundManager.addSound('flamethrower', this.assetLoader.getSound('flamethrower'));
        this.soundManager.addSound('music_stage', this.assetLoader.getSound('music_stage'));
        this.soundManager.addSound('game_start', this.assetLoader.getSound('game_start'));
        this.soundManager.addSound('game_intro', this.assetLoader.getSound('game_intro'));
    }

    startMenu() {
        console.log('Starting menu...');
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        // No longer start independent loop - will be called from main.js
    }

    startGame() {
        console.log('Starting single player game...');
        

    // Stage summary tracking
    this.stageStartStats = null;     // snapshot at start of stage
    this.lastStageSummary = null;    // computed at stage clear
    this.stageClearTimeoutId = null; // timer handle
    this.demoTimeoutId = null;       // timer handle for demo end
    this.gameOverReturnTimeoutId = null; // auto return-to-menu timer
    this.gameOverEndTime = 0;            // timestamp for countdown
        // Reset all multiplayer states
        this.activePlayerCount = 1;
        this.isMultiplayer = false;
        this.isLocalCoop = false;
        this.totalMultiplayerPlayers = 1;
        
        // Stop intro music and start stage music
        this.soundManager.stopMusic();
        this.soundManager.playMusic('music_stage', 0.3, true);
        
        // Create initial game state
    this.resetGame();
    // Capture baseline for stage 1 after reset
    this.stageStartStats = this.captureStageStartStats();
        
        // Game loop is already running from menu
        this.gameState = 'playing';
        this.updateDebugControlsVisibility();
    }

    startLocalCoopGame(playerCount) {
        console.log(`Starting local co-op game with ${playerCount} players`);
        
        // Set up local co-op
        this.activePlayerCount = playerCount;
        this.isMultiplayer = false;
        this.isLocalCoop = true;
        this.totalMultiplayerPlayers = playerCount;
        
        // Stop intro music and start stage music
        this.soundManager.stopMusic();
        this.soundManager.playMusic('music_stage', 0.3, true);
        
        // Create initial game state
        this.resetGame();
        
        // Game loop is already running from menu
        this.gameState = 'playing';
        this.updateDebugControlsVisibility();
    }

    startMultiplayerGame(playerCount) {
        console.log(`Starting online multiplayer game with ${playerCount} players total`);
        
        // In online multiplayer, each device controls 1 player
        this.activePlayerCount = 1;
        this.totalMultiplayerPlayers = playerCount;
        this.isMultiplayer = true;
        this.isLocalCoop = false;
        
        // Stop intro music and start stage music
        this.soundManager.stopMusic();
        this.soundManager.playMusic('music_stage', 0.3, true);
        
        // Create initial game state
        this.resetGame();
        
        // Game loop is already running from menu
        this.gameState = 'playing';
        this.updateDebugControlsVisibility();
    }

    updateDebugControlsVisibility() {
        // Update debug controls visibility based on game state
        if (typeof updateDebugControlsVisibility === 'function') {
            updateDebugControlsVisibility();
        }
    }

    resetGame() {
        console.log(`Resetting game with ${this.difficulty} difficulty`);
        
        // Clear existing entities
        this.players = [];
        this.enemies = [];
        this.bullets = [];
        if (this.walls && this.walls.length){
            this.walls.forEach(w=>{
                this.collisionSystem.removeEntity && this.collisionSystem.removeEntity(w);
                this.renderSystem.removeEntity && this.renderSystem.removeEntity(w);
            });
        }
        this.walls = [];
        this.cars = [];
        this.powerUps = [];
        this.explosionEffects = [];
        
        // Don't clear remote players in online multiplayer - preserve connections
        if (!this.isMultiplayer) {
            this.remotePlayers.clear();
        }
        
        // Reset game state
        this.gameScore = 0;
        this.gameTime = 0;
        this.stage = 1;
        this.enemySpawnTimer = 0;
        this.totalEnemiesKilled = 0;
        
    // Build level first so custom editor walls exist, then create players inside it
    this.createLevel();
    this.createPlayers();
        
        // Set up systems
        this.setupSystems();
        
        // Update UI
        this.updateUI();
        
        // Force full game state sync after reset (online multiplayer host only)
        if (this.isMultiplayer && this.networkManager && this.networkManager.isHost) {
            setTimeout(() => {
                this.networkManager.sendFullGameState();
            }, 500); // Wait for level to fully initialize
        }
    }

    createPlayers() {
        // Move players inside the safe zone defined by diagonal wall (640,130) to (135,475)
        // Safe spawn area: well within the diagonal boundary
        
        // Player positions - optimized for up to 8 players
        const playerPositions = [
            { x: 200, y: 420 }, { x: 280, y: 420 }, { x: 360, y: 420 }, { x: 440, y: 420 },
            { x: 520, y: 420 }, { x: 600, y: 420 }, { x: 320, y: 350 }, { x: 480, y: 350 }
        ].map(p => ({ x: this.sx(p.x), y: this.sy(p.y) }));
        
        const playArea = this.getPlayableAreaBounds();
        for (let i = 0; i < this.activePlayerCount; i++) {
            let pos = playerPositions[i] || playerPositions[0];
            // Clamp inside playable area with margin
            pos = this.clampPointToPlayArea(pos.x, pos.y, playArea, 40 * (this.entityScale||1));
            const player = new Player(pos.x, pos.y, i);
            // If player class exposes width/height, scale them (defensive)
            if (player.width)
                player.width *= this.entityScale;
            if (player.height)
                player.height *= this.entityScale;
            
            // Set sprite
            player.spriteName = player.spriteName || 'tankp1';
            player.sprite = this.assetLoader.getImage(player.spriteName);
            
            // Apply super shooting if enabled
            if (this.superShooting) {
                player.fireRate = 50;
                player.bulletSpeed = 600;
            }
            
            this.players.push(player);
            this.inputSystem.registerPlayer(player);
            this.renderSystem.addEntity(player);
            this.collisionSystem.addEntity(player);
        }
        
        // Update collision masks based on friendly fire settings
        this.updatePlayerCollisionMasks();
        
        // Initialize UI visibility
        this.updateUIVisibility();
    // Final clamp now that players are registered
    this.repositionPlayersInsideBounds();
    }

    createLevel() {
    // No auto boundary walls - user will define via collision editor or sprite editor

        // Stage 1 auto cars now respect autoObstaclesEnabled flag
        if (this.stage === 1) {
            if (this.autoObstaclesEnabled) {
                this.createCars();
            } else {
                // Remove any lingering auto cars from previous sessions
                if (this.cars && this.cars.length) {
                    let removed = 0;
                    this.cars.forEach(car => {
                        this.renderSystem.removeEntity && this.renderSystem.removeEntity(car);
                        this.collisionSystem.removeEntity && this.collisionSystem.removeEntity(car);
                        removed++;
                    });
                    this.cars = [];
                    if (removed) console.log(`[Stage] Removed ${removed} auto cars (autoObstaclesEnabled=false)`);
                }
            }
        }

    // Apply any saved editor rectangles & sprite placements BEFORE spawning enemies
    this.applyEditorRectanglesForStage(this.stage);
    if (this.spriteEditor) this.rebuildSpriteEditorEntitiesForStage();
    // Re-clamp existing players inside new bounds (stage change path)
    if (this.players && this.players.length) this.repositionPlayersInsideBounds();

    // Spawn enemies at green marker positions (unchanged)
        this.spawnEnemiesAtMarkers();
    }

    spawnEnemiesAtMarkers() {
        const area = this.getPlayableAreaBounds();
        const baseSpawns = [ { x:150,y:150 }, { x:400,y:150 }, { x:600,y:150 }, { x:150,y:300 }, { x:600,y:300 } ];
        const enemySpawns = baseSpawns.map(p => this.clampPointToPlayArea(this.sx(p.x), this.sy(p.y), area, 32*(this.entityScale||1)));
        
        // Spawn initial enemies
        enemySpawns.slice(0, 3).forEach((spawn, index) => {
            setTimeout(() => {
                this.spawnEnemyAt(spawn.x, spawn.y);
            }, index * 500); // Stagger spawning
        });
        
        // Store remaining spawn points for later waves
        this.enemySpawnPoints = enemySpawns;
        this.currentSpawnIndex = 3;
    }

    spawnEnemyAt(x, y) {
        // Only host spawns enemies in multiplayer
        if (this.isMultiplayer && this.networkManager && !this.networkManager.isHost) {
            return;
        }
        
        // Reduce debug spam - only log occasionally
        if (this.enemies.length % 2 === 0) {
            console.log(`SPAWN: Stage ${this.stage}, Killed ${this.totalEnemiesKilled}/${this.enemiesNeededToWin}, Enemies: ${this.enemies.length}/${this.maxEnemies}`);
        }
        
        if (this.enemies.length >= this.maxEnemies) return;
        
        // Different enemy types based on stage
        let enemyTypes = ['basic', 'fast', 'heavy'];
        
    if (this.stage === 1) { // City stage - keep it simple
            const bossCount = this.enemies.filter(e => e.enemyType === 'boss').length;
            // Only spawn boss if we've killed at least 50% of enemies and few bosses exist
            if (bossCount < 2 && this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.5) {
                if (Math.random() < 0.15) { // Much lower chance
                    enemyTypes = ['boss'];
                    console.log(`Spawning boss on stage 1 (Killed: ${this.totalEnemiesKilled}/${this.enemiesNeededToWin})`);
                } else {
                    enemyTypes = ['basic', 'fast', 'heavy'];
                }
            } else {
                enemyTypes = ['basic', 'fast', 'heavy']; // Only basic enemies
            }
    } else if (this.stage === 2) { // Island stage
            const flamethrowerCount = this.enemies.filter(e => e.enemyType === 'flamethrower').length;
            
            // Enter boss battle phase when 80% enemies killed
            if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.8 && !this.bossBattlePhase && flamethrowerCount === 0) {
                this.bossBattlePhase = true;
                this.maxEnemies = 1; // Only boss during boss phase
                console.log(`BOSS BATTLE PHASE ACTIVATED! (Killed: ${this.totalEnemiesKilled}/${this.enemiesNeededToWin})`);
            }
            
            // Spawn flamethrower boss if in boss phase
            if (this.bossBattlePhase && flamethrowerCount < 1) {
                enemyTypes = ['flamethrower']; // Only flamethrower boss
                console.log(`Spawning flamethrower boss! (Boss Phase Active)`);
            } else if (!this.bossBattlePhase) {
                const flameCount = this.enemies.filter(e => e.enemyType === 'flame').length;
                // Regular enemies for island stage
                if (flameCount < 4) { // Reduced flame enemy limit
                    enemyTypes = ['flame', 'flame', 'basic']; // Mostly flame enemies
                } else {
                    enemyTypes = ['basic', 'fast']; // Basic enemies when flame limit reached
                }
            } else {
                // During boss phase, don't spawn anything if boss exists
                console.log(`Boss phase active, boss exists, not spawning`);
                return;
            }
        } else if (this.stage === 3) { // Kitchen stage - mix of stage 1 and 2 enemies randomly
            const flamethrowerCount = this.enemies.filter(e => e.enemyType === 'flamethrower').length;
            const bossCount = this.enemies.filter(e => e.enemyType === 'boss').length;
            // Occasionally allow a boss or flamethrower, but keep mostly basic/fast/heavy/flame
            const roll = Math.random();
            if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.75 && flamethrowerCount < 1 && roll < 0.1) {
                enemyTypes = ['flamethrower'];
                console.log('Kitchen: rare flamethrower boss spawn chance');
            } else if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.5 && bossCount < 1 && roll < 0.15) {
                enemyTypes = ['boss'];
                console.log('Kitchen: rare boss spawn chance');
            } else {
                // Mix from stage 1 and stage 2 standard types
                enemyTypes = ['basic', 'fast', 'heavy', 'flame'];
            }
        } else if (this.stage === 4) { // Jungle stage - similar to island but with more heavies
            const flamethrowerCount = this.enemies.filter(e => e.enemyType === 'flamethrower').length;
            if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.8 && flamethrowerCount < 1) {
                this.bossBattlePhase = true;
                this.maxEnemies = 1;
                enemyTypes = ['flamethrower'];
                console.log('Jungle: boss phase active, spawning flamethrower boss');
            } else {
                enemyTypes = ['heavy', 'heavy', 'basic', 'fast'];
            }
        }
        
        const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const safe = this.clampPointToPlayArea(x, y, this.getPlayableAreaBounds(), 40 * (this.entityScale||1));
    const enemy = new Enemy(safe.x, safe.y, randomType);
        
        // Apply difficulty settings before setting other properties
        this.applyDifficultyToEnemy(enemy);
        
        // Set game reference for explosions
        enemy.game = this;
        
        // Set sprite based on enemy type
        if (enemy.enemyType === 'boss') {
            enemy.spriteName = 'enemy2'; // ai2.png
            enemy.sprite = this.assetLoader.getImage('enemy2');
        } else if (enemy.enemyType === 'flame') {
            enemy.spriteName = 'enemy3'; // ai3.png
            enemy.sprite = this.assetLoader.getImage('enemy3');
        } else if (enemy.enemyType === 'flamethrower') {
            enemy.spriteName = 'enemy4'; // ai4.png
            enemy.sprite = this.assetLoader.getImage('enemy4');
        } else {
            enemy.spriteName = 'enemy1'; // ai1.png
            enemy.sprite = this.assetLoader.getImage('enemy1');
        }
        
        this.enemies.push(enemy);
        this.renderSystem.addEntity(enemy);
        this.collisionSystem.addEntity(enemy);
        
        this.updateUI();
    }
    
    spawnPowerUp(type = 'freeze', x, y) {
        // Only allow the two user-provided power-ups
        const allowed = ['freeze', 'laser'];
        if (!allowed.includes(type)) {
            console.log(`PowerUp type '${type}' not allowed, defaulting to 'freeze'`);
            type = 'freeze';
        }
        
        // Generate random position if not provided, using per-stage bounds square
        if (x === undefined || y === undefined) {
            const area = this.getStageBoundsSquare();
            const margin = 20 * (this.entityScale||1);
            x = area.minX + margin + Math.random() * (area.maxX - area.minX - 2*margin);
            y = area.minY + margin + Math.random() * (area.maxY - area.minY - 2*margin);
        }
        
    const powerUp = new PowerUp(x, y, type);
        
        this.powerUps.push(powerUp);
        this.renderSystem.addEntity(powerUp);
        this.collisionSystem.addEntity(powerUp);
    console.log(`Spawned ${type} power-up at (${x}, ${y})`);
    }
    
    spawnRandomPowerUp(x, y) {
        const allowed = ['freeze', 'laser'];
        const type = allowed[Math.floor(Math.random()*allowed.length)];
        this.spawnPowerUp(type, x, y);
    }

    updatePowerUpSpawning(nowMs){
        if (nowMs >= this.nextPowerUpTime) {
            // Ensure we don't spawn multiple power-ups at the same time on screen
            const activePowerUps = (this.powerUps||[]).filter(p=>p && p.alive && !p.collected);
            if (activePowerUps.length === 0) {
                // spawn at safe random spot within stage bounds square
                const area = this.getStageBoundsSquare();
                const x = area.minX + 60 + Math.random() * (area.maxX - area.minX - 120);
                const y = area.minY + 60 + Math.random() * (area.maxY - area.minY - 120);
                this.spawnRandomPowerUp(x, y);
            }
            this.nextPowerUpTime = nowMs + this.powerUpIntervalMs;
        }
    }

    createWalls() {
    // Remove previously generated non-editor standard walls to avoid random duplicates
    if (this.walls && this.walls.length) {
        this.walls = this.walls.filter(w => {
            if (!w.editorWall && !w.editorSpriteWall) { this.collisionSystem.removeEntity(w); return false; }
            return true;
        });
    }
    // Scale walls proportionally to avoid over-expanding on wider aspect ratios
    const uni = this.entityScale; // uniform scale from base 800x600
    const wallThickness = 8 * uni;
    // Legacy logical bounds we want proportionally inside new canvas
    let L = 110 * uni, T = 102 * uni, R = 689 * uni, B = 500 * uni;
    // Clamp so we never exceed canvas edges
    R = Math.min(R, this.canvas.width - 10);
    B = Math.min(B, this.canvas.height - 10);
    const removed = (this.collisionEditor && this.collisionEditor.removedBaseWalls && this.collisionEditor.removedBaseWalls[this.stage])||[];
    const isRemoved=(x,y,w,h)=> removed.some(r=> Math.abs(r.x-x)<2 && Math.abs(r.y-y)<2 && Math.abs(r.width-w)<2 && Math.abs(r.height-h)<2 );
    // Top
    const topWall = new Entity(L, T - wallThickness/2, R - L, wallThickness);
        topWall.collisionLayer = 'wall';
        topWall.collisionMask = ['tank', 'bullet'];
        topWall.visible = false; // Make invisible
        topWall.destructible = false;
    if(!isRemoved(topWall.position.x, topWall.position.y, topWall.size.x, topWall.size.y)) this.walls.push(topWall);
        
    // Right
    const rightWall = new Entity(R - wallThickness/2, 100 * uni, wallThickness, (400 * uni));
        rightWall.collisionLayer = 'wall';
        rightWall.collisionMask = ['tank', 'bullet'];
        rightWall.visible = false; // Make invisible
        rightWall.destructible = false;
    if(!isRemoved(rightWall.position.x, rightWall.position.y, rightWall.size.x, rightWall.size.y)) this.walls.push(rightWall);
        
    // Bottom
    const bottomWall = new Entity(100 * uni, B - wallThickness/2, (690 - 100) * uni, wallThickness);
        bottomWall.collisionLayer = 'wall';
        bottomWall.collisionMask = ['tank', 'bullet'];
        bottomWall.visible = false; // Make invisible
        bottomWall.destructible = false;
    if(!isRemoved(bottomWall.position.x, bottomWall.position.y, bottomWall.size.x, bottomWall.size.y)) this.walls.push(bottomWall);
        
    // Left
    const leftWall = new Entity(100 * uni - wallThickness/2, 102 * uni, wallThickness, 398 * uni);
        leftWall.collisionLayer = 'wall';
        leftWall.collisionMask = ['tank', 'bullet'];
        leftWall.visible = false; // Make invisible
        leftWall.destructible = false;
    if(!isRemoved(leftWall.position.x, leftWall.position.y, leftWall.size.x, leftWall.size.y)) this.walls.push(leftWall);
        
        // Add walls to collision system only (not render system since they're invisible)
        this.walls.forEach(wall => {
            this.collisionSystem.addEntity(wall);
            // Don't add to renderSystem since walls are invisible
        });
    }

    createCars() {
    // Car positions - scaled from legacy coordinates
        const carPositions = [
            // Column 1: x=226/225, y from 177 to 424 (6 cars)
            { x: 226, y: 177 },
            { x: 226, y: 226 },
            { x: 226, y: 275 },
            { x: 226, y: 324 },
            { x: 226, y: 375 },
            { x: 225, y: 424 },
            
            // Column 2: x=358, y from 177 to 424 (6 cars)
            { x: 358, y: 177 },
            { x: 358, y: 226 },
            { x: 358, y: 275 },
            { x: 358, y: 324 },
            { x: 358, y: 375 },
            { x: 358, y: 424 },
            
            // Column 3: x=494/490, y from 177 to 424 (6 cars)
            { x: 494, y: 177 },
            { x: 494, y: 226 },
            { x: 494, y: 275 },
            { x: 494, y: 324 },
            { x: 494, y: 375 },
            { x: 490, y: 424 },
            
            // Column 4: x=623, y from 177 to 424 (6 cars)
            { x: 623, y: 177 },
            { x: 623, y: 226 },
            { x: 623, y: 275 },
            { x: 623, y: 324 },
            { x: 623, y: 375 },
            { x: 623, y: 424 }
        ];
        
    // Create cars at each specified position (use small cars only)
    const size = 32 * this.entityScale;
        carPositions.forEach((pos) => {
            const sx = this.sx(pos.x); const sy = this.sy(pos.y);
            const car = new Car(sx - size/2, sy - size/2, size, size);
            
            // Set sprite
            car.sprite = this.assetLoader.getImage('car');
            
            this.cars.push(car);
            this.renderSystem.addEntity(car);
            this.collisionSystem.addEntity(car);
        });
        
        console.log(`Created ${this.cars.length} destructible cars (scaled size ${size.toFixed(1)})`);
    }

    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies) return;
        
        // Random spawn position at top of screen
        const gameWidth = this.canvas.width;
        const x = Math.random() * (gameWidth - 64) + 32;
        const y = 50;
        
        // Different enemy types based on stage
        let enemyTypes = ['basic', 'fast', 'heavy'];
        
    if (this.stage === 1) { // City stage - keep it simple
            const bossCount = this.enemies.filter(e => e.enemyType === 'boss').length;
            // Only spawn boss if we've killed at least 50% of enemies and few bosses exist
            if (bossCount < 2 && this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.5) {
                if (Math.random() < 0.15) { // Much lower chance
                    enemyTypes = ['boss'];
                    console.log(`Spawning boss on stage 1 (Killed: ${this.totalEnemiesKilled}/${this.enemiesNeededToWin})`);
                } else {
                    enemyTypes = ['basic', 'fast', 'heavy'];
                }
            } else {
                enemyTypes = ['basic', 'fast', 'heavy']; // Only basic enemies
            }
    } else if (this.stage === 2) { // Island stage
            const flamethrowerCount = this.enemies.filter(e => e.enemyType === 'flamethrower').length;
            
            // Enter boss battle phase when 80% enemies killed
            if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.8 && !this.bossBattlePhase && flamethrowerCount === 0) {
                this.bossBattlePhase = true;
                this.maxEnemies = 1; // Only boss during boss phase
                console.log(`BOSS BATTLE PHASE ACTIVATED! (Killed: ${this.totalEnemiesKilled}/${this.enemiesNeededToWin})`);
            }
            
            // Spawn flamethrower boss if in boss phase
            if (this.bossBattlePhase && flamethrowerCount < 1) {
                enemyTypes = ['flamethrower']; // Only flamethrower boss
                console.log(`Spawning flamethrower boss! (Boss Phase Active)`);
            } else if (!this.bossBattlePhase) {
                const flameCount = this.enemies.filter(e => e.enemyType === 'flame').length;
                // Regular enemies for island stage
                if (flameCount < 4) { // Reduced flame enemy limit
                    enemyTypes = ['flame', 'flame', 'basic']; // Mostly flame enemies
                } else {
                    enemyTypes = ['basic', 'fast']; // Basic enemies when flame limit reached
                }
            } else {
                // During boss phase, don't spawn anything if boss exists
                return;
            }
        } else if (this.stage === 3) { // Kitchen stage - mix of stage 1 and 2 enemies randomly
            const flamethrowerCount = this.enemies.filter(e => e.enemyType === 'flamethrower').length;
            const bossCount = this.enemies.filter(e => e.enemyType === 'boss').length;
            const roll = Math.random();
            if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.75 && flamethrowerCount < 1 && roll < 0.1) {
                enemyTypes = ['flamethrower'];
            } else if (this.totalEnemiesKilled >= this.enemiesNeededToWin * 0.5 && bossCount < 1 && roll < 0.15) {
                enemyTypes = ['boss'];
            } else {
                enemyTypes = ['basic', 'fast', 'heavy', 'flame'];
            }
        }
        
        const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const enemy = new Enemy(x, y, randomType);
        
        // Apply difficulty settings before setting other properties
        this.applyDifficultyToEnemy(enemy);
        
        // Set game reference for explosions
        enemy.game = this;
        
        // Set sprite based on enemy type
        if (enemy.enemyType === 'boss') {
            enemy.spriteName = 'enemy2'; // ai2.png
            enemy.sprite = this.assetLoader.getImage('enemy2');
        } else if (enemy.enemyType === 'flame') {
            enemy.spriteName = 'enemy3'; // ai3.png
            enemy.sprite = this.assetLoader.getImage('enemy3');
        } else if (enemy.enemyType === 'flamethrower') {
            enemy.spriteName = 'enemy4'; // ai4.png
            enemy.sprite = this.assetLoader.getImage('enemy4');
        } else {
            enemy.spriteName = 'enemy1'; // ai1.png
            enemy.sprite = this.assetLoader.getImage('enemy1');
        }
        
        // Set target to nearest player
        if (this.players.length > 0) {
            const nearestPlayer = this.findNearestPlayer(enemy.getCenter());
            enemy.setTarget(nearestPlayer);
        }
        
        this.enemies.push(enemy);
        this.renderSystem.addEntity(enemy);
        this.collisionSystem.addEntity(enemy);
        
        // Update collision mask based on friendly fire setting
        if (this.friendlyFireEnemies) {
            if (!enemy.collisionMask.includes('enemyBullet')) {
                enemy.collisionMask.push('enemyBullet');
            }
        }
    }

    // Debug spawn function for specific enemy types
    debugSpawnEnemy(enemyType = 'basic') {
        // Spawn inside playable area, not at edges
        const gameWidth = this.canvas.width;
        const gameHeight = this.canvas.height;
        
        // Keep away from walls (32px border) and player spawn areas
        const minX = 96; // Away from left wall and player spawn
        const maxX = gameWidth - 96; // Away from right wall
        const minY = 96; // Away from top wall
        const maxY = gameHeight - 150; // Away from bottom wall and player spawn
        
        const x = Math.random() * (maxX - minX) + minX;
        const y = Math.random() * (maxY - minY) + minY;
        
        // Create enemy directly (same as regular spawnEnemy)
        const enemy = new Enemy(x, y, enemyType);
        
        // Apply difficulty settings before setting other properties
        this.applyDifficultyToEnemy(enemy);
        
        // Set game reference for explosions
        enemy.game = this;
        
        // Set sprite based on enemy type
        if (enemy.enemyType === 'boss') {
            enemy.spriteName = 'enemy2'; // ai2.png
            enemy.sprite = this.assetLoader.getImage('enemy2');
        } else if (enemy.enemyType === 'flame') {
            enemy.spriteName = 'enemy3'; // ai3.png
            enemy.sprite = this.assetLoader.getImage('enemy3');
        } else if (enemy.enemyType === 'flamethrower') {
            enemy.spriteName = 'enemy4'; // ai4.png
            enemy.sprite = this.assetLoader.getImage('enemy4');
        } else {
            enemy.spriteName = 'enemy1'; // ai1.png
            enemy.sprite = this.assetLoader.getImage('enemy1');
        }
        
        // Set target to nearest player
        if (this.players.length > 0) {
            const nearestPlayer = this.findNearestPlayer(enemy.getCenter());
            enemy.setTarget(nearestPlayer);
        }
        
        this.enemies.push(enemy);
        this.renderSystem.addEntity(enemy);
        this.collisionSystem.addEntity(enemy);
        
        console.log(`Debug spawned ${enemyType} enemy`);
    }

    // Debug function to skip to next stage
    debugNextStage() {
        console.log('Debug: Skipping to next stage');
    this.nextStage();
    }

    // Debug function to toggle infinite health
    debugToggleInfiniteHealth() {
        if (this.players.length > 0) {
            const player = this.players[0];
            if (player.infiniteHealth) {
                player.infiniteHealth = false;
                console.log('Infinite health OFF');
            } else {
                player.infiniteHealth = true;
                player.health = player.maxHealth || 100;
                console.log('Infinite health ON');
            }
        }
    }

    // Apply difficulty settings to enemy health
    applyDifficultyToEnemy(enemy) {
        console.log(`BEFORE difficulty: ${enemy.enemyType} has ${enemy.health} health, current difficulty: ${this.difficulty}`);
        
        const settings = this.difficultySettings[this.difficulty];
        const originalHealth = enemy.health;
        
        // Treat anything flagged as boss-type the same (future-proofing)
        const isBossType = enemy.enemyType === 'boss' || enemy.enemyType === 'flamethrower' || enemy.isFlamethrowerBoss === true;
        
        if (isBossType) {
            enemy.health = settings.bossHealth;
            enemy.maxHealth = settings.bossHealth;
        } else {
            enemy.health = settings.aiHealth;
            enemy.maxHealth = settings.aiHealth;
        }
        
        console.log(`AFTER difficulty: ${enemy.enemyType} health ${originalHealth} → ${enemy.health} (${this.difficulty}: AI=${settings.aiHealth}, Boss=${settings.bossHealth})`);
    }

    findNearestPlayer(position) {
        let nearest = null;
        let minDistance = Infinity;
        
        this.players.forEach(player => {
            if (player.alive && !player.respawning) {
                const distance = position.distanceTo(player.getCenter());
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = player;
                }
            }
        });
        
        return nearest;
    }

    setupSystems() {
        // Clear collision system
        this.collisionSystem = new CollisionSystem();
        
        // Add all entities to systems
        [...this.players, ...this.enemies, ...this.walls, ...this.cars].forEach(entity => {
            if (entity) {
                this.collisionSystem.addEntity(entity);
            }
        });
    }

    updateGame() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        
        // Initialize frame timing
        if (!this.lastFrameTime) this.lastFrameTime = currentTime;
        
        this.deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        
        // Skip frame if delta is too small (prevent division issues)
        if (this.deltaTime < 0.001) {
            // Just return - main loop will call us again next frame
            return;
        }
        
        // Cap delta time to prevent large jumps
        this.deltaTime = Math.min(this.deltaTime, 1/15); // More conservative cap
        
        // Frame skip logic for performance
        this.frameCounter = (this.frameCounter || 0) + 1;
        
        // FPS monitoring (less frequent)
        if (this.frameCounter % 60 === 0) { // Check every 60 frames
            const fps = 1 / this.deltaTime;
            if (fps < 20) {
                console.warn(`Performance warning: ${fps.toFixed(1)} FPS`);
                // Enable frame skipping for very low FPS
                this.performanceMode = true;
            } else if (fps > 45) {
                this.performanceMode = false;
            }
        }
        
        try {
            // Update game with performance considerations
            this.update(this.deltaTime);
        } catch (error) {
            console.error('Game update error:', error);
            // Don't crash the game, just log the error
        }
        
        // Update input system's previous key states for next frame
        if (this.inputSystem && this.inputSystem.updatePreviousKeys) {
            this.inputSystem.updatePreviousKeys();
        }
        
        try {
            // Render game with performance considerations
            if (!this.performanceMode || this.frameCounter % 2 === 0) {
                this.render();
            }
        } catch (error) {
            console.error('Game render error:', error);
            // Don't crash the game, just log the error
        }
        
        // NO LONGER CREATE INDEPENDENT LOOP - will be called from main.js
        // requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        // Always update input system to check for pause
        this.inputSystem.update();
        
        // Handle menu input
        if (this.gameState === 'menu') {
            this.handleMenuInput();
            return;
        }
        
        // Handle local co-op menu input
        if (this.gameState === 'localcoop') {
            this.handleLocalCoopInput();
            return;
        }
        
        // Handle options input
        if (this.gameState === 'options') {
            this.handleOptionsInput();
            return;
        }
        
        // Handle game over input
        if (this.gameState === 'gameOver') {
            this.handleGameOverInput();
            return;
        }
        
        // Handle pause input (works in any state)
        if (this.inputSystem.isPausePressed()) {
            this.togglePause();
            return;
        }
        
        // Handle debug toggle (works in any state)
        if (this.inputSystem.isDebugTogglePressed()) {
            this.debugSystem.toggle();
            return;
        }
        
        // Debug: Next stage (N key)
        if (this.inputSystem.isKeyJustPressed(['KeyN'])) {
            this.debugNextStage();
            return;
        }
        
        // Debug: Spawn flamethrower boss (B key)
        if (this.inputSystem.isKeyJustPressed(['KeyB'])) {
            this.debugSpawnEnemy('flamethrower');
            return;
        }
        
        // Debug: Spawn freeze power-up (F key)
        if (this.inputSystem.isKeyJustPressed(['KeyF'])) {
            this.spawnPowerUp('freeze', 400, 300); // Center of screen
            return;
        }
        
        // Debug: Reset to stage 1 (R key)
        if (this.inputSystem.isKeyJustPressed(['KeyR'])) {
            console.log('Resetting to stage 1...');
            this.stage = 1;
            this.totalEnemiesKilled = 0;
            this.maxEnemies = 4;
            this.bossBattlePhase = false;
            this.enemies = [];
            this.bullets = [];
            this.setupStage();
            return;
        }
        
        // Debug: Trigger boss phase (O key)
        if (this.inputSystem.isKeyJustPressed(['KeyO'])) {
            console.log('Triggering boss battle phase...');
            this.totalEnemiesKilled = Math.floor(this.enemiesNeededToWin * 0.8);
            this.bossBattlePhase = false; // Reset so it can be triggered
            return;
        }
        
        // Don't update game logic when paused or not playing
        if (this.gameState !== 'playing') return;
        
        // Performance throttling
        const shouldUpdateAI = this.frameCounter % 3 === 0; // Every 3rd frame for AI
        const shouldUpdatePhysics = this.frameCounter % 2 === 0; // Every 2nd frame for physics
        const shouldCleanup = this.frameCounter % 60 === 0; // Every 60th frame for cleanup
        const shouldUpdateNetwork = this.frameCounter % 6 === 0; // Every 6th frame for network
        
        // Update game time
        this.gameTime += deltaTime;
        
        // Update explosion effects (lightweight)
        this.updateExplosionEffects(deltaTime);
        
        // Update hit effects
        this.updateHitEffects(deltaTime);
        
        // Always update players (most important)
        this.players.forEach(player => {
            if (player.alive) {
                player.update(deltaTime);
                player.clampToScreen(this.canvas.width, this.canvas.height);
            }
        });
        
        // Always update bullets (fast moving)
        this.bullets.forEach(bullet => {
            if (bullet.alive) {
                bullet.update(deltaTime);
                
                // Remove bullets that are off screen or have traveled too far
                if (bullet.isOffScreen(this.canvas.width, this.canvas.height) || 
                    !bullet.alive || bullet.traveledDistance >= bullet.maxDistance) {
                    
                    // Clear the active bullet reference from the owner
                    if (bullet.owner && bullet.owner.activeBullet === bullet) {
                        bullet.owner.activeBullet = null;
                    }
                    
                    bullet.destroy();
                }
            }
        });
        
        // Update power-ups (check for collection and expiration)
        this.powerUps.forEach((powerUp, index) => {
            if (powerUp.alive) {
                powerUp.update(deltaTime);
                
                // Remove expired power-ups
                if (!powerUp.alive) {
                    this.powerUps.splice(index, 1);
                }
            }
        });
        
        // Handle power-up collision with players
        this.powerUps.forEach(powerUp => {
            if (powerUp.alive) {
                this.players.forEach(player => {
                    if (player.alive && this.collisionSystem.checkCollision(powerUp, player)) {
                        powerUp.collectBy(player);
                    }
                });
            }
        });
        
        // Throttled updates for performance
        if (shouldUpdateAI) {
            // Update enemies (CPU intensive)
            this.enemies.forEach(enemy => {
                if (enemy.alive) {
                    enemy.update(deltaTime * 3); // Compensate for skipped frames
                    
                    // Update enemy target less frequently
                    if (this.frameCounter % 9 === 0) {
                        const nearestPlayer = this.findNearestPlayer(enemy.getCenter());
                        enemy.setTarget(nearestPlayer);
                    }
                    
                    enemy.clampToScreen(this.canvas.width, this.canvas.height);
                }
            });
        }
        
        if (shouldUpdatePhysics) {
            // Update cars and walls (less frequent)
            this.walls.forEach(wall => {
                if (wall.alive && wall.update) {
                    wall.update(deltaTime * 2);
                }
            });
            
            this.cars.forEach(car => {
                if (car.alive && car.update) {
                    car.update(deltaTime * 2);
                }
            });
        }
        
        // Handle firing (always - responsive)
        this.handleFiring();
        
        // Safety cleanup for stale bullet references (every 2 seconds)
        if (this.frameCounter % 120 === 0) {
            this.cleanupStaleBulletReferences();
        }
        
        // Update collision system (throttled)
        if (shouldUpdatePhysics) {
            this.collisionSystem.update();
        }
        
        // Spawn enemies (throttled)
        if (shouldUpdateAI) {
            this.updateEnemySpawning(deltaTime * 3);
        }
        
        // Check win/lose conditions (less frequent)
        if (this.frameCounter % 30 === 0) {
            this.checkGameConditions();
        }
        
        // Network updates (heavily throttled)
        if (shouldUpdateNetwork && this.networkManager) {
            // Network updates are now handled by intervals in NetworkManager
            // No need to call update() or sendPlayerUpdate() here
            // This prevents the 1 FPS issue caused by duplicate network calls
        }
        
        // Update UI (less frequent)
        if (this.frameCounter % 10 === 0) {
            this.updateUI();
        }
        
        // Check for keyboard/controller usage and update touch control visibility
        if (this.frameCounter % 30 === 0) {
            this.detectKeyboardControllerUsage();
        }
        
        // Update debug system (less frequent)
        if (this.frameCounter % 30 === 0) {
            const allEntities = [...this.players, ...this.enemies, ...this.bullets, ...this.walls, ...this.cars, ...this.powerUps];
            this.debugSystem.update(allEntities, this.renderSystem.camera);
        }
        
        // Clean up dead entities (very infrequent)
        if (shouldCleanup) {
            this.cleanup();
        }
    }

    handleFiring() {
        // Player firing
        this.players.forEach(player => {
            if (player.alive && !player.respawning) {
                const bulletData = player.attemptFire();
                if (bulletData) {
                    this.createBullet(bulletData);
                }
            }
        });
        
        // Enemy firing is now handled in their individual updateFiring() methods
        // which are called from their update() method in the AI loop
        // This allows for proper cooldowns, line-of-sight, and intelligent firing
    }

    createBullet(bulletData) {
        const bullet = new Bullet(
            bulletData.position.x,
            bulletData.position.y,
            bulletData.direction,
            bulletData.speed,
            bulletData.damage,
            bulletData.owner,
            bulletData.type || 'standard'
        );
        
        // Assign unique ID for network sync
        bullet.id = `${Date.now()}_${Math.random()}`;
        
        // Set game reference for animation support
        bullet.game = this;
        
        // Apply special bullet properties
        if (bulletData.type === 'missile') {
            // Boss missile bullets
            bullet.spriteName = 'missile';
            bullet.sprite = this.assetLoader.getImage('missile') || this.assetLoader.getImage('seek_missile');
            bullet.explosive = true;
            bullet.explosionRadius = bulletData.explosionRadius || 80;
            bullet.explosionType = bulletData.explosionType || 'flame';
            const scale = this.entityScale || 1;
            bullet.size = new Vector2D(64 * scale, 64 * scale); // Enlarged missile
            bullet.color = '#ff8800'; // Orange missile
        } else if (bulletData.type === 'fireball') {
            // Flame enemy bullets - bigger fire balls
            const scale2 = this.entityScale || 1;
            bullet.size = new Vector2D(12 * scale2, 12 * scale2); // Bigger than normal
            bullet.color = '#ff4400'; // Bright orange-red
            bullet.explosive = false;
            bullet.damage = bulletData.damage || 1;
        }
        // Note: Flamethrower enemies no longer create bullets - they use flame streams
        
        // Set the active bullet reference for the owner
        if (bulletData.owner) {
            bulletData.owner.activeBullet = bullet;
        }
        
        // Apply friendly fire settings
        if (bullet.owner instanceof Player && this.friendlyFirePlayers) {
            // Add 'player' to collision mask so player bullets can hit other players
            if (!bullet.collisionMask.includes('player')) {
                bullet.collisionMask.push('player');
            }
        }
        
        this.bullets.push(bullet);
        this.renderSystem.addEntity(bullet);
        this.collisionSystem.addEntity(bullet);
        
        // Send bullet to network if in multiplayer
        if (this.isMultiplayer && this.networkManager && bulletData.owner === this.players[0]) {
            this.networkManager.sendBulletFired(bullet);
        }
        
        // Play appropriate shooting sound
        if (bulletData.type === 'flamethrower') {
            this.soundManager.playSound('flamethrower', 0.6);
        } else {
            this.soundManager.playSound('shoot', 0.3);
        }
    }

    createBulletFromNetwork(data) {
        // Don't create bullets from our own player
        if (data.playerId === this.networkManager.myPlayerId) return;
        
        const bullet = new Bullet(
            data.x,
            data.y,
            data.direction,
            data.speed,
            data.damage,
            null // No owner for network bullets to prevent collision with remote player
        );
        
        bullet.isNetworkBullet = true;
        bullet.networkPlayerId = data.playerId;
        bullet.collisionLayer = 'playerBullet'; // Same as player bullets
        bullet.game = this;
        
        // Apply friendly fire settings for network bullets
        if (this.friendlyFirePlayers) {
            // Add 'player' to collision mask so network bullets can hit local players
            if (!bullet.collisionMask.includes('player')) {
                bullet.collisionMask.push('player');
            }
        }
        
        this.bullets.push(bullet);
        this.renderSystem.addEntity(bullet);
        this.collisionSystem.addEntity(bullet);
        
        // Play sound effect
        this.soundManager.playSound('shoot', 0.3);
    }

    handleMenuInput() {
        // Handle menu navigation with keyboard
        if (this.inputSystem.isUpPressed()) {
            this.selectedMenuItem = Math.max(0, this.selectedMenuItem - 1);
        }
        if (this.inputSystem.isDownPressed()) {
            this.selectedMenuItem = Math.min(this.menuItems.length - 1, this.selectedMenuItem + 1);
        }
        
        // Handle menu selection with keyboard
        if (this.inputSystem.isFirePressed() || this.inputSystem.isEnterPressed()) {
            const selectedItem = this.menuItems[this.selectedMenuItem];
            this.handleMenuAction(selectedItem.action);
        }
        
        // Handle touch/mouse menu interaction
        this.handleMenuTouchInput();
    }
    
    handleMenuTouchInput() {
        // Check if there's a click/touch event on the canvas
        const canvas = this.canvas;
        
        // Add click event listener for menu (if not already added)
        if (!this.menuClickHandlerAdded) {
            this.menuClickHandlerAdded = true;
            
            const handleCanvasClick = (e) => {
                if (this.gameState !== 'menu') return;
                
                e.preventDefault();
                
                // Get click position relative to canvas
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                
                // Check which menu item was clicked
                this.menuItems.forEach((item, index) => {
                    const itemY = 300 + index * 60;
                    const itemHeight = 40;
                    
                    if (y >= itemY - itemHeight/2 && y <= itemY + itemHeight/2) {
                        this.selectedMenuItem = index;
                        this.handleMenuAction(item.action);
                    }
                });
            };
            
            // Game click handler for power-up test button
            const handleGameClick = (e) => {
                if (this.gameState !== 'playing') return;
                
                e.preventDefault();
                
                // Get click position relative to canvas
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
            };
            
            // Add click event listener that handles both menu and game clicks
            const masterClickHandler = (e) => {
                handleCanvasClick(e);
                handleGameClick(e);
            };
            
            // Add both click and touch events
            canvas.addEventListener('click', masterClickHandler);
            canvas.addEventListener('touchend', (e) => {
                if (e.touches.length === 0 && e.changedTouches.length > 0) {
                    // Use the last touch position
                    const touch = e.changedTouches[0];
                    const fakeEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => e.preventDefault()
                    };
                    masterClickHandler(fakeEvent);
                }
            });
        }
    }

    handleMenuAction(action) {
        // Play selection sound
        this.soundManager.playSound('game_start', 0.5);
        
        switch (action) {
            case 'start1player':
                this.activePlayerCount = 1;
                this.startGame();
                break;
            case 'localcoop':
                this.gameState = 'localcoop';
                this.selectedCoopMenuItem = 0;
                break;
            case 'multiplayer':
                this.networkManager.showMultiplayerMenu();
                break;
            case 'options':
                this.gameState = 'options';
                this.selectedOptionItem = 0;
                break;
        }
    }

    handleLocalCoopInput() {
        // Handle local co-op menu navigation with keyboard
        if (this.inputSystem.isUpPressed()) {
            this.selectedCoopMenuItem = Math.max(0, this.selectedCoopMenuItem - 1);
        }
        if (this.inputSystem.isDownPressed()) {
            this.selectedCoopMenuItem = Math.min(this.coopMenuItems.length - 1, this.selectedCoopMenuItem + 1);
        }
        
        // Handle menu selection with keyboard
        if (this.inputSystem.isFirePressed() || this.inputSystem.isEnterPressed()) {
            const selectedItem = this.coopMenuItems[this.selectedCoopMenuItem];
            this.handleLocalCoopAction(selectedItem.action, selectedItem.players);
        }
        
        // Handle back navigation
        if (this.inputSystem.isEscapePressed()) {
            this.gameState = 'menu';
            this.selectedMenuItem = 0;
        }
    }

    handleLocalCoopAction(action, players) {
        // Play selection sound
        this.soundManager.playSound('game_start', 0.5);
        
        switch (action) {
            case 'startlocal':
                console.log(`Starting local co-op with ${players} players`);
                this.startLocalCoopGame(players);
                break;
            case 'backtomenu':
                this.gameState = 'menu';
                this.selectedMenuItem = 0;
                break;
        }
    }

    handleOptionsInput() {
        // Handle options navigation with keyboard
        if (this.inputSystem.isUpPressed()) {
            this.selectedOptionItem = Math.max(0, this.selectedOptionItem - 1);
        }
        if (this.inputSystem.isDownPressed()) {
            this.selectedOptionItem = Math.min(this.optionItems.length - 1, this.selectedOptionItem + 1);
        }
        
        const selectedOption = this.optionItems[this.selectedOptionItem];
        
        // Handle volume slider adjustments
        if (selectedOption.type === 'slider') {
            if (this.inputSystem.isLeftPressed()) {
                selectedOption.value = Math.max(selectedOption.min, selectedOption.value - 5);
                this.applyOptionChange(selectedOption.action, selectedOption.value);
            }
            if (this.inputSystem.isRightPressed()) {
                selectedOption.value = Math.min(selectedOption.max, selectedOption.value + 5);
                this.applyOptionChange(selectedOption.action, selectedOption.value);
            }
        }
        
        // Handle toggle adjustments
        if (selectedOption.type === 'toggle') {
            if (this.inputSystem.isLeftPressed() || this.inputSystem.isRightPressed()) {
                this.handleOptionAction(selectedOption.action);
            }
        }
        
    // Handle select adjustments
    if (selectedOption.type === 'select') {
            if (this.inputSystem.isLeftPressed()) {
                selectedOption.value = Math.max(0, selectedOption.value - 1);
                this.applyOptionChange(selectedOption.action, selectedOption.value);
            }
            if (this.inputSystem.isRightPressed()) {
                selectedOption.value = Math.min(selectedOption.options.length - 1, selectedOption.value + 1);
                this.applyOptionChange(selectedOption.action, selectedOption.value);
            }
        }
        
        // Handle button selection with keyboard
        if (this.inputSystem.isFirePressed() || this.inputSystem.isEnterPressed()) {
            this.handleOptionAction(selectedOption.action);
        }
        
        // ESC to go back to menu
        if (this.inputSystem.isEscapePressed()) {
            this.gameState = 'menu';
        }
        
        // Handle touch/mouse options interaction
        this.handleOptionsTouchInput();
    }
    
    handleOptionsTouchInput() {
        // Check if there's a click/touch event on the canvas for options
        const canvas = this.canvas;
        
        // Add click event listener for options (if not already added)
        if (!this.optionsClickHandlerAdded) {
            this.optionsClickHandlerAdded = true;
            
            const handleOptionsClick = (e) => {
                if (this.gameState !== 'options') return;
                
                e.preventDefault();
                
                // Get click position relative to canvas
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                
                // Check which option item was clicked
                this.optionItems.forEach((item, index) => {
                    const itemY = 220 + index * 80;
                    const itemHeight = 50;
                    
                    if (y >= itemY - itemHeight/2 && y <= itemY + itemHeight/2) {
                        this.selectedOptionItem = index;
                        
                        if (item.type === 'slider') {
                            // Handle slider clicks - adjust value based on X position
                            const sliderX = 280;
                            const sliderWidth = 300;
                            
                            if (x >= sliderX && x <= sliderX + sliderWidth) {
                                const percentage = (x - sliderX) / sliderWidth;
                                item.value = Math.round(percentage * item.max);
                                this.applyOptionChange(item.action, item.value);
                            }
                        } else if (item.type === 'toggle') {
                            // Handle toggle clicks
                            this.handleOptionAction(item.action);
                        } else if (item.type === 'select') {
                            // Left half decrements, right half increments
                            if (x < this.canvas.width/2) {
                                item.value = Math.max(0, item.value - 1);
                            } else {
                                item.value = Math.min(item.options.length - 1, item.value + 1);
                            }
                            this.applyOptionChange(item.action, item.value);
                        } else {
                            // Handle button clicks
                            this.handleOptionAction(item.action);
                        }
                    }
                });
            };
            
            // Add touch event handlers to the existing click handler
            const existingClickHandler = canvas.onclick;
            canvas.addEventListener('click', handleOptionsClick);
            canvas.addEventListener('touchend', (e) => {
                if (e.touches.length === 0 && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const fakeEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => e.preventDefault()
                    };
                    handleOptionsClick(fakeEvent);
                }
            });
        }
    }

    applyOptionChange(action, value) {
        const volume = value / 100; // Convert percentage to 0-1 range
        
        switch (action) {
            case 'difficulty':
                // Map select index to difficulty string
                const difficultyMap = ['easy', 'normal', 'hard'];
                this.difficulty = difficultyMap[value];
                console.log(`Difficulty changed to: ${this.difficulty} (value=${value}) - Settings: AI=${this.difficultySettings[this.difficulty].aiHealth}, Boss=${this.difficultySettings[this.difficulty].bossHealth}`);
                
                // Apply new difficulty to all existing enemies
                this.enemies.forEach(enemy => {
                    this.applyDifficultyToEnemy(enemy);
                });
                console.log(`Applied new difficulty to ${this.enemies.length} existing enemies`);
                break;
            case 'resolution': {
                // Map 0 => 1280x720, 1 => 1920x1080
                this.currentResolutionIndex = value === 0 ? 1 : 2;
                // Apply immediately
                this.applyResolutionSettings();
                break;
            }
            case 'fullscreen': {
                // Toggle fullscreen based on desired value
                const wantFullscreen = !!value;
                const isFs = !!document.fullscreenElement;
                if (wantFullscreen !== isFs) {
                    this.toggleFullscreen();
                }
                break;
            }
            case 'bgmVolume':
                this.soundManager.setMusicVolume(volume);
                console.log(`BGM Volume: ${value}% - Music volume updated`);
                break;
            case 'sfxVolume':
                this.soundManager.setSFXVolume(volume);
                // Play a test sound
                this.soundManager.playSound('shoot', volume);
                console.log(`SFX Volume: ${value}%`);
                break;
        }
    }

    handleOptionAction(action) {
        switch (action) {
            case 'friendlyFirePlayers':
                this.toggleFriendlyFirePlayers();
                break;
            case 'friendlyFireEnemies':
                this.toggleFriendlyFireEnemies();
                break;
            case 'superShooting':
                this.toggleSuperShooting();
                break;
            case 'resolution': {
                const item = this.optionItems.find(i=>i.action==='resolution');
                if (item) this.applyOptionChange('resolution', item.value);
                break;
            }
            case 'fullscreen': {
                const item = this.optionItems.find(i=>i.action==='fullscreen');
                if (item) {
                    item.value = !item.value;
                    this.applyOptionChange('fullscreen', item.value ? 1 : 0);
                }
                break;
            }
            case 'backtomenu':
                this.gameState = 'menu';
                this.soundManager.playSound('game_start', 0.5);
                break;
        }
    }

    toggleFriendlyFirePlayers() {
        this.friendlyFirePlayers = !this.friendlyFirePlayers;
        
        // Update the option item value
        const option = this.optionItems.find(item => item.action === 'friendlyFirePlayers');
        if (option) {
            option.value = this.friendlyFirePlayers;
        }
        
        // Update collision masks for all players
        this.updatePlayerCollisionMasks();
        
        console.log(`Friendly Fire (Players): ${this.friendlyFirePlayers ? 'ON' : 'OFF'}`);
        this.soundManager.playSound('game_start', 0.3);
    }

    toggleFriendlyFireEnemies() {
        this.friendlyFireEnemies = !this.friendlyFireEnemies;
        
        // Update the option item value
        const option = this.optionItems.find(item => item.action === 'friendlyFireEnemies');
        if (option) {
            option.value = this.friendlyFireEnemies;
        }
        
        // Update collision masks for all enemies
        this.updateEnemyCollisionMasks();
        
        console.log(`Friendly Fire (Enemies): ${this.friendlyFireEnemies ? 'ON' : 'OFF'}`);
        this.soundManager.playSound('game_start', 0.3);
    }

    toggleSuperShooting() {
        this.superShooting = !this.superShooting;
        
        // Update the option item value
        const option = this.optionItems.find(item => item.action === 'superShooting');
        if (option) {
            option.value = this.superShooting;
        }
        
        // Apply super shooting to all players
        this.players.forEach(player => {
            if (this.superShooting) {
                player.fireRate = 50; // Super fast fire rate (20 shots per second)
                player.bulletSpeed = 600; // Faster bullets
                console.log(`Player ${player.playerIndex + 1}: Super Shooting ENABLED (50ms fire rate)`);
            } else {
                player.fireRate = player.originalFireRate || 400; // Restore original fire rate
                player.bulletSpeed = 300; // Normal bullet speed
                console.log(`Player ${player.playerIndex + 1}: Super Shooting DISABLED (restored to ${player.fireRate}ms)`);
            }
        });
        
        console.log(`Super Shooting (Debug): ${this.superShooting ? 'ON' : 'OFF'}`);
        this.soundManager.playSound('game_start', 0.3);
    }

    updatePlayerCollisionMasks() {
        this.players.forEach(player => {
            if (this.friendlyFirePlayers) {
                // Add playerBullet to collision mask so players can be hurt by other players
                if (!player.collisionMask.includes('playerBullet')) {
                    player.collisionMask.push('playerBullet');
                }
            } else {
                // Remove playerBullet from collision mask
                player.collisionMask = player.collisionMask.filter(mask => mask !== 'playerBullet');
            }
        });
        
        // Update existing player bullets collision masks
        this.bullets.forEach(bullet => {
            if (bullet.owner instanceof Player) {
                if (this.friendlyFirePlayers) {
                    // Add 'player' to collision mask so player bullets can hit other players
                    if (!bullet.collisionMask.includes('player')) {
                        bullet.collisionMask.push('player');
                    }
                } else {
                    // Remove 'player' from collision mask
                    bullet.collisionMask = bullet.collisionMask.filter(mask => mask !== 'player');
                }
            }
        });
    }

    updateEnemyCollisionMasks() {
        this.enemies.forEach(enemy => {
            if (this.friendlyFireEnemies) {
                // Add enemyBullet to collision mask so enemies can hurt each other
                if (!enemy.collisionMask.includes('enemyBullet')) {
                    enemy.collisionMask.push('enemyBullet');
                }
            } else {
                // Remove enemyBullet from collision mask
                enemy.collisionMask = enemy.collisionMask.filter(mask => mask !== 'enemyBullet');
            }
        });
    }

    handleGameOverInput() {
    // Allow immediate return to menu with keyboard
        if (this.inputSystem.isKeyJustPressed(['Escape'])) {
            this.returnToMenu();
        }
        
        // Handle touch/mouse game over interaction
        this.handleGameOverTouchInput();
    }
    
    handleGameOverTouchInput() {
        // Check if there's a click/touch event on the canvas for game over
        const canvas = this.canvas;
        
        // Add click event listener for game over (if not already added)
        if (!this.gameOverClickHandlerAdded) {
            this.gameOverClickHandlerAdded = true;
            
            const handleGameOverClick = (e) => {
                if (this.gameState !== 'gameOver') return;
                
                e.preventDefault();
                
                // Get click position relative to canvas
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                
                // Single action: any click/tap returns to menu immediately
                this.returnToMenu();
            };
            
            // Add touch event handlers
            canvas.addEventListener('click', handleGameOverClick);
            canvas.addEventListener('touchend', (e) => {
                if (e.touches.length === 0 && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const fakeEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => e.preventDefault()
                    };
                    handleGameOverClick(fakeEvent);
                }
            });
        }
    }

    updateExplosionEffects(deltaTime) {
        // Update explosion effects
        this.explosionEffects = this.explosionEffects.filter(effect => {
            effect.lifetime -= deltaTime;
            effect.scale += deltaTime * 2; // Grow over time
            effect.alpha = Math.max(0, effect.lifetime / effect.maxLifetime);
            return effect.lifetime > 0;
        });
    }

    updateHitEffects(deltaTime) {
        // Initialize hit effects array if it doesn't exist
        if (!this.hitEffects) {
            this.hitEffects = [];
        }
        
        // Update and filter hit effects
        this.hitEffects = this.hitEffects.filter(effect => {
            return effect.update(deltaTime);
        });
    }

    createExplosionEffect(x, y, type = 'destroy') {
        const effect = {
            x: x,
            y: y,
            type: type,
            lifetime: 0.5, // 0.5 seconds
            maxLifetime: 0.5,
            scale: 0.5,
            alpha: 1.0
        };
        this.explosionEffects.push(effect);
        
        // Play explosion sound
        this.soundManager.playSound('explode', 0.4);
    }

    createExplosion(x, y, type = 'effect_explode', scale = 1.0) {
        const effect = {
            x: x,
            y: y,
            type: type,
            lifetime: 0.6, // 0.6 seconds for bigger explosions
            maxLifetime: 0.6,
            scale: scale,
            alpha: 1.0
        };
        this.explosionEffects.push(effect);
        
        // Play explosion sound
        this.soundManager.playSound('explode', 0.5);
    }

    updateEnemySpawning(deltaTime) {
        this.enemySpawnTimer += deltaTime * 1000;
        
        // Don't spawn regular enemies during boss battle phase (boss will spawn via spawnEnemyAt logic)
        if (this.bossBattlePhase && this.enemies.length > 0) {
            return; // Boss is alive, don't spawn more
        }
        
        // Keep spawning enemies until we reach the kill limit
        if (this.enemySpawnTimer >= this.enemySpawnDelay && 
            this.enemies.length < this.maxEnemies &&
            this.totalEnemiesKilled < this.enemiesNeededToWin) {
            
            // Use predetermined spawn points first, then random
            if (this.enemySpawnPoints && this.currentSpawnIndex < this.enemySpawnPoints.length) {
                const spawnPoint = this.enemySpawnPoints[this.currentSpawnIndex];
                this.spawnEnemyAt(spawnPoint.x, spawnPoint.y);
                this.currentSpawnIndex++;
            } else {
                // Random spawn after initial points are used
                this.spawnRandomEnemy();
            }
            this.enemySpawnTimer = 0;
        }
    }

    spawnRandomEnemy() {
    const area = this.getStageBoundsSquare();
    // Constrained to stage square; prefer upper half to avoid base area
    const rx = area.minX + 60 + Math.random()*(area.maxX - area.minX - 120);
    const halfY = area.minY + (area.maxY - area.minY) * 0.5;
    const ry = area.minY + 40 + Math.random()*((halfY - area.minY) - 80);
    this.spawnEnemyAt(rx, ry);
    }

    checkGameConditions() {
        // Check if all players are dead
        const alivePlayers = this.players.filter(player => !player.isGameOver());
        if (alivePlayers.length === 0) {
            this.gameOver('All Players Defeated');
            return;
        }
        
        // Check if we've killed enough enemies to win the stage
        if (this.totalEnemiesKilled >= this.enemiesNeededToWin) {
            // Trigger stage clear sequence once
            if (this.gameState !== 'stageClear' && this.gameState !== 'demoEnd') {
                this.onStageCleared();
            }
        }
    }

    render() {
        // Fixed camera - no movement, show full stage
        this.renderSystem.camera.x = 0;
        this.renderSystem.camera.y = 0;
        
        if (this.gameState === 'menu') {
            this.renderMenu();
            return;
        }
        
        if (this.gameState === 'localcoop') {
            this.renderLocalCoopMenu();
            return;
        }
        
        if (this.gameState === 'options') {
            this.renderOptions();
            return;
        }
        
        // Render everything
        this.renderSystem.render();
        
        // Render remote players
        this.renderRemotePlayers();
        
        // Render explosion effects
        this.renderExplosionEffects();
        
        // Render hit effects
        this.renderHitEffects();
        
        // Render debug overlay
        const allEntities = [...this.players, ...this.enemies, ...this.bullets, ...this.walls, ...this.cars, ...this.powerUps];
        this.debugSystem.render(this.ctx, allEntities, this.renderSystem.camera);

    // Collision editor visuals
    this.renderCollisionEditorVisuals();
    this.renderSpriteEditorVisuals();
    this.renderSpritePlacementPassiveOverlays && this.renderSpritePlacementPassiveOverlays();
        
        // Render game state specific overlays
        if (this.gameState === 'paused') {
            this.renderPauseScreen();
        } else if (this.gameState === 'gameOver') {
            this.renderGameOverScreen();
        } else if (this.gameState === 'stageClear') {
            this.renderStageClearScreen();
        } else if (this.gameState === 'demoEnd') {
            this.renderDemoEndScreen();
        }
    }

    renderRemotePlayers() {
        const now = Date.now();
        
        this.remotePlayers.forEach((player, playerId) => {
            // Skip if player is not alive or respawning
            if (!player.alive || player.respawning) return;
            
            // Skip if data is stale (no update for 1 second)
            if (now - player.lastUpdate > 1000) return;
            

            // Countdown to title
            const remainingMs = Math.max(0, this.gameOverEndTime - Date.now());
            const remainingSec = Math.ceil(remainingMs / 1000);
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`Returning to Title in ${remainingSec}s...  (ESC to skip)`, this.canvas.width / 2, this.canvas.height / 2 + 110);
            this.ctx.save();
            
            // Draw tank at position with proper rotation
            this.ctx.translate(player.x + 16, player.y + 16); // Center of 32x32 tank
            this.ctx.rotate(player.rotation);
            
            // Use different sprites for remote players
            const spriteNames = ['player2', 'player3'];
            const spriteIndex = Math.abs(this.hashCode(playerId)) % spriteNames.length;
            const sprite = this.assetLoader.getImage(spriteNames[spriteIndex]);
            
            if (sprite) {
                this.ctx.drawImage(sprite, -16, -16, 32, 32);
            } else {
                // Fallback colored square
                this.ctx.fillStyle = '#00ff88';
                this.ctx.fillRect(-16, -16, 32, 32);
            }
            
            this.ctx.restore();
            
            // Draw health bar
            const healthPercent = player.health / 100;
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(player.x + 6, player.y - 10, 20, 3);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(player.x + 6, player.y - 10, 20 * healthPercent, 3);
            
            // Draw player name
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`P${playerId.slice(-3)}`, player.x + 16, player.y - 15);
        });
    }

    // Helper function for consistent hashing
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    updateOrCreateRemotePlayer(playerId, data) {
        if (!this.remotePlayers.has(playerId)) {
            // Create a visual representation only (not a full Player entity)
            this.remotePlayers.set(playerId, {
                id: playerId,
                x: data.x,
                y: data.y,
                direction: data.direction || 0,
                facing: data.facing || 0,
                rotation: data.rotation || 0,
                health: data.health || 100,
                lives: data.lives || 4,
                alive: data.alive,
                respawning: data.respawning,
                lastUpdate: Date.now(),
                sprite: null // Will be set during rendering
            });
        } else {
            const player = this.remotePlayers.get(playerId);
            player.x = data.x;
            player.y = data.y;
            player.direction = data.direction || player.direction;
            player.facing = data.facing || player.facing;
            player.rotation = data.rotation || player.rotation;
            player.health = data.health || player.health;
            player.lives = data.lives || player.lives;
            player.alive = data.alive;
            player.respawning = data.respawning;
            player.lastUpdate = Date.now();
        }
    }

    renderMenu() {
        // Clear screen
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game name/logo
        const gameNameImg = this.assetLoader.getImage('gamename');
        if (gameNameImg) {
            const imgWidth = 400;
            const imgHeight = 100;
            const x = (this.canvas.width - imgWidth) / 2;
            const y = 100;
            this.ctx.drawImage(gameNameImg, x, y, imgWidth, imgHeight);
        }
        
        // Draw menu items
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        
        this.menuItems.forEach((item, index) => {
            const y = 300 + index * 60;
            
            if (index === this.selectedMenuItem) {
                this.ctx.fillStyle = '#ffff00'; // Yellow for selected
                this.ctx.fillRect(this.canvas.width / 2 - 200, y - 25, 400, 40);
                this.ctx.fillStyle = '#000000';
            } else {
                this.ctx.fillStyle = '#ffffff';
            }
            
            this.ctx.fillText(item.text, this.canvas.width / 2, y);
        });
        
        // Instructions
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Use Arrow Keys to navigate, Enter or Space to select', this.canvas.width / 2, this.canvas.height - 50);

    // Online disclaimer
    this.ctx.font = '14px Arial';
    this.ctx.fillStyle = '#ff8888';
    this.ctx.fillText('Online mode (experimental): buggy, currently unplayable', this.canvas.width / 2, this.canvas.height - 25);
    }

    renderLocalCoopMenu() {
        // Clear screen
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LOCAL CO-OP', this.canvas.width / 2, 120);
        
        // Draw controller status
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        const controllerCount = this.gamepadManager ? this.gamepadManager.getConnectedGamepadsCount() : 0;
        this.ctx.fillText(`Controllers Connected: ${controllerCount}`, this.canvas.width / 2, 150);
        
        // Show which controllers are detected
        if (this.gamepadManager && controllerCount > 0) {
            for (let i = 0; i < 4; i++) {
                const connected = this.gamepadManager.isGamepadConnected(i);
                this.ctx.fillStyle = connected ? '#00ff00' : '#666666';
                this.ctx.fillText(`Controller ${i}: ${connected ? 'READY' : 'NOT FOUND'}`, this.canvas.width / 2, 170 + i * 20);
            }
        }
        
        // Draw subtitle
        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Player 1: Keyboard or Controller 0', this.canvas.width / 2, 270);
        this.ctx.fillText('Players 2-8: Controllers 1-7 Required', this.canvas.width / 2, 290);
        
        // Draw menu items
        this.ctx.font = '28px Arial';
        
        this.coopMenuItems.forEach((item, index) => {
            const y = 330 + index * 50;
            
            if (index === this.selectedCoopMenuItem) {
                this.ctx.fillStyle = '#ffff00'; // Yellow for selected
                this.ctx.fillRect(this.canvas.width / 2 - 180, y - 20, 360, 35);
                this.ctx.fillStyle = '#000000';
            } else {
                this.ctx.fillStyle = '#ffffff';
            }
            
            this.ctx.fillText(item.text, this.canvas.width / 2, y);
        });
        
        // Instructions
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Use Arrow Keys to navigate, Enter/Space to select, ESC to go back', this.canvas.width / 2, this.canvas.height - 30);
    }

    renderOptions() {
        // Clear screen
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('OPTIONS', this.canvas.width / 2, 120);
        
        // Keep resolution/fullscreen items synced to live state
        const resItem = this.optionItems.find(i=>i.action==='resolution');
        if (resItem) {
            resItem.value = (this.currentResolutionIndex === 1) ? 0 : 1;
        }
        const fsItem = this.optionItems.find(i=>i.action==='fullscreen');
        if (fsItem) fsItem.value = !!document.fullscreenElement;

        // Draw option items
        this.ctx.font = '24px Arial';
        
        this.optionItems.forEach((item, index) => {
            const y = 220 + index * 80;
            const isSelected = index === this.selectedOptionItem;
            
            if (isSelected) {
                this.ctx.fillStyle = '#ffff00'; // Yellow background for selected
                this.ctx.fillRect(50, y - 30, this.canvas.width - 100, 50);
                this.ctx.fillStyle = '#000000';
            } else {
                this.ctx.fillStyle = '#ffffff';
            }
            
            if (item.type === 'slider') {
                // Draw slider label
                this.ctx.textAlign = 'left';
                this.ctx.fillText(item.text + ':', 80, y);
                
                // Draw slider bar
                const sliderX = 280;
                const sliderWidth = 300;
                const sliderHeight = 20;
                
                // Background bar
                this.ctx.fillStyle = isSelected ? '#666666' : '#333333';
                this.ctx.fillRect(sliderX, y - 10, sliderWidth, sliderHeight);
                
                // Fill bar
                const fillWidth = (item.value / item.max) * sliderWidth;
                this.ctx.fillStyle = isSelected ? '#00ff00' : '#0088ff';
                this.ctx.fillRect(sliderX, y - 10, fillWidth, sliderHeight);
                
                // Value text
                this.ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(item.value + '%', this.canvas.width - 80, y);
                
                if (isSelected) {
                    // Instructions for sliders
                    this.ctx.font = '14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillStyle = '#666666';
                    this.ctx.fillText('← → to adjust', this.canvas.width / 2, y + 25);
                    this.ctx.font = '24px Arial';
                }
            } else if (item.type === 'toggle') {
                // Draw toggle label
                this.ctx.textAlign = 'left';
                this.ctx.fillText(item.text + ':', 80, y);
                
                // Draw toggle switch
                const toggleX = 450;
                const toggleWidth = 80;
                const toggleHeight = 30;
                
                // Background
                this.ctx.fillStyle = item.value ? '#00aa00' : '#aa0000';
                this.ctx.fillRect(toggleX, y - 15, toggleWidth, toggleHeight);
                
                // Switch button
                const buttonWidth = 25;
                const buttonX = item.value ? toggleX + toggleWidth - buttonWidth - 5 : toggleX + 5;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(buttonX, y - 10, buttonWidth, 20);
                
                // Status text
                this.ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(item.value ? 'ON' : 'OFF', toggleX + toggleWidth / 2, y + 5);
                
                if (isSelected) {
                    // Instructions for toggles
                    this.ctx.font = '14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillStyle = '#666666';
                    this.ctx.fillText('← → or Enter to toggle', this.canvas.width / 2, y + 25);
                    this.ctx.font = '24px Arial';
                }
            } else if (item.type === 'select') {
                // Draw select label
                this.ctx.textAlign = 'left';
                this.ctx.fillText(item.text + ':', 80, y);
                
                // Draw current selection
                this.ctx.textAlign = 'center';
                this.ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
                const currentOption = item.options[item.value];
                this.ctx.fillText(`< ${currentOption} >`, this.canvas.width / 2 + 100, y);
                
                if (isSelected) {
                    // Instructions for select
                    this.ctx.font = '14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillStyle = '#666666';
                    this.ctx.fillText('← → to change', this.canvas.width / 2, y + 25);
                    this.ctx.font = '24px Arial';
                }
            } else {
                // Regular button
                this.ctx.textAlign = 'center';
                this.ctx.fillText(item.text, this.canvas.width / 2, y);
            }
        });
        
        // Instructions
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Arrow Keys: Navigate  |  Left/Right or Enter: Adjust/Toggle  |  ESC: Back', this.canvas.width / 2, this.canvas.height - 30);
    }

    renderExplosionEffects() {
        this.explosionEffects.forEach(effect => {
            const img = this.assetLoader.getImage('effect_' + effect.type);
            if (img) {
                this.ctx.save();
                this.ctx.globalAlpha = effect.alpha;
                this.ctx.translate(effect.x, effect.y);
                this.ctx.scale(effect.scale, effect.scale);
                
                const size = 32;
                this.ctx.drawImage(img, -size/2, -size/2, size, size);
                
                this.ctx.restore();
            }
        });
    }

    renderHitEffects() {
        if (this.hitEffects) {
            this.hitEffects.forEach(effect => {
                if (effect.alive) {
                    effect.render(this.ctx, this.renderSystem.camera);
                }
            });
        }
    }

    renderLoadingScreen(progress) {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2 - 50);
        
        // Progress bar
        const barWidth = 300;
        const barHeight = 20;
        const barX = (this.canvas.width - barWidth) / 2;
        const barY = this.canvas.height / 2;
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(barX, barY, (progress / 100) * barWidth, barHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`${Math.round(progress)}%`, this.canvas.width / 2, barY + barHeight + 30);
    }

    renderPauseScreen() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Press P or Escape to resume', this.canvas.width / 2, this.canvas.height / 2 + 50);
        this.ctx.restore();
    }

    renderGameOverScreen() {
        // Dark overlay
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Game Over title
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 64px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 100);
        
        // Stats
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '32px Arial';
        this.ctx.fillText(`Final Score: ${this.gameScore}`, this.canvas.width / 2, this.canvas.height / 2 - 20);
        this.ctx.fillText(`Stage Reached: ${this.stage}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        this.ctx.fillText(`Enemies Defeated: ${this.totalEnemiesKilled}`, this.canvas.width / 2, this.canvas.height / 2 + 60);
        
        // Instructions
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillText('Press ESC or Tap to return to title', this.canvas.width / 2, this.canvas.height / 2 + 140);
        
        this.ctx.restore();
    }

    // Stage clear & demo end helpers
    captureStageStartStats() {
        const totalLives = this.players.reduce((sum, p) => sum + (p?.lives || 0), 0);
        const totalScore = this.players.reduce((sum, p) => sum + (p?.score || 0), 0);
        return {
            stage: this.stage,
            time: Date.now(),
            totalLives,
            totalScore,
            totalKills: this.totalEnemiesKilled
        };
    }

    computeStageSummary() {
        const start = this.stageStartStats || { totalLives: 0, totalScore: 0, totalKills: 0 };
        const endLives = this.players.reduce((sum, p) => sum + (p?.lives || 0), 0);
        const endScore = this.players.reduce((sum, p) => sum + (p?.score || 0), 0);
        const elapsedSec = Math.max(1, Math.floor((Date.now() - (start.time || Date.now())) / 1000));
        const gainedLives = endLives - (start.totalLives || 0);
        const gainedScore = endScore - (start.totalScore || 0);
        return {
            stage: this.stage,
            lives: endLives,
            score: endScore,
            gainedLives,
            gainedScore,
            kills: this.totalEnemiesKilled - (start.totalKills || 0),
            elapsedSec
        };
    }

    onStageCleared() {
        // Stop gameplay and show summary
        this.gameState = 'stageClear';
        this.lastStageSummary = this.computeStageSummary();

        // Auto-advance after ~7 seconds
        if (this.stageClearTimeoutId) clearTimeout(this.stageClearTimeoutId);
        this.stageClearTimeoutId = setTimeout(() => {
            if (this.stage >= 4) {
                // Jungle is last stage in demo
                this.showDemoEnd();
            } else {
                this.advanceToNextStageFromClear();
            }
        }, 7000);
    }

    advanceToNextStageFromClear() {
        // Move to next stage and resume playing
        this.nextStage();
        this.gameState = 'playing';
    }

    showDemoEnd() {
        this.gameState = 'demoEnd';
        if (this.demoTimeoutId) clearTimeout(this.demoTimeoutId);
        // Optionally auto-return to menu after some seconds
        this.demoTimeoutId = setTimeout(() => {
            this.returnToMenu();
        }, 7000);
    }

    renderStageClearScreen() {
        const s = this.lastStageSummary || { stage: this.stage, lives: 0, score: 0, gainedLives: 0, gainedScore: 0, kills: 0, elapsedSec: 0 };
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#00ff66';
        this.ctx.font = 'bold 56px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Stage ${s.stage} Clear!`, this.canvas.width / 2, this.canvas.height / 2 - 120);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '28px Arial';
        const y = this.canvas.height / 2 - 40;
        this.ctx.fillText(`Enemies Defeated: ${this.totalEnemiesKilled}`, this.canvas.width / 2, y);
        this.ctx.fillText(`Score: ${s.score}  (+${Math.max(0, s.gainedScore)})`, this.canvas.width / 2, y + 40);
        this.ctx.fillText(`Lives: ${s.lives}  (${s.gainedLives >= 0 ? '+' : ''}${s.gainedLives})`, this.canvas.width / 2, y + 80);
        this.ctx.fillText(`Time: ${s.elapsedSec}s`, this.canvas.width / 2, y + 120);
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Next stage in 7 seconds...', this.canvas.width / 2, y + 170);
        this.ctx.restore();
    }

    renderDemoEndScreen() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Thanks for playing!', this.canvas.width / 2, this.canvas.height / 2 - 80);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Demo version — come back soon for more stages and the full game.', this.canvas.width / 2, this.canvas.height / 2 - 30);
        this.ctx.fillText('Visit our site for updates and the full version:', this.canvas.width / 2, this.canvas.height / 2 + 10);
        this.ctx.fillStyle = '#00ccff';
        this.ctx.fillText('https://green-core-beta.vercel.app/', this.canvas.width / 2, this.canvas.height / 2 + 40);
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Returning to menu in 7 seconds…', this.canvas.width / 2, this.canvas.height / 2 + 90);
        this.ctx.restore();
    }

    updateUI() {
        // Update lives display
        const livesElement = document.getElementById('lives');
        if (livesElement && this.players[0]) {
            livesElement.textContent = this.players[0].lives;
        }
        
        // Update score display
        const scoreElement = document.getElementById('score');
        if (scoreElement && this.players[0]) {
            scoreElement.textContent = this.players[0].score;
        }
        
        // Update stage display
        const stageElement = document.getElementById('stage');
        if (stageElement) {
            stageElement.textContent = this.stage;
        }
        
        // Update enemy count - show kills/needed and remaining
        const enemyCountElement = document.getElementById('enemyCount');
        if (enemyCountElement) {
            const remaining = this.enemiesNeededToWin - this.totalEnemiesKilled;
            enemyCountElement.textContent = `Defeated: ${this.totalEnemiesKilled}/${this.enemiesNeededToWin} | Remaining: ${remaining}`;
        }

        // Ensure HUD is visible and layered correctly in all modes/resolutions
        this.ensureHUDVisible();
    }

    ensureHUDVisible() {
        const hud = document.getElementById('gameUI');
        if (!hud) return;
        hud.classList.remove('hidden', 'ui-hidden');
        hud.style.display = '';
        hud.style.visibility = 'visible';
        hud.style.opacity = '1';
        // Keep above canvas; bump slightly higher in fullscreen
        hud.style.zIndex = document.fullscreenElement ? '3000' : '2500';
    }

    cleanup() {
        // Remove dead entities and update systems
        const prevBulletCount = this.bullets.length;
        const prevEnemyCount = this.enemies.length;
        
        // Filter out dead entities
        // Don't remove players who are respawning - only remove if truly game over
        this.players = this.players.filter(player => {
            if (player.isGameOver()) {
                // Player is truly dead (no lives left)
                this.collisionSystem.removeEntity(player);
                this.renderSystem.removeEntity(player);
                return false;
            }
            return true;
        });
        
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.alive) {
                // Enemy class now triggers its own destroy explosion; just remove and count
                this.collisionSystem.removeEntity(enemy);
                this.renderSystem.removeEntity(enemy);
                this.totalEnemiesKilled++;
                
                // Send network event
                if (this.isMultiplayer && this.networkManager) {
                    this.networkManager.sendEnemyKilled(enemy.id);
                }
                
                return false;
            }
            return true;
        });
        
        this.bullets = this.bullets.filter(bullet => {
            if (!bullet.alive) {
                // Clear the active bullet reference from the owner
                if (bullet.owner && bullet.owner.activeBullet === bullet) {
                    bullet.owner.activeBullet = null;
                }
                
                this.collisionSystem.removeEntity(bullet);
                this.renderSystem.removeEntity(bullet);
                return false;
            }
            return true;
        });
        
        this.walls = this.walls.filter(wall => {
            if (!wall.alive) {
                this.collisionSystem.removeEntity(wall);
                this.renderSystem.removeEntity(wall);
                return false;
            }
            return true;
        });
        
        this.cars = this.cars.filter(car => {
            if (!car.alive) {
                // Create explosion effect when car is destroyed
                this.createExplosionEffect(car.x + car.width/2, car.y + car.height/2, 'destroy');
                
                this.collisionSystem.removeEntity(car);
                this.renderSystem.removeEntity(car);
                
                // Send network event
                if (this.isMultiplayer && this.networkManager) {
                    this.networkManager.sendDestructibleDestroyed(car.id, 'car');
                }
                
                return false;
            }
            return true;
        });
        
        this.powerUps = this.powerUps.filter(powerUp => {
            if (!powerUp.alive) {
                this.collisionSystem.removeEntity(powerUp);
                this.renderSystem.removeEntity(powerUp);
                return false;
            }
            return true;
        });
        
        // Debug: Log cleanup (much less frequent to improve performance)
        if (prevBulletCount !== this.bullets.length && this.bullets.length % 50 === 0) {
            console.log(`Cleaned up ${prevBulletCount - this.bullets.length} bullets, ${this.bullets.length} remaining`);
        }
        if (prevEnemyCount !== this.enemies.length) {
            console.log(`Enemies killed: ${prevEnemyCount - this.enemies.length}, Total killed: ${this.totalEnemiesKilled}/${this.enemiesNeededToWin}`);
        }
        
        // Clean up render system
        this.renderSystem.cleanup();
    }

    // Game state management
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            console.log('Game paused');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            console.log('Game resumed');
        }
        this.updateDebugControlsVisibility();
    }

    gameOver(reason = 'Game Over') {
        console.log('Game Over:', reason);
        this.gameState = 'gameOver';
        this.updateDebugControlsVisibility();
        
        // Calculate final score
        this.gameScore = this.players.reduce((total, player) => total + player.score, 0);
        
        // Update final score display
        const finalScoreElement = document.getElementById('finalScore');
        if (finalScoreElement) {
            finalScoreElement.textContent = this.gameScore;
        }
        
    // Schedule auto return to title after 5 seconds
    this.gameOverEndTime = Date.now() + 5000;
    if (this.gameOverReturnTimeoutId) clearTimeout(this.gameOverReturnTimeoutId);
    this.gameOverReturnTimeoutId = setTimeout(() => this.returnToMenu(), 5000);
    }

    restartGame() {
    // Disabled manual restart per request (auto return only)
    return;
        
        // Reset game state
        this.gameState = 'playing';
        this.resetGame();
    }

    returnToMenu() {
        // Stop stage music and start intro music
        this.soundManager.stopMusic();
        this.soundManager.playMusic('game_intro', 0.5, true);
        
        // Reset to menu state
        this.gameState = 'menu';
        this.selectedMenuItem = 0;
        
        // Clear game entities
        this.players = [];
        this.enemies = [];
        this.bullets = [];
        this.walls = [];
        this.cars = [];
        this.powerUps = [];
        this.explosionEffects = [];
        
        console.log('Returned to main menu');
    }

    nextStage() {
    this.stage++;
    // Removed wrap to stage 1 so future (unimplemented) stage numbers can still hold custom editor data
        console.log(`Advancing to stage ${this.stage}`);
        
        // Reset stage-specific variables
        this.totalEnemiesKilled = 0;
        this.bossBattlePhase = false; // Reset boss battle phase for new stage
        
        // Keep maxEnemies at 4 for multiple enemy spawning
        this.maxEnemies = 4;
        this.enemySpawnDelay = Math.max(2000, 5000 - (this.stage * 500));
        
        // Clear remaining enemies
        this.enemies.forEach(enemy => enemy.destroy());
        this.enemies = [];
        
        // Clear bullets
        this.bullets.forEach(bullet => bullet.destroy());
        this.bullets = [];

        // Remove any existing walls (including editor / sprite generated) from BOTH systems
        if (this.walls && this.walls.length){
            this.walls.forEach(w => {
                this.collisionSystem.removeEntity && this.collisionSystem.removeEntity(w);
                this.renderSystem.removeEntity && this.renderSystem.removeEntity(w);
            });
            this.walls = [];
        }

        // Clear sprite editor spawned entities explicitly so they don't leak into next stage visuals
        if (this.spriteEditor) this.clearSpriteEditorEntities();
        
        // Clear current stage objects properly
        this.cars.forEach(car => {
            this.renderSystem.removeEntity(car);
            this.collisionSystem.removeEntity(car);
        });
        this.cars = [];
        
        this.walls.forEach(wall => {
            this.collisionSystem.removeEntity(wall);
        });
        this.walls = [];
        
    // Setup new stage with error handling
        try {
            this.setupStage(this.stage);
        } catch (error) {
            console.error(`Error setting up stage ${this.stage}:`, error);
            // Fallback to city stage if there's an error
            this.setupCityStage();
        }

        // Apply user collision rectangles & sprite placements for the NEW stage every time (not just first stage)
        this.applyEditorRectanglesForStage(this.stage);
        if (this.spriteEditor) this.rebuildSpriteEditorEntitiesForStage();

        // Re-clamp players inside any newly applied editor bounds
        this.repositionPlayersInsideBounds();
        
    // Reposition players safely inside new stage bounds
    this.repositionPlayersInsideBounds();

    // Spawn new enemies
        this.enemySpawnTimer = 0;
        
        this.updateUI();
    }

    setupStage(stageNumber) {
        console.log(`Setting up stage ${stageNumber}`);
        
        try {
            switch (stageNumber) {
                case 1:
                    this.setupCityStage();
                    break;
                case 2:
                    this.setupIslandStage();
                    break;
                case 3:
                    this.setupKitchenStage();
                    break;
                case 4:
                    this.setupJungleStage();
                    break;
                default:
                    // Future stages - fallback to city for now
                    console.log(`Stage ${stageNumber} not implemented, using city stage`);
                    this.setupCityStage();
                    break;
            }
        } catch (error) {
            console.error(`Error in stage ${stageNumber} setup:`, error);
            this.setupCityStage(); // Safe fallback
        }

    // Snapshot stage start stats for summary later
    this.stageStartStats = this.captureStageStartStats();

    // (Collision & sprite editor entities now applied during createLevel / stage setup earlier)
    }

    repositionPlayersInsideBounds() {
        const area = this.getPlayableAreaBounds();
        this.players.forEach(p => { if(!p) return; const safe=this.clampPointToPlayArea(p.x, p.y, area, p.width||32); p.x=safe.x; p.y=safe.y; });
    }

    setupCityStage() {
    // Original city stage setup
    console.log('Setting up City Stage');
    this.renderSystem.setBackground('stage_city');
    // No auto boundary walls
    if (this.autoObstaclesEnabled) this.createCars();
    }

    setupIslandStage() {
    console.log('Setting up Island Stage with Barrels');
    this.renderSystem.setBackground('stage_island');
    // No auto island walls
    if (this.autoObstaclesEnabled) this.createBarrels();
    console.log('Island stage ready (auto obstacles ' + (this.autoObstaclesEnabled?'ON':'OFF') + ')');
    }

    setupKitchenStage() {
    console.log('Setting up Kitchen Stage with Cups');
    this.renderSystem.setBackground('stage_kitchen');
    // No auto kitchen walls
    if (this.autoObstaclesEnabled) this.createCups();
    console.log('Kitchen stage ready (auto obstacles ' + (this.autoObstaclesEnabled?'ON':'OFF') + ')');
    }

    setupJungleStage() {
    console.log('Setting up Jungle Stage with Boxes');
    this.renderSystem.setBackground('stage_jungle');
    // No auto jungle walls
    if (this.autoObstaclesEnabled) this.createDestructibleBoxes();
    console.log('Jungle stage ready (auto obstacles ' + (this.autoObstaclesEnabled?'ON':'OFF') + ')');
    }
    // ===== Playable Area Helpers =====
    getPlayableAreaBounds(){
        const W=this.canvas.width, H=this.canvas.height;
        const walls=this.walls.filter(w=> w.collisionLayer==='wall');
        // Treat walls that hug edges (within 25px) as potential borders
        const edgeTol=40*(this.entityScale||1);
        const leftWall = walls.filter(w=> w.position.x < edgeTol && w.size.y > H*0.4).sort((a,b)=> (b.size.y - a.size.y))[0];
        const rightWall = walls.filter(w=> (w.position.x + w.size.x) > (W - edgeTol) && w.size.y > H*0.4).sort((a,b)=> (b.size.y - a.size.y))[0];
        const topWall = walls.filter(w=> w.position.y < edgeTol && w.size.x > W*0.4).sort((a,b)=> (b.size.x - a.size.x))[0];
        const bottomWall = walls.filter(w=> (w.position.y + w.size.y) > (H - edgeTol) && w.size.x > W*0.4).sort((a,b)=> (b.size.x - a.size.x))[0];
        let minX = leftWall? leftWall.position.x + leftWall.size.x : edgeTol;
        let maxX = rightWall? rightWall.position.x : W - edgeTol;
        let minY = topWall? topWall.position.y + topWall.size.y : edgeTol;
        let maxY = bottomWall? bottomWall.position.y : H - edgeTol;
        if (maxX - minX < W*0.3 || maxY - minY < H*0.3){
            // Fallback with margin
            const m=20*(this.entityScale||1);
            return {minX:m,minY:m,maxX:W-m,maxY:H-m};
        }
        return {minX,minY,maxX,maxY};
    }
    // Per-stage bounds based on legacy coordinate square inside walls
    getStageBoundsSquare(){
        // Try to infer from existing invisible walls if present
        const base = this.getPlayableAreaBounds();
        // For known stages, tighten to the canonical square we use for layouts (scaled)
        const sx = (n)=> this.sx ? this.sx(n) : n;
        const sy = (n)=> this.sy ? this.sy(n) : n;
        // Legacy logical bounds used by createWalls and island walls: L=110,T=102,R=689,B=500
        const L = sx(110), T = sy(102), R = sx(689), B = sy(500);
        const minX = Math.max(base.minX, L);
        const maxX = Math.min(base.maxX, R);
        const minY = Math.max(base.minY, T);
        const maxY = Math.min(base.maxY, B);
        // Ensure sane rectangle
        if (maxX - minX < 50 || maxY - minY < 50) return base;
        return { minX, minY, maxX, maxY };
    }
    clampPointToPlayArea(x,y,area,margin=0){
        return {
            x: Math.min(Math.max(x, area.minX + margin), area.maxX - margin),
            y: Math.min(Math.max(y, area.minY + margin), area.maxY - margin)
        };
    }

    createCups() {
        // Use a grid similar to cars but a bit bigger; cups are destructible walls
        const cupPositions = [
            // 4 columns x 5 rows like cars, but spaced out slightly
            { x: 226, y: 177 }, { x: 226, y: 226 }, { x: 226, y: 275 }, { x: 226, y: 324 }, { x: 226, y: 375 },
            { x: 358, y: 177 }, { x: 358, y: 226 }, { x: 358, y: 275 }, { x: 358, y: 324 }, { x: 358, y: 375 },
            { x: 494, y: 177 }, { x: 494, y: 226 }, { x: 494, y: 275 }, { x: 494, y: 324 }, { x: 494, y: 375 },
            { x: 623, y: 177 }, { x: 623, y: 226 }, { x: 623, y: 275 }, { x: 623, y: 324 }, { x: 623, y: 375 }
        ].map(p => ({ x: this.sx(p.x), y: this.sy(p.y) }));
        const width = 64 * this.entityScale; const height = 64 * this.entityScale;
        cupPositions.forEach(pos => {
            const cup = new Car(pos.x - width/2, pos.y - height/2, width, height);
            cup.sprite = this.assetLoader.getImage('wall_cup');
            cup.health = 2;
            cup.maxHealth = 2;
            
            // Add to collection and systems
            this.cars.push(cup);
            this.renderSystem.addEntity(cup);
            this.collisionSystem.addEntity(cup);
        });
        
        console.log(`Created ${cupPositions.length} cup obstacles in kitchen stage`);
    }

    createIslandWalls() {
    // Remove existing non-editor island walls to prevent stacking duplicates
    if (this.walls && this.walls.length) {
        this.walls = this.walls.filter(w => { if(!w.editorWall && !w.editorSpriteWall){ this.collisionSystem.removeEntity(w); return false;} return true; });
    }
    const uni = this.entityScale; const wt = 8 * uni;
    const removed = (this.collisionEditor && this.collisionEditor.removedBaseWalls && this.collisionEditor.removedBaseWalls[this.stage])||[];
    const isRemoved=(x,y,w,h)=> removed.some(r=> Math.abs(r.x-x)<2 && Math.abs(r.y-y)<2 && Math.abs(r.width-w)<2 && Math.abs(r.height-h)<2 );
    const base=[
        new Entity(110 * uni, 94 * uni, 579 * uni, wt),
        new Entity(689 * uni, 100 * uni, wt, 400 * uni),
        new Entity(100 * uni, 500 * uni, 589 * uni, wt),
        new Entity(100 * uni, 102 * uni, wt, 398 * uni)
    ];
    base.forEach(w=>{ if(!isRemoved(w.position.x,w.position.y,w.size.x,w.size.y)) this.walls.push(w); });
        
        // Add walls to collision system
        this.walls.forEach(wall => {
            wall.collisionLayer = 'wall';
            wall.visible = false; // Invisible water collision
            this.collisionSystem.addEntity(wall);
        });
    }

    createFishDecoration() {
    const fishW = 128 * this.entityScale; const fishH = 128 * this.entityScale;
    const fishX = this.sx(400) - fishW/2;
    const fishY = this.sy(300) - fishH/2;
    const fish = new Entity(fishX, fishY, fishW, fishH);
        fish.sprite = this.assetLoader.getImage('wall_fish');
        fish.collisionLayer = 'decoration';
        fish.destructible = false;
        fish.visible = true;
        
        this.cars.push(fish); // Add to cars array for rendering
        this.renderSystem.addEntity(fish);
        // Don't add to collision system - it's just decoration
    }

    createDestructibleBoxes() {
    const boxes = [];
    const width = 64 * this.entityScale, height = 64 * this.entityScale;

        // Requested layout:
        // - Horizontal span: from x=227 to x=638 (left to right), 8 boxes per row
        // - First row y=191
        // - Additional rows below at y = 247, 292, 345, 389
    const cols = 8; // existing columns kept as-is
        const xStart = 227;
        const xEnd = 638;
        const yRows = [191, 247, 292, 345, 389];

        // Generate evenly spaced centers from start to end (inclusive)
        const xs = [];
        for (let i = 0; i < cols; i++) {
            const t = i / (cols - 1);
            xs.push(Math.round(xStart + t * (xEnd - xStart)));
        }

    // Add the missing leftmost column (requested ~x=171) without shifting existing columns
    const extraLeftX = 171;
    xs.unshift(extraLeftX);

        // Build Car-based boxes so they are solid and destructible, but use the box sprite
        for (const yCenter of yRows) {
            for (const xCenter of xs) {
                const sx = this.sx(xCenter), sy = this.sy(yCenter);
                const box = new Car(sx - width / 2, sy - height / 2, width, height);
                box.sprite = this.assetLoader.getImage('wall_box');
                box.health = 1;
                box.maxHealth = 1;
                // Car already sets: destructible=true, solid=true, collisionLayer='wall'
                boxes.push(box);
                this.renderSystem.addEntity(box);
                this.collisionSystem.addEntity(box);
            }
        }

    // Track in cars array for unified destruction handling/network sync
    this.cars.push(...boxes);
    const rowsCount = yRows.length;
    const colsCount = xs.length;
    console.log(`Created ${boxes.length} destructible boxes (${rowsCount} rows x ${colsCount} cols)`);
    }

    createBarrels() {
    const barrelPositions = [
            // Column 1: x=226/225, y from 177 to 424 (6 barrels)
            { x: 226, y: 177 },
            { x: 226, y: 226 },
            { x: 226, y: 275 },
            { x: 226, y: 324 },
            { x: 226, y: 375 },
            { x: 225, y: 424 },
            
            // Column 2: x=358, y from 177 to 424 (6 barrels)
            { x: 358, y: 177 },
            { x: 358, y: 226 },
            { x: 358, y: 275 },
            { x: 358, y: 324 },
            { x: 358, y: 375 },
            { x: 358, y: 424 },
            
            // Column 3: x=494/490, y from 177 to 424 (6 barrels)
            { x: 494, y: 177 },
            { x: 494, y: 226 },
            { x: 494, y: 275 },
            { x: 494, y: 324 },
            { x: 494, y: 375 },
            { x: 490, y: 424 },
            
            // Column 4: x=623, y from 177 to 424 (6 barrels)
            { x: 623, y: 177 },
            { x: 623, y: 226 },
            { x: 623, y: 275 },
            { x: 623, y: 324 },
            { x: 623, y: 375 },
            { x: 623, y: 424 }
        ].map(p => ({ x: this.sx(p.x), y: this.sy(p.y) }));
        const bSize = 64 * this.entityScale;
        barrelPositions.forEach(pos => {
            const barrel = new Car(pos.x - bSize/2, pos.y - bSize/2, bSize, bSize);
            
            // Set barrel sprite
            barrel.sprite = this.assetLoader.getImage('wall_barrel');
            
            this.cars.push(barrel);
            this.renderSystem.addEntity(barrel);
            this.collisionSystem.addEntity(barrel);
        });
        
    console.log(`Created ${barrelPositions.length} barrels (scaled size ${bSize.toFixed(1)})`);
    }

    // Effect system
    createEffect(type, position, options = {}) {
        return this.renderSystem.createEffect(type, position, options);
    }

    addScreenShake(intensity, duration) {
        this.renderSystem.addScreenShake(intensity, duration);
    }

    // Event handlers
    onBaseDestroyed(base) {
        console.log('Base destroyed!');
        // Game over will be handled in checkGameConditions
    }
    
    // Debug methods
    toggleDebug() {
        this.renderSystem.toggleDebug();
        window.DEBUG_MODE = this.renderSystem.showDebug;
    }

    toggleDebugVisibility() {
        // Hide/show ALL UI elements including debug, coordinates, buttons, etc.
        const allUIElements = [
            // Debug elements
            document.getElementById('debugControls'),
            // Main floating debug panel (coordinates etc.)
            document.getElementById('debugPanel'),
            document.querySelector('.debug-display'),
            document.querySelector('#debugDisplay'),
            
            // Game UI elements  
            document.getElementById('gameUI'),
            document.querySelector('.game-ui'),
            
            // Touch controls
            document.getElementById('touchControls'),
            document.querySelector('.touch-controls'),
            document.getElementById('screenTouchControls'),
            
            // Title and other elements
            document.querySelector('h1'),
            
            // Multiplayer menu
            document.getElementById('multiplayerMenu'),
            // Collision editor overlay (F9) so Shift+H hides it too
            document.getElementById('collisionEditorOverlay')
        ];
        
        // Check current state by looking at the first visible element
        const gameUI = document.getElementById('gameUI');
        const isCurrentlyVisible = gameUI && gameUI.style.display !== 'none';
        
        allUIElements.forEach(element => {
            if (element) {
                if (isCurrentlyVisible) {
                    element.style.display = 'none';
                } else {
                    element.style.display = '';
                }
            }
        });
        
        // Store the UI visibility state
        this.uiHidden = isCurrentlyVisible;
        
        if (this.uiHidden) {
            console.log('All UI hidden (Shift+H)');
        } else {
            console.log('All UI shown (Shift+H)');
            // When showing UI, also check if we need to auto-hide touch controls
            this.updateUIVisibility();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            // Enter fullscreen mode
            document.documentElement.requestFullscreen().then(() => {
                // Make body completely black and hide overflow
                document.body.style.overflow = 'hidden';
                document.body.style.backgroundColor = 'black';
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                
                // Expand game container to cover whole screen & remove gradient
                const gameContainer = document.getElementById('gameContainer');
                if (gameContainer) {
                    gameContainer.dataset.prevStyle = gameContainer.getAttribute('style') || '';
                    gameContainer.style.position = 'fixed';
                    gameContainer.style.top = '0';
                    gameContainer.style.left = '0';
                    gameContainer.style.width = '100vw';
                    gameContainer.style.height = '100vh';
                    gameContainer.style.margin = '0';
                    gameContainer.style.padding = '0';
                    gameContainer.style.background = 'black';
                    gameContainer.style.display = 'block';
                }
                
                // Make canvas fill entire screen
                const canvas = document.getElementById('gameCanvas');
                if (canvas) {
                    // Base logical resolution (original game coordinate system)
                    const baseWidth = parseInt(canvas.getAttribute('width')) || 800;
                    const baseHeight = parseInt(canvas.getAttribute('height')) || 600;
                    if (!canvas.dataset.prevWidth) {
                        canvas.dataset.prevWidth = canvas.width;
                        canvas.dataset.prevHeight = canvas.height;
                    }
                    // Ensure logical size stays constant for game logic
                    canvas.width = baseWidth;
                    canvas.height = baseHeight;
                    canvas.style.position = 'fixed';
                    canvas.style.top = '50%';
                    canvas.style.left = '50%';
                    canvas.style.width = baseWidth + 'px';
                    canvas.style.height = baseHeight + 'px';
                    canvas.style.zIndex = '9999';
                    canvas.style.backgroundColor = 'black';
                    canvas.style.border = '0';
                    canvas.style.boxShadow = 'none';
                    canvas.style.borderRadius = '0';
                    canvas.style.transformOrigin = 'center center';
                    const applyScale = () => {
                        const scale = Math.max(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
                        canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
                    };
                    applyScale();
                    window.addEventListener('resize', applyScale);
                    canvas.dataset.fullscreenScaleHandler = 'true';
                }
                
                // Hide debug/multiplayer chrome; keep UI counters and touch toggle visible
                const hideIds = ['debugControls','debugPanel','multiplayerMenu'];
                hideIds.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });
                // Ensure UI overlay and touch panels are above canvas
                const gameUI = document.getElementById('gameUI');
                const touchControls = document.getElementById('touchControls');
                const screenTouchControls = document.getElementById('screenTouchControls');
                if (gameUI) { gameUI.style.display=''; gameUI.style.zIndex='3000'; }
                if (touchControls) { touchControls.style.display=''; touchControls.style.zIndex='3000'; }
                if (screenTouchControls) { screenTouchControls.style.display=''; screenTouchControls.style.zIndex='2900'; }
                // Let auto-hide logic manage touch visibility
                
                console.log('Entered true fullscreen mode');
            }).catch(err => {
                console.log('Error entering fullscreen:', err);
            });
        } else {
            // Exit fullscreen mode
            document.exitFullscreen().then(() => {
                // Restore normal layout
                document.body.style.overflow = '';
                document.body.style.backgroundColor = '';
                document.body.style.margin = '';
                document.body.style.padding = '';
                
                const gameContainer = document.getElementById('gameContainer');
                if (gameContainer) {
                    // Restore previous inline style if any, otherwise clear
                    const prev = gameContainer.dataset.prevStyle || '';
                    gameContainer.setAttribute('style', prev);
                    delete gameContainer.dataset.prevStyle;
                }
                
                const canvas = document.getElementById('gameCanvas');
                if (canvas) {
                    canvas.style.position = '';
                    canvas.style.top = '';
                    canvas.style.left = '';
                    canvas.style.width = '';
                    canvas.style.height = '';
                    canvas.style.zIndex = '';
                    canvas.style.backgroundColor = '';
                    canvas.style.border = '';
                    canvas.style.boxShadow = '';
                    canvas.style.borderRadius = '';
                    canvas.style.transform = '';
                    canvas.style.transformOrigin = '';
                    // Restore previous intrinsic size
                    if (canvas.dataset.prevWidth) {
                        canvas.width = canvas.dataset.prevWidth;
                        canvas.height = canvas.dataset.prevHeight;
                        delete canvas.dataset.prevWidth;
                        delete canvas.dataset.prevHeight;
                    }
                    // (We can't easily remove anonymous resize listener; minimal impact.)
                }
                
                // Restore hidden debug/multiplayer elements
                ['debugControls','debugPanel','multiplayerMenu'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=''; });
                // Reset elevated z-indexes
                const gameUI = document.getElementById('gameUI');
                const touchControls = document.getElementById('touchControls');
                const screenTouchControls = document.getElementById('screenTouchControls');
                if (gameUI) gameUI.style.zIndex='';
                if (touchControls) touchControls.style.zIndex='';
                if (screenTouchControls) screenTouchControls.style.zIndex='';
                
                // Restore touch controls and debug based on current settings
                this.updateUIVisibility();
                
                console.log('Exited fullscreen mode');
            });
        }
    }

    cleanupStaleBulletReferences() {
        // Clean up any stale activeBullet references that might prevent shooting
        [...this.players, ...this.enemies].forEach(entity => {
            if (entity.activeBullet && (!entity.activeBullet.alive || entity.activeBullet.destroyed || !this.bullets.includes(entity.activeBullet))) {
                console.log(`Clearing stale bullet reference for ${entity.constructor.name} ${entity.playerIndex || entity.enemyType || 'unknown'}`);
                entity.activeBullet = null;
            }
        });
    }

    updateUIVisibility() {
    // Keep HUD always visible unless explicitly hidden with Shift+H
    if (this.uiHidden) return;
    const touchControls = document.getElementById('touchControls');
    const screenTouchControls = document.getElementById('screenTouchControls');
    if (touchControls) touchControls.style.display = '';
    if (screenTouchControls) screenTouchControls.style.display = '';
    // Ensure the HUD has the right z-index
    this.ensureHUDVisible();
    }

    detectKeyboardControllerUsage() {
        let hasKeyboardInput = false;
        let hasGamepadInput = false;
        
        // Check if any keyboard input is being used
        if (this.inputSystem.keys) {
            const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter'];
            hasKeyboardInput = gameKeys.some(key => this.inputSystem.keys[key]);
        }
        
        // Check if any gamepad is connected and being used
        if (this.gamepadManager) {
            hasGamepadInput = this.gamepadManager.getConnectedGamepadsCount() > 0;
            
            // Also check if any gamepad buttons are currently pressed or sticks moved
            for (let i = 0; i < 4; i++) {
                if (this.gamepadManager.isGamepadConnected(i)) {
                    // Check for stick movement
                    const leftStick = this.gamepadManager.getLeftStick(i);
                    const rightStick = this.gamepadManager.getRightStick(i);
                    const dpad = this.gamepadManager.getDPad(i);
                    
                    // Check for any axis movement
                    const hasStickInput = Math.abs(leftStick.x) > 0.1 || Math.abs(leftStick.y) > 0.1 ||
                                        Math.abs(rightStick.x) > 0.1 || Math.abs(rightStick.y) > 0.1 ||
                                        Math.abs(dpad.x) > 0 || Math.abs(dpad.y) > 0;
                    
                    // Check for any button press
                    const buttons = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS'];
                    const hasButtonInput = buttons.some(button => this.gamepadManager.isButtonPressed(i, button));
                    
                    if (hasStickInput || hasButtonInput) {
                        hasGamepadInput = true;
                        break;
                    }
                }
            }
        }
        
        // Update keyboard/controller active state
        const wasActive = this.keyboardControllerActive;
        this.keyboardControllerActive = hasKeyboardInput || hasGamepadInput;
        
        // Update UI visibility if state changed
        if (wasActive !== this.keyboardControllerActive) {
            this.updateUIVisibility();
            console.log(`Input method changed: ${this.keyboardControllerActive ? 'Keyboard/Controller' : 'Touch'} - Touch controls ${this.keyboardControllerActive ? 'hidden' : 'shown'}`);
        }
    }

    // ================= Resolution & Borderless Handling (F2 Menu) =================
    createResolutionOptionsMenu() {
        if (document.getElementById('resolutionOptionsMenu')) return;
        const menu = document.createElement('div');
        menu.id = 'resolutionOptionsMenu';
        menu.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#0f0;padding:18px 26px;font-family:'Courier New',monospace;font-size:14px;z-index:3000;min-width:420px;border:2px solid #0f0;display:none;`;
        document.body.appendChild(menu);
        this.refreshResolutionOptionsMenu();
        document.addEventListener('keydown', (e) => {
            if (e.code === 'F2') {
                this.optionsOpen = !this.optionsOpen;
                menu.style.display = this.optionsOpen ? 'block' : 'none';
                if (this.optionsOpen) this.refreshResolutionOptionsMenu();
            } else if (this.optionsOpen) {
                if (['ArrowUp','ArrowDown'].includes(e.code)) {
                    e.preventDefault();
                    const max = 2; // resolution line, borderless toggle, apply
                    this.optionsSelection = (this.optionsSelection + (e.code==='ArrowDown'?1:-1) + (max+1)) % (max+1);
                    this.refreshResolutionOptionsMenu();
                } else if (['ArrowLeft','ArrowRight'].includes(e.code)) {
                    e.preventDefault();
                    if (this.optionsSelection === 0) {
                        const dir = e.code==='ArrowRight'?1:-1;
                        this.currentResolutionIndex = (this.currentResolutionIndex + dir + this.availableResolutions.length) % this.availableResolutions.length;
                        this.refreshResolutionOptionsMenu();
                    } else if (this.optionsSelection === 1) {
                        this.borderlessFullscreen = !this.borderlessFullscreen;
                        this.refreshResolutionOptionsMenu();
                    }
                } else if (e.code === 'Enter') {
                    e.preventDefault();
                    this.applyResolutionSettings();
                } else if (e.code === 'Escape') {
                    this.optionsOpen = false;
                    menu.style.display = 'none';
                }
            }
        });
    }

    refreshResolutionOptionsMenu() {
        const menu = document.getElementById('resolutionOptionsMenu');
        if (!menu) return;
        const res = this.availableResolutions[this.currentResolutionIndex];
        const hl = (i,t)=> i===this.optionsSelection?`> ${t}`:`  ${t}`;
        menu.innerHTML = `
            <div style="font-weight:bold;color:#fff;margin-bottom:6px;font-size:16px">DISPLAY OPTIONS (F2)</div>
<pre style="margin:0;line-height:1.35;white-space:pre">${hl(0,'Resolution: '+res.label)}\n${hl(1,'Borderless: '+(this.borderlessFullscreen?'ON':'OFF'))}\n${hl(2,'Apply (Enter)')}\n\nArrow Keys = Navigate / Change\nEnter = Apply   Esc/F2 = Close</pre>`;
    }

    applyResolutionSettings() {
        const canvas = this.canvas;
        if (!canvas) return;
        const res = this.availableResolutions[this.currentResolutionIndex];
        // Logical resolution
        canvas.width = res.width;
        canvas.height = res.height;
        canvas.setAttribute('width', res.width);
        canvas.setAttribute('height', res.height);
        window.GAME_WIDTH = res.width;
        window.GAME_HEIGHT = res.height;
    // Recalculate scale factors BEFORE (re)layout
    this.updateScale();

        if (this.borderlessFullscreen) {
            // Borderless: scale to fit entire screen without cropping (may letterbox if aspect differs)
            canvas.style.position = 'fixed';
            canvas.style.top = '50%';
            canvas.style.left = '50%';
            canvas.style.zIndex = '1999';
            canvas.style.border = '0';
            canvas.style.boxShadow = 'none';
            canvas.style.background = 'black';
            canvas.style.transformOrigin = 'center center';
            const resizeBorderless = () => {
                const scale = Math.min(window.innerWidth / res.width, window.innerHeight / res.height);
                canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
                canvas.style.width = res.width + 'px';
                canvas.style.height = res.height + 'px';
            };
            resizeBorderless();
            window.addEventListener('resize', resizeBorderless);
        } else {
            // Windowed fallback: center within container using original sizing
            canvas.style.position = '';
            canvas.style.top = '';
            canvas.style.left = '';
            canvas.style.transform = '';
            canvas.style.width = res.width + 'px';
            canvas.style.height = res.height + 'px';
        }
        console.log(`Resolution applied: ${res.label} ${this.borderlessFullscreen?'[Borderless]':''}`);
        if (this.optionsOpen) this.refreshResolutionOptionsMenu();
        // If game already has entities, re-layout the current stage to occupy full area
        if (this.players && this.players.length) {
            console.log('[SCALE] Rebuilding current stage for new resolution');
            const preserveState = {
                stage: this.stage,
                totalEnemiesKilled: this.totalEnemiesKilled,
                score: this.gameScore,
                difficulty: this.difficulty
            };
            // Clear current entities and rebuild stage layout only (do not reset score/kill counts)
            this.walls = []; this.cars = []; this.powerUps = []; this.enemies = []; this.bullets = [];
            this.renderSystem.clearEntities && this.renderSystem.clearEntities();
            // Re-add players at proportionally same relative position (keep their percent offset)
            this.players.forEach(p => {
                const relX = p.x / (this.baseWidth); // relative to base logical size used previously
                const relY = p.y / (this.baseHeight);
                p.x = relX * this.canvas.width;
                p.y = relY * this.canvas.height;
            });
            // Rebuild stage objects for current stage
            try { this.setupStage(preserveState.stage); } catch (e) { console.error('Relayout error', e); }
            this.totalEnemiesKilled = preserveState.totalEnemiesKilled;
            this.gameScore = preserveState.score;
            this.difficulty = preserveState.difficulty;
            if (this.spriteEditor) this.rebuildSpriteEditorEntitiesForStage();
        }
    }

    // ================= Collision Editor (F9) =================
    initCollisionEditor() {
        // Load saved rectangles from localStorage
        try {
            const raw = localStorage.getItem('wf_collision_rects_v1');
            if (raw) {
                this.collisionEditor.rectangles = JSON.parse(raw);
            }
            const removedRaw = localStorage.getItem('wf_removed_base_walls_v1');
            if (removedRaw){ this.collisionEditor.removedBaseWalls = JSON.parse(removedRaw); }
        } catch(e){ console.warn('Collision editor load failed', e); }

    // Key handling
        document.addEventListener('keydown', (e)=>{
            if (e.code === 'F9') {
                e.preventDefault();
                this.toggleCollisionEditor();
            } else if (this.collisionEditor.active) {
                if (e.code === 'KeyS') { // save
                    e.preventDefault();
                    this.serializeCollisionRectangles();
        } else if (e.code === 'KeyG') { // toggle grid
            this.collisionEditor.gridSnap = !this.collisionEditor.gridSnap; this.updateCollisionEditorOverlay();
                } else if (e.code === 'Delete') {
                    // Delete selected rectangle if any
                    const list=this.collisionEditor.rectangles[this.stage]||[];
                    if (this.collisionEditor.selectedRect){
                        const idx=list.indexOf(this.collisionEditor.selectedRect);
                        if(idx>=0){ list.splice(idx,1); this.collisionEditor.selectedRect=null; this.persistEditorData(); this.refreshEditorWallsForStage(this.stage); this.updateCollisionEditorOverlay(); return; }
                    }
                    // If none selected, delete first rect under mouse pointer
                    const mp = this.collisionEditor.lastMousePos;
                    if(mp){
                        for(let i=list.length-1;i>=0;i--){ const r=list[i]; if(mp.x>=r.x&&mp.x<=r.x+r.width&&mp.y>=r.y&&mp.y<=r.y+r.height){ list.splice(i,1); this.persistEditorData(); this.refreshEditorWallsForStage(this.stage); this.updateCollisionEditorOverlay(); break; } }
                    }
                } else if (e.code === 'Escape') {
                    e.preventDefault();
                    this.cancelCurrentDrag();
                }
            }
        });

        // Mouse handling on canvas
        // Enhanced mouse handling (left only)
        this.collisionEditor.gridSnap = true; this.collisionEditor.gridSize = 16;
        this.collisionEditor.resizing=false; this.collisionEditor.resizeHandle=null; this.collisionEditor.dragOffset={dx:0,dy:0};
        this.canvas.addEventListener('mousedown',(e)=>{
            if(!this.collisionEditor.active || e.button!==0) return; const p=this.editorPointerPos(e);
            const list=this.collisionEditor.rectangles[this.stage]||[];
            // Resize / move detection
            for (let i=list.length-1;i>=0;i--){ const r=list[i]; const handle=this.collisionHitHandle(r,p,6); if(handle){ this.collisionEditor.resizing=true; this.collisionEditor.resizeHandle=handle; this.collisionEditor.currentRect=r; this.collisionEditor.selectedRect=r; return; }
                if(p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height){
                    this.collisionEditor.selectedRect=r; // select
                    // Start move only if user drags (set flag but we will confirm move on mousemove)
                    this.collisionEditor.resizing=true; this.collisionEditor.resizeHandle='move'; this.collisionEditor.currentRect=r; this.collisionEditor.dragOffset={dx:p.x-r.x,dy:p.y-r.y}; return; } }
            // Create new
            this.collisionEditor.dragging=true; this.collisionEditor.startPos=p; this.collisionEditor.currentRect={x:p.x,y:p.y,width:0,height:0,_new:true};
        });
        this.canvas.addEventListener('mousemove',(e)=>{
            if(!this.collisionEditor.active) return; const p=this.editorPointerPos(e);
            this.collisionEditor.lastMousePos = p;
            if(this.collisionEditor.dragging&&this.collisionEditor.currentRect){ const r=this.collisionEditor.currentRect; r.width=p.x-r.x; r.height=p.y-r.y; }
            else if(this.collisionEditor.resizing&&this.collisionEditor.currentRect){ const r=this.collisionEditor.currentRect; if(this.collisionEditor.resizeHandle==='move'){ r.x=p.x-this.collisionEditor.dragOffset.dx; r.y=p.y-this.collisionEditor.dragOffset.dy; } else { const L=r.x,T=r.y,R=r.x+r.width,B=r.y+r.height; let nx=L,ny=T,nr=R,nb=B; if(this.collisionEditor.resizeHandle.includes('l')) nx=p.x; if(this.collisionEditor.resizeHandle.includes('r')) nr=p.x; if(this.collisionEditor.resizeHandle.includes('t')) ny=p.y; if(this.collisionEditor.resizeHandle.includes('b')) nb=p.y; r.x=Math.min(nx,nr); r.y=Math.min(ny,nb); r.width=Math.abs(nr-nx); r.height=Math.abs(nb-ny);} }
        });
        this.canvas.addEventListener('mouseup',(e)=>{
            if(!this.collisionEditor.active || e.button!==0) return; if(this.collisionEditor.dragging&&this.collisionEditor.currentRect){ this.finishEditorRectangle(); }
            else if(this.collisionEditor.resizing){ if(this.collisionEditor.gridSnap && this.collisionEditor.currentRect){ const g=this.collisionEditor.gridSize; const r=this.collisionEditor.currentRect; r.x=Math.round(r.x/g)*g; r.y=Math.round(r.y/g)*g; r.width=Math.round(r.width/g)*g; r.height=Math.round(r.height/g)*g; } this.collisionEditor.resizing=false; this.collisionEditor.resizeHandle=null; this.persistEditorData(); this.refreshEditorWallsForStage(this.stage); this.updateCollisionEditorOverlay(); }
        });
    }

    toggleCollisionEditor() {
        this.collisionEditor.active = !this.collisionEditor.active;
        if (this.collisionEditor.active) {
            this.showCollisionEditorOverlay();
            this.refreshEditorWallsForStage(this.stage);
            console.log('[Editor] Collision editor ON');
        } else {
            this.hideCollisionEditorOverlay();
            // Hide base walls again
            this.walls.forEach(w=>{ if(w._baseWallTempShown){ w.visible=false; delete w._baseWallTempShown; }});
            console.log('[Editor] Collision editor OFF');
        }
    }

    showCollisionEditorOverlay() {
        if (!this.collisionEditor.overlay) {
            const div = document.createElement('div');
            div.id='collisionEditorOverlay';
            div.style.cssText='position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.7);color:#0f0;padding:8px 12px;font:12px monospace;z-index:4000;max-width:260px;line-height:1.3;border:1px solid #0f0;';
            document.body.appendChild(div);
            this.collisionEditor.overlay = div;
        }
        this.updateCollisionEditorOverlay();
    }
    hideCollisionEditorOverlay(){ if (this.collisionEditor.overlay) this.collisionEditor.overlay.remove(); this.collisionEditor.overlay=null; }
    updateCollisionEditorOverlay(){
        if (!this.collisionEditor.overlay) return;
        const list = this.collisionEditor.rectangles[this.stage]||[];
    this.collisionEditor.overlay.innerHTML = `<b>COLLISION EDITOR (F9)</b><br>Stage ${this.stage}<br>Rects: ${list.length}<br>Grid: ${this.collisionEditor.gridSnap?'ON':'OFF'}<br><br>Drag: add<br>Delete key: delete selected<br>Click then drag: move / resize handles<br>G: grid snap<br>S: save<br>Esc: cancel drag<br>F9: exit`;
    }

    editorPointerPos(e){
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
    }
    cancelCurrentDrag(){ this.collisionEditor.dragging=false; this.collisionEditor.currentRect=null; }
    finishEditorRectangle(){
        const r=this.collisionEditor.currentRect; if(!r) return;
        // Normalize
        if (r.width<0){ r.x+=r.width; r.width*=-1; }
        if (r.height<0){ r.y+=r.height; r.height*=-1; }
        if (r.width<5 || r.height<5){ this.cancelCurrentDrag(); return; }
    if (this.collisionEditor.gridSnap){ const g=this.collisionEditor.gridSize; r.x=Math.round(r.x/g)*g; r.y=Math.round(r.y/g)*g; r.width=Math.round(r.width/g)*g; r.height=Math.round(r.height/g)*g; }
        if(!this.collisionEditor.rectangles[this.stage]) this.collisionEditor.rectangles[this.stage]=[];
        const storeRect = { x:Math.round(r.x), y:Math.round(r.y), width:Math.round(r.width), height:Math.round(r.height) };
        this.collisionEditor.rectangles[this.stage].push(storeRect);
        this.persistEditorData();
        this.cancelCurrentDrag();
        this.refreshEditorWallsForStage(this.stage);
        this.updateCollisionEditorOverlay();
    }
    persistEditorData(){
        try { localStorage.setItem('wf_collision_rects_v1', JSON.stringify(this.collisionEditor.rectangles)); } catch(e){ console.warn('Persist fail', e); }
    }
    serializeCollisionRectangles(){
        // Persist already handled in persistEditorData(); here we just log and provide quick feedback
        this.persistEditorData();
        console.log('[Editor] Collision data saved to localStorage (no download)');
    }
    saveCollisionEditorFromButton(){
        if(!this.collisionEditor.active){ console.log('[Editor] Activating collision editor to save current data'); }
        this.serializeCollisionRectangles();
    }
    applyEditorRectanglesForStage(stage){
        const list = this.collisionEditor.rectangles[stage];
        if (!list || !list.length) return;
        list.forEach(r=> this.addEditorWall(r));
        console.log(`[Editor] Applied ${list.length} custom collision rectangles for stage ${stage}`);
    }
    refreshEditorWallsForStage(stage){
        // Remove existing editor walls (have flag editorWall)
        this.walls = this.walls.filter(w=>{ if(w.editorWall){ this.collisionSystem.removeEntity(w); return false;} return true; });
        const list = this.collisionEditor.rectangles[stage]||[];
        list.forEach(r=> this.addEditorWall(r));
        // Also reveal base walls (non-editor, non-sprite) while editing for deletion preview
        if (this.collisionEditor.active){
            this.walls.forEach(w=>{ if(!w.editorWall && !w.editorSpriteWall){ w.visible=true; w._baseWallTempShown=true; }});
        } else {
            this.walls.forEach(w=>{ if(w._baseWallTempShown){ w.visible=false; delete w._baseWallTempShown; }});
        }
    }
    addEditorWall(r){
        const wall = new Entity(r.x, r.y, r.width, r.height);
        wall.collisionLayer='wall';
        wall.collisionMask=['player','enemy','playerBullet','enemyBullet'];
        wall.visible = this.collisionEditor.active; // show only while editing
        wall.color='rgba(0,255,200,0.25)';
        wall.editorWall=true;
        this.walls.push(wall);
        this.collisionSystem.addEntity(wall);
        if (this.collisionEditor.active) this.renderSystem.addEntity(wall); // so it draws
    }

    // Render editor overlay rectangles & current drag (hook into render)
    renderCollisionEditorVisuals(){
        if(!this.collisionEditor.active) return;
        const ctx=this.ctx;
        ctx.save();
        const list=this.collisionEditor.rectangles[this.stage]||[];
        // Grid
        if (this.collisionEditor.gridSnap){
            const g=this.collisionEditor.gridSize; ctx.strokeStyle='rgba(0,255,200,0.15)'; ctx.lineWidth=1;
            for (let x=0;x<this.canvas.width;x+=g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.canvas.height); ctx.stroke(); }
            for (let y=0;y<this.canvas.height;y+=g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.canvas.width,y); ctx.stroke(); }
        }
        ctx.strokeStyle='#00ffc8'; ctx.lineWidth=1;
        list.forEach(r=>{ ctx.strokeRect(r.x, r.y, r.width, r.height); this.drawCollisionHandles(ctx,r); });
    // Highlight selected
    if(this.collisionEditor.selectedRect){ const sr=this.collisionEditor.selectedRect; ctx.strokeStyle='#ff0'; ctx.lineWidth=2; ctx.strokeRect(sr.x-1,sr.y-1,sr.width+2,sr.height+2); }
        if (this.collisionEditor.dragging && this.collisionEditor.currentRect){
            const d=this.collisionEditor.currentRect; ctx.fillStyle='rgba(0,255,200,0.15)'; ctx.fillRect(d.x, d.y, d.width, d.height); ctx.strokeRect(d.x, d.y, d.width, d.height);
        }
        ctx.restore();
    }

    collisionHitHandle(r,p,size){
        const hs=size;
        const handles={ tl:{x:r.x,y:r.y}, tr:{x:r.x+r.width,y:r.y}, br:{x:r.x+r.width,y:r.y+r.height}, bl:{x:r.x,y:r.y+r.height} };
        for(const k in handles){ const h=handles[k]; if(p.x>=h.x-hs && p.x<=h.x+hs && p.y>=h.y-hs && p.y<=h.y+hs) return k; }
        return null;
    }
    drawCollisionHandles(ctx,r){
        const hs=6; ctx.fillStyle='#00ffc8';
        const pts=[[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]];
        pts.forEach(pt=>{ ctx.fillRect(pt[0]-hs/2, pt[1]-hs/2, hs, hs); });
    }

    // ================= Sprite Placement Editor (F10) =================
    initSpriteEditor(){
        try {
            const raw = localStorage.getItem('wf_sprite_placements_v1');
            if (raw) this.spriteEditor.placements = JSON.parse(raw);
        } catch(e){ console.warn('Sprite placements load failed', e); }

        document.addEventListener('keydown', (e)=>{
            if (e.code === 'F10') {
                e.preventDefault();
                this.toggleSpriteEditor();
            } else if (this.spriteEditor.active) {
                if (e.code === 'Tab') {
                    e.preventDefault();
                    const dir = e.shiftKey?-1:1;
                    this.spriteEditor.selectedIndex = (this.spriteEditor.selectedIndex + dir + this.spriteEditor.palette.length) % this.spriteEditor.palette.length;
                } else if (e.code === 'Delete') {
                    if (this.spriteEditor.dragSprite) {
                        this.deleteSpritePlacement(this.spriteEditor.dragSprite);
                        this.spriteEditor.dragSprite = null;
                    }
                } else if ((e.ctrlKey||e.metaKey) && e.code === 'KeyS') {
                    e.preventDefault();
                    this.saveSpritePlacements();
                } else if (e.altKey && e.code === 'KeyC') {
                    if (this.spriteEditor.dragSprite) {
                        this.spriteEditor.dragSprite.collidable = !this.spriteEditor.dragSprite.collidable;
                        this.rebuildSpriteEditorEntitiesForStage();
                        this.saveSpritePlacements();
                    }
                } else if (e.code === 'KeyD') { // toggle destructible
                    if (this.spriteEditor.dragSprite) {
                        this.spriteEditor.dragSprite.destructible = !this.spriteEditor.dragSprite.destructible;
                        this.saveSpritePlacements();
                        this.rebuildSpriteEditorEntitiesForStage();
                    }
                } else if (['Equal','NumpadAdd'].includes(e.code)) { // + increase size
                    if (this.spriteEditor.dragSprite) { const sp=this.spriteEditor.dragSprite; sp.width*=1.1; sp.height*=1.1; this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); }
                } else if (['Minus','NumpadSubtract'].includes(e.code)) { // - decrease size
                    if (this.spriteEditor.dragSprite) { const sp=this.spriteEditor.dragSprite; sp.width*=0.9; sp.height*=0.9; this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); }
                } else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) { // rotate fine control
                    if (this.spriteEditor.dragSprite) { const sp=this.spriteEditor.dragSprite; const step= (e.shiftKey? Math.PI/180 : Math.PI/90); // Shift = finer 1°
                        if(e.code==='ArrowLeft'||e.code==='ArrowDown') sp.angle=(sp.angle||0)-step; else sp.angle=(sp.angle||0)+step; this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); e.preventDefault(); }
                }
            }
        });

        // Mouse interactions
        this.canvas.addEventListener('mousedown', (e)=>{
            if (!this.spriteEditor.active || e.button!==0) return;
            const p = this.spritePointerPos(e);
            const list = this.getSpritePlacementsForStage();
            // Shift+Click delete placement
            if(e.shiftKey){ for(let i=list.length-1;i>=0;i--){ const sp=list[i]; if(p.x>=sp.x&&p.x<=sp.x+sp.width&&p.y>=sp.y&&p.y<=sp.y+sp.height){ list.splice(i,1); this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); return; }} return; }
            // Detect resize / rotate handles on selected sprite first
            if (this.spriteEditor.dragSprite){
                const sp=this.spriteEditor.dragSprite; const ang=sp.angle||0; const cx=sp.x+sp.width/2, cy=sp.y+sp.height/2;
                // Transform point into unrotated local space for corner detection
                const dx=p.x-cx, dy=p.y-cy; const cos=Math.cos(-ang), sin=Math.sin(-ang); const lx=dx*cos - dy*sin + cx; const ly=dx*sin + dy*cos + cy - cy; // incorrect; we'll simplify by inverse rotate corners instead
                // Simpler: compute rotated corner world positions and test distance
                const corners=[{name:'tl',x:sp.x,y:sp.y},{name:'tr',x:sp.x+sp.width,y:sp.y},{name:'br',x:sp.x+sp.width,y:sp.y+sp.height},{name:'bl',x:sp.x,y:sp.y+sp.height}];
                const rotPoint=(pt)=>{ const rx=pt.x-cx, ry=pt.y-cy; return { x: cx + rx*Math.cos(ang) - ry*Math.sin(ang), y: cy + rx*Math.sin(ang) + ry*Math.cos(ang)}; };
                const hs=8; for(const c of corners){ const rc=rotPoint(c); if(p.x>=rc.x-hs/2&&p.x<=rc.x+hs/2&&p.y>=rc.y-hs/2&&p.y<=rc.y+hs/2){ this.spriteEditor.resizing=true; this.spriteEditor.resizeHandle=c.name; this.spriteEditor.dragging=false; return; }}
                // Rotation handle
                const rotY=sp.y-24; const rotWorld=rotPoint({x:sp.x+sp.width/2,y:sp.y-24}); const dist=Math.hypot(p.x-rotWorld.x,p.y-rotWorld.y); if(dist<12){ this.spriteEditor.rotating=true; this.spriteEditor.rotateCenter={x:cx,y:cy}; return; }
            }
            for (let i=list.length-1;i>=0;i--){
                const sp = list[i];
                if (p.x>=sp.x && p.x<=sp.x+sp.width && p.y>=sp.y && p.y<=sp.y+sp.height){
                    this.spriteEditor.dragging = true;
                    this.spriteEditor.dragSprite = sp;
                    this.spriteEditor.dragOffset = { x: p.x - sp.x, y: p.y - sp.y };
                    return;
                }
            }
            // Create new
            const name = this.spriteEditor.palette[this.spriteEditor.selectedIndex];
            const size = this.estimateSpriteSize(name);
            const sp = { x: p.x - size.w/2, y: p.y - size.h/2, width: size.w, height: size.h, sprite: name, collidable: false, angle:0 };
            list.push(sp);
            this.spriteEditor.dragging = true;
            this.spriteEditor.dragSprite = sp;
            this.spriteEditor.dragOffset = { x: size.w/2, y: size.h/2 };
            this.rebuildSpriteEditorEntitiesForStage();
            this.saveSpritePlacements();
        });
        document.addEventListener('mousemove',(e)=>{
            if(!this.spriteEditor.active) return;
            const mp = this.spritePointerPos(e);
            if (this.spriteEditor.rotating && this.spriteEditor.dragSprite){ const sp=this.spriteEditor.dragSprite; const c=this.spriteEditor.rotateCenter; sp.angle=Math.atan2(mp.y-c.y,mp.x-c.x); this.saveSpritePlacements(); return; }
            if (this.spriteEditor.resizing && this.spriteEditor.dragSprite){ const sp=this.spriteEditor.dragSprite; // operate in unrotated space: approximate by ignoring rotation for size change
                // Determine new bounds based on handle and mouse delta (without rotation complexity)
                const mx=mp.x, my=mp.y; const minSize=8;
                if(['tl','tr','br','bl'].includes(this.spriteEditor.resizeHandle)){
                    if(this.spriteEditor.resizeHandle.includes('t')){ const diff= (sp.y+sp.height) - my; sp.height=Math.max(minSize,diff); sp.y=(sp.y+sp.height)-diff; }
                    if(this.spriteEditor.resizeHandle.includes('b')){ sp.height=Math.max(minSize,my-sp.y); }
                    if(this.spriteEditor.resizeHandle.includes('l')){ const diff=(sp.x+sp.width)-mx; sp.width=Math.max(minSize,diff); sp.x=(sp.x+sp.width)-diff; }
                    if(this.spriteEditor.resizeHandle.includes('r')){ sp.width=Math.max(minSize,mx-sp.x); }
                }
                this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); return; }
            if (!this.spriteEditor.dragging || !this.spriteEditor.dragSprite) return;
            const p = mp;
            const sp = this.spriteEditor.dragSprite;
            sp.x = p.x - this.spriteEditor.dragOffset.x;
            sp.y = p.y - this.spriteEditor.dragOffset.y;
        });
        document.addEventListener('mouseup',(e)=>{
            if (!this.spriteEditor.active) return;
            if (this.spriteEditor.rotating){ this.spriteEditor.rotating=false; this.saveSpritePlacements(); return; }
            if (this.spriteEditor.resizing){ this.spriteEditor.resizing=false; this.spriteEditor.resizeHandle=null; this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); return; }
            if (this.spriteEditor.dragging){
                this.spriteEditor.dragging=false;
                this.saveSpritePlacements();
                this.rebuildSpriteEditorEntitiesForStage();
            }
        });
    }
    toggleSpriteEditor(){
        this.spriteEditor.active = !this.spriteEditor.active;
        // Always ensure entities exist for stage (collidables must persist)
        this.rebuildSpriteEditorEntitiesForStage();
        console.log(`[Editor] Sprite editor ${this.spriteEditor.active?'ON':'OFF'}`);
        // Show / hide graphical picker
        if (this.spriteEditor.active) {
            this.showSpritePicker();
        } else {
            this.hideSpritePicker();
        }
    }
    spritePointerPos(e){
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
    }
    getSpritePlacementsForStage(){
        const key = 'stage_'+this.stage;
        if (!this.spriteEditor.placements[key]) this.spriteEditor.placements[key] = [];
        return this.spriteEditor.placements[key];
    }
    saveSpritePlacements(){
        try { localStorage.setItem('wf_sprite_placements_v1', JSON.stringify(this.spriteEditor.placements)); } catch(e){ console.warn('Sprite placement save failed', e); }
    }
    saveSpritePlacementsFromButton(){
        this.saveSpritePlacements();
        console.log('[Editor] Sprite placements saved to localStorage (no download)');
    }
    toggleSelectedSpriteCollidable(){
        if(!this.spriteEditor.dragSprite){ console.log('[Editor] No sprite selected'); return; }
        this.spriteEditor.dragSprite.collidable = !this.spriteEditor.dragSprite.collidable;
        this.saveSpritePlacements();
        this.rebuildSpriteEditorEntitiesForStage();
        console.log('[Editor] Selected sprite collidable=', this.spriteEditor.dragSprite.collidable);
    }
    toggleSelectedSpriteDestructible(){
        if(!this.spriteEditor.dragSprite){ console.log('[Editor] No sprite selected'); return; }
        this.spriteEditor.dragSprite.destructible = !this.spriteEditor.dragSprite.destructible;
        this.saveSpritePlacements();
        this.rebuildSpriteEditorEntitiesForStage();
        console.log('[Editor] Selected sprite destructible=', this.spriteEditor.dragSprite.destructible);
    }
    serializeSpritePlacements(){
        const data = JSON.stringify(this.spriteEditor.placements, null, 2);
        const blob = new Blob([data], {type:'application/json'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sprite-placements.json'; document.body.appendChild(a); a.click(); a.remove();
        console.log('[Editor] Sprite placements exported');
    }
    promptImportSpritePlacements(){
        if (!this._spriteImportInput){
            const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json'; inp.style.display='none';
            inp.addEventListener('change', ()=>{ if (inp.files && inp.files[0]) { this.importSpritePlacements(inp.files[0]); } });
            document.body.appendChild(inp); this._spriteImportInput=inp;
        }
        this._spriteImportInput.value=''; this._spriteImportInput.click();
    }
    importSpritePlacements(file){ const reader=new FileReader(); reader.onload=()=>{ try { const data=JSON.parse(reader.result); if(data && typeof data==='object'){ this.spriteEditor.placements=data; this.saveSpritePlacements(); this.rebuildSpriteEditorEntitiesForStage(); console.log('[Editor] Sprite placements imported'); } } catch(e){ console.warn('Import failed', e);} }; reader.readAsText(file); }
    estimateSpriteSize(name){
        const scale = this.entityScale || 1;
        switch(name){
            case 'car': return { w:80*scale, h:40*scale };
            case 'wall_box': return { w:64*scale, h:64*scale };
            case 'wall_cup': return { w:48*scale, h:64*scale };
            case 'wall_barrel': return { w:48*scale, h:64*scale };
            case 'wall_fish': return { w:96*scale, h:48*scale };
            default: return { w:64*scale, h:64*scale };
        }
    }
    clearSpriteEditorEntities(){
        if (!this.spriteEditor.spriteEntities) return;
        this.spriteEditor.spriteEntities.forEach(ent=>{
            this.renderSystem.removeEntity && this.renderSystem.removeEntity(ent);
            this.collisionSystem.removeEntity && this.collisionSystem.removeEntity(ent);
        });
        this.spriteEditor.spriteEntities = [];
    }
    rebuildSpriteEditorEntitiesForStage(){
        if (!this.spriteEditor) return;
        // Remove previous stage's entities (they get cleared on stage change anyway, but ensure not duplicated)
        this.clearSpriteEditorEntities();
        const list = this.getSpritePlacementsForStage();
        list.forEach(p=>{
            if (p.collidable){
                const wall = new Entity(p.x, p.y, p.width, p.height);
                wall.collisionLayer='wall';
                wall.collisionMask=['player','enemy','playerBullet','enemyBullet'];
                wall.visible = true;
                wall.sprite = this.assetLoader.getImage(p.sprite);
                wall.spriteName = p.sprite;
                wall.editorSpriteWall = true;
                wall.rotation = p.angle || 0;
                wall.destructible = !!p.destructible;
                this.walls.push(wall);
                this.collisionSystem.addEntity(wall);
                this.renderSystem.addEntity(wall);
                this.spriteEditor.spriteEntities.push(wall);
            } else {
                const deco = new Entity(p.x, p.y, p.width, p.height);
                deco.collisionLayer='decoration';
                deco.visible = true;
                deco.sprite = this.assetLoader.getImage(p.sprite);
                deco.spriteName = p.sprite;
                deco.editorDecoration = true;
                deco.rotation = p.angle || 0;
                this.renderSystem.addEntity(deco);
                this.spriteEditor.spriteEntities.push(deco);
            }
        });
    }
    deleteSpritePlacement(sp){
        const list = this.getSpritePlacementsForStage();
        const idx = list.indexOf(sp);
        if (idx>=0) list.splice(idx,1);
        this.saveSpritePlacements();
        this.rebuildSpriteEditorEntitiesForStage();
    }
    renderSpriteEditorVisuals(){
        if (!this.spriteEditor || (!this.spriteEditor.active && !this.spriteEditor.dragging)) return; // show outlines only when active
        if (!this.spriteEditor.active) return; // outlines only active mode
        const ctx = this.ctx;
        const list = this.getSpritePlacementsForStage();
        ctx.save();
        list.forEach(p=>{
            const sel = this.spriteEditor.dragSprite===p;
            ctx.save();
            const cx=p.x+p.width/2, cy=p.y+p.height/2;
            const ang = p.angle||0;
            ctx.translate(cx,cy); ctx.rotate(ang); ctx.translate(-cx,-cy);
            ctx.strokeStyle = sel?'#0ff': (p.collidable?'#f55':'#5f5');
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.width, p.height);
            if(sel){
                // Corner handles
                const hs=6; const corners=[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]];
                ctx.fillStyle='#000'; ctx.strokeStyle='#0ff';
                corners.forEach(c=>{ ctx.beginPath(); ctx.rect(c[0]-hs/2,c[1]-hs/2,hs,hs); ctx.fill(); ctx.stroke(); });
                // Rotation handle (above top center)
                const rx=p.x+p.width/2, ry=p.y-24; ctx.beginPath();
                ctx.moveTo(p.x+p.width/2,p.y); ctx.lineTo(rx,ry); ctx.stroke();
                ctx.beginPath(); ctx.arc(rx,ry,8,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill(); ctx.stroke();
            }
            ctx.restore();
        });
        // Toolbar
        ctx.fillStyle='rgba(0,0,0,0.6)';
        ctx.fillRect(0,0,this.canvas.width,38);
        ctx.fillStyle='#fff';
        ctx.font='14px Arial';
        ctx.textAlign='left';
        const paletteStr = this.spriteEditor.palette.map((n,i)=> i===this.spriteEditor.selectedIndex?`[${n}]`:n).join('  ');
    ctx.fillText(`SPRITE EDITOR (F10)  Tab cycle  Click add/drag  Shift+Click delete  Drag corners resize  Drag circle rotate  +/- size  Arrows rotate (Shift=fine)  Alt+C collidable  D destructible  Delete remove  Ctrl+S save  Ctrl+Shift+S export  Ctrl+I import  ${paletteStr}`, 10, 24);
        ctx.restore();
    }

    // ================= Sprite Picker Overlay =================
    showSpritePicker(){
        // Avoid duplicates
        if (this._spritePickerEl) return;
        const picker = document.createElement('div');
        picker.id = 'spritePicker';
        picker.style.cssText = 'position:fixed;left:10px;top:50px;max-height:420px;width:210px;overflow:auto;background:rgba(0,0,0,0.75);border:1px solid #0ff;padding:6px;z-index:4500;font:12px monospace;color:#fff;display:grid;grid-template-columns:repeat(3, 64px);grid-auto-rows:82px;gap:4px;';
        const header = document.createElement('div');
        header.textContent = 'SPRITES';
        header.style.cssText='grid-column:1/4;text-align:center;font-weight:bold;margin-bottom:4px;font-size:13px;color:#0ff;';
        picker.appendChild(header);
        // Build tiles from palette
        this.spriteEditor.palette.forEach((name, idx)=>{
            const tile = document.createElement('div');
            tile.style.cssText='position:relative;width:64px;height:78px;cursor:pointer;border:1px solid #222;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:2px;background:#111;';
            tile.dataset.index=idx;
            const img = this.assetLoader.getImage(name);
            const imgEl = document.createElement('canvas');
            imgEl.width=60; imgEl.height=48;
            const ictx = imgEl.getContext('2d');
            if (img){
                // Fit image maintaining aspect
                const scale = Math.min(60 / img.width, 48 / img.height);
                const w = img.width * scale; const h = img.height * scale;
                ictx.imageSmoothingEnabled = false;
                ictx.drawImage(img, (60-w)/2, (48-h)/2, w, h);
            } else {
                ictx.fillStyle='#333'; ictx.fillRect(0,0,60,48); ictx.fillStyle='#555'; ictx.fillRect(10,10,40,28);
            }
            const label = document.createElement('div');
            label.textContent = name.replace(/^stage_/,'');
            label.style.cssText='width:100%;text-align:center;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ccc;';
            tile.appendChild(imgEl);
            tile.appendChild(label);
            tile.addEventListener('click',()=>{
                this.spriteEditor.selectedIndex = idx;
                this.updateSpritePickerSelection();
            });
            tile.addEventListener('dblclick',()=>{
                // On double click, create a placement centered on screen
                const size = this.estimateSpriteSize(name);
                const sp = { x: (this.canvas.width/2) - size.w/2, y: (this.canvas.height/2) - size.h/2, width:size.w, height:size.h, sprite:name, collidable:false, angle:0 };
                const list = this.getSpritePlacementsForStage();
                list.push(sp);
                this.spriteEditor.dragSprite = sp;
                this.saveSpritePlacements();
                this.rebuildSpriteEditorEntitiesForStage();
            });
            picker.appendChild(tile);
        });
        document.body.appendChild(picker);
        this._spritePickerEl = picker;
        // Add close button / toggle hint
        const closeBtn = document.createElement('div');
        closeBtn.textContent='✕';
        closeBtn.title='Hide (V)';
        closeBtn.style.cssText='position:absolute;right:4px;top:4px;font-size:12px;color:#0ff;cursor:pointer;';
        closeBtn.addEventListener('click',()=> this.toggleSpritePickerVisibility());
        picker.appendChild(closeBtn);
        this.updateSpritePickerSelection();
        // Keyboard toggle (V)
        if(!this._spritePickerKeyHandler){
            this._spritePickerKeyHandler=(e)=>{ if(this.spriteEditor.active && e.code==='KeyV'){ e.preventDefault(); this.toggleSpritePickerVisibility(); } };
            document.addEventListener('keydown', this._spritePickerKeyHandler);
        }
    }
    hideSpritePicker(){
        if (this._spritePickerEl){ this._spritePickerEl.remove(); this._spritePickerEl=null; }
        if (this._spritePickerKeyHandler){ document.removeEventListener('keydown', this._spritePickerKeyHandler); this._spritePickerKeyHandler=null; }
    }
    toggleSpritePickerVisibility(){
        if(!this._spritePickerEl){ this.showSpritePicker(); return; }
        const vis = this._spritePickerEl.style.display !== 'none';
        this._spritePickerEl.style.display = vis?'none':'grid';
    }
    updateSpritePickerSelection(){
        if(!this._spritePickerEl) return;
        const idx = this.spriteEditor.selectedIndex;
        Array.from(this._spritePickerEl.querySelectorAll('div[data-index]')).forEach(div=>{
            if (parseInt(div.dataset.index)===idx){ div.style.border='1px solid #0ff'; div.style.background='#033'; }
            else { div.style.border='1px solid #222'; div.style.background='#111'; }
        });
    }
}
