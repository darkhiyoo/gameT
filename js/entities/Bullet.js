class Bullet extends Entity {
    constructor(x, y, direction, speed, damage, owner, bulletType = 'standard') {
        const scale = (window.game && window.game.entityScale) || 1;
    // Base bullet size (hitbox) – scaled further below for standard bullets
    super(x, y, 8 * scale, 8 * scale);
        
        // Handle direction parameter - could be Vector2D or raw angle
        if (direction instanceof Vector2D) {
            this.direction = direction.normalize();
            // Calculate rotation from the normalized direction
            this.rotation = Math.atan2(this.direction.y, this.direction.x);
        } else if (typeof direction === 'number') {
            // Convert angle to normalized Vector2D
            this.direction = new Vector2D(Math.cos(direction), Math.sin(direction));
            this.rotation = direction;
        } else {
            // Fallback - assume it's an object with x,y properties
            this.direction = new Vector2D(direction.x || 0, direction.y || 1).normalize();
            this.rotation = Math.atan2(this.direction.y, this.direction.x);
        }
        
        this.speed = speed;
        this.damage = damage;
        this.owner = owner;
        this.bulletType = bulletType;
    this.maxDistance = 600; // keep logical distance (could scale later)
        this.traveledDistance = 0;
        this.startPosition = new Vector2D(x, y);
        
        // Bullets should not have friction applied
        this.applyFriction = false;
        
        // Visual
        this.color = (owner instanceof Player) ? '#00ffff' : '#ff4444';
        this.trailLength = 8;
        this.trail = [];
        
        // Collision
        this.solid = true;
        this.collisionLayer = (owner instanceof Player) ? 'playerBullet' : 'enemyBullet';
        this.collisionMask = (owner instanceof Player) ? ['enemy', 'wall'] : ['player', 'wall'];
        
        // Set velocity based on direction and speed - FIXED
        this.velocity = this.direction.multiply(speed);
        
        // Special properties
        this.piercing = false;
        this.bounces = 0;
        this.maxBounces = 0;
        this.explosive = false;
        this.explosionRadius = 0;
        this.spriteRetried = false; // Track sprite loading retry attempts
        
        // Apply bullet type effects
        this.applyBulletType();
        
        // Apply owner's bullet modifications (only if owner exists)
        if (owner && owner.powerUps && owner.powerUps.piercing) {
            this.piercing = true;
            this.color = (owner instanceof Player) ? '#ffff00' : '#ff8800';
        }
    }
    
    applyBulletType() {
    const scale = (window.game && window.game.entityScale) || 1;
    switch (this.bulletType) {
            case 'freeze':
                this.color = this.owner instanceof Player ? '#00ffff' : '#8888ff';
                this.spriteName = 'freeze8';
                this.loadSprite();
                break;
            case 'flame':
                this.color = this.owner instanceof Player ? '#ff4400' : '#ff6600';
                this.spriteName = 'flam8';
                this.loadSprite();
                break;
            case 'missile':
                // Boss missiles - keep existing sprite system
                this.color = '#ff8800';
                this.spriteName = 'seek_missile';
                this.loadSprite();
                this.size.x = this.size.y = 16 * scale;
                break;
            case 'fireball':
                // Flame enemy bullets
                this.color = '#ff4400';
                this.spriteName = 'flam6'; // Use existing flame sprite
                this.loadSprite();
                this.size.x = this.size.y = 12 * scale;
                break;
            case 'flamethrower':
                // Flamethrower bullets
                this.color = '#ff6600';
                this.spriteName = 'flam8'; // Use flame sprite for flamethrower bullets
                this.loadSprite();
                break;
            case 'standard':
            case 'normal':
            default:
                // Normal bullets now use sprites instead of placeholders
                this.color = this.owner instanceof Player ? '#00ffff' : '#ff4444';
                this.spriteName = this.owner instanceof Player ? 'bullet_normal' : 'bullet_enemy';
                this.loadSprite();
                // Enlarge standard bullet hitbox early using game multiplier
                const mulHB = (window.game && typeof window.game.bulletSizeMultiplier === 'number') ? window.game.bulletSizeMultiplier : 1.0;
                if (mulHB !== 1.0) { this.size.x = this.size.y = this.size.x * mulHB; }
                break;
        }
    }
    
    loadSprite() {
        if (this.spriteName && window.game && window.game.assetLoader) {
            this.sprite = window.game.assetLoader.getImage(this.spriteName);
            
            // Debug log if sprite fails to load
            if (!this.sprite) {
                console.warn(`Failed to load bullet sprite: ${this.spriteName} for bullet type: ${this.bulletType}`);
                // Ensure bullet is invisible rather than showing placeholder
                this.visible = false;
            }
        } else {
            console.warn(`Missing sprite name or asset loader for bullet type: ${this.bulletType}`);
            // Ensure bullet is invisible rather than showing placeholder  
            this.visible = false;
        }
    }

    update(deltaTime) {
        if (!this.alive) return;
        
        // Update flamethrower animation
        if (this.bulletType === 'flamethrower' && this.animationFrames) {
            this.animationTime += deltaTime;
            const frameTime = 1.0 / this.animationSpeed; // Time per frame
            
            if (this.animationTime >= frameTime) {
                this.currentFrame = (this.currentFrame + 1) % this.animationFrames.length;
                this.spriteName = this.animationFrames[this.currentFrame];
                // Update the sprite reference
                if (this.game && this.game.assetLoader) {
                    this.sprite = this.game.assetLoader.getImage(this.spriteName);
                }
                this.animationTime = 0;
            }
        }
        
        // Store previous position for trail
        this.addTrailPoint();
        
        // Update position using velocity - FIXED to use proper physics
        const movement = this.velocity.multiply(deltaTime);
        this.position = this.position.add(movement);
        
        // Update traveled distance
        const frameDistance = movement.magnitude();
        this.traveledDistance += frameDistance;
        
        // Check if bullet has traveled max distance
        if (this.traveledDistance >= this.maxDistance) {
            this.destroy();
            return;
        }
        
        // Update trail
        this.updateTrail();
    }

    addTrailPoint() {
        this.trail.push({
            x: this.position.x + this.size.x / 2,
            y: this.position.y + this.size.y / 2,
            time: Date.now()
        });
        
        // Limit trail length
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }
    }

    updateTrail() {
        const currentTime = Date.now();
        this.trail = this.trail.filter(point => currentTime - point.time < 300);
    }

    onCollision(other) {
        if (!other || !other.alive) return;
        
        // Don't collide with owner
        if (other === this.owner) return;
        
        // Handle different collision types
        if (other.collisionLayer === 'wall') {
            this.handleWallCollision(other);
        } else if (other instanceof Tank) {
            this.handleTankCollision(other);
        }
    }

    handleWallCollision(wall) {
        if (this.maxBounces > 0 && this.bounces < this.maxBounces) {
            this.bounce(wall);
        } else {
            this.createImpactEffect();
            this.destroy();
        }
    }

    handleTankCollision(tank) {
        // Don't damage owner
        if (tank === this.owner) return;
        
        // Don't friendly fire (players don't damage each other)
        if (this.owner && this.owner instanceof Player && tank instanceof Player) return;
        
        // Apply freeze effect if this is a freeze bullet
        if (this.bulletType === 'freeze' && tank.applyFreezeEffect) {
            tank.applyFreezeEffect(3000); // 3 seconds freeze
        }
        
        // Deal damage
        tank.takeDamage(this.damage);
        
        // Create hit effect
        this.createHitEffect(tank);
        
        // Destroy bullet unless it's piercing
        if (!this.piercing) {
            this.destroy();
        }
    }

    bounce(wall) {
        // Simple bounce calculation (reverse appropriate velocity component)
        const center = this.getCenter();
        const wallCenter = wall.getCenter();
        
        const dx = center.x - wallCenter.x;
        const dy = center.y - wallCenter.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal bounce
            this.velocity.x = -this.velocity.x;
            this.direction.x = -this.direction.x;
        } else {
            // Vertical bounce
            this.velocity.y = -this.velocity.y;
            this.direction.y = -this.direction.y;
        }
        
        this.bounces++;
        this.rotation = Math.atan2(this.direction.y, this.direction.x);
        
        // Slightly reduce speed on bounce
        this.velocity = this.velocity.multiply(0.9);
    }

    createImpactEffect() {
        // Create explosion if this is an explosive bullet
        if (this.explosive) {
            this.createExplosion();
        }
        
        // This will be handled by the game's effect system
        window.game?.createEffect('bulletImpact', this.getCenter(), {
            color: this.color,
            size: 'small'
        });
    }

    createExplosion() {
        if (!window.game) return;
        
        const center = this.getCenter();
        
        // Create visual explosion effect based on type
        if (this.explosionType === 'flame') {
            window.game.createExplosion(center.x, center.y, 'flame_explosion', 1.5);
        } else {
            window.game.createExplosion(center.x, center.y, 'effect_explode', 1.2);
        }
        
        // Deal area damage to nearby entities
        const allEntities = [
            ...window.game.players,
            ...window.game.enemies,
            ...window.game.cars
        ];
        
        allEntities.forEach(entity => {
            if (entity === this.owner || !entity.alive) return;
            
            const distance = center.distanceTo(entity.getCenter());
            if (distance <= this.explosionRadius) {
                // Calculate damage based on distance (closer = more damage)
                const damageRatio = 1 - (distance / this.explosionRadius);
                const damage = Math.ceil(damageRatio * this.damage * 1.5); // 50% damage bonus for explosions
                
                if (entity.takeDamage) {
                    entity.takeDamage(damage);
                }
            }
        });
        
        // Screen shake for explosion
        window.game.addScreenShake(8, 400);
    }

    createHitEffect(target) {
        // Create explosion if this is an explosive bullet
        if (this.explosive) {
            this.createExplosion();
        }
        
        // This will be handled by the game's effect system
        window.game?.createEffect('bulletHit', target.getCenter(), {
            color: this.color,
            size: 'medium',
            target: target
        });
        
        // Cause screen shake for heavy hits
        if (this.damage > 1) {
            window.game?.addScreenShake(3, 200);
        }
    }

    render(ctx, camera = { x: 0, y: 0 }) {
        if (!this.visible || !this.alive) return;
        
        // Render trail
        this.renderTrail(ctx, camera);
        
        // Render bullet
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        
        // Bullet body
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        if (this.piercing) {
            // Piercing bullets have a special glow effect
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
        }
        
        // Draw bullet - always use sprites (no placeholders)
        if (this.spriteName && this.sprite) {
            // Render sprite ONLY (all bullets now use sprites)
            ctx.translate(screenX + this.size.x / 2, screenY + this.size.y / 2);
            
            // Rotate sprite to align with movement direction
            // Add 90 degrees (π/2) to align sprite properly with movement
            ctx.rotate(this.rotation + Math.PI / 2);
            
            // Different sizes for different bullet types
            let spriteSize = this.size.x;
            if (this.bulletType === 'freeze') {
                spriteSize = 32; // Make freeze bullets 32x32 size
            } else if (this.bulletType === 'flame') {
                spriteSize = 24; // Make flame bullets 24x24 size
            } else if (this.bulletType === 'missile') {
                const mul = (this.game && typeof this.game.missileSizeMultiplier === 'number') ? this.game.missileSizeMultiplier : 1.0;
                spriteSize = 32 * mul; // Scalable missile size
            } else if (this.bulletType === 'fireball') {
                spriteSize = 20; // Make fireball bullets slightly bigger
            } else {
                // Standard bullets: scale up strongly using bulletSizeMultiplier from Game
                const mul = (this.game && typeof this.game.bulletSizeMultiplier === 'number') ? this.game.bulletSizeMultiplier : 1.0;
                spriteSize = 16 * mul;
            }
            
            ctx.drawImage(
                this.sprite,
                -spriteSize / 2,
                -spriteSize / 2,
                spriteSize,
                spriteSize
            );
        } else {
            // If no sprite available, try to reload it once
            if (this.spriteName && !this.spriteRetried) {
                this.spriteRetried = true;
                this.loadSprite();
            }
            // No fallback rendering - bullet will be invisible if sprite fails
        }
        
        ctx.restore();
    }

    renderTrail(ctx, camera) {
        if (this.trail.length < 2) return;
        
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for (let i = 1; i < this.trail.length; i++) {
            const current = this.trail[i];
            const previous = this.trail[i - 1];
            const age = Date.now() - current.time;
            const alpha = Math.max(0, 1 - age / 300);
            const width = (i / this.trail.length) * 2;
            
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = width;
            
            ctx.beginPath();
            ctx.moveTo(previous.x - camera.x, previous.y - camera.y);
            ctx.lineTo(current.x - camera.x, current.y - camera.y);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // Static factory methods for different bullet types
    static createStandard(x, y, direction, owner) {
        return new Bullet(x, y, direction, 200, 1, owner);
    }

    static createRapid(x, y, direction, owner) {
        const bullet = new Bullet(x, y, direction, 250, 1, owner);
        bullet.size = new Vector2D(3, 3);
        bullet.color = owner instanceof Player ? '#00ff88' : '#ff6666';
        return bullet;
    }

    static createHeavy(x, y, direction, owner) {
        const bullet = new Bullet(x, y, direction, 150, 2, owner);
        bullet.size = new Vector2D(6, 6);
        bullet.color = owner instanceof Player ? '#ffaa00' : '#aa0000';
        return bullet;
    }

    static createPiercing(x, y, direction, owner) {
        const bullet = new Bullet(x, y, direction, 180, 1, owner);
        bullet.piercing = true;
        bullet.color = owner instanceof Player ? '#ffff00' : '#ff8800';
        bullet.maxDistance = 600;
        return bullet;
    }

    static createBouncing(x, y, direction, owner) {
        const bullet = new Bullet(x, y, direction, 160, 1, owner);
        bullet.maxBounces = 2;
        bullet.color = owner instanceof Player ? '#ff00ff' : '#aa00aa';
        return bullet;
    }

    onDestroy() {
        super.onDestroy();
        this.createImpactEffect();
    }
}
