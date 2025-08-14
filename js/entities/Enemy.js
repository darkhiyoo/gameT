class Enemy extends Tank {
    constructor(x, y, enemyType = 'basic') {
        super(x, y);
        
        this.enemyType = enemyType;
        this.aiState = 'patrol'; // patrol, chase, attack, dodge, retreat
        this.target = null;
        this.lastStateChange = Date.now();
        this.stateChangeDelay = 2000; // Change state every 2 seconds if needed
        
        // AI parameters - More aggressive settings
        this.detectionRange = 200; // Increased from 150
        this.attackRange = 150; // Increased from 120
        this.dodgeRange = 80;
        this.patrolSpeed = 50; // Increased from 40
        this.chaseSpeed = 80; // Increased from 70
        this.retreatSpeed = 70; // Increased from 60
        
        // Movement AI
        this.waypoints = [];
        this.currentWaypoint = 0;
        this.lastDirectionChange = Date.now();
        this.directionChangeInterval = 2000; // Reduced from 3000 - change direction more often
        
        // Combat AI - More reasonable firing rates with proper cooldowns
        this.lastFireTime = 0;
        this.fireRate = 2000; // 2 seconds base cooldown - much more reasonable
        this.aimAccuracy = 0.7; // Reasonable accuracy
        this.reactionTime = 500; // Half second reaction time
        
        // Dodge AI
        this.dodgeDirection = null;
        this.dodgeStartTime = 0;
        this.dodgeDuration = 1000;
        
        // Different enemy types
        this.setupEnemyType(enemyType);
        
        // Collision
        this.collisionLayer = 'enemy';
        this.collisionMask = ['wall', 'player', 'playerBullet'];
        
        // Visual
        this.tankColor = '#ff0000';
        this.alertColor = '#ffff00';
        this.isAlert = false;
        this.alertRadius = 0;
        this.alertStartTime = Date.now(); // Track when alert started
        this.alertDuration = 2000; // 2 seconds
    }

    setupEnemyType(type) {
    const scale = (window.game && window.game.entityScale) || 1;
        switch (type) {
            case 'fast':
                this.speed = 110; // Increased from 100
                this.health = 2; // START with 2 health for normal difficulty
                this.fireRate = 1800; // Reasonable cooldown
                this.aimAccuracy = 0.7; // Slightly less accurate but faster
                this.tankColor = '#ff8800';
                this.spriteName = 'enemy1';
                break;
            case 'heavy':
                this.speed = 60; // Increased from 50
                this.health = 3;
                this.fireRate = 2500; // Slower but powerful
                this.aimAccuracy = 0.8; // More accurate
                this.size = new Vector2D(40 * scale, 40 * scale);
                this.tankColor = '#880000';
                this.spriteName = 'enemy1';
                break;
            case 'sniper':
                this.speed = 70; // Increased from 60
                this.health = 2; // START with 2 health for normal difficulty
                this.fireRate = 3000; // Long cooldown for sniper
                this.aimAccuracy = 0.9; // Very accurate
                this.detectionRange = 250; // Increased from 200
                this.attackRange = 200; // Increased from 180
                this.tankColor = '#4400aa';
                this.spriteName = 'enemy1';
                break;
            case 'boss':
                this.speed = 50; // Increased from 45
                this.health = 6; // 6 hits for normal difficulty
                this.fireRate = 2000; // Reasonable boss fire rate
                this.aimAccuracy = 0.85; // Accurate but not perfect
                this.size = new Vector2D(64 * scale, 64 * scale); // Bigger than normal
                this.tankColor = '#aa0000';
                this.spriteName = 'enemy2'; // ai2.png
                this.bulletType = 'missile'; // Use seek-missile.png
                this.explosionType = 'flame'; // Use flam6.png
                this.explosionRadius = 80; // Area damage radius
                this.detectionRange = 250; // Longer range for boss
                this.attackRange = 180; // Longer attack range
                break;
            case 'flame':
                this.speed = 75;
                this.health = 2;
                this.fireRate = 1500; // Moderate fire rate
                this.aimAccuracy = 0.75;
                this.size = new Vector2D(36 * scale, 36 * scale); // Slightly bigger
                this.tankColor = '#ff4400';
                this.spriteName = 'enemy3'; // ai3.png
                this.bulletType = 'fireball'; // Fire bigger bullet ball
                this.detectionRange = 200;
                this.attackRange = 160;
                break;
            case 'flamethrower':
                this.speed = 35; // Slower but deadly
                this.health = 6; // 6 hits for normal difficulty (same as boss)
                this.fireRate = 3000; // Much longer cooldown for flame bursts
                this.aimAccuracy = 0.95;
                this.size = new Vector2D(96 * scale, 96 * scale); // Much bigger - scarier boss tank
                this.tankColor = '#cc0000'; // Darker red for scary look
                this.spriteName = 'enemy4'; // ai4.png
                this.bulletType = 'flamethrower'; // Special flamethrower weapon
                this.detectionRange = 350; // Longer range for bigger tank
                this.attackRange = 220; // Longer flamethrower range
                this.flameAnimation = 0; // For burning head effect
                this.isFlamethrowerBoss = true;
                this.flameSegments = []; // Array to hold flame segments
                this.flameThrowing = false; // Whether currently throwing flames
                this.flameDirection = new Vector2D(1, 0); // Current flame direction
                this.flameDistance = 200; // How far flames extend
                this.flameWidth = 40; // Width of flame stream
                this.flameDuration = 1500; // How long each flame burst lasts
                this.flameStartTime = 0; // When current flame burst started
                break;
            default: // basic
                this.speed = 80; // Increased from 70
                this.health = 2; // START with 2 health for normal difficulty
                this.fireRate = 2200; // Reasonable fire rate
                this.aimAccuracy = 0.7; // Reasonable accuracy
                this.tankColor = '#ff0000';
                this.spriteName = 'enemy1';
                break;
        }
        this.maxHealth = this.health;
    }

    update(deltaTime) {
        if (!this.alive) return;
        
        // Update flame animation for flamethrower boss
        if (this.isFlamethrowerBoss) {
            this.flameAnimation += deltaTime * 10; // 10 frames per second
            
            // Update flame segments if actively throwing flames
            if (this.flameThrowing) {
                this.updateFlameSegments(deltaTime);
            }
        }
        
        // Update AI
        this.updateAI(deltaTime);
        
        // Update alert state
        this.updateAlertState(deltaTime);
        
        super.update(deltaTime);
    }

    updateAI(deltaTime) {
        // Find nearest player target
        this.findTarget();
        
        // Update AI state machine
        this.updateAIState();
        
        // Execute current state behavior
        this.executeAIBehavior(deltaTime);
        
        // Handle firing
        this.updateFiring();
    }

    findTarget() {
        // This will be called by the game to set targets
        // For now, we'll assume the game sets this.target
    }

    setTarget(target) {
        this.target = target;
    }

    updateAIState() {
        if (!this.target || !this.target.alive || this.target.respawning) {
            this.aiState = 'patrol';
            this.isAlert = false;
            return;
        }
        
        const distanceToTarget = this.distanceTo(this.target);
        const currentTime = Date.now();
        const canSeeTarget = this.canSeeTarget(this.target);
        
        // Check for incoming bullets (dodge behavior)
        if (this.shouldDodge()) {
            this.aiState = 'dodge';
            this.isAlert = true;
            return;
        }
        
        // More aggressive state transitions
        switch (this.aiState) {
            case 'patrol':
                // Increased detection range and prioritize line of sight
                if (distanceToTarget <= this.detectionRange * 1.5 || canSeeTarget) {
                    this.aiState = 'chase';
                    this.isAlert = true;
                    this.lastStateChange = currentTime;
                }
                break;
                
            case 'chase':
                // Switch to attack mode faster and more aggressively
                if (distanceToTarget <= this.attackRange * 1.2 || this.hasCardinalLineOfSight(this.target)) {
                    this.aiState = 'attack';
                    this.lastStateChange = currentTime;
                } else if (distanceToTarget > this.detectionRange * 2 && !canSeeTarget) {
                    this.aiState = 'patrol';
                    this.isAlert = false;
                    this.lastStateChange = currentTime;
                }
                break;
                
            case 'attack':
                // Stay in attack mode longer, only retreat if very close or badly damaged
                if (distanceToTarget > this.attackRange * 1.8 && !canSeeTarget) {
                    this.aiState = 'chase';
                    this.lastStateChange = currentTime;
                } else if (this.health <= this.maxHealth * 0.2 && distanceToTarget < 50) {
                    this.aiState = 'retreat';
                    this.lastStateChange = currentTime;
                }
                break;
                
            case 'retreat':
                // Return to fighting faster
                if (distanceToTarget > this.detectionRange * 1.2) {
                    this.aiState = 'patrol';
                    this.isAlert = false;
                    this.lastStateChange = currentTime;
                } else if (this.health > this.maxHealth * 0.5) {
                    this.aiState = 'chase';
                    this.lastStateChange = currentTime;
                }
                break;
                
            case 'dodge':
                if (currentTime - this.dodgeStartTime > this.dodgeDuration) {
                    this.aiState = distanceToTarget <= this.attackRange ? 'attack' : 'chase';
                    this.dodgeDirection = null;
                }
                break;
        }
    }

    executeAIBehavior(deltaTime) {
        let moveDirection = new Vector2D(0, 0);
        
        switch (this.aiState) {
            case 'patrol':
                moveDirection = this.getPatrolMovement();
                break;
                
            case 'chase':
                moveDirection = this.getChaseMovement();
                break;
                
            case 'attack':
                moveDirection = this.getAttackMovement();
                break;
                
            case 'retreat':
                moveDirection = this.getRetreatMovement();
                break;
                
            case 'dodge':
                moveDirection = this.getDodgeMovement();
                break;
        }
        
        this.setMoveDirection(moveDirection);
    }

    getPatrolMovement() {
        const currentTime = Date.now();
        
        // Change direction randomly
        if (currentTime - this.lastDirectionChange > this.directionChangeInterval) {
            this.lastDirectionChange = currentTime;
            this.directionChangeInterval = 2000 + Math.random() * 3000;
            
            // Pick a random direction
            const directions = [
                new Vector2D(0, -1), // up
                new Vector2D(1, 0),  // right
                new Vector2D(0, 1),  // down
                new Vector2D(-1, 0)  // left
            ];
            return directions[Math.floor(Math.random() * directions.length)];
        }
        
        return this.moveDirection;
    }

    getChaseMovement() {
        if (!this.target) return new Vector2D(0, 0);
        
        const targetPos = this.target.getCenter();
        const myPos = this.getCenter();
        const deltaX = targetPos.x - myPos.x;
        const deltaY = targetPos.y - myPos.y;
        
        // Choose the primary direction based on which distance is greater
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Move horizontally
            return new Vector2D(deltaX > 0 ? 1 : -1, 0);
        } else {
            // Move vertically
            return new Vector2D(0, deltaY > 0 ? 1 : -1);
        }
    }

    getAttackMovement() {
        if (!this.target) return new Vector2D(0, 0);
        
        // Special behavior for flamethrower - stop and aim
        if (this.isFlamethrowerBoss) {
            const targetPos = this.target.getCenter();
            const myPos = this.getCenter();
            const distanceToTarget = myPos.distanceTo(targetPos);
            
            if (distanceToTarget > this.attackRange * 1.2) {
                // Too far, move closer
                const deltaX = targetPos.x - myPos.x;
                const deltaY = targetPos.y - myPos.y;
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    return new Vector2D(deltaX > 0 ? 1 : -1, 0);
                } else {
                    return new Vector2D(0, deltaY > 0 ? 1 : -1);
                }
            } else if (distanceToTarget < this.attackRange * 0.4) {
                // Too close, back away
                const deltaX = targetPos.x - myPos.x;
                const deltaY = targetPos.y - myPos.y;
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    return new Vector2D(deltaX > 0 ? -1 : 1, 0);
                } else {
                    return new Vector2D(0, deltaY > 0 ? -1 : 1);
                }
            } else {
                // Perfect range - stop and flame
                return new Vector2D(0, 0);
            }
        }
        
        // Original behavior for other enemies
        const targetPos = this.target.getCenter();
        const myPos = this.getCenter();
        const distanceToTarget = myPos.distanceTo(targetPos);
        const deltaX = targetPos.x - myPos.x;
        const deltaY = targetPos.y - myPos.y;
        
        if (distanceToTarget < this.attackRange * 0.6) {
            // Too close, back away in 4 directions only
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                return new Vector2D(deltaX > 0 ? -1 : 1, 0); // Move away horizontally
            } else {
                return new Vector2D(0, deltaY > 0 ? -1 : 1); // Move away vertically
            }
        } else if (distanceToTarget > this.attackRange) {
            // Too far, move closer in 4 directions only
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                return new Vector2D(deltaX > 0 ? 1 : -1, 0); // Move closer horizontally
            } else {
                return new Vector2D(0, deltaY > 0 ? 1 : -1); // Move closer vertically
            }
        } else {
            // Good distance, try to get better angle for shooting
            // Occasionally strafe to avoid player fire
            if (Math.random() < 0.3) {
                const directions = [
                    new Vector2D(0, -1), new Vector2D(1, 0), 
                    new Vector2D(0, 1), new Vector2D(-1, 0)
                ];
                return directions[Math.floor(Math.random() * directions.length)];
            }
            return new Vector2D(0, 0); // Stop to aim and shoot
        }
    }

    getRetreatMovement() {
        if (!this.target) return new Vector2D(0, 0);
        
        // Move away from target in 4 directions only
        const targetPos = this.target.getCenter();
        const myPos = this.getCenter();
        const deltaX = myPos.x - targetPos.x;
        const deltaY = myPos.y - targetPos.y;
        
        // Choose the direction that moves furthest away
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            return new Vector2D(deltaX > 0 ? 1 : -1, 0);
        } else {
            return new Vector2D(0, deltaY > 0 ? 1 : -1);
        }
    }

    getDodgeMovement() {
        if (!this.dodgeDirection) {
            // Pick a random dodge direction
            const directions = [
                new Vector2D(1, 0),   // right
                new Vector2D(-1, 0),  // left
                new Vector2D(0, 1),   // down
                new Vector2D(0, -1)   // up
            ];
            this.dodgeDirection = directions[Math.floor(Math.random() * directions.length)];
            this.dodgeStartTime = Date.now();
        }
        
        return this.dodgeDirection;
    }

    shouldDodge() {
        // This would be called by the game when bullets are nearby
        // For now, we'll use a simple probability
        return Math.random() < 0.1; // 10% chance to randomly dodge
    }

    triggerDodge() {
        this.aiState = 'dodge';
        this.dodgeDirection = null;
        this.isAlert = true;
    }

    updateFiring() {
        // Don't fire if frozen!
        if (this.frozen) return;
        
        // Only fire if we're in attack state AND can see a valid target
        if (this.aiState !== 'attack') return;
        
        // Check cooldown first - MUST respect this
        const currentTime = Date.now();
        const timeSinceLastFire = currentTime - this.lastFireTime;
        if (timeSinceLastFire < this.fireRate) {
            return; // Still in cooldown
        }
        
        // Only fire if we can see a valid target AND have a clear shot
        const validTarget = this.findValidTarget();
        if (!validTarget) return;
        
        // Special handling for flamethrower
        if (this.isFlamethrowerBoss) {
            this.handleFlamethrowerFiring(validTarget);
            return;
        }
        
        // Aim at the target
        this.aimAtTarget(validTarget);
        
        // Fire at the target and create bullet through game
        const bulletData = this.attemptFire();
        if (bulletData && this.game) {
            this.game.createBullet(bulletData);
        }
    }
    
    handleFlamethrowerFiring(target) {
        // Don't fire if frozen!
        if (this.frozen) {
            // If frozen, stop any active flamethrower immediately
            if (this.flameThrowing) {
                this.stopFlamethrowing();
            }
            return;
        }
        
        const currentTime = Date.now();
        
        // If not currently throwing flames, start a new burst
        if (!this.flameThrowing) {
            this.startFlamethrowing();
            this.flameStartTime = currentTime;
            this.lastFireTime = currentTime; // Set cooldown
        } else {
            // Check if current flame burst should end
            if (currentTime - this.flameStartTime > this.flameDuration) {
                this.stopFlamethrowing();
                this.lastFireTime = currentTime; // Start cooldown for next burst
            }
        }
    }

    shouldFireAtTarget(target) {
        if (!target || !target.alive) return false;
        
        // Only fire if we have a valid target in sight that we can actually hit
        
        // Check if target is in cardinal direction (4-way shooting)
        if (!this.hasCardinalLineOfSight(target)) return false;
        
        // Check if we have a clear shot (no obstacles in the way)
        if (!this.hasClearShotToTarget(target)) return false;
        
        // For players: Always shoot if we can see them and have clear line of sight
        if (target instanceof Player) {
            return true;
        }
        
        // For destructible objects (cars, walls): Always shoot if we can see them
        if (target.destructible) {
            return true;
        }
        
        // Don't shoot at anything else (no shooting in air)
        return false;
    }

    shouldFireAtPlayer(player) {
        // Simplified - if we can see the player in cardinal direction with clear shot, fire
        return true;
    }

    hasClearShotToTarget(target) {
        if (!target || !this.game || !this.game.collisionSystem) return false;
        
        const myPos = this.getCenter();
        const targetPos = target.getCenter();
        
        // Check for obstacles between us and target
        const entities = this.game.collisionSystem.entities;
        
        for (let entity of entities) {
            // Skip ourselves, the target, and non-solid objects
            if (entity === this || entity === target || !entity.alive) continue;
            if (entity.collisionLayer === 'bullet' || entity.collisionLayer === 'decoration') continue;
            
            // Check if this entity blocks our shot
            if (this.lineIntersectsEntity(myPos, targetPos, entity)) {
                return false;
            }
        }
        
        return true;
    }

    lineIntersectsEntity(startPos, endPos, entity) {
        // Simple line-rectangle intersection
        const entityBounds = {
            left: entity.position.x,
            right: entity.position.x + entity.size.x,
            top: entity.position.y,
            bottom: entity.position.y + entity.size.y
        };
        
        // Check if line intersects with entity's bounding box
        return this.lineIntersectsRect(startPos, endPos, entityBounds);
    }

    lineIntersectsRect(start, end, rect) {
        // Check if line segment intersects with rectangle
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        let t0 = 0, t1 = 1;
        
        // Check intersection with left and right edges
        if (dx !== 0) {
            const tx1 = (rect.left - start.x) / dx;
            const tx2 = (rect.right - start.x) / dx;
            
            t0 = Math.max(t0, Math.min(tx1, tx2));
            t1 = Math.min(t1, Math.max(tx1, tx2));
        } else {
            // Line is vertical
            if (start.x < rect.left || start.x > rect.right) return false;
        }
        
        // Check intersection with top and bottom edges
        if (dy !== 0) {
            const ty1 = (rect.top - start.y) / dy;
            const ty2 = (rect.bottom - start.y) / dy;
            
            t0 = Math.max(t0, Math.min(ty1, ty2));
            t1 = Math.min(t1, Math.max(ty1, ty2));
        } else {
            // Line is horizontal
            if (start.y < rect.top || start.y > rect.bottom) return false;
        }
        
        return t0 <= t1 && t1 >= 0 && t0 <= 1;
    }

    findValidTarget() {
        // Only look for targets that are worth shooting at
        
        // Check for players first - but only if we have clear cardinal line of sight
        if (this.target && this.target.alive && !this.target.respawning) {
            const distance = this.distanceTo(this.target);
            if (distance <= this.attackRange) { // Only within attack range
                // Only consider player a valid target if they're perfectly aligned in cardinal direction
                if (this.hasCardinalLineOfSight(this.target) && this.hasClearShotToTarget(this.target)) {
                    return this.target;
                }
            }
        }
        
        // Check for any other players in cardinal line of sight
        if (window.game && window.game.players) {
            for (let player of window.game.players) {
                if (player.alive && !player.respawning) {
                    const distance = this.distanceTo(player);
                    if (distance <= this.attackRange) {
                        if (this.hasCardinalLineOfSight(player) && this.hasClearShotToTarget(player)) {
                            return player;
                        }
                    }
                }
            }
        }
        
        // Check for destructible objects (cars, etc.) in direct cardinal line of sight only
        const nearbyTargets = this.findNearbyDestructibleTargets();
        for (let destructible of nearbyTargets) {
            const distance = this.distanceTo(destructible);
            if (distance <= this.attackRange) {
                if (this.hasCardinalLineOfSight(destructible) && this.hasClearShotToTarget(destructible)) {
                    return destructible;
                }
            }
        }
        
        return null; // No valid target found - don't shoot in air
    }

    hasCardinalLineOfSight(target) {
        if (!target || !target.alive) return false;
        
        const myPos = this.getCenter();
        const targetPos = target.getCenter();
        const deltaX = targetPos.x - myPos.x;
        const deltaY = targetPos.y - myPos.y;
        
        // Check if target is EXACTLY in one of the 4 cardinal directions (much stricter alignment)
        const tolerance = 12; // Very tight tolerance for precise cardinal alignment
        
        const isHorizontalAligned = Math.abs(deltaY) <= tolerance && Math.abs(deltaX) > tolerance;
        const isVerticalAligned = Math.abs(deltaX) <= tolerance && Math.abs(deltaY) > tolerance;
        
        if (!isHorizontalAligned && !isVerticalAligned) {
            return false; // Not aligned in cardinal direction
        }
        
        // Must also have clear line of sight - no obstacles
        return this.hasLineOfSight(myPos, targetPos);
    }

    canSeeTarget(target) {
        if (!target || !target.alive) return false;
        
        const myPos = this.getCenter();
        const targetPos = target.getCenter();
        const distance = myPos.distanceTo(targetPos);
        
        // Increased detection range for more aggressive AI
        if (distance > this.detectionRange * 1.2) return false;
        
        // Check line of sight
        return this.hasLineOfSight(myPos, targetPos);
    }

    hasLineOfSight(start, end) {
        // Simple line of sight check using the game's collision system
        // For now, assume we can see targets unless there's a wall directly between
        const game = window.game;
        if (!game) return true;
        
        const direction = end.subtract(start).normalize();
        const distance = start.distanceTo(end);
        const stepSize = 16; // Check every 16 pixels
        
        for (let d = stepSize; d < distance; d += stepSize) {
            const checkPos = start.add(direction.multiply(d));
            
            // Check if this position intersects with any walls
            const walls = game.walls || [];
            for (let wall of walls) {
                if (wall.alive && this.pointIntersectsEntity(checkPos, wall)) {
                    return false; // Wall blocks line of sight
                }
            }
        }
        
        return true; // Clear line of sight
    }

    pointIntersectsEntity(point, entity) {
        return point.x >= entity.x && 
               point.x <= entity.x + entity.width &&
               point.y >= entity.y && 
               point.y <= entity.y + entity.height;
    }

    findNearbyDestructibleTargets() {
        const game = window.game;
        if (!game) return [];
        
        const myPos = this.getCenter();
        const nearbyTargets = [];
        
        // Check for destructible cars
        const cars = game.cars || [];
        for (let car of cars) {
            if (car.alive && car.destructible) {
                const distance = myPos.distanceTo(car.getCenter());
                if (distance <= this.attackRange && this.canSeeTarget(car)) {
                    nearbyTargets.push(car);
                }
            }
        }
        
        // Sort by distance - closest first
        nearbyTargets.sort((a, b) => {
            const distA = myPos.distanceTo(a.getCenter());
            const distB = myPos.distanceTo(b.getCenter());
            return distA - distB;
        });
        
        return nearbyTargets;
    }

    aimAtTarget(target) {
        const targetPos = target.getCenter();
        const myPos = this.getCenter();
        const deltaX = targetPos.x - myPos.x;
        const deltaY = targetPos.y - myPos.y;
        
        // Force 4-directional aiming - choose the dominant direction
        let aimAngle;
        let facing;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal aim
            if (deltaX > 0) {
                aimAngle = 0; // Right
                facing = 1;
            } else {
                aimAngle = Math.PI; // Left
                facing = 3;
            }
        } else {
            // Vertical aim
            if (deltaY > 0) {
                aimAngle = Math.PI / 2; // Down
                facing = 2;
            } else {
                aimAngle = -Math.PI / 2; // Up
                facing = 0;
            }
        }
        
        // Add small inaccuracy for non-boss enemies
        if (this.enemyType !== 'boss') {
            const inaccuracy = (1 - this.aimAccuracy) * (Math.random() - 0.5) * Math.PI / 8;
            aimAngle += inaccuracy;
        }
        
        // Set rotation and facing direction
        this.rotation = aimAngle;
        this.facing = facing;
        this.direction = facing; // Tank class uses direction as the cardinal direction
    }

    angleToDirection(angle) {
        // Convert angle to cardinal direction (0=up, 1=right, 2=down, 3=left)
        const normalized = ((angle + Math.PI * 2) % (Math.PI * 2));
        const degrees = (normalized * 180 / Math.PI + 90) % 360;
        
        if (degrees >= 315 || degrees < 45) return 0; // up
        if (degrees >= 45 && degrees < 135) return 1; // right
        if (degrees >= 135 && degrees < 225) return 2; // down
        return 3; // left
    }

    attemptFire() {
        // Special handling for flamethrower - use visual flame stream, not bullets
        if (this.enemyType === 'flamethrower') {
            this.startFlamethrowing();
            return null; // Don't create bullets - use visual flame effect instead
        }
        
        // Check if we can actually fire
        if (!this.canFireBullet()) return null;
        
        const bulletData = this.fire();
        if (bulletData) {
            // Mark bullet type for special enemies
            if (this.enemyType === 'boss') {
                bulletData.type = 'missile';
                bulletData.explosionType = 'flame';
                bulletData.explosionRadius = this.explosionRadius || 40;
                console.log('Boss firing missile bullet!', bulletData); // Debug log
            } else if (this.enemyType === 'flame') {
                bulletData.type = 'fireball';
                bulletData.size = 'large';
            } else {
                // Basic enemies use normal bullets with enemy sprites
                bulletData.type = 'normal';
            }
            return bulletData;
        }
        return null;
    }

    takeDamage(amount) {
        console.log(`${this.enemyType} taking ${amount} damage - Health BEFORE: ${this.health}/${this.maxHealth}`);
        super.takeDamage(amount);
        console.log(`${this.enemyType} after damage - Health AFTER: ${this.health}/${this.maxHealth}, Alive: ${this.alive}`);
        
        // Special death effect for boss enemy
        if (this.health <= 0 && this.enemyType === 'boss' && this.game) {
            // Create area damage explosion
            this.createBossExplosion();
        }
    }

    createBossExplosion() {
        if (!this.game) return;
        
        const center = this.getCenter();
        const explosionRadius = this.explosionRadius || 80;
        
    // Create visual explosion effect using destroy.png (same as wall destruction)
    this._didExplosion = true;
    this.game.createExplosion(center.x, center.y, 'destroy', 2.0); // Bigger explosion
        
        // Deal area damage to nearby entities
        const allEntities = [
            ...this.game.players,
            ...this.game.enemies,
            ...this.game.cars
        ];
        
        allEntities.forEach(entity => {
            if (entity === this || !entity.alive) return;
            
            const distance = center.distanceTo(entity.getCenter());
            if (distance <= explosionRadius) {
                // Calculate damage based on distance (closer = more damage)
                const damageRatio = 1 - (distance / explosionRadius);
                const damage = Math.ceil(damageRatio * 2); // Max 2 damage at center
                
                if (entity.takeDamage) {
                    entity.takeDamage(damage);
                }
            }
        });
    }

    updateAlertState(deltaTime) {
        // Only show alert for 2 seconds after spawning
        const currentTime = Date.now();
        const timeSinceStart = currentTime - this.alertStartTime;
        
        if (timeSinceStart < this.alertDuration) {
            // Show alert for first 2 seconds
            this.isAlert = true;
            this.alertRadius = Math.min(30, this.alertRadius + deltaTime * 50);
        } else {
            // Hide alert after 2 seconds
            this.isAlert = false;
            this.alertRadius = Math.max(0, this.alertRadius - deltaTime * 100);
        }
    }

    render(ctx, camera = { x: 0, y: 0 }) {
        // Special scary effects for flamethrower boss (before main render)
        if (this.isFlamethrowerBoss) {
            this.renderFlamethrowerEffects(ctx, camera);
        }
        
        // Render alert indicator
        if (this.alertRadius > 0) {
            this.renderAlertIndicator(ctx, camera);
        }
        
        super.render(ctx, camera);
        
        // Render AI state indicator (debug)
        if (window.DEBUG_MODE) {
            this.renderDebugInfo(ctx, camera);
        }
    }

    onRender(ctx, camera) {
        // Override Entity's sprite rendering for flamethrower boss
        if (this.type === 'flamethrower') {
            // Apply special rendering for flamethrower boss
            ctx.save();
            
            // Dark red tint for scary effect
            ctx.fillStyle = '#cc0000';
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillRect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);
            
            // Reset composite operation and draw sprite
            ctx.globalCompositeOperation = 'source-over';
            
            ctx.restore();
        }
        
        // Call parent's onRender for any additional effects
        super.onRender(ctx, camera);
    }

    renderAlertIndicator(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        ctx.strokeStyle = this.alertColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(
            screenX + this.size.x / 2,
            screenY + this.size.y / 2,
            this.alertRadius,
            0, Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
    }

    renderFlamethrowerEffects(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        
        // Pulsing red glow effect (scary aura)
        const pulseIntensity = 0.3 + 0.2 * Math.sin(Date.now() * 0.01);
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 + pulseIntensity * 10;
        ctx.globalAlpha = pulseIntensity;
        
        // Draw outer scary glow
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(
            screenX + this.size.x / 2,
            screenY + this.size.y / 2,
            this.size.x / 2 + 15,
            0, Math.PI * 2
        );
        ctx.fill();
        
        // Heat distortion effect when flamethrowing
        if (this.flameThrowing) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#ffaa00';
            
            // Multiple heat waves
            for (let i = 0; i < 3; i++) {
                const waveOffset = Math.sin(Date.now() * 0.02 + i) * 5;
                ctx.beginPath();
                ctx.arc(
                    screenX + this.size.x / 2 + waveOffset,
                    screenY + this.size.y / 2,
                    this.size.x / 2 + 25 + i * 8,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        }
        
        ctx.restore();
        
        // Render flame segments using PNG sprites
        if (this.flameThrowing && this.flameSegments.length > 0) {
            ctx.save();
            
            for (const segment of this.flameSegments) {
                const segmentScreenX = segment.position.x - camera.x;
                const segmentScreenY = segment.position.y - camera.y;
                
                // Set opacity for segment
                ctx.globalAlpha = segment.opacity;
                
                // Get the flame sprite (flam1 to flam8)
                const flameSpriteName = `flam${segment.frame}`;
                const flameSprite = this.game.assetLoader.getImage(flameSpriteName);
                
                if (flameSprite) {
                    // Draw flame segment
                    ctx.drawImage(
                        flameSprite,
                        segmentScreenX - segment.size / 2,
                        segmentScreenY - segment.size / 2,
                        segment.size,
                        segment.size
                    );
                }
            }
            
            ctx.restore();
        }
    }

    renderDebugInfo(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.fillText(this.aiState, screenX, screenY - 10);
        
        // Draw detection range
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(
            screenX + this.size.x / 2,
            screenY + this.size.y / 2,
            this.detectionRange,
            0, Math.PI * 2
        );
        ctx.stroke();
        
        // Draw attack range
        ctx.strokeStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(
            screenX + this.size.x / 2,
            screenY + this.size.y / 2,
            this.attackRange,
            0, Math.PI * 2
        );
        ctx.stroke();
        
        ctx.restore();
    }

    startFlamethrowing() {
        if (!this.flameThrowing) {
            this.flameThrowing = true;
            this.flameDirection = this.getDirectionToTarget();
            this.createFlameStream();
            
            // Start looping flamethrower sound
            if (this.game && this.game.soundManager) {
                this.game.soundManager.startLoopingSound('flamethrower', 0.8);
            }
        }
    }

    stopFlamethrowing() {
        this.flameThrowing = false;
        this.clearFlameSegments();
        
        // Stop looping flamethrower sound
        if (this.game && this.game.soundManager) {
            this.game.soundManager.stopLoopingSound('flamethrower');
        }
    }

    createFlameStream() {
        this.clearFlameSegments();
        
        const segmentCount = 8; // Number of flame segments
        const segmentSize = this.flameDistance / segmentCount;
        
        // Calculate tank front position (where flames should start from)
        const tankRadius = Math.max(this.size.x, this.size.y) / 2;
        const flameStartPos = this.position.add(this.flameDirection.multiply(tankRadius + 10));
        
        for (let i = 0; i < segmentCount; i++) {
            const distance = (i + 1) * segmentSize;
            const segmentPos = flameStartPos.add(this.flameDirection.multiply(distance));
            
            const segment = {
                position: segmentPos,
                distance: distance,
                frame: (i + Math.floor(this.flameAnimation)) % 5 + 1, // Use flam1-flam5
                size: 32 + (i * 4), // Get bigger as they go out
                opacity: 1.0 - (i * 0.1) // Fade out as they go further
            };
            
            this.flameSegments.push(segment);
        }
    }

    updateFlameSegments(deltaTime) {
        if (!this.flameThrowing) return;
        
        // Update flame direction to current target
        this.flameDirection = this.getDirectionToTarget();
        
        // Calculate tank front position (where flames should start from)
        const tankRadius = Math.max(this.size.x, this.size.y) / 2;
        const flameStartPos = this.position.add(this.flameDirection.multiply(tankRadius + 10));
        
        // Update each flame segment
        for (let i = 0; i < this.flameSegments.length; i++) {
            const segment = this.flameSegments[i];
            
            // Update position based on tank front position and direction
            segment.position = flameStartPos.add(this.flameDirection.multiply(segment.distance));
            
            // Update animation frame
            segment.frame = ((i + Math.floor(this.flameAnimation)) % 5) + 1;
            
            // Check collision with players
            this.checkFlameCollision(segment);
        }
        
        // Stop flamethrowing after a certain time
        if (Math.random() < 0.02) { // 2% chance per frame to stop
            this.stopFlamethrowing();
        }
    }

    checkFlameCollision(segment) {
        if (!this.game || !this.game.players) return;
        
        for (const player of this.game.players) {
            if (!player.alive) continue;
            
            const distance = segment.position.subtract(player.position).magnitude();
            if (distance < segment.size / 2) {
                // Player hit by flame
                player.takeDamage(1);
                
                // Add burning effect (if implemented)
                if (player.addStatusEffect) {
                    player.addStatusEffect('burning', 2000); // 2 seconds of burning
                }
            }
        }
    }

    clearFlameSegments() {
        this.flameSegments = [];
    }

    getDirectionToTarget() {
        if (!this.target) return new Vector2D(1, 0);
        
        return this.target.position.subtract(this.position).normalize();
    }

    onTakeDamage(amount) {
        // Create hit effect using freeze5.png bigger than AI when hit
        this.createHitEffect();
        super.onTakeDamage(amount);
    }

    createHitEffect() {
        if (window.game && window.game.assetLoader) {
            const center = this.getCenter();
            const effectSize = Math.max(this.size.x + 16, this.size.y + 16, 48); // At least 48px, bigger than AI
            
            // Load freeze5.png for hit effect as specifically requested
            const hitSprite = window.game.assetLoader.getImage('freeze5');
            
            // Determine duration - if frozen, stay until freeze ends, otherwise short duration
            const duration = this.frozen && this.freezeEffect ? 3000 : 300; // 3 seconds if frozen, 0.3s if not
            
            // Create a temporary hit effect entity
            const hitEffect = {
                position: { 
                    x: center.x - effectSize / 2, 
                    y: center.y - effectSize / 2 
                },
                size: effectSize,
                sprite: hitSprite,
                startTime: Date.now(),
                duration: duration,
                alpha: 0.3, // Much more transparent so enemy tank is clearly visible
                alive: true,
                target: this, // Reference to the enemy
                
                update: function(deltaTime) {
                    // Remove effect if target is dead
                    if (!this.target || !this.target.alive) {
                        this.alive = false;
                        return false;
                    }
                    
                    // If target is frozen, keep effect active until freeze ends
                    if (this.target.frozen && this.target.freezeEffect) {
                        this.alpha = 0.3; // Very transparent while frozen so tank is clearly visible
                        return true;
                    }
                    
                    // If not frozen anymore, fade out quickly
                    const elapsed = Date.now() - this.startTime;
                    if (elapsed >= 200) { // Quick fade when unfrozen
                        this.alive = false;
                        return false;
                    }
                    // Quick fade out
                    this.alpha = 0.3 * (1.0 - (elapsed / 200));
                    return true;
                },
                
                render: function(ctx, camera = { x: 0, y: 0 }) {
                    if (!this.alive || !this.target || !this.target.alive) return;
                    
                    // Position effect to follow target
                    const targetCenter = this.target.getCenter();
                    this.position.x = targetCenter.x - this.size / 2;
                    this.position.y = targetCenter.y - this.size / 2;
                    
                    const screenX = this.position.x - camera.x;
                    const screenY = this.position.y - camera.y;
                    
                    ctx.save();
                    ctx.globalAlpha = this.alpha;
                    
                    if (this.sprite) {
                        ctx.drawImage(
                            this.sprite,
                            screenX,
                            screenY,
                            this.size,
                            this.size
                        );
                    }
                    
                    ctx.restore();
                }
            };
            
            // Add to game's temporary effects list
            if (!window.game.hitEffects) {
                window.game.hitEffects = [];
            }
            window.game.hitEffects.push(hitEffect);
            
            console.log(`Created freeze hit effect using freeze5.png, size: ${effectSize}px, duration: ${duration}ms, alpha: 0.3`);
        }
    }

    onDestroy() {
        super.onDestroy();
        
        // Clear flame segments and stop sound when destroyed
        if (this.isFlamethrowerBoss) {
            this.clearFlameSegments();
            // Stop flamethrower sound
            if (this.game && this.game.soundManager) {
                this.game.soundManager.stopLoopingSound('flamethrower');
            }
        }
        
        // Unified death effect for enemies using destroy.png (match collision wall effect)
        if (this.game && !this._didExplosion) {
            const c = this.getCenter();
            // Slightly larger for bigger enemies
            const scale = (this.enemyType === 'heavy' || this.enemyType === 'boss' || this.isFlamethrowerBoss) ? 1.5 : 1.2;
            this.game.createExplosion(c.x, c.y, 'destroy', scale);
            this._didExplosion = true;
        }
        
        // Add score to player who killed this enemy
        if (this.target && this.target.addScore) {
            const baseScore = 100;
            const typeMultiplier = this.enemyType === 'heavy' ? 3 : this.enemyType === 'sniper' ? 2 : 1;
            this.target.addScore(baseScore * typeMultiplier);
        }
    }
}
