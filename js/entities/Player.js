class Player extends Tank {
    constructor(x, y, playerIndex = 0) {
        super(x, y);
        
        this.playerIndex = playerIndex;
        this.lives = 4; // Increased to 4 lives
        this.score = 0;
        this.respawning = false;
        this.respawnTime = 0;
        this.respawnDuration = 3000; // 3 seconds
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.invulnerabilityDuration = 2000; // 2 seconds after respawn
        
        // Single bullet system
        this.activeBullet = null;
        
        // Store spawn point
        this.spawnPoint = { x: x, y: y };
        
        // Player-specific stats
        this.maxHealth = 1;
        this.health = this.maxHealth;
        this.speed = 90;
        this.originalSpeed = 90; // Store original speed
        this.fireRate = 400;
        this.originalFireRate = 400; // Store original fire rate
        this.bulletType = 'normal'; // Default bullet type
        
        // Visual
        this.playerColors = ['#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#ff8800', '#00ffff', '#8800ff', '#ff0088'];
        this.tankColor = this.playerColors[playerIndex % this.playerColors.length];
        
        // Controls
        this.controls = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false
        };
        
        // Collision - players can move through base area
        this.collisionLayer = 'player';
        this.collisionMask = ['wall', 'enemy', 'enemyBullet', 'powerup'];
        // Note: playerBullet will be added to collision mask if friendly fire is enabled
        
        // Set sprite based on player index - support for 8 players
        this.spriteNames = ['tankp1', 'tankp2', 'tankp3', 'tankp4', 'tankp5', 'tankp6', 'tankp7', 'tankp8'];
        this.spriteName = this.spriteNames[playerIndex % this.spriteNames.length];
        
        // Spawn effect
        this.spawnEffect = {
            active: true,
            duration: 1000,
            startTime: Date.now()
        };

    // Laser power-up state
    this.laserEnabled = false; // Granted by picking up laser power-up
    this.laserActive = false;  // True while beam is firing
    this.laserEndTime = 0;     // When current beam auto-stops
    this.laserCooldownEnd = 0; // When we can fire again after beam
    this.laserDamageInterval = 750; // ms between damage ticks (reduced damage by 80% from 150ms to 750ms)
    this.lastLaserDamageTime = 0;   // last tick time
    this.laserMaxDuration = 5000;   // ms match exact sound length
    this.laserSoundDuration = 5000; // reference for sync
    this.laserCooldown = 3000;      // ms (reduced from 6 seconds to 3 seconds)
    this.laserMaxDistance = 800;    // px
    this.laserFrameRate = 12;       // fps for beam tiles
    this.laserHitFrameRate = 12;    // fps for hit effect animation speed
    this.laserRecentlyStopped = 0;  // debounce to prevent rapid restart
    this.laserMinActiveDuration = 300; // ms minimal visible duration to avoid flicker
    }

    update(deltaTime) {
        // Handle respawning
        if (this.respawning) {
            this.updateRespawn(deltaTime);
            return;
        }
        
        // Handle invulnerability
        if (this.invulnerable) {
            this.invulnerabilityTime -= deltaTime * 1000;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update power-ups
        this.updatePowerUps();

    // Handle laser input/state separate from bullet firing
    this.updateLaserState();
        
        // Update spawn effect
        if (this.spawnEffect.active) {
            if (Date.now() - this.spawnEffect.startTime > this.spawnEffect.duration) {
                this.spawnEffect.active = false;
            }
        }
        
        // Process input and update movement
        this.processInput();
        
        super.update(deltaTime);
    }

    updateLaserState() {
        const now = Date.now();
        if (!this.laserEnabled) return;

        // Start beam if holding fire, not active, and off cooldown
        if (!this.laserActive && this.controls.fire && now >= this.laserCooldownEnd && (now - this.laserRecentlyStopped) > 250) {
            this.laserActive = true;
            this.laserEndTime = now + this.laserMaxDuration; // align to sound
            this.lastLaserDamageTime = 0; // force immediate tick on start
            
            // Play laser sound ONCE (no looping)
            if (window.game && window.game.soundManager) {
                const sm = window.game.soundManager;
                const ls = sm.sounds['laser_sound'];
                console.log('Laser activation: sound present =', !!ls);
                if (!ls) {
                    // Attempt late registration from assetLoader if exists
                    if (window.game.assetLoader) {
                        const loaded = window.game.assetLoader.getSound('laser_sound');
                        if (loaded) {
                            sm.addSound('laser_sound', loaded);
                            console.log('Late-registered laser_sound from assetLoader');
                        }
                    }
                }
                // Use normal playSound so it does not loop
                sm.playSound('laser_sound', 0.55, false);
            }
        }

        if (this.laserActive) {
            const startTime = this.laserEndTime - this.laserMaxDuration;
            const activeElapsed = now - startTime;
            // Stop if released (after min duration) or timed out
            if ((now >= this.laserEndTime) || (!this.controls.fire && activeElapsed >= this.laserMinActiveDuration)) {
                this.laserActive = false;
                this.laserCooldownEnd = now + this.laserCooldown;
                this.laserRecentlyStopped = now;
                
                // No looping sound to stop (single-shot)
                return;
            }

            // Apply periodic damage to first hit entity
            if (this.lastLaserDamageTime === 0 || now - this.lastLaserDamageTime >= this.laserDamageInterval) {
                const hit = this.computeLaserHit();
                if (hit && hit.entity && hit.entity.alive) {
                    // Don't damage players (no friendly fire)
                    if (!(hit.entity instanceof Player)) {
                        if (typeof hit.entity.takeDamage === 'function') {
                            hit.entity.takeDamage(1);
                        }
                    }
                }
                this.lastLaserDamageTime = now;
            }
        }
    }

    processInput() {
        let moveDir = new Vector2D(0, 0);
        
        // 4-directional movement only - prioritize the first pressed direction
        if (this.controls.up && !this.controls.down && !this.controls.left && !this.controls.right) {
            moveDir.y -= 1;
        } else if (this.controls.down && !this.controls.up && !this.controls.left && !this.controls.right) {
            moveDir.y += 1;
        } else if (this.controls.left && !this.controls.up && !this.controls.down && !this.controls.right) {
            moveDir.x -= 1;
        } else if (this.controls.right && !this.controls.up && !this.controls.down && !this.controls.left) {
            moveDir.x += 1;
        } else if (this.controls.up || this.controls.down || this.controls.left || this.controls.right) {
            // If multiple keys are pressed, prioritize vertical movement first
            if (this.controls.up) {
                moveDir.y -= 1;
            } else if (this.controls.down) {
                moveDir.y += 1;
            } else if (this.controls.left) {
                moveDir.x -= 1;
            } else if (this.controls.right) {
                moveDir.x += 1;
            }
        }
        
        this.setMoveDirection(moveDir);
    }

    updateRespawn(deltaTime) {
        this.respawnTime -= deltaTime * 1000;
        if (this.respawnTime <= 0) {
            this.completeRespawn();
        }
    }

    setControls(controls) {
        this.controls = { ...this.controls, ...controls };
    }

    attemptFire() {
        if (this.respawning || !this.controls.fire) return null;

        // If laser currently firing, no bullets
        if (this.laserActive) return null;

        // If laser enabled: any press while ready triggers laser (handled in updateLaserState) and suppresses bullets until released
        if (this.laserEnabled) {
            const now = Date.now();
            if (this.controls.fire && now >= this.laserCooldownEnd) return null; // will become laser this frame
            if (this.laserActive) return null; // beam running
        }

        // Fire (may be normal, freeze, flame, rapid fire modified, etc.)
        return this.fire();
    }

    takeDamage(amount) {
        if (this.invulnerable || this.respawning) return;
        
        // Debug infinite health check
        if (this.infiniteHealth) {
            console.log('Damage blocked by infinite health');
            return;
        }
        
        // Don't call super.takeDamage() to avoid automatic destroy()
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            // Don't destroy - start respawn instead
            this.startRespawn();
        } else {
            // Brief invulnerability after taking damage
            this.invulnerable = true;
            this.invulnerabilityTime = 500;
        }
        
        this.onTakeDamage(amount);
    }

    startRespawn() {
        this.lives--;
        console.log(`Player ${this.playerIndex} died. Lives remaining: ${this.lives}`);
        this.respawning = true;
        this.respawnTime = this.respawnDuration;
        this.visible = false;
        this.solid = false;
        
        // Reset all power-ups on death
        this.resetPowerUps();
        
        // Reset position to spawn point
        this.resetToSpawnPoint();
    }

    completeRespawn() {
        if (this.lives <= 0) {
            // Game over for this player
            console.log(`Player ${this.playerIndex} game over - no lives left`);
            this.alive = false;
            return;
        }
        
        // Successfully respawned
        console.log(`Player ${this.playerIndex} respawned with ${this.lives} lives remaining`);
        this.alive = true;
        this.respawning = false;
        this.visible = true;
        this.solid = true;
        this.health = this.maxHealth;
        this.invulnerable = true;
        this.invulnerabilityTime = this.invulnerabilityDuration;
        
        // Restart spawn effect
        this.spawnEffect.active = true;
        this.spawnEffect.startTime = Date.now();
    }

    resetToSpawnPoint() {
        // Reset to original spawn position
        this.setPosition(this.spawnPoint.x, this.spawnPoint.y);
        this.direction = 0; // Face up
        this.facing = 0;
        this.rotation = 0;
        this.velocity = new Vector2D(0, 0);
    }

    addScore(points) {
        this.score += points;
    }

    collectPowerUp(powerUpType) {
        switch (powerUpType) {
            case 'rapidFire':
                this.activatePowerUp('rapidFire', 15000);
                this.addScore(100);
                break;
            case 'shield':
                this.activatePowerUp('shield', 10000);
                this.addScore(150);
                break;
            case 'speed':
                this.activatePowerUp('speed', 12000);
                this.addScore(100);
                break;
            case 'extraLife':
                this.lives++;
                this.addScore(500);
                break;
        }
    }

    // Activate power-up effect
    activatePowerUp(type, duration) {
        console.log(`Player ${this.playerIndex + 1} activated ${type} power-up for ${duration === -1 ? 'until death' : duration + 'ms'}`);
        
        switch (type) {
            case 'freeze':
                // Switching to freeze disables laser & flame
                if (this.laserActive) {
                    this.laserActive = false;
                    if (window.game?.soundManager) window.game.soundManager.stopLoopingSound('laser_sound');
                }
                this.laserEnabled = false;
                if (this.flamePowerUp) this.flamePowerUp.active = false;
                this.freezePowerUp = {
                    active: true,
                    endTime: duration === -1 ? -1 : Date.now() + duration, // -1 = permanent until death
                    type: 'freeze'
                };
                this.bulletType = 'freeze'; // Switch to freeze bullets
                break;
            case 'flame':
                // Switching to flame disables laser & freeze
                if (this.laserActive) {
                    this.laserActive = false;
                    if (window.game?.soundManager) window.game.soundManager.stopLoopingSound('laser_sound');
                }
                this.laserEnabled = false;
                if (this.freezePowerUp) this.freezePowerUp.active = false;
                this.flamePowerUp = {
                    active: true,
                    endTime: duration === -1 ? -1 : Date.now() + duration, // -1 = permanent until death
                    type: 'flame'
                };
                this.bulletType = 'flame'; // Switch to flame bullets
                break;
            case 'laser':
                // Laser is its own firing mode; keep normal bullet type unchanged.
                // Grant ability until death when duration === -1
                // Disable other weapon types
                if (this.freezePowerUp) this.freezePowerUp.active = false;
                if (this.flamePowerUp) this.flamePowerUp.active = false;
                if (this.bulletType !== 'normal') this.bulletType = 'normal';
                this.laserEnabled = true;
                // Reset cooldown so it can be used immediately on pickup
                this.laserCooldownEnd = 0;
                break;
            case 'rapidFire':
                this.rapidFirePowerUp = {
                    active: true,
                    endTime: Date.now() + duration,
                    type: 'rapidFire'
                };
                this.fireRate *= 3; // Increase fire rate
                break;
            case 'shield':
                this.shieldPowerUp = {
                    active: true,
                    endTime: Date.now() + duration,
                    type: 'shield'
                };
                this.invulnerable = true;
                break;
            case 'speed':
                this.speedPowerUp = {
                    active: true,
                    endTime: Date.now() + duration,
                    type: 'speed'
                };
                this.speed *= 1.5; // Increase movement speed
                break;
            case 'invincible':
                this.invinciblePowerUp = {
                    active: true,
                    endTime: Date.now() + duration,
                    type: 'invincible'
                };
                this.invulnerable = true;
                break;
        }
    }

    // Update active power-ups and handle expiration
    updatePowerUps() {
        const now = Date.now();
        
        // Check freeze power-up (only expire if not permanent)
        if (this.freezePowerUp && this.freezePowerUp.active && this.freezePowerUp.endTime !== -1) {
            if (now >= this.freezePowerUp.endTime) {
                console.log(`Player ${this.playerIndex + 1} freeze power-up expired`);
                this.freezePowerUp.active = false;
                this.bulletType = 'normal'; // Reset to normal bullets
            }
        }
        
        // Check flame power-up (only expire if not permanent)
        if (this.flamePowerUp && this.flamePowerUp.active && this.flamePowerUp.endTime !== -1) {
            if (now >= this.flamePowerUp.endTime) {
                console.log(`Player ${this.playerIndex + 1} flame power-up expired`);
                this.flamePowerUp.active = false;
                this.bulletType = 'normal'; // Reset to normal bullets
            }
        }
        
        // Check rapid fire power-up
        if (this.rapidFirePowerUp && this.rapidFirePowerUp.active) {
            if (now >= this.rapidFirePowerUp.endTime) {
                console.log(`Player ${this.playerIndex + 1} rapid fire power-up expired`);
                this.rapidFirePowerUp.active = false;
                this.fireRate = this.originalFireRate || 250; // Reset fire rate
            }
        }
        
        // Check shield power-up
        if (this.shieldPowerUp && this.shieldPowerUp.active) {
            if (now >= this.shieldPowerUp.endTime) {
                console.log(`Player ${this.playerIndex + 1} shield power-up expired`);
                this.shieldPowerUp.active = false;
                this.invulnerable = false; // Remove invulnerability
            }
        }
        
        // Check speed power-up
        if (this.speedPowerUp && this.speedPowerUp.active) {
            if (now >= this.speedPowerUp.endTime) {
                console.log(`Player ${this.playerIndex + 1} speed power-up expired`);
                this.speedPowerUp.active = false;
                this.speed = this.originalSpeed || 100; // Reset speed
            }
        }
        
        // Check invincible power-up
        if (this.invinciblePowerUp && this.invinciblePowerUp.active) {
            if (now >= this.invinciblePowerUp.endTime) {
                console.log(`Player ${this.playerIndex + 1} invincible power-up expired`);
                this.invinciblePowerUp.active = false;
                this.invulnerable = false; // Remove invulnerability
            }
        }

    // Laser persists until death (duration handled by firing window),
    // no timer expiration here.
    }

    // Reset all power-ups (called on death)
    resetPowerUps() {
        console.log(`Player ${this.playerIndex + 1} power-ups reset on death`);
        
        // Reset freeze power-up
        if (this.freezePowerUp) {
            this.freezePowerUp.active = false;
        }
        
        // Reset flame power-up
        if (this.flamePowerUp) {
            this.flamePowerUp.active = false;
        }
        
        // Reset rapid fire power-up
        if (this.rapidFirePowerUp) {
            this.rapidFirePowerUp.active = false;
            this.fireRate = this.originalFireRate || 250;
        }
        
        // Reset shield power-up
        if (this.shieldPowerUp) {
            this.shieldPowerUp.active = false;
            this.invulnerable = false;
        }
        
        // Reset speed power-up
        if (this.speedPowerUp) {
            this.speedPowerUp.active = false;
            this.speed = this.originalSpeed || 90;
        }
        
        // Reset invincible power-up
        if (this.invinciblePowerUp) {
            this.invinciblePowerUp.active = false;
            this.invulnerable = false;
        }
        
        // Reset bullet type to normal
        this.bulletType = 'normal';

        // Reset laser state
        this.laserEnabled = false;
        this.laserActive = false;
        this.laserEndTime = 0;
        this.laserCooldownEnd = 0;
        this.lastLaserDamageTime = 0;
        
        // Stop laser sound if it's playing
        if (window.game && window.game.soundManager) {
            window.game.soundManager.stopLoopingSound('laser_sound');
        }
    }

    // Check if any power-up is currently active
    hasActivePowerUp() {
    // This method now reflects any enhancement buffs but excludes weapon types (freeze/flame) from blocking logic
    return (this.shieldPowerUp && this.shieldPowerUp.active) ||
           (this.speedPowerUp && this.speedPowerUp.active) ||
           (this.invinciblePowerUp && this.invinciblePowerUp.active) ||
           (this.laserEnabled) ||
           (this.bulletType !== 'normal');
    }

    render(ctx, camera = { x: 0, y: 0 }) {
        if (!this.visible && !this.respawning) return;
        
        // Handle invulnerability flashing
        if (this.invulnerable) {
            const flashRate = 200;
            const flashVisible = Math.floor(Date.now() / flashRate) % 2 === 0;
            if (!flashVisible) return;
        }
        
        // Respawn countdown
        if (this.respawning) {
            this.renderRespawnCountdown(ctx, camera);
            return;
        }
        
        // Spawn effect
        if (this.spawnEffect.active) {
            this.renderSpawnEffect(ctx, camera);
        }
        
        super.render(ctx, camera);
        
        // Render player indicator
        this.renderPlayerIndicator(ctx, camera);

        // Render laser beam and hit effect if active
        if (this.laserActive && this.laserEnabled) {
            this.renderLaser(ctx, camera);
        }
    }

    renderRespawnCountdown(ctx, camera) {
        const gameWidth = 800;
        const gameHeight = 600;
        const centerX = gameWidth / 2;
        const centerY = gameHeight - 150;
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = this.tankColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        
        const countdown = Math.ceil(this.respawnTime / 1000);
        const text = `Player ${this.playerIndex + 1} respawning in ${countdown}`;
        
        ctx.strokeText(text, centerX, centerY);
        ctx.fillText(text, centerX, centerY);
        ctx.restore();
    }

    renderSpawnEffect(ctx, camera) {
        const progress = (Date.now() - this.spawnEffect.startTime) / this.spawnEffect.duration;
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = this.tankColor;
        ctx.lineWidth = 3;
        
        // Expanding circle effect
        const radius = progress * 50;
        ctx.beginPath();
        ctx.arc(
            screenX + this.size.x / 2,
            screenY + this.size.y / 2,
            radius,
            0, Math.PI * 2
        );
        ctx.stroke();
        
        // Sparkle effects
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + progress * Math.PI * 2;
            const sparkleX = screenX + this.size.x / 2 + Math.cos(angle) * radius * 0.7;
            const sparkleY = screenY + this.size.y / 2 + Math.sin(angle) * radius * 0.7;
            
            ctx.fillStyle = this.tankColor;
            ctx.fillRect(sparkleX - 2, sparkleY - 2, 4, 4);
        }
        
        ctx.restore();
    }

    renderPlayerIndicator(ctx, camera) {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y;
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = this.tankColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        
        const text = `P${this.playerIndex + 1}`;
        const textX = screenX + this.size.x / 2;
        const textY = screenY - 5;
        
        ctx.strokeText(text, textX, textY);
        ctx.fillText(text, textX, textY);
        ctx.restore();
    }

    isGameOver() {
        return !this.alive && this.lives <= 0;
    }

    resetForNewGame() {
        this.lives = 4; // Updated to 4 lives
        this.score = 0;
        this.health = this.maxHealth;
        this.alive = true;
        this.respawning = false;
        this.invulnerable = false;
        this.visible = true;
        this.solid = true;
        this.resetToSpawnPoint();
        
        // Reset power-ups
        this.powerUps = {
            rapidFire: false,
            piercing: false,
            shield: false,
            speed: false
        };
        this.powerUpTimers = {};
        this.fireRate = 400;
        this.speed = 90;
        
        // Reset spawn effect
        this.spawnEffect.active = true;
        this.spawnEffect.startTime = Date.now();
    }

    // Compute the first hit (entity and point) along current facing
    computeLaserHit() {
        if (!window.game || !window.game.collisionSystem) return null;
        const dir = this.getDirectionVector(this.facing);
        const start = this.getCenter().add(dir.multiply(this.barrelLength));
        const hits = window.game.collisionSystem.raycast(start, dir, this.laserMaxDistance);
        // Filter out self and non-blocking types
        const ffPlayers = window.game?.friendlyFirePlayers;
        const valid = hits.find(h => h.entity !== this && h.entity.alive && (
            (h.entity instanceof Tank && (!(h.entity instanceof Player) || ffPlayers)) ||
            h.entity.collisionLayer === 'wall' ||
            h.entity instanceof Base
        ));
        if (!valid) {
            return { entity: null, point: start.add(dir.multiply(this.laserMaxDistance)), distance: this.laserMaxDistance };
        }
        // Approximate hit point along the ray by clamping to distance
        const endPoint = start.add(dir.multiply(valid.distance));
        return { entity: valid.entity, point: endPoint, distance: valid.distance };
    }

    renderLaser(ctx, camera) {
        const dir = this.getDirectionVector(this.facing);
    // Offset start further so beam doesn't visually cover the tank body
    const start = this.getCenter().add(dir.multiply(this.barrelLength + 12));
        const hits = window.game?.collisionSystem?.raycast(start, dir, this.laserMaxDistance) || [];
        const ffPlayers = window.game?.friendlyFirePlayers;
        // Build list of impact targets (all sprites / solids) honoring friendly fire for players
        const impactTargets = [];
        for (const h of hits) {
            if (!h.entity || !h.entity.alive) continue;
            if (h.entity === this) continue;
            const isPlayer = h.entity instanceof Player;
            if (isPlayer && !ffPlayers) continue; // skip players if FF off
            impactTargets.push(h);
            // Continue collecting; if walls should block further effects, break here instead
        }
        const endPoint = hits.length ? start.add(dir.multiply(hits[0].distance)) : start.add(dir.multiply(this.laserMaxDistance));
        // Beam growth/shrink synced to sound duration: ease-in grow, sustain, ease-out taper
        const now = Date.now();
        const total = this.laserMaxDuration;
        const startTime = this.laserEndTime - total;
        const elapsed = Math.max(0, now - startTime);
        const progress = Math.min(1, elapsed / total);

    // Phases tuned for 5s: Grow 10% (0.5s), Sustain 70% (3.5s), Fade 20% (1s)
    const growPhase = 0.10;
    const fadePhase = 0.20;
        const sustainPhaseStart = growPhase;
        const sustainPhaseEnd = 1 - fadePhase;
        let sizeMultiplier;
        if (progress < growPhase) {
            // Ease-out cubic on grow (fast then settle)
            const t = progress / growPhase;
            sizeMultiplier = 1 - Math.pow(1 - t, 3);
        } else if (progress < sustainPhaseEnd) {
            sizeMultiplier = 1; // Full size
        } else {
            // Ease-in cubic fade (slow then faster shrink)
            const t = (progress - sustainPhaseEnd) / fadePhase; // 0..1
            sizeMultiplier = 1 - Math.pow(t, 3);
        }

    const minBeamSize = 3;
    const maxBeamSize = 48; // slimmer so it doesn't engulf the tank
        const currentBeamSize = minBeamSize + (maxBeamSize - minBeamSize) * Math.max(0, sizeMultiplier);

        // Choose current beam frame
        const beamFrames = ['laser1', 'laser2', 'laser3'];
        const frameIdx = Math.floor((Date.now() / (1000 / this.laserFrameRate))) % beamFrames.length;
        const beamSprite = window.game?.assetLoader?.getImage(beamFrames[frameIdx]);

        // Draw the beam as overlapping segments to eliminate gaps
        const segmentLength = 24; // Smaller segments for smoother appearance
        const segmentOverlap = 8; // Overlap segments to eliminate gaps
        const effectiveSegmentLength = segmentLength - segmentOverlap;
        const totalLength = start.distanceTo(endPoint);
        const steps = Math.max(1, Math.ceil(totalLength / effectiveSegmentLength));
        const angle = Math.atan2(dir.y, dir.x);

        ctx.save();
        
        // First, draw a continuous background beam for seamless appearance
        ctx.strokeStyle = '#004466';
        ctx.lineWidth = currentBeamSize * 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x - camera.x, start.y - camera.y);
        ctx.lineTo(endPoint.x - camera.x, endPoint.y - camera.y);
        ctx.stroke();
        
        // Then draw the main beam
        ctx.strokeStyle = '#0088cc';
        ctx.lineWidth = currentBeamSize;
        ctx.beginPath();
        ctx.moveTo(start.x - camera.x, start.y - camera.y);
        ctx.lineTo(endPoint.x - camera.x, endPoint.y - camera.y);
        ctx.stroke();
        
        // Finally, add the bright center line
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = currentBeamSize * 0.3;
        ctx.beginPath();
        ctx.moveTo(start.x - camera.x, start.y - camera.y);
        ctx.lineTo(endPoint.x - camera.x, endPoint.y - camera.y);
        ctx.stroke();
        
        // Use additive blending for animated texture overlay
        ctx.globalCompositeOperation = 'lighter';
        
        for (let i = 0; i < steps; i++) {
            const t = (i * effectiveSegmentLength) / totalLength;
            if (t > 1) break; // Don't go beyond the end point
            
            const pos = new Vector2D(
                start.x + (endPoint.x - start.x) * t,
                start.y + (endPoint.y - start.y) * t
            );
            const screenX = pos.x - camera.x;
            const screenY = pos.y - camera.y;
            
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(angle);
            
            if (beamSprite) {
                ctx.globalAlpha = 0.6; // More transparent for texture overlay
                ctx.drawImage(beamSprite, 0, -currentBeamSize / 2, segmentLength, currentBeamSize);
            }
            ctx.restore();
        }
        
        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';

        // Render hit effects for every impact target
        if (impactTargets.length) {
            const hitFrames = ['laser-hit1', 'laser-hit2', 'laser-hit3', 'laser-hit4'];
            const hitIdx = Math.floor((Date.now() / (1000 / this.laserHitFrameRate))) % hitFrames.length;
            const hitSprite = window.game?.assetLoader?.getImage(hitFrames[hitIdx]);
            for (const h of impactTargets) {
                const ent = h.entity;
                const entCenter = ent.getCenter ? ent.getCenter() : new Vector2D(ent.position.x + ent.size.x/2, ent.position.y + ent.size.y/2);
                const hx = entCenter.x - camera.x;
                const hy = entCenter.y - camera.y;
                let hitEffectSize = 32;
                if (ent.size) {
                    hitEffectSize = Math.max(ent.size.x, ent.size.y) + 16;
                }
                ctx.save();
                ctx.translate(hx, hy);
                if (hitSprite) {
                    ctx.drawImage(hitSprite, -hitEffectSize / 2, -hitEffectSize / 2, hitEffectSize, hitEffectSize);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(0, 0, hitEffectSize / 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        ctx.restore();
    }
}
