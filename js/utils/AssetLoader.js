class AssetLoader {
    constructor() {
        this.images = {};
        this.sounds = {};
        this.loadedAssets = 0;
        this.totalAssets = 0;
        this.onProgress = null;
        this.onComplete = null;
    }

    loadImage(name, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this.loadedAssets++;
                if (this.onProgress) {
                    this.onProgress(this.loadedAssets, this.totalAssets);
                }
                resolve(img);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${path}`);
                // Create a placeholder colored rectangle
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 32;
                canvas.height = 32;
                
                // Different colors for different asset types
                let color = '#ff0000'; // Default red
                if (name.includes('player')) color = '#00ff00';
                else if (name.includes('enemy')) color = '#ff0000';
                else if (name.includes('base')) color = '#0000ff';
                else if (name.includes('stage')) color = '#666666';
                else if (name === 'car') color = '#ffff00'; // Yellow for cars
                
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 32, 32);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, 30, 30);
                
                // Add text label
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(name.slice(0, 4), 16, 20);
                
                this.images[name] = canvas;
                this.loadedAssets++;
                if (this.onProgress) {
                    this.onProgress(this.loadedAssets, this.totalAssets);
                }
                resolve(canvas);
            };
            img.src = path;
        });
    }

    loadSound(name, path) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            let resolved = false;
            
            const finishLoad = (result) => {
                if (resolved) return;
                resolved = true;
                this.sounds[name] = result;
                this.loadedAssets++;
                if (this.onProgress) {
                    this.onProgress(this.loadedAssets, this.totalAssets);
                }
                resolve(result);
            };
            
            // Use canplay instead of canplaythrough (fires earlier)
            audio.oncanplay = () => finishLoad(audio);
            audio.oncanplaythrough = () => finishLoad(audio);
            
            audio.onerror = () => {
                console.error(`Failed to load sound: ${path}`);
                finishLoad(null);
            };
            
            // Fallback timeout - if nothing fires in 3 seconds, continue anyway
            setTimeout(() => {
                if (!resolved) {
                    console.warn(`Sound load timeout: ${path}`);
                    finishLoad(null);
                }
            }, 3000);
            
            audio.src = path;
        });
    }

    async loadAssets() {
        const assetsToLoad = [
            // Images
            { type: 'image', name: 'stage_city', path: 'data/stages/city.png' },
            { type: 'image', name: 'stage_kitchen', path: 'data/stages/kitchen.png' },
            // Player tank sprites (8 players)
            { type: 'image', name: 'tankp1', path: 'data/sprits/tankp1.png' },
            { type: 'image', name: 'tankp2', path: 'data/sprits/tankp2.png' },
            { type: 'image', name: 'tankp3', path: 'data/sprits/tankp3.png' },
            { type: 'image', name: 'tankp4', path: 'data/sprits/tankp4.png' },
            { type: 'image', name: 'tankp5', path: 'data/sprits/tankp5.png' },
            { type: 'image', name: 'tankp6', path: 'data/sprits/tankp6.png' },
            { type: 'image', name: 'tankp7', path: 'data/sprits/tankp7.png' },
            { type: 'image', name: 'tankp8', path: 'data/sprits/tankp8.png' },
            // Legacy player names for compatibility
            { type: 'image', name: 'player1', path: 'data/sprits/tankp1.png' },
            { type: 'image', name: 'player2', path: 'data/sprits/tankp2.png' },
            { type: 'image', name: 'player3', path: 'data/sprits/tankp3.png' },
            { type: 'image', name: 'enemy1', path: 'data/sprits/ai1.png' },
            { type: 'image', name: 'enemy2', path: 'data/sprits/ai2.png' },
            { type: 'image', name: 'enemy3', path: 'data/sprits/ai3.png' },
            { type: 'image', name: 'enemy4', path: 'data/sprits/ai4.png' },
            { type: 'image', name: 'base', path: 'data/collisions/base.png' },
            { type: 'image', name: 'base_destroyed', path: 'data/collisions/base-x.png' },
            { type: 'image', name: 'wall_brick', path: 'data/collisions/brick.png' },
            { type: 'image', name: 'wall_water', path: 'data/collisions/water.png' },
            { type: 'image', name: 'wall_barrel', path: 'data/collisions/barrel.png' },
            { type: 'image', name: 'wall_box', path: 'data/collisions/box.png' },
            { type: 'image', name: 'wall_fish', path: 'data/collisions/fish.png' },
            { type: 'image', name: 'wall_cup', path: 'data/collisions/cup.png' },
            { type: 'image', name: 'car', path: 'data/collisions/car.png' },
            
            // Stages
            { type: 'image', name: 'stage_city', path: 'data/stages/city.png' },
            { type: 'image', name: 'stage_island', path: 'data/stages/island.png' },
            { type: 'image', name: 'stage_kitchen', path: 'data/stages/kitchen.png' },
            { type: 'image', name: 'stage_jungle', path: 'data/stages/jungle.png' },
            
            // Menu and UI
            { type: 'image', name: 'gamename', path: 'data/collisions/gamename.png' },
            
            // Power-ups
            { type: 'image', name: 'freeze', path: 'data/powers/freeze.png' },
            { type: 'image', name: 'flame', path: 'data/powers/flame.png' },
            { type: 'image', name: 'missile', path: 'data/powers/missile.png' },
            { type: 'image', name: 'star', path: 'data/powers/star.png' },
            { type: 'image', name: 'seek-missile', path: 'data/powers/seek-missile.png' },
            { type: 'image', name: 'seek_missile', path: 'data/powers/seek-missile.png' },
            { type: 'image', name: 'laser-box', path: 'data/powers/laser-box.png' },
            
            // Normal bullet sprites
            { type: 'image', name: 'bullet_normal', path: 'data/powers/missile.png' },
            { type: 'image', name: 'bullet_enemy', path: 'data/sfx/missile.png' },
            
            // Freeze power-up sprites
            { type: 'image', name: 'freeze1', path: 'data/powers/freeze1.png' },
            { type: 'image', name: 'freeze2', path: 'data/powers/freeze2.png' },
            { type: 'image', name: 'freeze3', path: 'data/powers/freeze3.png' },
            { type: 'image', name: 'freeze4', path: 'data/powers/freeze4.png' },
            { type: 'image', name: 'freeze5', path: 'data/powers/freeze5.png' },
            { type: 'image', name: 'freeze6', path: 'data/powers/freeze6.png' },
            { type: 'image', name: 'freeze7', path: 'data/powers/freeze7.png' },
            { type: 'image', name: 'freeze8', path: 'data/powers/freeze8.png' },
            
            // Laser power-up sprites
            { type: 'image', name: 'laser1', path: 'data/powers/laser1.png' },
            { type: 'image', name: 'laser2', path: 'data/powers/laser2.png' },
            { type: 'image', name: 'laser3', path: 'data/powers/laser3.png' },
            
            // Laser hit effect sprites
            { type: 'image', name: 'laser-hit1', path: 'data/powers/laser-hit1.png' },
            { type: 'image', name: 'laser-hit2', path: 'data/powers/laser-hit2.png' },
            { type: 'image', name: 'laser-hit3', path: 'data/powers/laser-hit3.png' },
            { type: 'image', name: 'laser-hit4', path: 'data/powers/laser-hit4.png' },
            
            // Flame power-up sprites
            { type: 'image', name: 'flam1', path: 'data/powers/flam1.png' },
            { type: 'image', name: 'flam2', path: 'data/powers/flam2.png' },
            { type: 'image', name: 'flam3', path: 'data/powers/flam3.png' },
            { type: 'image', name: 'flam4', path: 'data/powers/flam4.png' },
            { type: 'image', name: 'flam5', path: 'data/powers/flam5.png' },
            { type: 'image', name: 'flam6', path: 'data/powers/flam6.png' },
            { type: 'image', name: 'flam7', path: 'data/powers/flam7.png' },
            { type: 'image', name: 'flam8', path: 'data/powers/flam8.png' },
            
            // Effects
            { type: 'image', name: 'effect_explode', path: 'data/sfx/destroy2-x.png' },
            { type: 'image', name: 'effect_destroy', path: 'data/sfx/destroy.png' },
            { type: 'image', name: 'effect_burning1', path: 'data/sfx/burning1.png' },
            { type: 'image', name: 'effect_burning2', path: 'data/sfx/burning2.png' },
            
            // Sounds
            { type: 'sound', name: 'shoot', path: 'data/sfx/canon.mp3' },
            { type: 'sound', name: 'explode', path: 'data/sfx/explode.mp3' },
            { type: 'sound', name: 'rocket_sound', path: 'data/sfx/rocket-sound.mp3' },
            { type: 'sound', name: 'flamethrower', path: 'data/sfx/flamethrower.mp3' },
            { type: 'sound', name: 'freezethrower', path: 'data/sfx/freezethrower.mp3' },
            { type: 'sound', name: 'laser_sound', path: 'data/sfx/lasersound.mp3' },
            { type: 'sound', name: 'music_stage', path: 'data/sfx/music1.mp3' },
            { type: 'sound', name: 'music_stage2', path: 'data/sfx/music2.mp3' },
            { type: 'sound', name: 'bossfight', path: 'data/sfx/bossfight1.mp3' },
            { type: 'sound', name: 'game_start', path: 'data/sfx/game-start.mp3' },
            { type: 'sound', name: 'game_intro', path: 'data/sfx/game-intro.mp3' }
        ];

        this.totalAssets = assetsToLoad.length;
        this.loadedAssets = 0;

        const loadPromises = assetsToLoad.map(asset => {
            if (asset.type === 'image') {
                return this.loadImage(asset.name, asset.path);
            } else if (asset.type === 'sound') {
                return this.loadSound(asset.name, asset.path);
            }
        });

        try {
            await Promise.all(loadPromises);
            if (this.onComplete) {
                this.onComplete();
            }
            console.log('All assets loaded successfully');
            // Auto-register sounds with global game's SoundManager if available
            if (window.game && window.game.soundManager) {
                Object.entries(this.sounds).forEach(([name, audio]) => {
                    if (audio && !window.game.soundManager.sounds[name]) {
                        window.game.soundManager.addSound(name, audio);
                        // Debug one-liner for laser only to confirm fix
                        if (name === 'laser_sound') {
                            console.log('Registered laser_sound with SoundManager');
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error loading assets:', error);
            if (this.onComplete) {
                this.onComplete();
            }
        }
    }

    getImage(name) {
        return this.images[name] || null;
    }

    getSound(name) {
        return this.sounds[name] || null;
    }

    playSound(name, volume = 1.0) {
        const sound = this.getSound(name);
        if (sound) {
            sound.volume = volume;
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Sound play failed:', e));
        }
    }

    setLoadingCallbacks(onProgress, onComplete) {
        this.onProgress = onProgress;
        this.onComplete = onComplete;
    }

    getLoadingProgress() {
        return this.totalAssets > 0 ? this.loadedAssets / this.totalAssets : 0;
    }
}
