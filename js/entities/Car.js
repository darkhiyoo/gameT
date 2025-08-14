class Car extends Entity {
    constructor(x, y, width = 64, height = 64) {
        const scale = (window.game && window.game.entityScale) || 1;
        super(x, y, width * scale, height * scale);
        
        this.health = 1;
        this.maxHealth = 1;
        this.destructible = true;
        this.solid = true;
        this.visible = true;
        
        // Collision settings
    this.collisionLayer = 'wall';
    this.collisionMask = ['player', 'enemy', 'playerBullet', 'enemyBullet'];
        
        // Visual properties
        this.spriteName = 'car';
        this.sprite = null;
        
        // Physics - cars don't move
        this.velocity = new Vector2D(0, 0);
        this.speed = 0;
        this.applyFriction = false;
    }

    takeDamage(damage) {
        this.health -= damage;
        
        if (this.health <= 0) {
            this.destroy();
            
            // Create explosion effect
            if (window.game) {
                window.game.createEffect('explosion', this.getCenter(), {
                    scale: 1.2,
                    duration: 800
                });
                
                // Play explosion sound at reduced volume (specifically for cars)
                if (window.game.soundManager) {
                    window.game.soundManager.playSound('explode', 0.2); // Much quieter for cars
                }
                
                // Add screen shake
                window.game.addScreenShake(5, 300);
                
                // Award points to the shooter
                // This would need to be tracked through the bullet owner
            }
        }
    }

    destroy() {
        this.alive = false;
        this.solid = false;
        this.visible = false;
    }

    update(deltaTime) {
        // Cars don't move or update, they just exist until destroyed
        super.update(deltaTime);
    }

    render(ctx, camera) {
        if (!this.visible || !this.alive) return;
        
        if (this.sprite) {
            const screenPos = this.position.subtract(camera);
            ctx.drawImage(
                this.sprite,
                screenPos.x,
                screenPos.y,
                this.size.x,
                this.size.y
            );
        } else {
            // Fallback rendering if sprite not loaded
            const screenPos = this.position.subtract(camera);
            ctx.fillStyle = '#666666';
            ctx.fillRect(screenPos.x, screenPos.y, this.size.x, this.size.y);
            ctx.strokeStyle = '#333333';
            ctx.strokeRect(screenPos.x, screenPos.y, this.size.x, this.size.y);
        }
    }
}
