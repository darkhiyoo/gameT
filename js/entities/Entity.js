class Entity {
    constructor(x, y, width, height) {
        this.position = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.size = new Vector2D(width, height);
        this.rotation = 0;
        this.speed = 100; // pixels per second
        this.health = 1;
        this.maxHealth = 1;
        this.alive = true;
        this.visible = true;
        this.sprite = null;
        this.color = '#ffffff';
        this.lastUpdateTime = 0;
        this.id = Entity.generateId();
        
        // Collision
        this.solid = true;
        this.collisionLayer = 'default';
        this.collisionMask = ['default'];
        
        // Animation
        this.animationFrame = 0;
        this.animationSpeed = 100; // ms per frame
        this.lastAnimationTime = 0;
        
        // Physics
        this.friction = 0.9;
        this.mass = 1;
    }

    static generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    update(deltaTime) {
        if (!this.alive) return;
        
        this.lastUpdateTime = Date.now();
        
        // Update position based on velocity
        this.position = this.position.add(this.velocity.multiply(deltaTime));
        
        // Apply friction only to entities that should have it (not bullets)
        if (this.applyFriction !== false) {
            this.velocity = this.velocity.multiply(this.friction);
        }
        
        // Update animation
        this.updateAnimation(deltaTime);
        
        // Custom update logic (override in subclasses)
        this.onUpdate(deltaTime);
    }

    onUpdate(deltaTime) {
        // Override in subclasses
    }

    updateAnimation(deltaTime) {
        if (Date.now() - this.lastAnimationTime > this.animationSpeed) {
            this.animationFrame++;
            this.lastAnimationTime = Date.now();
        }
    }

    render(ctx, camera = { x: 0, y: 0 }) {
        if (!this.visible || !this.alive) return;

        ctx.save();
        
        // Calculate screen position
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        // Apply rotation
        ctx.translate(screenX + this.size.x / 2, screenY + this.size.y / 2);
        ctx.rotate(this.rotation);
        
        if (this.sprite) {
            ctx.drawImage(
                this.sprite,
                -this.size.x / 2,
                -this.size.y / 2,
                this.size.x,
                this.size.y
            );
        } else {
            // Draw a colored rectangle if no sprite
            ctx.fillStyle = this.color;
            ctx.fillRect(
                -this.size.x / 2,
                -this.size.y / 2,
                this.size.x,
                this.size.y
            );
            
            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                -this.size.x / 2,
                -this.size.y / 2,
                this.size.x,
                this.size.y
            );
        }
        
        ctx.restore();
        
        // Custom rendering (override in subclasses)
        this.onRender(ctx, camera);
    }

    onRender(ctx, camera) {
        // Override in subclasses for additional rendering
    }

    // Movement methods
    move(direction, deltaTime) {
        const moveVector = direction.normalize().multiply(this.speed * deltaTime);
        this.velocity = this.velocity.add(moveVector);
    }

    setPosition(x, y) {
        this.position.set(x, y);
    }

    setRotation(angle) {
        this.rotation = angle;
    }

    // Collision detection
    getBounds() {
        return {
            left: this.position.x,
            right: this.position.x + this.size.x,
            top: this.position.y,
            bottom: this.position.y + this.size.y
        };
    }

    getCenter() {
        return new Vector2D(
            this.position.x + this.size.x / 2,
            this.position.y + this.size.y / 2
        );
    }

    intersects(other) {
        const bounds1 = this.getBounds();
        const bounds2 = other.getBounds();
        
        return !(bounds1.right < bounds2.left ||
                bounds1.left > bounds2.right ||
                bounds1.bottom < bounds2.top ||
                bounds1.top > bounds2.bottom);
    }

    distanceTo(other) {
        return this.getCenter().distanceTo(other.getCenter());
    }

    // Health and damage
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.destroy();
        }
        this.onTakeDamage(amount);
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.onHeal(amount);
    }

    destroy() {
        this.alive = false;
        this.onDestroy();
    }

    onTakeDamage(amount) {
        // Override in subclasses
    }

    onHeal(amount) {
        // Override in subclasses
    }

    onDestroy() {
        // Override in subclasses
    }

    // Utility methods
    isOffScreen(screenWidth, screenHeight) {
        const bounds = this.getBounds();
        return bounds.right < 0 || bounds.left > screenWidth ||
               bounds.bottom < 0 || bounds.top > screenHeight;
    }

    clampToScreen(screenWidth, screenHeight) {
        this.position.x = Math.max(0, Math.min(screenWidth - this.size.x, this.position.x));
        this.position.y = Math.max(0, Math.min(screenHeight - this.size.y, this.position.y));
    }
}
