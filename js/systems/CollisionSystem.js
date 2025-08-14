class CollisionSystem {
    constructor() {
        this.entities = [];
        this.staticEntities = []; // Walls, obstacles that don't move
        this.dynamicEntities = []; // Tanks, bullets that move
        this.collisionGrid = new Map();
        this.gridSize = 64; // Size of each grid cell
        this.callbacks = new Map(); // Collision callbacks
        
        // Performance optimization
        this.frameCounter = 0;
        this.staticGridNeedsUpdate = true;
        this.lastCleanupFrame = 0;
    }

    addEntity(entity) {
        if (!this.entities.includes(entity)) {
            this.entities.push(entity);
            
            // Categorize entity
            if (entity.velocity && entity.velocity.magnitude() > 0 || 
                entity instanceof Tank || entity instanceof Bullet) {
                this.dynamicEntities.push(entity);
            } else {
                this.staticEntities.push(entity);
                this.staticGridNeedsUpdate = true; // Mark static grid for update
            }
        }
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
        
        const dynamicIndex = this.dynamicEntities.indexOf(entity);
        if (dynamicIndex !== -1) {
            this.dynamicEntities.splice(dynamicIndex, 1);
        }
        
        const staticIndex = this.staticEntities.indexOf(entity);
        if (staticIndex !== -1) {
            this.staticEntities.splice(staticIndex, 1);
            this.staticGridNeedsUpdate = true; // Mark static grid for update
        }
    }

    update() {
        this.frameCounter++;
        
        // Clear grid only for dynamic entities (static entities stay put)
        this.collisionGrid.clear();
        
        // Update spatial grid with optimized approach
        this.updateSpatialGrid();
        
        // Check collisions only for critical entities every frame
        this.checkCriticalCollisions();
        
        // Check non-critical collisions every 2nd frame
        if (this.frameCounter % 2 === 0) {
            this.checkNonCriticalCollisions();
        }
        
        // Clean up dead entities every 5th frame
        if (this.frameCounter % 5 === 0) {
            this.cleanupDeadEntities();
        }
    }

    updateSpatialGrid() {
        this.entities.forEach(entity => {
            if (!entity.alive || !entity.solid) return;
            
            const gridPositions = this.getGridPositions(entity);
            gridPositions.forEach(gridPos => {
                const key = `${gridPos.x},${gridPos.y}`;
                if (!this.collisionGrid.has(key)) {
                    this.collisionGrid.set(key, []);
                }
                this.collisionGrid.get(key).push(entity);
            });
        });
    }

    getGridPositions(entity) {
        const bounds = entity.getBounds();
        const positions = [];
        
        const startX = Math.floor(bounds.left / this.gridSize);
        const endX = Math.floor(bounds.right / this.gridSize);
        const startY = Math.floor(bounds.top / this.gridSize);
        const endY = Math.floor(bounds.bottom / this.gridSize);
        
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                positions.push({ x, y });
            }
        }
        
        return positions;
    }

    checkCollisions() {
        const checkedPairs = new Set();
        
        this.collisionGrid.forEach(entities => {
            if (entities.length < 2) return;
            
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const entity1 = entities[i];
                    const entity2 = entities[j];
                    
                    // Create unique pair ID
                    const pairId = entity1.id < entity2.id ? 
                        `${entity1.id}-${entity2.id}` : `${entity2.id}-${entity1.id}`;
                    
                    if (checkedPairs.has(pairId)) continue;
                    checkedPairs.add(pairId);
                    
                    this.checkEntityCollision(entity1, entity2);
                }
            }
        });
    }

    checkEntityCollision(entity1, entity2) {
        if (!entity1.alive || !entity2.alive) return;
        if (!entity1.solid || !entity2.solid) return;
        
        // Check if entities should collide based on collision layers
        if (!this.shouldCollide(entity1, entity2)) return;
        
        // Check intersection
        if (entity1.intersects(entity2)) {
            this.handleCollision(entity1, entity2);
        }
    }

    // Check critical collisions every frame (bullets, tanks, bases)
    checkCriticalCollisions() {
        const checkedPairs = new Set();
        
        this.collisionGrid.forEach(entities => {
            if (entities.length < 2) return;
            
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const entity1 = entities[i];
                    const entity2 = entities[j];
                    
                    // Only check critical entities (bullets, tanks, bases)
                    if (!this.isCriticalEntity(entity1) && !this.isCriticalEntity(entity2)) continue;
                    
                    const pairId = entity1.id < entity2.id ? 
                        `${entity1.id}-${entity2.id}` : `${entity2.id}-${entity1.id}`;
                    
                    if (checkedPairs.has(pairId)) continue;
                    checkedPairs.add(pairId);
                    
                    this.checkEntityCollision(entity1, entity2);
                }
            }
        });
    }

    // Check non-critical collisions every 2nd frame (walls, destructibles)
    checkNonCriticalCollisions() {
        const checkedPairs = new Set();
        
        this.collisionGrid.forEach(entities => {
            if (entities.length < 2) return;
            
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const entity1 = entities[i];
                    const entity2 = entities[j];
                    
                    // Skip if both are critical (handled in critical check)
                    if (this.isCriticalEntity(entity1) && this.isCriticalEntity(entity2)) continue;
                    
                    const pairId = entity1.id < entity2.id ? 
                        `${entity1.id}-${entity2.id}` : `${entity2.id}-${entity1.id}`;
                    
                    if (checkedPairs.has(pairId)) continue;
                    checkedPairs.add(pairId);
                    
                    this.checkEntityCollision(entity1, entity2);
                }
            }
        });
    }

    isCriticalEntity(entity) {
        return entity instanceof Tank || 
               entity instanceof Bullet || 
               entity instanceof Base ||
               entity.type === 'player' ||
               entity.type === 'bullet' ||
               entity.type === 'base';
    }

    // Simple collision check between two entities (for power-ups, etc.)
    checkCollision(entity1, entity2) {
        if (!entity1 || !entity2) return false;
        if (!entity1.alive || !entity2.alive) return false;
        
        // Use intersects method if available, otherwise use simple bounds check
        if (entity1.intersects && typeof entity1.intersects === 'function') {
            return entity1.intersects(entity2);
        }
        
        // Fallback to simple bounds collision
        return entity1.x < entity2.x + entity2.width &&
               entity1.x + entity1.width > entity2.x &&
               entity1.y < entity2.y + entity2.height &&
               entity1.y + entity1.height > entity2.y;
    }

    shouldCollide(entity1, entity2) {
        // Check if entity1's collision mask includes entity2's layer
        const entity1CanCollide = entity1.collisionMask.includes(entity2.collisionLayer);
        
        // Check if entity2's collision mask includes entity1's layer
        const entity2CanCollide = entity2.collisionMask.includes(entity1.collisionLayer);
        
        return entity1CanCollide || entity2CanCollide;
    }

    handleCollision(entity1, entity2) {
        // Determine collision types and handle appropriately
        this.handleBulletCollisions(entity1, entity2);
        this.handleTankCollisions(entity1, entity2);
        this.handleWallCollisions(entity1, entity2);
        this.handleBaseCollisions(entity1, entity2);
        
        // Call entity collision handlers
        if (entity1.onCollision) entity1.onCollision(entity2);
        if (entity2.onCollision) entity2.onCollision(entity1);
        
        // Trigger custom collision callbacks
        this.triggerCollisionCallbacks(entity1, entity2);
    }

    handleBulletCollisions(entity1, entity2) {
        let bullet = null;
        let target = null;
        
        if (entity1 instanceof Bullet) {
            bullet = entity1;
            target = entity2;
        } else if (entity2 instanceof Bullet) {
            bullet = entity2;
            target = entity1;
        }
        
        if (!bullet || !target) return;
        
        // Bullet hit something
        if (target instanceof Tank) {
            this.handleBulletTankCollision(bullet, target);
        } else if (target instanceof Base) {
            this.handleBulletBaseCollision(bullet, target);
        } else if (target.collisionLayer === 'wall') {
            this.handleBulletWallCollision(bullet, target);
        }
    }

    handleBulletTankCollision(bullet, tank) {
        // Don't let tanks shoot themselves
        if (bullet.owner === tank) return;
        
        // Don't let players damage each other (friendly fire off)
        if (bullet.owner instanceof Player && tank instanceof Player) return;
        
        // Apply damage
        tank.takeDamage(bullet.damage);
        
        // Create hit effect
        this.createHitEffect(bullet, tank);
        
        // Destroy bullet unless piercing
        if (!bullet.piercing) {
            bullet.destroy();
        }
        
        // Vibrate controller for hit feedback
        if (tank instanceof Player) {
            window.game?.inputSystem?.vibrate(tank.playerIndex, 300, 0.7, 0.3);
        }
        if (bullet.owner instanceof Player) {
            window.game?.inputSystem?.vibrate(bullet.owner.playerIndex, 150, 0.3, 0.1);
        }
    }

    handleBulletBaseCollision(bullet, base) {
        // Apply damage to base
        base.takeDamage(bullet.damage);
        
        // Create hit effect
        this.createHitEffect(bullet, base);
        
        // Destroy bullet
        bullet.destroy();
        
        // Vibrate all controllers for base hit
        for (let i = 0; i < 8; i++) {
            window.game?.inputSystem?.vibrate(i, 500, 0.8, 0.5);
        }
    }

    handleBulletWallCollision(bullet, wall) {
        // Handle wall collision based on wall type
        if (wall.destructible) {
            wall.takeDamage(bullet.damage);
            // If wall died, create a destroy effect at that spot
        if (!wall.alive) {
                const center = wall.getCenter ? wall.getCenter() : {x: wall.x + wall.width/2, y: wall.y + wall.height/2};
                if (window.game && typeof window.game.createExplosion === 'function') {
            window.game.createExplosion(center.x, center.y, 'destroy', 1.2);
                } else if (window.game && typeof window.game.createEffect === 'function') {
                    window.game.createEffect('explosion', center, { duration: 600, size: 'medium' });
                }
            }
        }
        
        // Create impact effect
        this.createImpactEffect(bullet, wall);
        
        // Handle bouncing bullets
        if (bullet.maxBounces > 0 && bullet.bounces < bullet.maxBounces) {
            bullet.bounce(wall);
        } else {
            bullet.destroy();
        }
    }

    handleTankCollisions(entity1, entity2) {
        let tank1 = null;
        let tank2 = null;
        
        if (entity1 instanceof Tank && entity2 instanceof Tank) {
            tank1 = entity1;
            tank2 = entity2;
        } else {
            return;
        }
        
        // Separate tanks that are overlapping
        this.separateEntities(tank1, tank2);
    }

    handleWallCollisions(entity1, entity2) {
        let movingEntity = null;
        let wall = null;
        
        if (entity1.collisionLayer === 'wall') {
            wall = entity1;
            movingEntity = entity2;
        } else if (entity2.collisionLayer === 'wall') {
            wall = entity2;
            movingEntity = entity1;
        }
        
        if (!wall || !movingEntity) return;
        if (movingEntity instanceof Bullet) return; // Handled separately
        
        // Stop movement into wall
        this.resolveWallCollision(movingEntity, wall);
    }

    handleBaseCollisions(entity1, entity2) {
        let base = null;
        let other = null;
        
        if (entity1 instanceof Base) {
            base = entity1;
            other = entity2;
        } else if (entity2 instanceof Base) {
            base = entity2;
            other = entity1;
        }
        
        if (!base || !other) return;
        
        // Only bullets should damage the base
        if (other instanceof Bullet) {
            // This is handled in handleBulletCollisions
            return;
        }
        
        // Tanks can't move through the base
        if (other instanceof Tank) {
            this.resolveWallCollision(other, base);
        }
    }

    separateEntities(entity1, entity2) {
        const center1 = entity1.getCenter();
        const center2 = entity2.getCenter();
        const direction = center1.subtract(center2);
        
        if (direction.magnitude() === 0) {
            // Entities are exactly on top of each other, push them apart randomly
            direction.set(Math.random() - 0.5, Math.random() - 0.5);
        }
        
        const separationDistance = (entity1.size.x + entity2.size.x) / 2 + 1;
        const normalizedDirection = direction.normalize();
        const separation = normalizedDirection.multiply(separationDistance);
        
        // Move entities apart
        const halfSeparation = separation.multiply(0.5);
        entity1.position = entity1.position.add(halfSeparation);
        entity2.position = entity2.position.subtract(halfSeparation);
        
        // Reduce velocities
        entity1.velocity = entity1.velocity.multiply(0.5);
        entity2.velocity = entity2.velocity.multiply(0.5);
    }

    resolveWallCollision(entity, wall) {
        const entityBounds = entity.getBounds();
        const wallBounds = wall.getBounds();
        
        // Calculate overlap
        const overlapLeft = entityBounds.right - wallBounds.left;
        const overlapRight = wallBounds.right - entityBounds.left;
        const overlapTop = entityBounds.bottom - wallBounds.top;
        const overlapBottom = wallBounds.bottom - entityBounds.top;
        
        // Find minimum overlap direction
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        
        if (minOverlap === overlapLeft) {
            // Move entity to the left
            entity.position.x = wallBounds.left - entity.size.x;
            entity.velocity.x = Math.min(0, entity.velocity.x);
        } else if (minOverlap === overlapRight) {
            // Move entity to the right
            entity.position.x = wallBounds.right;
            entity.velocity.x = Math.max(0, entity.velocity.x);
        } else if (minOverlap === overlapTop) {
            // Move entity up
            entity.position.y = wallBounds.top - entity.size.y;
            entity.velocity.y = Math.min(0, entity.velocity.y);
        } else if (minOverlap === overlapBottom) {
            // Move entity down
            entity.position.y = wallBounds.bottom;
            entity.velocity.y = Math.max(0, entity.velocity.y);
        }
    }

    createHitEffect(bullet, target) {
        window.game?.createEffect('bulletHit', target.getCenter(), {
            color: bullet.color,
            size: 'medium',
            damage: bullet.damage
        });
    }

    createImpactEffect(bullet, wall) {
        window.game?.createEffect('bulletImpact', bullet.getCenter(), {
            color: bullet.color,
            size: 'small'
        });
    }

    cleanupDeadEntities() {
        // Only cleanup if enough time has passed to reduce GC pressure
        if (this.frameCounter - this.lastCleanupFrame < 5) return;
        
        this.lastCleanupFrame = this.frameCounter;
        
        // Use more efficient cleanup - filter in place
        let i = this.entities.length;
        while (i--) {
            if (!this.entities[i].alive) {
                this.entities.splice(i, 1);
            }
        }
        
        i = this.dynamicEntities.length;
        while (i--) {
            if (!this.dynamicEntities[i].alive) {
                this.dynamicEntities.splice(i, 1);
            }
        }
        
        i = this.staticEntities.length;
        while (i--) {
            if (!this.staticEntities[i].alive) {
                this.staticEntities.splice(i, 1);
                this.staticGridNeedsUpdate = true;
            }
        }
    }

    // Collision callback system
    addCollisionCallback(entity1Type, entity2Type, callback) {
        const key = `${entity1Type}-${entity2Type}`;
        if (!this.callbacks.has(key)) {
            this.callbacks.set(key, []);
        }
        this.callbacks.get(key).push(callback);
    }

    triggerCollisionCallbacks(entity1, entity2) {
        const type1 = entity1.constructor.name;
        const type2 = entity2.constructor.name;
        
        const key1 = `${type1}-${type2}`;
        const key2 = `${type2}-${type1}`;
        
        if (this.callbacks.has(key1)) {
            this.callbacks.get(key1).forEach(callback => callback(entity1, entity2));
        }
        
        if (this.callbacks.has(key2)) {
            this.callbacks.get(key2).forEach(callback => callback(entity2, entity1));
        }
    }

    // Utility methods
    getEntitiesInRadius(center, radius) {
        const entities = [];
        const radiusSquared = radius * radius;
        
        this.entities.forEach(entity => {
            if (!entity.alive) return;
            
            const distance = center.distanceTo(entity.getCenter());
            if (distance <= radius) {
                entities.push(entity);
            }
        });
        
        return entities;
    }

    getEntitiesOfType(type) {
        return this.entities.filter(entity => entity instanceof type && entity.alive);
    }

    raycast(start, direction, maxDistance = 1000) {
        const end = start.add(direction.normalize().multiply(maxDistance));
        const hits = [];
        
        this.entities.forEach(entity => {
            if (!entity.alive || !entity.solid) return;
            
            const bounds = entity.getBounds();
            
            // Simple line-rectangle intersection
            if (this.lineIntersectsRect(start, end, bounds)) {
                const distance = start.distanceTo(entity.getCenter());
                hits.push({ entity, distance });
            }
        });
        
        return hits.sort((a, b) => a.distance - b.distance);
    }

    lineIntersectsRect(lineStart, lineEnd, rect) {
        // Check if line intersects with rectangle
        const x1 = lineStart.x;
        const y1 = lineStart.y;
        const x2 = lineEnd.x;
        const y2 = lineEnd.y;
        
        const left = rect.left;
        const right = rect.right;
        const top = rect.top;
        const bottom = rect.bottom;
        
        // Check intersection with each edge of the rectangle
        return this.lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) ||    // Top edge
               this.lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) || // Right edge
               this.lineIntersectsLine(x1, y1, x2, y2, right, bottom, left, bottom) || // Bottom edge
               this.lineIntersectsLine(x1, y1, x2, y2, left, bottom, left, top);     // Left edge
    }

    lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denom === 0) return false;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }
}
