window.STS = window.STS || {};

STS.Audio = {
    context: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    currentMusic: null,
    initialized: false,
    musicVolume: 0.4,
    sfxVolume: 0.6,
    _musicNodes: [],

    init() {
        if (this.initialized) return;
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.sfxGain = this.context.createGain();

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);

        this.musicGain.gain.value = this.musicVolume;
        this.sfxGain.gain.value = this.sfxVolume;
        this.initialized = true;
    },

    _ensureContext() {
        if (!this.initialized) this.init();
        if (this.context.state === 'suspended') this.context.resume();
    },

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.05);
        }
    },

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.context.currentTime, 0.05);
        }
    },

    // ─── Music ─────────────────────────────────────────────────────

    playMusic(trackId) {
        this._ensureContext();
        this.stopMusic(0.5);

        this.currentMusic = trackId;
        switch (trackId) {
            case 'combat': this.generateCombatMusic(); break;
            case 'boss': this.generateBossMusic(); break;
            case 'menu': this.generateMenuMusic(); break;
            case 'rest': this.generateRestMusic(); break;
            default: this.generateMenuMusic();
        }
    },

    stopMusic(fadeTime) {
        const fade = fadeTime || 1.0;
        const now = this.context ? this.context.currentTime : 0;
        this._musicNodes.forEach(node => {
            try {
                if (node.gain) {
                    node.gain.gain.setTargetAtTime(0, now, fade / 3);
                } else if (node.stop) {
                    node.stop(now + fade);
                }
            } catch (e) { /* already stopped */ }
        });
        setTimeout(() => {
            this._musicNodes.forEach(node => {
                try { if (node.stop) node.stop(); } catch (e) {}
                try { if (node.disconnect) node.disconnect(); } catch (e) {}
            });
            this._musicNodes = [];
        }, fade * 1000 + 200);
        this.currentMusic = null;
    },

    // ─── Sound Effects ─────────────────────────────────────────────

    play(soundId) {
        this._ensureContext();
        switch (soundId) {
            case 'attack': this.generateAttackSound(); break;
            case 'block': this.generateBlockSound(); break;
            case 'heal': this.generateHealSound(); break;
            case 'damage': this.generateDamageSound(); break;
            case 'poison': this.generatePoisonSound(); break;
            case 'cardDraw': this.generateCardDrawSound(); break;
            case 'cardPlayAttack': this.generateCardPlaySound('ATTACK'); break;
            case 'cardPlaySkill': this.generateCardPlaySound('SKILL'); break;
            case 'cardPlayPower': this.generateCardPlaySound('POWER'); break;
            case 'buttonClick': this.generateButtonClickSound(); break;
            case 'coin': this.generateCoinSound(); break;
            case 'death': this.generateDeathSound(); break;
            case 'victory': this.generateVictorySound(); break;
            case 'defeat': this.generateDefeatSound(); break;
            case 'relic': this.generateRelicSound(); break;
            case 'potion': this.generatePotionSound(); break;
            case 'upgrade': this.generateUpgradeSound(); break;
            case 'turnStart': this.generateTurnStartSound(); break;
            case 'mapNode': this.generateMapNodeSound(); break;
            default: this.generateButtonClickSound();
        }
    },

    // ─── Helpers ───────────────────────────────────────────────────

    createNoiseBuffer(duration) {
        const bufferSize = Math.floor(this.context.sampleRate * duration);
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        return source;
    },

    createReverb(duration, decay) {
        const sampleRate = this.context.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const impulse = this.context.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        const convolver = this.context.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    },

    _playTone(freq, type, duration, startTime, gainValue, destination) {
        const t = startTime || this.context.currentTime;
        const dest = destination || this.sfxGain;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(gainValue || 0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + duration);
        return { osc, gain };
    },

    _createFilter(type, frequency, q) {
        const filter = this.context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        if (q !== undefined) filter.Q.value = q;
        return filter;
    },

    // ─── Procedural Sound Generators ───────────────────────────────

    generateAttackSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);

        const noise = this.createNoiseBuffer(0.1);
        const noiseGain = this.context.createGain();
        noiseGain.gain.setValueAtTime(0.2, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        const hpFilter = this._createFilter('highpass', 800, 1);
        noise.connect(hpFilter);
        hpFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.1);
    },

    generateBlockSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Metallic clang
        const osc1 = this.context.createOscillator();
        const gain1 = this.context.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(800, t);
        osc1.frequency.exponentialRampToValueAtTime(400, t + 0.08);
        gain1.gain.setValueAtTime(0.2, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        const reverb = this.createReverb(0.3, 2);
        osc1.connect(gain1);
        gain1.connect(reverb);
        reverb.connect(this.sfxGain);
        osc1.start(t);
        osc1.stop(t + 0.15);

        // Filtered noise layer
        const noise = this.createNoiseBuffer(0.08);
        const noiseGain = this.context.createGain();
        const bpFilter = this._createFilter('bandpass', 2000, 3);
        noiseGain.gain.setValueAtTime(0.15, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        noise.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.08);

        // High harmonic ping
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1200, t);
        gain2.gain.setValueAtTime(0.1, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc2.connect(gain2);
        gain2.connect(reverb);
        osc2.start(t);
        osc2.stop(t + 0.12);
    },

    generateHealSound() {
        this._ensureContext();
        const t = this.context.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

        const reverb = this.createReverb(0.6, 2.5);
        reverb.connect(this.sfxGain);

        notes.forEach((freq, i) => {
            const start = t + i * 0.1;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15, start + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.connect(gain);
            gain.connect(reverb);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    },

    generateDamageSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Low thud
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);

        // Impact noise burst
        const noise = this.createNoiseBuffer(0.08);
        const noiseGain = this.context.createGain();
        const lpFilter = this._createFilter('lowpass', 600, 1);
        noiseGain.gain.setValueAtTime(0.25, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        noise.connect(lpFilter);
        lpFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.08);

        // Distortion hit
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, t);
        osc2.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        gain2.gain.setValueAtTime(0.15, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(t);
        osc2.stop(t + 0.1);
    },

    generatePoisonSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Bubbly effect with modulated oscillator
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const lfo = this.context.createOscillator();
        const lfoGain = this.context.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(12, t);
        lfoGain.gain.setValueAtTime(100, t);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.4);
        lfo.start(t);
        lfo.stop(t + 0.4);

        // Drip sound
        const drip = this.context.createOscillator();
        const dripGain = this.context.createGain();
        drip.type = 'sine';
        drip.frequency.setValueAtTime(1200, t + 0.15);
        drip.frequency.exponentialRampToValueAtTime(200, t + 0.25);
        dripGain.gain.setValueAtTime(0.1, t + 0.15);
        dripGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        drip.connect(dripGain);
        dripGain.connect(this.sfxGain);
        drip.start(t + 0.15);
        drip.stop(t + 0.25);
    },

    generateCardDrawSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Fast swoosh with filtered noise
        const noise = this.createNoiseBuffer(0.12);
        const noiseGain = this.context.createGain();
        const bpFilter = this._createFilter('bandpass', 3000, 0.8);

        bpFilter.frequency.setValueAtTime(2000, t);
        bpFilter.frequency.exponentialRampToValueAtTime(5000, t + 0.06);
        bpFilter.frequency.exponentialRampToValueAtTime(1500, t + 0.12);

        noiseGain.gain.setValueAtTime(0.001, t);
        noiseGain.gain.linearRampToValueAtTime(0.12, t + 0.03);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        noise.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.12);

        // Subtle pitch variation for feel
        const osc = this.context.createOscillator();
        const oscGain = this.context.createGain();
        osc.type = 'sine';
        const baseFreq = 800 + Math.random() * 400;
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.06);
        oscGain.gain.setValueAtTime(0.04, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
    },

    generateCardPlaySound(cardType) {
        this._ensureContext();
        const t = this.context.currentTime;

        switch (cardType) {
            case 'ATTACK': {
                // Whoosh + impact
                const noise = this.createNoiseBuffer(0.2);
                const nGain = this.context.createGain();
                const bp = this._createFilter('bandpass', 1500, 1.5);
                bp.frequency.setValueAtTime(800, t);
                bp.frequency.exponentialRampToValueAtTime(3000, t + 0.1);
                bp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
                nGain.gain.setValueAtTime(0.001, t);
                nGain.gain.linearRampToValueAtTime(0.18, t + 0.05);
                nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                noise.connect(bp);
                bp.connect(nGain);
                nGain.connect(this.sfxGain);
                noise.start(t);
                noise.stop(t + 0.2);

                // Low frequency thud
                const thud = this.context.createOscillator();
                const thudGain = this.context.createGain();
                thud.type = 'sine';
                thud.frequency.setValueAtTime(80, t + 0.08);
                thud.frequency.exponentialRampToValueAtTime(30, t + 0.2);
                thudGain.gain.setValueAtTime(0.25, t + 0.08);
                thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                thud.connect(thudGain);
                thudGain.connect(this.sfxGain);
                thud.start(t + 0.08);
                thud.stop(t + 0.2);
                break;
            }
            case 'SKILL': {
                // Magical shimmer with tremolo
                const osc = this.context.createOscillator();
                const gain = this.context.createGain();
                const tremolo = this.context.createOscillator();
                const tremoloGain = this.context.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, t);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);

                tremolo.type = 'sine';
                tremolo.frequency.setValueAtTime(15, t);
                tremoloGain.gain.setValueAtTime(0.08, t);
                tremolo.connect(tremoloGain);
                tremoloGain.connect(gain.gain);

                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(t);
                osc.stop(t + 0.35);
                tremolo.start(t);
                tremolo.stop(t + 0.35);

                // Shimmer layer
                const osc2 = this.context.createOscillator();
                const gain2 = this.context.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1800, t);
                osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.25);
                gain2.gain.setValueAtTime(0.06, t);
                gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                osc2.connect(gain2);
                gain2.connect(this.sfxGain);
                osc2.start(t);
                osc2.stop(t + 0.25);
                break;
            }
            case 'POWER': {
                // Deep resonant hum that builds
                const osc = this.context.createOscillator();
                const gain = this.context.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(80, t);
                osc.frequency.linearRampToValueAtTime(120, t + 0.3);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.linearRampToValueAtTime(0.2, t + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
                const lp = this._createFilter('lowpass', 300, 2);
                osc.connect(lp);
                lp.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(t);
                osc.stop(t + 0.5);

                // High accent
                const osc2 = this.context.createOscillator();
                const gain2 = this.context.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(600, t + 0.15);
                osc2.frequency.exponentialRampToValueAtTime(900, t + 0.35);
                gain2.gain.setValueAtTime(0.08, t + 0.15);
                gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc2.connect(gain2);
                gain2.connect(this.sfxGain);
                osc2.start(t + 0.15);
                osc2.stop(t + 0.4);
                break;
            }
        }
    },

    generateButtonClickSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
    },

    generateCoinSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Multiple metallic pings at harmonic intervals
        const frequencies = [2400, 3600, 4800];
        frequencies.forEach((freq, i) => {
            const start = t + i * 0.025;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, start + 0.15);
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.2);
        });

        // Subtle noise tap
        const noise = this.createNoiseBuffer(0.03);
        const nGain = this.context.createGain();
        const hp = this._createFilter('highpass', 5000, 1);
        nGain.gain.setValueAtTime(0.06, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        noise.connect(hp);
        hp.connect(nGain);
        nGain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.03);
    },

    generateDeathSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Deep rumble
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        const lp = this._createFilter('lowpass', 200, 2);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.8);

        // High screech
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(2000, t);
        osc2.frequency.exponentialRampToValueAtTime(500, t + 0.4);
        gain2.gain.setValueAtTime(0.1, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        const reverb = this.createReverb(1.0, 3);
        osc2.connect(gain2);
        gain2.connect(reverb);
        reverb.connect(this.sfxGain);
        osc2.start(t);
        osc2.stop(t + 0.5);

        // Descending pitch
        const osc3 = this.context.createOscillator();
        const gain3 = this.context.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(400, t + 0.1);
        osc3.frequency.exponentialRampToValueAtTime(50, t + 0.7);
        gain3.gain.setValueAtTime(0.15, t + 0.1);
        gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc3.connect(gain3);
        gain3.connect(this.sfxGain);
        osc3.start(t + 0.1);
        osc3.stop(t + 0.7);
    },

    generateVictorySound() {
        this._ensureContext();
        const t = this.context.currentTime;
        // Ascending major scale fanfare: C5, E5, G5, C6
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const reverb = this.createReverb(0.8, 2);
        reverb.connect(this.sfxGain);

        notes.forEach((freq, i) => {
            const start = t + i * 0.15;
            const duration = 0.4 + (i === notes.length - 1 ? 0.3 : 0);

            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
            gain.gain.setValueAtTime(0.18, start + duration * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
            osc.connect(gain);
            gain.connect(reverb);
            osc.start(start);
            osc.stop(start + duration);

            // Chorus layer (slightly detuned)
            const osc2 = this.context.createOscillator();
            const gain2 = this.context.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 1.003, start);
            gain2.gain.setValueAtTime(0, start);
            gain2.gain.linearRampToValueAtTime(0.08, start + 0.04);
            gain2.gain.exponentialRampToValueAtTime(0.001, start + duration);
            osc2.connect(gain2);
            gain2.connect(reverb);
            osc2.start(start);
            osc2.stop(start + duration);
        });
    },

    generateDefeatSound() {
        this._ensureContext();
        const t = this.context.currentTime;
        // Descending minor scale
        const notes = [493.88, 440, 349.23, 261.63]; // B4, A4, F4, C4
        const reverb = this.createReverb(1.0, 3);
        reverb.connect(this.sfxGain);

        notes.forEach((freq, i) => {
            const start = t + i * 0.25;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15 - i * 0.02, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
            osc.connect(gain);
            gain.connect(reverb);
            osc.start(start);
            osc.stop(start + 0.5);
        });

        // Low rumble underneath
        const rumble = this.context.createOscillator();
        const rumbleGain = this.context.createGain();
        rumble.type = 'sine';
        rumble.frequency.setValueAtTime(50, t);
        rumble.frequency.exponentialRampToValueAtTime(25, t + 1.5);
        rumbleGain.gain.setValueAtTime(0.12, t);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        rumble.connect(rumbleGain);
        rumbleGain.connect(this.sfxGain);
        rumble.start(t);
        rumble.stop(t + 1.5);
    },

    generateRelicSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Mystical shimmer ascending
        const reverb = this.createReverb(0.7, 2.5);
        reverb.connect(this.sfxGain);

        const freqs = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        freqs.forEach((freq, i) => {
            const start = t + i * 0.08;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
            osc.connect(gain);
            gain.connect(reverb);
            osc.start(start);
            osc.stop(start + 0.4);
        });

        // Sparkle noise
        const noise = this.createNoiseBuffer(0.2);
        const nGain = this.context.createGain();
        const hp = this._createFilter('highpass', 6000, 1);
        nGain.gain.setValueAtTime(0.05, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        noise.connect(hp);
        hp.connect(nGain);
        nGain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.2);
    },

    generatePotionSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Liquid bubble
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.15);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);

        // Cork pop
        const pop = this.context.createOscillator();
        const popGain = this.context.createGain();
        pop.type = 'sine';
        pop.frequency.setValueAtTime(1000, t);
        pop.frequency.exponentialRampToValueAtTime(200, t + 0.04);
        popGain.gain.setValueAtTime(0.2, t);
        popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        pop.connect(popGain);
        popGain.connect(this.sfxGain);
        pop.start(t);
        pop.stop(t + 0.06);

        // Fizz
        const noise = this.createNoiseBuffer(0.15);
        const nGain = this.context.createGain();
        const bp = this._createFilter('bandpass', 4000, 2);
        nGain.gain.setValueAtTime(0.06, t + 0.04);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        noise.connect(bp);
        bp.connect(nGain);
        nGain.connect(this.sfxGain);
        noise.start(t + 0.04);
        noise.stop(t + 0.2);
    },

    generateUpgradeSound() {
        this._ensureContext();
        const t = this.context.currentTime;
        const reverb = this.createReverb(0.5, 2);
        reverb.connect(this.sfxGain);

        // Ascending power chord
        const chords = [
            { freq: 261.63, time: 0 },     // C4
            { freq: 329.63, time: 0.08 },   // E4
            { freq: 392, time: 0.16 },      // G4
            { freq: 523.25, time: 0.24 },   // C5
        ];

        chords.forEach(({ freq, time }) => {
            const start = t + time;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
            osc.connect(gain);
            gain.connect(reverb);
            osc.start(start);
            osc.stop(start + 0.4);
        });

        // Bright sparkle layer
        const sparkle = this.context.createOscillator();
        const sparkleGain = this.context.createGain();
        sparkle.type = 'sine';
        sparkle.frequency.setValueAtTime(2000, t + 0.24);
        sparkle.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
        sparkleGain.gain.setValueAtTime(0.06, t + 0.24);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        sparkle.connect(sparkleGain);
        sparkleGain.connect(reverb);
        sparkle.start(t + 0.24);
        sparkle.stop(t + 0.5);
    },

    generateTurnStartSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        // Quick ascending tone
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);

        // Secondary confirmation tone
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(500, t + 0.08);
        gain2.gain.setValueAtTime(0.1, t + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(t + 0.08);
        osc2.stop(t + 0.2);
    },

    generateMapNodeSound() {
        this._ensureContext();
        const t = this.context.currentTime;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(700, t + 0.06);
        osc.frequency.exponentialRampToValueAtTime(550, t + 0.12);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
    },

    // ─── Music Generators ──────────────────────────────────────────

    generateCombatMusic() {
        this._ensureContext();
        const t = this.context.currentTime;
        const nodes = [];

        // Bass drone
        const bass = this.context.createOscillator();
        const bassGain = this.context.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(55, t); // A1

        const bassLfo = this.context.createOscillator();
        const bassLfoGain = this.context.createGain();
        bassLfo.type = 'sine';
        bassLfo.frequency.setValueAtTime(0.2, t);
        bassLfoGain.gain.setValueAtTime(5, t);
        bassLfo.connect(bassLfoGain);
        bassLfoGain.connect(bass.frequency);

        bassGain.gain.setValueAtTime(0.12, t);
        bass.connect(bassGain);
        bassGain.connect(this.musicGain);
        bass.start(t);
        bassLfo.start(t);
        nodes.push(bass, bassLfo, bassGain);

        // Rhythmic pulse
        const pulse = this.context.createOscillator();
        const pulseGain = this.context.createGain();
        const pulseFilter = this._createFilter('lowpass', 400, 3);
        pulse.type = 'square';
        pulse.frequency.setValueAtTime(110, t);

        const pulseLfo = this.context.createOscillator();
        const pulseLfoGain = this.context.createGain();
        pulseLfo.type = 'square';
        pulseLfo.frequency.setValueAtTime(2, t); // 2 beats per second
        pulseLfoGain.gain.setValueAtTime(0.1, t);
        pulseLfo.connect(pulseLfoGain);
        pulseLfoGain.connect(pulseGain.gain);

        pulseGain.gain.setValueAtTime(0.06, t);
        pulse.connect(pulseFilter);
        pulseFilter.connect(pulseGain);
        pulseGain.connect(this.musicGain);
        pulse.start(t);
        pulseLfo.start(t);
        nodes.push(pulse, pulseLfo, pulseGain);

        // Tension notes (dissonant interval)
        const tension = this.context.createOscillator();
        const tensionGain = this.context.createGain();
        tension.type = 'sine';
        tension.frequency.setValueAtTime(164.81, t); // E3

        const tensionLfo = this.context.createOscillator();
        const tensionLfoGain = this.context.createGain();
        tensionLfo.type = 'sine';
        tensionLfo.frequency.setValueAtTime(0.1, t);
        tensionLfoGain.gain.setValueAtTime(3, t);
        tensionLfo.connect(tensionLfoGain);
        tensionLfoGain.connect(tension.frequency);

        tensionGain.gain.setValueAtTime(0.04, t);
        tension.connect(tensionGain);
        tensionGain.connect(this.musicGain);
        tension.start(t);
        tensionLfo.start(t);
        nodes.push(tension, tensionLfo, tensionGain);

        // Tritone for dissonance
        const tritone = this.context.createOscillator();
        const tritoneGain = this.context.createGain();
        tritone.type = 'sine';
        tritone.frequency.setValueAtTime(77.78, t); // Eb2 (tritone from A)
        tritoneGain.gain.setValueAtTime(0.03, t);

        const tritLfo = this.context.createOscillator();
        const tritLfoGain = this.context.createGain();
        tritLfo.type = 'sine';
        tritLfo.frequency.setValueAtTime(0.05, t);
        tritLfoGain.gain.setValueAtTime(0.03, t);
        tritLfo.connect(tritLfoGain);
        tritLfoGain.connect(tritoneGain.gain);

        tritone.connect(tritoneGain);
        tritoneGain.connect(this.musicGain);
        tritone.start(t);
        tritLfo.start(t);
        nodes.push(tritone, tritLfo, tritoneGain);

        this._musicNodes = nodes;
    },

    generateBossMusic() {
        this._ensureContext();
        const t = this.context.currentTime;
        const nodes = [];

        // Heavy bass
        const bass = this.context.createOscillator();
        const bassGain = this.context.createGain();
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(41.2, t); // E1
        const bassFilter = this._createFilter('lowpass', 150, 4);
        bassGain.gain.setValueAtTime(0.15, t);
        bass.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.musicGain);
        bass.start(t);
        nodes.push(bass, bassGain);

        // Faster rhythmic pulse
        const pulse = this.context.createOscillator();
        const pulseGain = this.context.createGain();
        const pulseFilter = this._createFilter('lowpass', 500, 2);
        pulse.type = 'square';
        pulse.frequency.setValueAtTime(82.41, t); // E2

        const pulseLfo = this.context.createOscillator();
        const pulseLfoGain = this.context.createGain();
        pulseLfo.type = 'square';
        pulseLfo.frequency.setValueAtTime(3.5, t);
        pulseLfoGain.gain.setValueAtTime(0.08, t);
        pulseLfo.connect(pulseLfoGain);
        pulseLfoGain.connect(pulseGain.gain);

        pulseGain.gain.setValueAtTime(0.06, t);
        pulse.connect(pulseFilter);
        pulseFilter.connect(pulseGain);
        pulseGain.connect(this.musicGain);
        pulse.start(t);
        pulseLfo.start(t);
        nodes.push(pulse, pulseLfo, pulseGain);

        // Intense dissonance (minor second interval)
        const dis1 = this.context.createOscillator();
        const dis1Gain = this.context.createGain();
        dis1.type = 'sine';
        dis1.frequency.setValueAtTime(164.81, t); // E3
        dis1Gain.gain.setValueAtTime(0.05, t);

        const dis2 = this.context.createOscillator();
        const dis2Gain = this.context.createGain();
        dis2.type = 'sine';
        dis2.frequency.setValueAtTime(174.61, t); // F3
        dis2Gain.gain.setValueAtTime(0.04, t);

        const disLfo = this.context.createOscillator();
        const disLfoGain = this.context.createGain();
        disLfo.type = 'sine';
        disLfo.frequency.setValueAtTime(0.15, t);
        disLfoGain.gain.setValueAtTime(0.04, t);
        disLfo.connect(disLfoGain);
        disLfoGain.connect(dis1Gain.gain);

        dis1.connect(dis1Gain);
        dis1Gain.connect(this.musicGain);
        dis2.connect(dis2Gain);
        dis2Gain.connect(this.musicGain);
        dis1.start(t);
        dis2.start(t);
        disLfo.start(t);
        nodes.push(dis1, dis2, disLfo, dis1Gain, dis2Gain);

        // Low rumble noise bed
        const noise = this.createNoiseBuffer(30);
        const noiseGain = this.context.createGain();
        const noiseLp = this._createFilter('lowpass', 100, 1);
        noiseGain.gain.setValueAtTime(0.04, t);
        noise.connect(noiseLp);
        noiseLp.connect(noiseGain);
        noiseGain.connect(this.musicGain);
        noise.start(t);
        nodes.push(noise, noiseGain);

        this._musicNodes = nodes;
    },

    generateMenuMusic() {
        this._ensureContext();
        const t = this.context.currentTime;
        const nodes = [];

        // Warm pad (detuned sines)
        const padFreqs = [220, 220.8, 329.63, 330.2, 440, 440.6];
        padFreqs.forEach(freq => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.03, t);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(t);
            nodes.push(osc, gain);
        });

        // Slow modulated atmosphere
        const atmo = this.context.createOscillator();
        const atmoGain = this.context.createGain();
        atmo.type = 'sine';
        atmo.frequency.setValueAtTime(660, t);

        const atmoLfo = this.context.createOscillator();
        const atmoLfoGain = this.context.createGain();
        atmoLfo.type = 'sine';
        atmoLfo.frequency.setValueAtTime(0.08, t);
        atmoLfoGain.gain.setValueAtTime(10, t);
        atmoLfo.connect(atmoLfoGain);
        atmoLfoGain.connect(atmo.frequency);

        const atmoTremolo = this.context.createOscillator();
        const atmoTremoloGain = this.context.createGain();
        atmoTremolo.type = 'sine';
        atmoTremolo.frequency.setValueAtTime(0.3, t);
        atmoTremoloGain.gain.setValueAtTime(0.015, t);
        atmoTremolo.connect(atmoTremoloGain);
        atmoTremoloGain.connect(atmoGain.gain);

        atmoGain.gain.setValueAtTime(0.02, t);
        atmo.connect(atmoGain);
        atmoGain.connect(this.musicGain);
        atmo.start(t);
        atmoLfo.start(t);
        atmoTremolo.start(t);
        nodes.push(atmo, atmoLfo, atmoTremolo, atmoGain);

        // Sub bass presence
        const sub = this.context.createOscillator();
        const subGain = this.context.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(55, t);
        subGain.gain.setValueAtTime(0.06, t);
        sub.connect(subGain);
        subGain.connect(this.musicGain);
        sub.start(t);
        nodes.push(sub, subGain);

        this._musicNodes = nodes;
    },

    generateRestMusic() {
        this._ensureContext();
        const t = this.context.currentTime;
        const nodes = [];

        // Warm major pad
        const padNotes = [
            { freq: 261.63, detune: 0.5 },   // C4
            { freq: 329.63, detune: 0.3 },   // E4
            { freq: 392, detune: 0.4 },       // G4
        ];

        padNotes.forEach(({ freq, detune }) => {
            const osc1 = this.context.createOscillator();
            const osc2 = this.context.createOscillator();
            const gain = this.context.createGain();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(freq, t);
            osc2.frequency.setValueAtTime(freq + detune, t);
            gain.gain.setValueAtTime(0.04, t);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.musicGain);
            osc1.start(t);
            osc2.start(t);
            nodes.push(osc1, osc2, gain);
        });

        // Gentle volume swell
        const swellOsc = this.context.createOscillator();
        const swellGain = this.context.createGain();
        swellOsc.type = 'sine';
        swellOsc.frequency.setValueAtTime(523.25, t); // C5

        const swellLfo = this.context.createOscillator();
        const swellLfoGain = this.context.createGain();
        swellLfo.type = 'sine';
        swellLfo.frequency.setValueAtTime(0.15, t);
        swellLfoGain.gain.setValueAtTime(0.025, t);
        swellLfo.connect(swellLfoGain);
        swellLfoGain.connect(swellGain.gain);

        swellGain.gain.setValueAtTime(0.02, t);
        swellOsc.connect(swellGain);
        swellGain.connect(this.musicGain);
        swellOsc.start(t);
        swellLfo.start(t);
        nodes.push(swellOsc, swellLfo, swellGain);

        // Deep warm bass
        const bass = this.context.createOscillator();
        const bassGain = this.context.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(130.81, t); // C3
        bassGain.gain.setValueAtTime(0.05, t);
        bass.connect(bassGain);
        bassGain.connect(this.musicGain);
        bass.start(t);
        nodes.push(bass, bassGain);

        // Octave shimmer
        const shimmer = this.context.createOscillator();
        const shimmerGain = this.context.createGain();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(1046.5, t); // C6

        const shimmerTremolo = this.context.createOscillator();
        const shimmerTremoloGain = this.context.createGain();
        shimmerTremolo.type = 'sine';
        shimmerTremolo.frequency.setValueAtTime(0.25, t);
        shimmerTremoloGain.gain.setValueAtTime(0.008, t);
        shimmerTremolo.connect(shimmerTremoloGain);
        shimmerTremoloGain.connect(shimmerGain.gain);

        shimmerGain.gain.setValueAtTime(0.01, t);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(this.musicGain);
        shimmer.start(t);
        shimmerTremolo.start(t);
        nodes.push(shimmer, shimmerTremolo, shimmerGain);

        this._musicNodes = nodes;
    }
};
