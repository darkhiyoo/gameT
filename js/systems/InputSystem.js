class InputSystem {
    constructor(gamepadManager) {
        this.gamepadManager = gamepadManager;
        this.keys = {};
        this.previousKeys = {};
    this.touchControls = {};
        this.players = [];
        
        // Pause functionality
        this.lastPauseTime = 0;
        this.pauseDelay = 300; // 300ms delay between pause toggles
        
        // Input mappings for keyboard - only Player 1 (Player 0)
        this.keyMappings = {
            // Player 1 (Arrow keys + WASD + alternatives) - keyboard only
            0: {
                up: ['ArrowUp', 'KeyW', 'KeyI', 'Numpad8'],
                down: ['ArrowDown', 'KeyS', 'KeyK', 'Numpad2'],
                left: ['ArrowLeft', 'KeyA', 'KeyJ', 'Numpad4'],
                right: ['ArrowRight', 'KeyD', 'KeyL', 'Numpad6'],
                fire: ['Space', 'KeyX', 'KeyZ', 'KeyF', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Enter', 'Numpad0', 'NumpadEnter'],
                pause: ['KeyP', 'Escape', 'Pause']
            }
            // Players 2-8 will use Xbox controllers only
        };
        
        this.init();
    }

    init() {
        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
    // Touch controls (D-pad + Fire button only)
    this.initTouchControls();
        
        // Gamepad events
        window.addEventListener('gamepadConnected', (e) => this.onGamepadConnected(e));
        window.addEventListener('gamepadDisconnected', (e) => this.onGamepadDisconnected(e));
        
        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Prevent default behavior for game keys and add universal key support
        window.addEventListener('keydown', (e) => {
            const gameKeys = [
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
                'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyO',
                'KeyX', 'KeyZ', 'KeyP', 'Escape', 'Enter', 'F1', 'F3'
            ];
            
            if (gameKeys.includes(e.code)) {
                e.preventDefault();
            }
            
            // Universal key support - if a key isn't mapped to movement/pause, treat it as fire
            this.handleUniversalKeySupport(e.code);
        });
        
        // Add support for all alphabet and number keys
        this.addUniversalKeyMappings();
    }
    
    addUniversalKeyMappings() {
        // Add all alphabet keys as potential fire buttons for maximum compatibility
        const alphabetKeys = [
            'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH', 'KeyI', 'KeyJ',
            'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT',
            'KeyU', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ'
        ];
        
        const numberKeys = [
            'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'
        ];
        
        const functionKeys = [
            'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
        ];
        
        // Add all these as potential fire keys (excluding movement keys)
        const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyI', 'KeyJ', 'KeyK', 'KeyL'];
        const pauseKeys = ['KeyP', 'Escape'];
        
        [...alphabetKeys, ...numberKeys, ...functionKeys].forEach(key => {
            if (!movementKeys.includes(key) && !pauseKeys.includes(key)) {
                this.keyMappings[0].fire.push(key);
            }
        });
    }
    
    handleUniversalKeySupport(keyCode) {
        // If key is not mapped to any specific action, make it a fire button
        const isMovementKey = this.isKeyMappedToMovement(keyCode);
        const isPauseKey = this.isKeyMappedToPause(keyCode);
        
        if (!isMovementKey && !isPauseKey) {
            // Add this key as a fire button if not already added
            if (!this.keyMappings[0].fire.includes(keyCode)) {
                this.keyMappings[0].fire.push(keyCode);
            }
        }
    }
    
    isKeyMappedToMovement(keyCode) {
        for (let player in this.keyMappings) {
            const mapping = this.keyMappings[player];
            if (mapping.up.includes(keyCode) || 
                mapping.down.includes(keyCode) || 
                mapping.left.includes(keyCode) || 
                mapping.right.includes(keyCode)) {
                return true;
            }
        }
        return false;
    }
    
    isKeyMappedToPause(keyCode) {
        for (let player in this.keyMappings) {
            const mapping = this.keyMappings[player];
            if (mapping.pause.includes(keyCode)) {
                return true;
            }
        }
        return false;
    }

    initTouchControls() {
        const touchControlsElement = document.getElementById('touchControls');
        if (!touchControlsElement) return;
        
    // No screen-wide touch controls in release
        
        // Initialize touch toggle button
        this.initTouchToggle();
        
        // D-pad controls
        const dpadButtons = touchControlsElement.querySelectorAll('.dpad-btn');
        dpadButtons.forEach(button => {
            const action = button.dataset.action;
            if (!action || action === 'center') return;
            
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.touchControls[action] = true;
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.touchControls[action] = false;
            });
            
            button.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.touchControls[action] = false;
            });
            
            // Mouse events for desktop testing
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.touchControls[action] = true;
            });
            
            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.touchControls[action] = false;
            });
        });
        
    // Action buttons (Fire acts as Enter/select in menus too)
        const actionButtons = touchControlsElement.querySelectorAll('.action-btn');
        actionButtons.forEach(button => {
            const action = button.dataset.action;
            
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (action === 'hide') {
                    this.toggleTouchControls();
                } else {
                    this.touchControls[action] = true;
            if (action === 'fire') this._synthesizeEnter();
                }
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (action !== 'hide') {
                    this.touchControls[action] = false;
                }
            });
            
            button.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                if (action !== 'hide') {
                    this.touchControls[action] = false;
                }
            });
            
            // Mouse events
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (action === 'hide') {
                    this.toggleTouchControls();
                } else {
                    this.touchControls[action] = true;
                    if (action === 'fire') this._synthesizeEnter();
                }
            });
            
            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                if (action !== 'hide') {
                    this.touchControls[action] = false;
                }
            });
        });
    }

    toggleTouchControls() {
        const touchControlsElement = document.getElementById('touchControls');
        if (touchControlsElement) {
            touchControlsElement.style.display = 
                touchControlsElement.style.display === 'none' ? 'flex' : 'none';
        }
    }

    // Removed screen-wide touch and drag controls

    initTouchToggle() {
    // No toggle in this build
    }

    onKeyDown(event) {
        this.previousKeys[event.code] = this.keys[event.code] || false;
        this.keys[event.code] = true;
    }

    onKeyUp(event) {
        this.previousKeys[event.code] = this.keys[event.code] || false;
        this.keys[event.code] = false;
    }

    onGamepadConnected(event) {
        console.log(`Input: Gamepad ${event.detail.playerIndex} connected`);
    }

    onGamepadDisconnected(event) {
        console.log(`Input: Gamepad disconnected`);
    }

    registerPlayer(player) {
        if (!this.players.includes(player)) {
            this.players.push(player);
        }
    }

    unregisterPlayer(player) {
        const index = this.players.indexOf(player);
        if (index !== -1) {
            this.players.splice(index, 1);
        }
    }

    update() {
        // Update gamepad state (moved from independent loop to prevent FPS issues)
        if (this.gamepadManager) {
            this.gamepadManager.update();
        }
        
        // Update all registered players
        this.players.forEach(player => {
            if (player && player.alive) {
                this.updatePlayerInput(player);
            }
        });
    }
    
    updatePreviousKeys() {
        // This should be called AFTER pause checking but BEFORE next frame
        this.previousKeys = { ...this.keys };
    }

    updatePlayerInput(player) {
        const playerIndex = player.playerIndex;
        const controls = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false
        };
        
        // Keyboard input (only for player 0)
        if (playerIndex === 0 && this.keyMappings[playerIndex]) {
            const mapping = this.keyMappings[playerIndex];
            controls.up = this.isKeyPressed(mapping.up);
            controls.down = this.isKeyPressed(mapping.down);
            controls.left = this.isKeyPressed(mapping.left);
            controls.right = this.isKeyPressed(mapping.right);
            controls.fire = this.isKeyPressed(mapping.fire);
        }
        
        // Touch controls (only for player 0)
        if (playerIndex === 0) {
            controls.up = controls.up || this.touchControls.up;
            controls.down = controls.down || this.touchControls.down;
            controls.left = controls.left || this.touchControls.left;
            controls.right = controls.right || this.touchControls.right;
            controls.fire = controls.fire || this.touchControls.fire;
        }
        
        // Gamepad input for all players
        if (this.gamepadManager && this.gamepadManager.getConnectedGamepadsCount() > 0) {
            const gamepadInput = this.getGamepadInput(playerIndex);
            controls.up = controls.up || gamepadInput.up;
            controls.down = controls.down || gamepadInput.down;
            controls.left = controls.left || gamepadInput.left;
            controls.right = controls.right || gamepadInput.right;
            controls.fire = controls.fire || gamepadInput.fire;
            
            // Debug logging for non-player 0
            if (playerIndex > 0 && (gamepadInput.up || gamepadInput.down || gamepadInput.left || gamepadInput.right || gamepadInput.fire)) {
                console.log(`Player ${playerIndex} gamepad input:`, gamepadInput);
            }
        }
        
        // Apply controls to player
        player.setControls(controls);
    }

    // Drag direction removed

    getGamepadInput(playerIndex) {
        const controls = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false
        };
        
        if (!this.gamepadManager) return controls;
        
        // Simple assignment: Player N uses Gamepad N
        // Player 0 can use keyboard OR gamepad 0
        // Players 1-7 use gamepads 1-7 respectively
        let gamepadIndex = playerIndex;
        
        // Check if this gamepad exists
        if (!this.gamepadManager.isGamepadConnected(gamepadIndex)) {
            return controls;
        }
        
        // D-pad input
        const dpad = this.gamepadManager.getDPad(gamepadIndex);
        if (dpad.y < 0) controls.up = true;
        if (dpad.y > 0) controls.down = true;
        if (dpad.x < 0) controls.left = true;
        if (dpad.x > 0) controls.right = true;
        
        // Left stick input
        const leftStick = this.gamepadManager.getLeftStick(gamepadIndex);
        if (leftStick.y < -0.5) controls.up = true;
        if (leftStick.y > 0.5) controls.down = true;
        if (leftStick.x < -0.5) controls.left = true;
        if (leftStick.x > 0.5) controls.right = true;
        
        // Button input - multiple button options for shooting
        controls.fire = this.gamepadManager.isButtonPressed(gamepadIndex, 'A') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'X') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'B') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'Y') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'RB') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'LB') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'RT') ||
                       this.gamepadManager.isButtonPressed(gamepadIndex, 'LT');
        
        return controls;
    }

    isKeyPressed(keyArray) {
        if (!Array.isArray(keyArray)) {
            keyArray = [keyArray];
        }
        
        return keyArray.some(key => this.keys[key]);
    }

    isKeyJustPressed(keyArray) {
        if (!Array.isArray(keyArray)) {
            keyArray = [keyArray];
        }
        
        return keyArray.some(key => this.keys[key] && !this.previousKeys[key]);
    }

    isPausePressed() {
        const currentTime = Date.now();
        
        // Check if enough time has passed since last pause toggle
        if (currentTime - this.lastPauseTime < this.pauseDelay) {
            return false;
        }
        
        // Check for key press (must be just pressed, not held)
        const keyPJustPressed = this.keys.KeyP && !this.previousKeys.KeyP;
        const keyEscJustPressed = this.keys.Escape && !this.previousKeys.Escape;
        const gamepadStart = this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'Start');
        
        const pausePressed = keyPJustPressed || keyEscJustPressed || gamepadStart;
        
        if (pausePressed) {
            this.lastPauseTime = currentTime;
            console.log('Pause toggled');
            return true;
        }
        
        return false;
    }

    isDebugTogglePressed() {
        // F3 key to toggle debug mode (common in many games)
        const f3JustPressed = this.keys.F3 && !this.previousKeys.F3;
        return f3JustPressed;
    }

    // Utility methods for game control
    getMenuInput() {
        return {
            up: this.isKeyJustPressed(['ArrowUp', 'KeyW']) || 
                (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'Up')),
            down: this.isKeyJustPressed(['ArrowDown', 'KeyS']) || 
                 (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'Down')),
            left: this.isKeyJustPressed(['ArrowLeft', 'KeyA']) || 
                 (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'Left')),
            right: this.isKeyJustPressed(['ArrowRight', 'KeyD']) || 
                  (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'Right')),
            select: this.isKeyJustPressed(['Space', 'Enter']) || 
                   (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'A')),
            back: this.isKeyJustPressed(['Escape']) || 
                 (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'B'))
        };
    }

    vibrate(playerIndex, duration = 200, weak = 0.5, strong = 0.5) {
        if (this.gamepadManager) {
            this.gamepadManager.vibrate(playerIndex, duration, weak, strong);
        }
    }

    addKeyMapping(playerIndex, action, keys) {
        if (!this.keyMappings[playerIndex]) {
            this.keyMappings[playerIndex] = {};
        }
        this.keyMappings[playerIndex][action] = Array.isArray(keys) ? keys : [keys];
    }

    removeKeyMapping(playerIndex, action) {
        if (this.keyMappings[playerIndex]) {
            delete this.keyMappings[playerIndex][action];
        }
    }

    // Debug methods
    getConnectedInputDevices() {
        const devices = {
            keyboard: true,
            touch: 'ontouchstart' in window,
            gamepads: this.gamepadManager ? this.gamepadManager.getConnectedGamepadsCount() : 0
        };
        return devices;
    }

    getCurrentInputState() {
        const state = {
            keys: Object.keys(this.keys).filter(key => this.keys[key]),
            touch: Object.keys(this.touchControls).filter(key => this.touchControls[key]),
            gamepads: []
        };
        
        if (this.gamepadManager) {
            for (let i = 0; i < 8; i++) {
                const leftStick = this.gamepadManager.getLeftStick(i);
                const buttons = ['A', 'B', 'X', 'Y', 'Up', 'Down', 'Left', 'Right']
                    .filter(btn => this.gamepadManager.isButtonPressed(i, btn));
                
                if (leftStick.magnitude() > 0 || buttons.length > 0) {
                    state.gamepads.push({
                        player: i,
                        leftStick: leftStick,
                        buttons: buttons
                    });
                }
            }
        }
        
        return state;
    }

    // Menu navigation convenience methods
    isUpPressed() {
        return this.getMenuInput().up;
    }

    isDownPressed() {
        return this.getMenuInput().down;
    }

    isEnterPressed() {
        return this.getMenuInput().select;
    }

    isFirePressed() {
    return this.isKeyJustPressed(['Space', 'Enter']) || 
           (this.gamepadManager && this.gamepadManager.isButtonJustPressed(0, 'A')) ||
           !!this.touchControls.fire;
    }

    isLeftPressed() {
        return this.getMenuInput().left;
    }

    isRightPressed() {
        return this.getMenuInput().right;
    }

    isEscapePressed() {
        return this.getMenuInput().back;
    }

    _synthesizeEnter(){
        // Let menus react as if Enter was pressed
        const ev = new KeyboardEvent('keydown',{key:'Enter',code:'Enter'});
        window.dispatchEvent(ev);
        setTimeout(()=>{
            const up = new KeyboardEvent('keyup',{key:'Enter',code:'Enter'});
            window.dispatchEvent(up);
        },50);
    }
}
