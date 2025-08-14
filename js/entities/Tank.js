class Tank extends Entity {
    constructor(x, y) {
        const scale = (window.game && window.game.entityScale) || 1;
        super(x, y, 32 * scale, 32 * scale);
        
        this.direction = 0; // 0: up, 1: right, 2: down, 3: left
        this.facing = 0; // Actual facing direction for sprite rendering
        this.speed = 80;
        this.maxHealth = 1;
        this.health = this.maxHealth;
        
        // Tank stats
        this.fireRate = 500; // milliseconds between shots
        this.lastFireTime = 0;
        this.bulletSpeed = 200;
        this.bulletDamage = 1;
        this.canFire = true;
        
        // Single bullet system - only one bullet at a time
        this.activeBullet = null;
        
        // Movement
        this.moveDirection = new Vector2D(0, 0);
        this.isMoving = false;
        this.turnSpeed = Math.PI * 4; // radians per second
        
        // Collision
        this.collisionLayer = 'tank';
        this.collisionMask = ['tank', 'wall', 'bullet'];
        
        // Visual
        this.tankColor = '#00ff00';
    this.barrelLength = 20 * ((window.game && window.game.entityScale) || 1);
        this.trackMarks = [];
        this.maxTrackMarks = 20;
        
        // Power-ups
        this.powerUps = {
            rapidFire: false,
            piercing: false,
            shield: false,
            speed: false,
            freeze: false
        };
        this.powerUpTimers = {};
        
        // Freeze status
        this.frozen = false;
        this.freezeEffect = null;
    }

    update(deltaTime) {
        super.update(deltaTime);
        
        // Don't update movement if frozen
        if (!this.frozen) {
            this.updateMovement(deltaTime);
        }
        
        // Update power-ups
        this.updatePowerUps(deltaTime);
        
        // Update freeze effect if active
        if (this.freezeEffect) {
            if (!this.freezeEffect.update(deltaTime)) {
                this.freezeEffect = null;
            }
        }
        
        // Update track marks
        this.updateTrackMarks();
    }

    updateMovement(deltaTime) {
        if (this.moveDirection.magnitude() > 0) {
            this.isMoving = true;
            
            // Calculate target direction based on movement
            const targetDirection = this.getDirectionFromVector(this.moveDirection);
            this.direction = targetDirection;
            
            // Update facing for sprite rendering (fixed direction mapping)
            this.facing = this.getCorrectFacing(this.direction);
            
            // Set velocity for Entity collision handling instead of direct position change
            this.velocity = this.moveDirection.normalize().multiply(this.speed);
            
            // Add track marks
            this.addTrackMark();
        } else {
            this.isMoving = false;
            this.velocity = new Vector2D(0, 0); // Stop movement
        }
        
        // Set rotation for rendering based on facing direction
        // Sprites might face DOWN by default, so rotate accordingly
        // 0: up = 180°, 1: right = 270°, 2: down = 0°, 3: left = 90°
        const rotationMap = [Math.PI, 3*Math.PI/2, 0, Math.PI/2];
        this.rotation = rotationMap[this.facing];
    }

    getDirectionFromVector(vector) {
        // Handle exact cardinal directions first
        if (vector.x === 0 && vector.y === 0) return 0; // no movement, default up
        
        if (Math.abs(vector.x) > Math.abs(vector.y)) {
            // Horizontal movement dominant
            return vector.x > 0 ? 1 : 3; // right : left
        } else {
            // Vertical movement dominant  
            return vector.y > 0 ? 2 : 0; // down : up
        }
    }

    getCorrectFacing(direction) {
        // Return the direction directly for sprite facing
        // 0: up, 1: right, 2: down, 3: left
        return direction;
    }

    addTrackMark() {
        if (this.isMoving && Date.now() - this.lastTrackTime > 100) {
            this.trackMarks.push({
                x: this.position.x + this.size.x / 2,
                y: this.position.y + this.size.y / 2,
                alpha: 1.0,
                time: Date.now()
            });
            
            // Limit track marks
            if (this.trackMarks.length > this.maxTrackMarks) {
                this.trackMarks.shift();
            }
            
            this.lastTrackTime = Date.now();
        }
    }

    updateTrackMarks() {
        // Fade out track marks over time
        const currentTime = Date.now();
        this.trackMarks = this.trackMarks.filter(mark => {
            mark.alpha = Math.max(0, 1 - (currentTime - mark.time) / 2000);
            return mark.alpha > 0;
        });
    }

    updatePowerUps(deltaTime) {
        for (let powerUp in this.powerUpTimers) {
            this.powerUpTimers[powerUp] -= deltaTime * 1000;
            if (this.powerUpTimers[powerUp] <= 0) {
                this.powerUps[powerUp] = false;
                delete this.powerUpTimers[powerUp];
            }
        }
    }

    setMoveDirection(direction) {
        this.moveDirection = direction.copy();
    }

    stopMovement() {
        this.moveDirection = new Vector2D(0, 0);
    }

    canFireBullet() {
        // Can only fire if not frozen, no active bullet and cooldown has passed
        // Added fallback: if activeBullet exists but is destroyed/dead, clear it
        if (this.activeBullet && (!this.activeBullet.alive || this.activeBullet.destroyed)) {
            this.activeBullet = null;
        }
        
        return this.canFire && 
               !this.frozen &&
               this.activeBullet === null && 
               Date.now() - this.lastFireTime > this.fireRate;
    }

    fire() {
        if (!this.canFireBullet()) return null;

        // Suppress bullets for players owning laser power-up (no mixing with laser)
        if (this instanceof Player && this.laserEnabled) {
            return null;
        }
        
        this.lastFireTime = Date.now();
        
        // Calculate bullet direction based on tank facing direction
        const bulletDirection = this.getDirectionVector(this.facing);
        
        // Calculate bullet start position (from center in facing direction)
        const center = this.getCenter();
        const bulletOffset = bulletDirection.multiply(this.barrelLength);
        const startPos = center.add(bulletOffset);
        
        // Determine bullet type based on active power-ups
        let bulletType = 'standard';
        
        // Check for Player-specific power-ups
        if (this instanceof Player) {
            if (this.freezePowerUp && this.freezePowerUp.active) {
                bulletType = 'freeze';
            } else if (this.flamePowerUp && this.flamePowerUp.active) {
                bulletType = 'flame';
            } else if (this.bulletType) {
                bulletType = this.bulletType; // Include 'normal' bullet type
            }
        } else {
            // For non-player tanks (enemies), check old powerUps system
            if (this.powerUps && this.powerUps.freeze) {
                bulletType = 'freeze';
            }
        }
        
        return {
            position: startPos,
            direction: bulletDirection,
            speed: this.bulletSpeed,
            damage: this.bulletDamage,
            owner: this,
            type: bulletType
        };
    }

    getDirectionVector(direction) {
        switch (direction) {
            case 0: return new Vector2D(0, -1); // up
            case 1: return new Vector2D(1, 0);  // right
            case 2: return new Vector2D(0, 1);  // down
            case 3: return new Vector2D(-1, 0); // left
            default: return new Vector2D(0, -1);
        }
    }

    activatePowerUp(type, duration = 10000) {
        this.powerUps[type] = true;
        this.powerUpTimers[type] = duration;
        
        // Apply power-up effects
        switch (type) {
            case 'rapidFire':
                this.fireRate = 150;
                break;
            case 'speed':
                this.speed = 120;
                break;
            case 'shield':
                // Visual shield effect will be handled in render
                break;
            case 'freeze':
                // Freeze power-up allows shooting freeze bullets
                // No immediate effect on the tank itself
                break;
        }
    }

    render(ctx, camera = { x: 0, y: 0 }) {
        // Render track marks first
        this.renderTrackMarks(ctx, camera);
        
        // Render tank
        super.render(ctx, camera);
        
        // Render power-up effects
        this.renderPowerUpEffects(ctx, camera);
    }

    renderTrackMarks(ctx, camera) {
        ctx.save();
        
        this.trackMarks.forEach(mark => {
            ctx.globalAlpha = mark.alpha * 0.3;
            ctx.fillStyle = '#654321';
            ctx.fillRect(
                mark.x - camera.x - 2,
                mark.y - camera.y - 2,
                4, 4
            );
        });
        
        ctx.restore();
    }

    renderPowerUpEffects(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        // Shield effect
        if (this.powerUps.shield) {
            ctx.save();
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(
                screenX + this.size.x / 2,
                screenY + this.size.y / 2,
                this.size.x / 2 + 5,
                0, Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
        }
        
        // Speed effect
        if (this.powerUps.speed && this.isMoving) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#ffff00';
            // Draw speed lines behind tank
            for (let i = 0; i < 3; i++) {
                const offset = (i + 1) * 8;
                const speedX = screenX - Math.cos(this.rotation) * offset;
                const speedY = screenY - Math.sin(this.rotation) * offset;
                ctx.fillRect(speedX, speedY, 2, 2);
            }
            ctx.restore();
        }
    }

    takeDamage(amount) {
        if (this.powerUps.shield) {
            // Shield absorbs damage
            this.powerUps.shield = false;
            delete this.powerUpTimers.shield;
            return;
        }
        
        super.takeDamage(amount);
    }
    
    applyFreezeEffect(duration = 3000) {
        // Don't freeze if already frozen or if this is a player (for now)
        if (this.frozen || this instanceof Player) return;
        
        // Create freeze effect
        this.freezeEffect = new FreezeEffect(this, duration);
    }

    onDestroy() {
        super.onDestroy();
        // Add explosion effect, sound, etc.
    }
}
