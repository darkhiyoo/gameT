class RenderSystem {
    constructor(canvas, assetLoader) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assetLoader = assetLoader;
        this.camera = new Vector2D(0, 0);
        this.entities = [];
        this.effects = [];
        
        // Screen shake
        this.screenShake = {
            intensity: 0,
            duration: 0,
            timer: 0
        };
        
        // Background
        this.backgroundSprite = null;
        this.backgroundColor = '#2a4a2a';
        
        // Render layers
        this.layers = {
            background: [],
            ground: [],
            entities: [],
            effects: [],
            ui: []
        };
        
        // Performance monitoring
        this.frameCount = 0;
        this.lastFPSUpdate = Date.now();
        this.fps = 0;
        this.showDebug = false;
    }

    setBackground(spriteName) {
        this.backgroundSprite = this.assetLoader.getImage(spriteName);
    }

    addEntity(entity, layer = 'entities') {
        if (!this.entities.includes(entity)) {
            this.entities.push(entity);
        }
        
        if (!this.layers[layer]) {
            this.layers[layer] = [];
        }
        
        if (!this.layers[layer].includes(entity)) {
            this.layers[layer].push(entity);
        }
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
        
        // Remove from all layers
        Object.keys(this.layers).forEach(layerName => {
            const layer = this.layers[layerName];
            const layerIndex = layer.indexOf(entity);
            if (layerIndex !== -1) {
                layer.splice(layerIndex, 1);
            }
        });
    }

    clearEntities(preserveUI = true) {
        // Remove all entity references (optionally keep UI layer)
        this.entities = [];
        Object.keys(this.layers).forEach(layerName => {
            if (preserveUI && layerName === 'ui') return;
            this.layers[layerName] = [];
        });
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply screen shake
        this.applyScreenShake();
        
        // Render background
        this.renderBackground();
        
        // Render layers in order
        this.renderLayer('background');
        this.renderLayer('ground');
        this.renderLayer('entities');
        
        // Render flamethrower streams with error handling
        try {
            this.renderFlamethrowerStreams();
        } catch (error) {
            console.warn('Flamethrower rendering error:', error);
        }
        
        this.renderLayer('effects');
        
        // Render effects
        this.renderEffects();
        
        // Render UI layer last (no camera offset)
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for UI
        this.renderLayer('ui');
        this.ctx.restore();
        
        // Render debug info
        if (this.showDebug) {
            this.renderDebugInfo();
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Clean up dead entities and effects
        this.cleanup();
    }

    renderBackground() {
        this.ctx.save();
        
        if (this.backgroundSprite) {
            // Display the full stage image scaled to canvas size
            // Don't tile - show as single full image
            this.ctx.drawImage(
                this.backgroundSprite,
                0, // source x
                0, // source y
                this.backgroundSprite.width, // source width
                this.backgroundSprite.height, // source height
                0, // destination x
                0, // destination y
                this.canvas.width, // destination width (scale to canvas)
                this.canvas.height // destination height (scale to canvas)
            );
        } else {
            // Solid background color
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.ctx.restore();
    }

    renderLayer(layerName) {
        const layer = this.layers[layerName];
        if (!layer) return;
        
        // Sort entities by Y position (for depth)
        if (layerName === 'entities') {
            layer.sort((a, b) => a.position.y - b.position.y);
        }
        
        layer.forEach(entity => {
            if (entity.alive && entity.visible) {
                // Set sprite from asset loader if needed
                if (entity.spriteName && !entity.sprite) {
                    entity.sprite = this.assetLoader.getImage(entity.spriteName);
                }
                
                entity.render(this.ctx, this.camera);
            }
        });
    }

    renderEffects() {
        this.effects.forEach(effect => {
            if (effect.active) {
                effect.render(this.ctx, this.camera);
            }
        });
    }

    renderDebugInfo() {
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        
        let y = 20;
        const lineHeight = 15;
        
        // FPS
        this.ctx.fillText(`FPS: ${this.fps}`, 10, y);
        y += lineHeight;
        
        // Entity count
        this.ctx.fillText(`Entities: ${this.entities.length}`, 10, y);
        y += lineHeight;
        
        // Effect count
        this.ctx.fillText(`Effects: ${this.effects.length}`, 10, y);
        y += lineHeight;
        
        // Camera position
        this.ctx.fillText(`Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)})`, 10, y);
        y += lineHeight;
        
        // Screen shake
        if (this.screenShake.intensity > 0) {
            this.ctx.fillText(`Shake: ${Math.round(this.screenShake.intensity)}`, 10, y);
            y += lineHeight;
        }
        
        this.ctx.restore();
    }

    applyScreenShake() {
        if (this.screenShake.intensity > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            const shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
            
            this.ctx.save();
            this.ctx.translate(shakeX, shakeY);
            
            // Reduce shake over time
            this.screenShake.timer -= 16; // Assuming 60 FPS
            if (this.screenShake.timer <= 0) {
                this.screenShake.intensity = 0;
            } else {
                this.screenShake.intensity *= 0.95; // Fade out
            }
        }
    }

    addScreenShake(intensity, duration) {
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
        this.screenShake.duration = duration;
        this.screenShake.timer = duration;
    }

    updateCamera(targetX, targetY, smooth = false) {
        if (smooth) {
            // Smooth camera movement
            const lerpFactor = 0.1;
            this.camera.x += (targetX - this.camera.x) * lerpFactor;
            this.camera.y += (targetY - this.camera.y) * lerpFactor;
        } else {
            this.camera.x = targetX;
            this.camera.y = targetY;
        }
        
        // Keep camera within reasonable bounds
        const maxX = 1000;
        const maxY = 1000;
        this.camera.x = Math.max(-maxX, Math.min(maxX, this.camera.x));
        this.camera.y = Math.max(-maxY, Math.min(maxY, this.camera.y));
    }

    centerCameraOn(entity) {
        const targetX = entity.position.x + entity.size.x / 2 - this.canvas.width / 2;
        const targetY = entity.position.y + entity.size.y / 2 - this.canvas.height / 2;
        this.updateCamera(targetX, targetY, true);
    }

    followMultipleEntities(entities) {
        if (entities.length === 0) return;
        
        // Calculate bounding box of all entities
        let minX = entities[0].position.x;
        let minY = entities[0].position.y;
        let maxX = entities[0].position.x + entities[0].size.x;
        let maxY = entities[0].position.y + entities[0].size.y;
        
        entities.forEach(entity => {
            minX = Math.min(minX, entity.position.x);
            minY = Math.min(minY, entity.position.y);
            maxX = Math.max(maxX, entity.position.x + entity.size.x);
            maxY = Math.max(maxY, entity.position.y + entity.size.y);
        });
        
        // Calculate center and required zoom
        const centerX = (minX + maxX) / 2 - this.canvas.width / 2;
        const centerY = (minY + maxY) / 2 - this.canvas.height / 2;
        
        this.updateCamera(centerX, centerY, true);
    }

    updatePerformanceMetrics() {
        this.frameCount++;
        const now = Date.now();
        
        if (now - this.lastFPSUpdate >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFPSUpdate));
            this.frameCount = 0;
            this.lastFPSUpdate = now;
        }
    }

    cleanup() {
        // Remove dead entities from layers
        Object.keys(this.layers).forEach(layerName => {
            this.layers[layerName] = this.layers[layerName].filter(entity => entity.alive);
        });
        
        // Remove inactive effects
        this.effects = this.effects.filter(effect => effect.active);
        
        // Remove dead entities from main list
        this.entities = this.entities.filter(entity => entity.alive);
    }

    // Effect creation helpers
    createEffect(type, position, options = {}) {
        const effect = new Effect(type, position, options);
        this.addEffect(effect);
        return effect;
    }

    // Screen utilities
    screenToWorld(screenPos) {
        return new Vector2D(
            screenPos.x + this.camera.x,
            screenPos.y + this.camera.y
        );
    }

    worldToScreen(worldPos) {
        return new Vector2D(
            worldPos.x - this.camera.x,
            worldPos.y - this.camera.y
        );
    }

    isOnScreen(entity, margin = 50) {
        const screenPos = this.worldToScreen(entity.position);
        return screenPos.x > -margin &&
               screenPos.y > -margin &&
               screenPos.x < this.canvas.width + margin &&
               screenPos.y < this.canvas.height + margin;
    }

    // Debug controls
    toggleDebug() {
        this.showDebug = !this.showDebug;
    }

    setDebug(enabled) {
        this.showDebug = enabled;
    }

    renderFlamethrowerStreams() {
        // Find all flamethrower enemies and render their flame streams
        for (const entity of this.entities) {
            if (entity.isFlamethrowerBoss && entity.flameThrowing && entity.flameSegments) {
                this.renderFlameStream(entity);
            }
        }
    }

    renderFlameStream(flamethrowerEnemy) {
        this.ctx.save();
        
        for (const segment of flamethrowerEnemy.flameSegments) {
            const screenX = segment.position.x - this.camera.x;
            const screenY = segment.position.y - this.camera.y;
            
            // Get the flame sprite for this frame
            const flameName = `flame${segment.frame}`;
            const flameSprite = this.assetLoader.getImage(flameName);
            
            if (flameSprite) {
                this.ctx.globalAlpha = segment.opacity;
                
                // Center the sprite on the segment position
                const drawX = screenX - segment.size / 2;
                const drawY = screenY - segment.size / 2;
                
                this.ctx.drawImage(
                    flameSprite,
                    drawX,
                    drawY,
                    segment.size,
                    segment.size
                );
            }
        }
        
        this.ctx.restore();
    }
}

// Simple effect class for visual effects
class Effect {
    constructor(type, position, options = {}) {
        this.type = type;
        this.position = position.copy();
        this.active = true;
        this.startTime = Date.now();
        this.duration = options.duration || 500;
        this.color = options.color || '#ffffff';
        this.size = options.size || 'medium';
        this.particles = [];
        
        this.createEffect(type, options);
    }

    createEffect(type, options) {
        switch (type) {
            case 'bulletHit':
                this.createBulletHitEffect(options);
                break;
            case 'bulletImpact':
                this.createBulletImpactEffect(options);
                break;
            case 'explosion':
                this.createExplosionEffect(options);
                break;
            case 'baseDestruction':
                this.createBaseDestructionEffect(options);
                break;
            default:
                this.createGenericEffect(options);
                break;
        }
    }

    createBulletHitEffect(options) {
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 30 + Math.random() * 20;
            
            this.particles.push({
                x: this.position.x,
                y: this.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.02
            });
        }
    }

    createBulletImpactEffect(options) {
        const particleCount = 4;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 15 + Math.random() * 10;
            
            this.particles.push({
                x: this.position.x,
                y: this.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.03
            });
        }
    }

    createExplosionEffect(options) {
        const particleCount = 16;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 50 + Math.random() * 30;
            
            this.particles.push({
                x: this.position.x,
                y: this.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.015
            });
        }
        this.duration = 1000;
    }

    createBaseDestructionEffect(options) {
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 60;
            
            this.particles.push({
                x: this.position.x,
                y: this.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 30, // Upward bias
                gravity: 100,
                life: 1.0,
                decay: 0.01
            });
        }
        this.duration = 2000;
    }

    createGenericEffect(options) {
        const particleCount = 6;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 15;
            
            this.particles.push({
                x: this.position.x,
                y: this.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.025
            });
        }
    }

    update(deltaTime) {
        // Update particles
        this.particles.forEach(particle => {
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            
            if (particle.gravity) {
                particle.vy += particle.gravity * deltaTime;
            }
            
            particle.life -= particle.decay;
        });
        
        // Remove dead particles
        this.particles = this.particles.filter(particle => particle.life > 0);
        
        // Check if effect should end
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.duration || this.particles.length === 0) {
            this.active = false;
        }
    }

    render(ctx, camera) {
        if (!this.active) return;
        
        ctx.save();
        
        this.particles.forEach(particle => {
            ctx.globalAlpha = particle.life;
            ctx.fillStyle = this.color;
            
            const screenX = particle.x - camera.x;
            const screenY = particle.y - camera.y;
            
            ctx.fillRect(screenX - 1, screenY - 1, 2, 2);
        });
        
        ctx.restore();
        
        // Update effect
        this.update(0.016); // Assuming 60 FPS
    }
}
