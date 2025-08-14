class Base extends Entity {
    constructor(x, y) {
        super(x, y, 48, 48);
        
        this.maxHealth = 1;
        this.health = this.maxHealth;
        this.destroyed = false;
        this.isPlayerBase = true;
        
        // Visual
        this.normalSprite = null;
        this.destroyedSprite = null;
        this.currentSprite = null;
        
        // Collision - base should only collide with bullets, not tanks
        this.solid = true;
        this.collisionLayer = 'base';
        this.collisionMask = ['enemyBullet']; // Only enemy bullets can damage base
        
        // Defense systems (can be added later)
        this.shielded = false;
        this.shieldHealth = 0;
        this.maxShieldHealth = 3;
        this.lastDamageTime = 0;
        
        // Effects
        this.damageEffect = {
            active: false,
            duration: 500,
            startTime: 0
        };
        
        this.destructionEffect = {
            active: false,
            particles: [],
            duration: 2000,
            startTime: 0
        };
    }

    setSprites(normalSprite, destroyedSprite) {
        this.normalSprite = normalSprite;
        this.destroyedSprite = destroyedSprite;
        this.currentSprite = this.destroyed ? this.destroyedSprite : this.normalSprite;
        this.sprite = this.currentSprite;
    }

    update(deltaTime) {
        super.update(deltaTime);
        
        // Update effects
        this.updateEffects(deltaTime);
        
        // Update sprite based on state
        this.updateSprite();
    }

    updateEffects(deltaTime) {
        const currentTime = Date.now();
        
        // Update damage effect
        if (this.damageEffect.active) {
            if (currentTime - this.damageEffect.startTime > this.damageEffect.duration) {
                this.damageEffect.active = false;
            }
        }
        
        // Update destruction effect
        if (this.destructionEffect.active) {
            if (currentTime - this.destructionEffect.startTime > this.destructionEffect.duration) {
                this.destructionEffect.active = false;
            } else {
                // Update destruction particles
                this.updateDestructionParticles(deltaTime);
            }
        }
    }

    updateDestructionParticles(deltaTime) {
        const currentTime = Date.now();
        
        // Remove old particles
        this.destructionEffect.particles = this.destructionEffect.particles.filter(particle => {
            return currentTime - particle.startTime < particle.lifetime;
        });
        
        // Update existing particles
        this.destructionEffect.particles.forEach(particle => {
            particle.x += particle.velocityX * deltaTime;
            particle.y += particle.velocityY * deltaTime;
            particle.velocityY += particle.gravity * deltaTime;
            particle.alpha = Math.max(0, 1 - (currentTime - particle.startTime) / particle.lifetime);
        });
    }

    updateSprite() {
        const targetSprite = this.destroyed ? this.destroyedSprite : this.normalSprite;
        if (this.currentSprite !== targetSprite) {
            this.currentSprite = targetSprite;
            this.sprite = this.currentSprite;
        }
    }

    takeDamage(amount) {
        if (this.destroyed) return;
        
        // Check shield first
        if (this.shielded && this.shieldHealth > 0) {
            this.shieldHealth -= amount;
            if (this.shieldHealth <= 0) {
                this.shielded = false;
                this.shieldHealth = 0;
                this.onShieldDestroyed();
            }
            this.triggerDamageEffect();
            return;
        }
        
        // Apply damage to base
        this.health -= amount;
        this.lastDamageTime = Date.now();
        this.triggerDamageEffect();
        
        if (this.health <= 0) {
            this.health = 0;
            this.destroyBase();
        }
        
        this.onTakeDamage(amount);
    }

    destroyBase() {
        if (this.destroyed) return;
        
        this.destroyed = true;
        this.triggerDestructionEffect();
        this.onDestroy();
        
        // Notify game of base destruction
        window.game?.onBaseDestroyed(this);
    }

    triggerDamageEffect() {
        this.damageEffect.active = true;
        this.damageEffect.startTime = Date.now();
    }

    triggerDestructionEffect() {
        this.destructionEffect.active = true;
        this.destructionEffect.startTime = Date.now();
        this.createDestructionParticles();
    }

    createDestructionParticles() {
        const center = this.getCenter();
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            const lifetime = 1000 + Math.random() * 1000;
            
            this.destructionEffect.particles.push({
                x: center.x,
                y: center.y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed - 50, // Upward bias
                gravity: 150,
                alpha: 1,
                startTime: Date.now(),
                lifetime: lifetime,
                color: ['#ff4444', '#ffaa00', '#888888'][Math.floor(Math.random() * 3)]
            });
        }
    }

    activateShield() {
        this.shielded = true;
        this.shieldHealth = this.maxShieldHealth;
    }

    repairBase() {
        if (!this.destroyed) {
            this.health = this.maxHealth;
        }
    }

    restoreBase() {
        this.destroyed = false;
        this.health = this.maxHealth;
        this.destructionEffect.active = false;
        this.destructionEffect.particles = [];
    }

    render(ctx, camera = { x: 0, y: 0 }) {
        // Render base
        this.renderBase(ctx, camera);
        
        // Render shield if active
        if (this.shielded) {
            this.renderShield(ctx, camera);
        }
        
        // Render effects
        this.renderEffects(ctx, camera);
    }

    renderBase(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        
        // Apply damage flash effect
        if (this.damageEffect.active) {
            const flashIntensity = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
            ctx.globalAlpha = 0.7 + flashIntensity * 0.3;
        }
        
        if (this.sprite) {
            ctx.drawImage(this.sprite, screenX, screenY, this.size.x, this.size.y);
        } else {
            // Fallback rendering
            ctx.fillStyle = this.destroyed ? '#666666' : '#0088ff';
            ctx.fillRect(screenX, screenY, this.size.x, this.size.y);
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, this.size.x, this.size.y);
            
            // Draw cross if destroyed
            if (this.destroyed) {
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(screenX + 5, screenY + 5);
                ctx.lineTo(screenX + this.size.x - 5, screenY + this.size.y - 5);
                ctx.moveTo(screenX + this.size.x - 5, screenY + 5);
                ctx.lineTo(screenX + 5, screenY + this.size.y - 5);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }

    renderShield(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        const centerX = screenX + this.size.x / 2;
        const centerY = screenY + this.size.y / 2;
        
        ctx.save();
        
        // Shield strength affects opacity and color
        const strength = this.shieldHealth / this.maxShieldHealth;
        const hue = strength * 120; // Green to red
        const saturation = 70;
        const lightness = 50;
        
        ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.2)`;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        
        // Animated shield effect
        const time = Date.now() * 0.005;
        const radius = this.size.x / 2 + 8 + Math.sin(time) * 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Shield segments
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + time;
            const x1 = centerX + Math.cos(angle) * (radius - 5);
            const y1 = centerY + Math.sin(angle) * (radius - 5);
            const x2 = centerX + Math.cos(angle) * (radius + 5);
            const y2 = centerY + Math.sin(angle) * (radius + 5);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    renderEffects(ctx, camera) {
        // Render destruction particles
        if (this.destructionEffect.active && this.destructionEffect.particles.length > 0) {
            ctx.save();
            
            this.destructionEffect.particles.forEach(particle => {
                ctx.globalAlpha = particle.alpha;
                ctx.fillStyle = particle.color;
                ctx.fillRect(
                    particle.x - camera.x - 2,
                    particle.y - camera.y - 2,
                    4, 4
                );
            });
            
            ctx.restore();
        }
    }

    onShieldDestroyed() {
        // Visual/audio feedback for shield destruction
        window.game?.createEffect('shieldBreak', this.getCenter(), {
            color: '#00ffff',
            size: 'large'
        });
    }

    onTakeDamage(amount) {
        super.onTakeDamage(amount);
        
        // Screen shake on base damage
        window.game?.addScreenShake(5, 300);
        
        // Create damage effect
        window.game?.createEffect('baseDamage', this.getCenter(), {
            color: '#ff4444',
            size: 'medium'
        });
    }

    onDestroy() {
        super.onDestroy();
        
        // Major screen shake on base destruction
        window.game?.addScreenShake(15, 1000);
        
        // Create large explosion effect
        window.game?.createEffect('baseDestruction', this.getCenter(), {
            color: '#ff0000',
            size: 'huge'
        });
    }

    // Utility methods
    isDestroyed() {
        return this.destroyed;
    }

    getHealthPercentage() {
        return this.health / this.maxHealth;
    }

    getShieldPercentage() {
        return this.shielded ? this.shieldHealth / this.maxShieldHealth : 0;
    }
}
