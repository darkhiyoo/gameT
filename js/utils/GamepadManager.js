class GamepadManager {
    constructor() {
        this.gamepads = {};
        this.deadzone = 0.2;
        this.isSupported = 'getGamepads' in navigator;
        this.connectedGamepads = 0;
        
        this.buttonMap = {
            0: 'A',      // Fire
            1: 'B',      // Special
            2: 'X',      // 
            3: 'Y',      // 
            4: 'LB',     // 
            5: 'RB',     // 
            6: 'LT',     // 
            7: 'RT',     // 
            8: 'Back',   // 
            9: 'Start',  // Pause
            10: 'LS',    // 
            11: 'RS',    // 
            12: 'Up',    // D-pad up
            13: 'Down',  // D-pad down
            14: 'Left',  // D-pad left
            15: 'Right'  // D-pad right
        };

        this.init();
    }

    init() {
        if (!this.isSupported) {
            console.log('Gamepad API not supported');
            return;
        }

        window.addEventListener('gamepadconnected', (e) => {
            this.onGamepadConnected(e);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            this.onGamepadDisconnected(e);
        });

        // No longer start independent animation loop - will be called from main game loop
        // this.update();
    }

    onGamepadConnected(event) {
        const gamepad = event.gamepad;
        this.gamepads[gamepad.index] = {
            gamepad: gamepad,
            buttons: {},
            axes: {},
            previousButtons: {}
        };
        
        this.connectedGamepads++;
        console.log(`✅ Gamepad ${gamepad.index} connected: ${gamepad.id}`);
        console.log(`✅ Total gamepads connected: ${this.connectedGamepads}`);
        
        // Hide touch controls if gamepad is connected
        this.updateTouchControlsVisibility();
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('gamepadConnected', {
            detail: { gamepad: gamepad, playerIndex: gamepad.index }
        }));
    }

    onGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        if (this.gamepads[gamepad.index]) {
            delete this.gamepads[gamepad.index];
            this.connectedGamepads--;
            console.log(`Gamepad ${gamepad.index} disconnected`);
            
            // Show touch controls if no gamepads are connected
            this.updateTouchControlsVisibility();
            
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('gamepadDisconnected', {
                detail: { gamepadIndex: gamepad.index }
            }));
        }
    }

    update() {
        if (!this.isSupported) return;

        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && this.gamepads[i]) {
                this.updateGamepadState(i, gamepad);
            }
        }

        // No longer use requestAnimationFrame - will be called from main game loop
        // requestAnimationFrame(() => this.update());
    }

    updateGamepadState(index, gamepad) {
        const gamepadData = this.gamepads[index];
        
        // Update buttons
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            const buttonName = this.buttonMap[i];
            
            gamepadData.previousButtons[buttonName] = gamepadData.buttons[buttonName] || false;
            gamepadData.buttons[buttonName] = button.pressed;
        }

        // Update axes (sticks)
        gamepadData.axes = {
            leftStickX: this.applyDeadzone(gamepad.axes[0]),
            leftStickY: this.applyDeadzone(gamepad.axes[1]),
            rightStickX: this.applyDeadzone(gamepad.axes[2]),
            rightStickY: this.applyDeadzone(gamepad.axes[3])
        };

        // Store the updated gamepad reference
        gamepadData.gamepad = gamepad;
    }

    applyDeadzone(value) {
        return Math.abs(value) < this.deadzone ? 0 : value;
    }

    updateTouchControlsVisibility() {
        const touchControls = document.getElementById('touchControls');
        const gameContainer = document.getElementById('gameContainer');
        
        if (this.connectedGamepads > 0) {
            gameContainer.classList.add('gamepad-connected');
        } else {
            gameContainer.classList.remove('gamepad-connected');
        }
    }

    // Public API methods
    isButtonPressed(playerIndex, buttonName) {
        // Direct mapping: playerIndex = gamepadIndex
        if (!this.gamepads[playerIndex]) return false;
        
        const gamepadData = this.gamepads[playerIndex];
        return gamepadData.buttons[buttonName] || false;
    }

    isButtonJustPressed(playerIndex, buttonName) {
        // Direct mapping: playerIndex = gamepadIndex
        if (!this.gamepads[playerIndex]) return false;
        
        const gamepadData = this.gamepads[playerIndex];
        return (gamepadData.buttons[buttonName] || false) && 
               !(gamepadData.previousButtons[buttonName] || false);
    }

    getLeftStick(playerIndex) {
        // Direct mapping: playerIndex = gamepadIndex
        if (!this.gamepads[playerIndex]) return new Vector2D(0, 0);
        
        const gamepadData = this.gamepads[playerIndex];
        return new Vector2D(
            gamepadData.axes.leftStickX || 0,
            gamepadData.axes.leftStickY || 0
        );
    }

    getRightStick(playerIndex) {
        // Direct mapping: playerIndex = gamepadIndex
        if (!this.gamepads[playerIndex]) return new Vector2D(0, 0);
        
        const gamepadData = this.gamepads[playerIndex];
        return new Vector2D(
            gamepadData.axes.rightStickX || 0,
            gamepadData.axes.rightStickY || 0
        );
    }

    getDPad(playerIndex) {
        // Direct mapping: playerIndex = gamepadIndex
        if (!this.gamepads[playerIndex]) return new Vector2D(0, 0);
        
        const gamepadData = this.gamepads[playerIndex];
        let x = 0, y = 0;
        
        if (gamepadData.buttons.Left) x = -1;
        if (gamepadData.buttons.Right) x = 1;
        if (gamepadData.buttons.Up) y = -1;
        if (gamepadData.buttons.Down) y = 1;
        
        return new Vector2D(x, y);
    }

    getGamepadIndexForPlayer(playerIndex) {
        for (let index in this.gamepads) {
            if (this.gamepads[index].playerIndex === playerIndex) {
                return parseInt(index);
            }
        }
        return -1;
    }

    getConnectedGamepadsCount() {
        return this.connectedGamepads;
    }

    isGamepadConnected(playerIndex) {
        return this.gamepads[playerIndex] && this.gamepads[playerIndex].gamepad;
    }

    vibrate(playerIndex, duration = 200, weakMagnitude = 0.5, strongMagnitude = 0.5) {
        const gamepadIndex = this.getGamepadIndexForPlayer(playerIndex);
        if (gamepadIndex === -1) return;
        
        const gamepad = this.gamepads[gamepadIndex].gamepad;
        if (gamepad.vibrationActuator) {
            gamepad.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: duration,
                weakMagnitude: weakMagnitude,
                strongMagnitude: strongMagnitude
            });
        }
    }
}
