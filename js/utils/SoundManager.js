class SoundManager {
    constructor() {
        this.sounds = {};
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.isMuted = false;
        this.currentMusic = null;
        this.currentMusicBaseVolume = 1.0; // Track the base volume for current music
        this.loopingSounds = {}; // Track looping sound effects
    }

    addSound(name, audio) {
        this.sounds[name] = audio;
    }

    playSound(name, volume = 1.0, loop = false) {
        if (this.isMuted) return;
        
        const sound = this.sounds[name];
        if (sound) {
            try {
                // Apply SFX volume scaling to the provided volume
                sound.volume = volume * this.sfxVolume;
                sound.loop = loop;
                sound.currentTime = 0;
                sound.play().catch(e => console.log('Sound play failed:', e));
            } catch (error) {
                console.log('Sound play error:', error);
            }
        }
    }

    playMusic(name, volume = 1.0, loop = true) {
        if (this.currentMusic) {
            this.stopMusic();
        }
        
        if (this.isMuted) return;
        
        const music = this.sounds[name];
        if (music) {
            try {
                // Store the base volume and apply music volume scaling
                this.currentMusicBaseVolume = volume;
                music.volume = volume * this.musicVolume;
                music.loop = loop;
                music.currentTime = 0;
                music.play().catch(e => console.log('Music play failed:', e));
                this.currentMusic = music;
            } catch (error) {
                console.log('Music play error:', error);
            }
        }
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
            this.currentMusicBaseVolume = 1.0;
        }
    }

    pauseMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
        }
    }

    resumeMusic() {
        if (this.currentMusic && this.currentMusic.paused && !this.isMuted) {
            this.currentMusic.play().catch(e => console.log('Music resume failed:', e));
        }
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.currentMusic) {
            // Apply the new music volume to the current music using its base volume
            this.currentMusic.volume = this.currentMusicBaseVolume * this.musicVolume;
        }
    }

    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.pauseMusic();
        } else {
            this.resumeMusic();
        }
    }

    isMusicPlaying() {
        return this.currentMusic && !this.currentMusic.paused;
    }

    startLoopingSound(name, volume = 1.0) {
        console.log(`Attempting to start looping sound: ${name}, muted: ${this.isMuted}, already playing: ${!!this.loopingSounds[name]}`);
        
        if (this.isMuted || this.loopingSounds[name]) return;
        
        const sound = this.sounds[name];
        console.log(`Sound ${name} found:`, !!sound, sound ? 'loaded' : 'not loaded');
        
        if (sound) {
            try {
                sound.volume = volume * this.sfxVolume;
                sound.loop = true;
                sound.currentTime = 0;
                console.log(`Playing sound ${name} with volume:`, sound.volume);
                sound.play().catch(e => console.log('Looping sound play failed:', e));
                this.loopingSounds[name] = sound;
                console.log(`Sound ${name} added to looping sounds`);
            } catch (error) {
                console.log('Looping sound play error:', error);
            }
        } else {
            console.warn(`Sound ${name} not found in loaded sounds. Available sounds:`, Object.keys(this.sounds));
        }
    }

    stopLoopingSound(name) {
        console.log(`Attempting to stop looping sound: ${name}`);
        const sound = this.loopingSounds[name];
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
            delete this.loopingSounds[name];
            console.log(`Sound ${name} stopped and removed from looping sounds`);
        } else {
            console.log(`Sound ${name} was not in looping sounds`);
        }
    }

    stopAllLoopingSounds() {
        for (let name in this.loopingSounds) {
            this.stopLoopingSound(name);
        }
    }
}
