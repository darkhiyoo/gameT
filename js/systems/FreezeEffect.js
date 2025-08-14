class FreezeEffect {
    constructor(target, duration = 3000) {
        this.target = target;
        this.duration = duration;
        this.startTime = Date.now();
        this.active = true;
        
        // Store original properties
        this.originalSpeed = target.speed;
        this.originalCanMove = target.canMove !== undefined ? target.canMove : true;
        this.originalCanFire = target.canFire !== undefined ? target.canFire : true;
        
        // Apply freeze effect
        this.applyFreeze();
        
        // Load freeze overlay sprite
        this.loadFreezeSprite();
        
        // Visual effects
        this.iceShards = [];
        this.createIceShards();
    }
    
    loadFreezeSprite() {
        if (window.game && window.game.assetLoader) {
            this.freezeSprite = window.game.assetLoader.getImage('freeze5');
        }
    }
    
    applyFreeze() {
        // Freeze movement and firing
        this.target.speed = 0;
        this.target.canMove = false;
        this.target.canFire = false;
        
        // Stop current movement
        if (this.target.velocity) {
            this.target.velocity = new Vector2D(0, 0);
        }
        if (this.target.moveDirection) {
            this.target.moveDirection = new Vector2D(0, 0);
        }
        
        // Add freeze status
        this.target.frozen = true;
        this.target.freezeEffect = this;
        
        // Create freeze impact effect
        this.createFreezeImpact();
    }
    
    createIceShards() {
        const center = this.target.getCenter();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const distance = this.target.size.x / 2 + 10;
            this.iceShards.push({
                x: center.x + Math.cos(angle) * distance,
                y: center.y + Math.sin(angle) * distance,
                angle: angle,
                size: 3 + Math.random() * 2,
                opacity: 0.8,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }
    
    createFreezeImpact() {
        if (window.game) {
            const center = this.target.getCenter();
            window.game.createEffect('freeze_impact', center, {
                color: '#00ffff',
                size: 'large',
                duration: 500
            });
            
            // Play freeze sound
            if (window.game.soundManager) {
                window.game.soundManager.playSound('freeze', 0.3);
            }
        }
    }
    
    update(deltaTime) {
        if (!this.active) return false;
        
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.duration) {
            this.removeFreeze();
            return false;
        }
        
        // Update ice shard rotation
        this.iceShards.forEach(shard => {
            shard.rotation += deltaTime * 2;
        });
        
        return true;
    }
    
    removeFreeze() {
        if (!this.active) return;
        
        this.active = false;
        
        // Restore original properties
        this.target.speed = this.originalSpeed;
        this.target.canMove = this.originalCanMove;
        this.target.canFire = this.originalCanFire;
        
        // Remove freeze status
        this.target.frozen = false;
        this.target.freezeEffect = null;
        
        // Create unfreeze effect
        this.createUnfreezeEffect();
    }
    
    createUnfreezeEffect() {
        if (window.game) {
            const center = this.target.getCenter();
            
            // Ice breaking effect
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const velocity = new Vector2D(
                    Math.cos(angle) * (50 + Math.random() * 50),
                    Math.sin(angle) * (50 + Math.random() * 50)
                );
                
                window.game.createEffect('ice_break', center, {
                    color: '#00ffff',
                    velocity: velocity,
                    size: 'small',
                    duration: 1000
                });
            }
            
            // Play unfreeze sound
            if (window.game.soundManager) {
                window.game.soundManager.playSound('glass_break', 0.2);
            }
        }
    }
    
    render(ctx, camera = { x: 0, y: 0 }) {
        if (!this.active) return;
        
        const screenX = this.target.position.x - camera.x;
        const screenY = this.target.position.y - camera.y;
        
        ctx.save();
        
        // Render freeze overlay sprite - BIGGER than the tank
        if (this.freezeSprite) {
            ctx.globalAlpha = 0.8;
            // Make freeze effect bigger than tank (40x40 for 32x32 tank)
            const effectSize = Math.max(this.target.size.x + 8, 40);
            const offsetX = (effectSize - this.target.size.x) / 2;
            const offsetY = (effectSize - this.target.size.y) / 2;
            
            ctx.drawImage(
                this.freezeSprite,
                screenX - offsetX,
                screenY - offsetY,
                effectSize,
                effectSize
            );
        } else {
            // Fallback ice overlay - BIGGER than tank
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#00ffff';
            const effectSize = Math.max(this.target.size.x + 8, 40);
            const offsetX = (effectSize - this.target.size.x) / 2;
            const offsetY = (effectSize - this.target.size.y) / 2;
            
            ctx.fillRect(screenX - offsetX, screenY - offsetY, effectSize, effectSize);
        }
        
        // Render ice shards around the target
        ctx.globalAlpha = 1;
        this.iceShards.forEach(shard => {
            const shardScreenX = shard.x - camera.x;
            const shardScreenY = shard.y - camera.y;
            
            ctx.save();
            ctx.translate(shardScreenX, shardScreenY);
            ctx.rotate(shard.rotation);
            ctx.fillStyle = '#aaffff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            
            // Draw diamond-shaped ice shard
            ctx.beginPath();
            ctx.moveTo(0, -shard.size);
            ctx.lineTo(shard.size / 2, 0);
            ctx.lineTo(0, shard.size);
            ctx.lineTo(-shard.size / 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.restore();
        });
        
        // Flash effect near end of freeze
        const elapsed = Date.now() - this.startTime;
        const timeLeft = this.duration - elapsed;
        if (timeLeft <= 1000) { // Last second
            const flash = Math.sin(Date.now() * 0.01) > 0;
            if (flash) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(screenX, screenY, this.target.size.x, this.target.size.y);
            }
        }
        
        ctx.restore();
    }
    
    getRemainingTime() {
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, this.duration - elapsed);
    }
    
    isActive() {
        return this.active;
    }
}
