class PowerUp extends Entity {
    constructor(x, y, type) {
        super(x, y, 24, 24); // 24x24 power-up size
        
        this.type = type;
        this.spawnTime = Date.now();
        this.duration = 20000; // 20 seconds before disappearing
        this.collected = false;
        
        // Visual effects
        this.bobOffset = 0;
        this.bobSpeed = 3;
        this.bobAmount = 4;
        this.pulseScale = 1;
        this.pulseSpeed = 2;
        
        // Collision
        this.solid = false; // Power-ups don't block movement
        this.collisionLayer = 'powerup';
        this.collisionMask = ['player']; // Only players can collect
        
        // Load sprite based on type
        this.loadSprite();
        
        // Glow effect
        this.glowColor = this.getGlowColor();
    }
    
    loadSprite() {
        if (window.game && window.game.assetLoader) {
            const spriteName = this.getSpriteNameForType();
            this.sprite = window.game.assetLoader.getImage(spriteName);
            this.spriteName = spriteName;
            
            // Debug log to verify sprite loading
            console.log(`PowerUp loading sprite: ${spriteName}, loaded:`, !!this.sprite);
            if (this.sprite) {
                console.log(`Sprite dimensions: ${this.sprite.width}x${this.sprite.height}`);
            }
        } else {
            console.warn('PowerUp: AssetLoader not available for sprite loading');
        }
    }
    
    getSpriteNameForType() {
        switch (this.type) {
            case 'freeze':
                return 'freeze';
            case 'flame':
                return 'flame';
            case 'star':
                return 'star';
            case 'missile':
                return 'missile';
            case 'seek-missile':
                return 'seek-missile';
            case 'laser':
                return 'laser-box';
            default:
                return 'freeze'; // fallback
        }
    }
    
    getGlowColor() {
        switch (this.type) {
            case 'freeze':
                return '#00ffff';
            case 'flame':
                return '#ff4400';
            case 'star':
                return '#ffff00';
            case 'missile':
                return '#ff8800';
            case 'seek-missile':
                return '#ff00ff';
            case 'laser':
                return '#00ffcc';
            default:
                return '#ffffff';
        }
    }
    
    update(deltaTime) {
        if (!this.alive || this.collected) return;
        
        // Check if power-up has expired
        const elapsed = Date.now() - this.spawnTime;
        if (elapsed >= this.duration) {
            this.destroy();
            return;
        }
        
        // Update visual effects
        this.bobOffset += this.bobSpeed * deltaTime;
        this.pulseScale = 1 + Math.sin(Date.now() * 0.005 * this.pulseSpeed) * 0.1;
        
        // Flash effect when about to expire (last 5 seconds)
        const timeLeft = this.duration - elapsed;
        this.shouldFlash = timeLeft <= 5000;
        this.flashVisible = !this.shouldFlash || Math.floor(Date.now() / 200) % 2 === 0;
    }
    
    onCollision(other) {
        if (other instanceof Player && !this.collected) {
            this.collectBy(other);
        }
    }
    
    collectBy(player) {
        if (this.collected) return;
        
        this.collected = true;
        this.applyEffect(player);
        
        // Create collection effect
        this.createCollectionEffect();
        
        // Add score
        player.addScore(200);
        
        // Play collection sound
        if (window.game && window.game.soundManager) {
            window.game.soundManager.playSound('powerup', 0.4);
        }
        
        this.destroy();
    }
    
    applyEffect(player) {
        switch (this.type) {
            case 'freeze':
                player.activatePowerUp('freeze', -1); // -1 = until death
                break;
            case 'flame':
                player.activatePowerUp('flame', -1); // -1 = until death
                break;
            case 'star':
                player.activatePowerUp('invincible', -1); // -1 = until death
                break;
            case 'missile':
                player.activatePowerUp('missile', -1); // -1 = until death
                break;
            case 'seek-missile':
                player.activatePowerUp('seekMissile', -1); // -1 = until death
                break;
            case 'laser':
                player.activatePowerUp('laser', -1); // until death
                break;
        }
    }
    
    createCollectionEffect() {
        if (window.game) {
            const center = this.getCenter();
            window.game.createEffect('powerupCollect', center, {
                color: this.glowColor,
                size: 'large',
                type: this.type
            });
        }
    }
    
    render(ctx, camera = { x: 0, y: 0 }) {
        if (!this.alive || !this.flashVisible) return;
        
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y + Math.sin(this.bobOffset) * this.bobAmount;
        
        ctx.save();
        
        // Glow effect
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 0.8;
        
        // Scale for pulse effect
        const centerX = screenX + this.size.x / 2;
        const centerY = screenY + this.size.y / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(this.pulseScale, this.pulseScale);
        
        // Draw sprite OR fallback shape (not both)
        if (this.sprite) {
            // Render ONLY the sprite (freeze.png powerup)
            ctx.drawImage(
                this.sprite,
                -this.size.x / 2,
                -this.size.y / 2,
                this.size.x,
                this.size.y
            );
        } else {
            // Fallback colored circle ONLY when sprite fails to load
            ctx.fillStyle = this.glowColor;
            ctx.beginPath();
            ctx.arc(0, 0, this.size.x / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Add inner highlight
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(-this.size.x / 6, -this.size.y / 6, this.size.x / 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Render remaining time indicator if about to expire
        if (this.shouldFlash) {
            this.renderTimeWarning(ctx, camera);
        }
    }
    
    renderTimeWarning(ctx, camera) {
        const elapsed = Date.now() - this.spawnTime;
        const timeLeft = this.duration - elapsed;
        const seconds = Math.ceil(timeLeft / 1000);
        
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        const text = seconds.toString();
        ctx.strokeText(text, screenX + this.size.x / 2, screenY - 5);
        ctx.fillText(text, screenX + this.size.x / 2, screenY - 5);
        ctx.restore();
    }
    
    static createFreeze(x, y) {
        return new PowerUp(x, y, 'freeze');
    }
    
    static createFlame(x, y) {
        return new PowerUp(x, y, 'flame');
    }
    
    static createStar(x, y) {
        return new PowerUp(x, y, 'star');
    }
    
    static createMissile(x, y) {
        return new PowerUp(x, y, 'missile');
    }
    
    static createSeekMissile(x, y) {
        return new PowerUp(x, y, 'seek-missile');
    }

    static createLaser(x, y) {
        return new PowerUp(x, y, 'laser');
    }
}
