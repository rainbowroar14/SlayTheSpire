window.STS = window.STS || {};

STS.Particles = {
    canvas: null,
    ctx: null,
    particles: [],
    pool: [],
    emitters: [],
    maxParticles: 1000,
    emitterIdCounter: 0,
    running: false,

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '999';
            document.body.appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        for (let i = 0; i < this.maxParticles; i++) {
            this.pool.push(this._createBlankParticle());
        }
        this.particles = [];
        this.emitters = [];
        this.running = true;
    },

    resize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement || document.body;
        this.canvas.width = parent.clientWidth || window.innerWidth;
        this.canvas.height = parent.clientHeight || window.innerHeight;
    },

    _createBlankParticle() {
        return {
            x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
            size: 5, maxSize: 5, minSize: 1,
            life: 0, maxLife: 1.0, decay: 0.02,
            color: [255, 255, 255], alpha: 1.0,
            shape: 'circle', rotation: 0, rotationSpeed: 0,
            gravity: 0, friction: 0.99,
            fadeOut: true, shrink: false,
            glow: false, glowSize: 10, glowColor: null,
            active: false
        };
    },

    _acquireParticle(config) {
        let p = null;
        if (this.pool.length > 0) {
            p = this.pool.pop();
        } else if (this.particles.length < this.maxParticles) {
            p = this._createBlankParticle();
        } else {
            let oldest = null;
            let minLife = Infinity;
            for (let i = 0; i < this.particles.length; i++) {
                if (this.particles[i].life < minLife) {
                    minLife = this.particles[i].life;
                    oldest = i;
                }
            }
            if (oldest !== null) {
                p = this.particles.splice(oldest, 1)[0];
            }
        }
        if (!p) return null;

        p.x = config.x || 0;
        p.y = config.y || 0;
        p.vx = config.vx || 0;
        p.vy = config.vy || 0;
        p.ax = config.ax || 0;
        p.ay = config.ay || 0;
        p.size = config.size || 5;
        p.maxSize = config.maxSize || p.size;
        p.minSize = config.minSize !== undefined ? config.minSize : 1;
        p.life = config.life || 1.0;
        p.maxLife = config.maxLife || p.life;
        p.decay = config.decay || 0.02;
        p.color = config.color ? config.color.slice() : [255, 255, 255];
        p.alpha = config.alpha !== undefined ? config.alpha : 1.0;
        p.shape = config.shape || 'circle';
        p.rotation = config.rotation || 0;
        p.rotationSpeed = config.rotationSpeed || 0;
        p.gravity = config.gravity || 0;
        p.friction = config.friction !== undefined ? config.friction : 0.99;
        p.fadeOut = config.fadeOut !== undefined ? config.fadeOut : true;
        p.shrink = config.shrink || false;
        p.glow = config.glow || false;
        p.glowSize = config.glowSize || 10;
        p.glowColor = config.glowColor || null;
        p.active = true;
        return p;
    },

    _releaseParticle(p) {
        p.active = false;
        p.life = 0;
        this.pool.push(p);
    },

    update(deltaTime) {
        const dt = deltaTime || (1 / 60);

        for (let i = 0; i < this.emitters.length; i++) {
            const e = this.emitters[i];
            if (!e.active) continue;

            e.elapsed += dt;
            if (e.duration > 0 && e.elapsed >= e.duration) {
                e.active = false;
                continue;
            }

            if (e.burst) {
                if (!e._bursted) {
                    for (let b = 0; b < e.burstCount; b++) {
                        this._emitFromEmitter(e);
                    }
                    e._bursted = true;
                }
            } else {
                e._accumulator = (e._accumulator || 0) + dt * e.rate;
                while (e._accumulator >= 1) {
                    this._emitFromEmitter(e);
                    e._accumulator -= 1;
                }
            }
        }

        this.emitters = this.emitters.filter(e => e.active || (e.burst && !e._cleaned));
        for (let i = 0; i < this.emitters.length; i++) {
            if (!this.emitters[i].active && this.emitters[i].burst) {
                this.emitters[i]._cleaned = true;
            }
        }
        this.emitters = this.emitters.filter(e => e.active);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vy += p.gravity * dt * 60;
            p.vx += p.ax * dt * 60;
            p.vy += p.ay * dt * 60;
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.rotation += p.rotationSpeed * dt * 60;
            p.life -= p.decay * dt * 60;

            if (p.life <= 0) {
                this._releaseParticle(this.particles.splice(i, 1)[0]);
            }
        }
    },

    _emitFromEmitter(e) {
        const angle = e.direction + (Math.random() - 0.5) * e.spread;
        const speed = this._randRange(e.speed[0], e.speed[1]);
        const size = this._randRange(e.sizeRange[0], e.sizeRange[1]);
        const life = this._randRange(e.lifeRange[0], e.lifeRange[1]);
        const cv = e.colorVariance || 0;

        const baseColor = e.particleConfig.color || [255, 255, 255];
        const color = [
            Math.max(0, Math.min(255, baseColor[0] + (Math.random() - 0.5) * 2 * cv)),
            Math.max(0, Math.min(255, baseColor[1] + (Math.random() - 0.5) * 2 * cv)),
            Math.max(0, Math.min(255, baseColor[2] + (Math.random() - 0.5) * 2 * cv))
        ];

        const cfg = Object.assign({}, e.particleConfig, {
            x: e.x + (Math.random() - 0.5) * 10,
            y: e.y + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: size,
            maxSize: size,
            life: life,
            maxLife: life,
            color: color
        });

        const p = this._acquireParticle(cfg);
        if (p) this.particles.push(p);
    },

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const alpha = p.fadeOut ? p.alpha * Math.max(0, p.life / p.maxLife) : p.alpha;
            if (alpha < 0.01) continue;
            this._renderParticle(p, alpha);
        }
    },

    _renderParticle(p, alpha) {
        const ctx = this.ctx;
        const size = p.shrink ? Math.max(p.minSize, p.size * (p.life / p.maxLife)) : p.size;

        ctx.save();
        ctx.globalAlpha = alpha;

        if (p.glow) {
            const gc = p.glowColor || p.color;
            ctx.shadowColor = 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',' + alpha + ')';
            ctx.shadowBlur = p.glowSize;
        }

        ctx.fillStyle = 'rgb(' + (p.color[0] | 0) + ',' + (p.color[1] | 0) + ',' + (p.color[2] | 0) + ')';
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        switch (p.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'square':
                ctx.fillRect(-size / 2, -size / 2, size, size);
                break;
            case 'star':
                this._drawStar(ctx, 0, 0, 5, size, size / 2);
                break;
            case 'spark':
                ctx.beginPath();
                ctx.moveTo(-size * 2, 0);
                ctx.lineTo(0, -size / 2);
                ctx.lineTo(size * 2, 0);
                ctx.lineTo(0, size / 2);
                ctx.closePath();
                ctx.fill();
                break;
            case 'line':
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = Math.max(1, size / 3);
                ctx.beginPath();
                ctx.moveTo(-size, 0);
                ctx.lineTo(size, 0);
                ctx.stroke();
                break;
            case 'plus':
                const t = size / 3;
                ctx.fillRect(-size / 2, -t / 2, size, t);
                ctx.fillRect(-t / 2, -size / 2, t, size);
                break;
            case 'ring':
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = Math.max(1, size / 5);
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(-size * 0.866, size * 0.5);
                ctx.lineTo(size * 0.866, size * 0.5);
                ctx.closePath();
                ctx.fill();
                break;
            default:
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
        }

        ctx.restore();
    },

    _drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    },

    emit(config) {
        const p = this._acquireParticle(config);
        if (p) this.particles.push(p);
        return p;
    },

    createEmitter(config) {
        const id = config.id || ('emitter_' + (++this.emitterIdCounter));
        const emitter = {
            id: id,
            x: config.x || 0,
            y: config.y || 0,
            rate: config.rate || 10,
            particleConfig: config.particleConfig || {},
            active: config.active !== undefined ? config.active : true,
            duration: config.duration !== undefined ? config.duration : -1,
            elapsed: 0,
            spread: config.spread !== undefined ? config.spread : Math.PI * 2,
            direction: config.direction !== undefined ? config.direction : -Math.PI / 2,
            speed: config.speed || [2, 5],
            sizeRange: config.sizeRange || [3, 8],
            lifeRange: config.lifeRange || [0.5, 1.5],
            colorVariance: config.colorVariance || 0,
            burst: config.burst || false,
            burstCount: config.burstCount || 0,
            _accumulator: 0,
            _bursted: false,
            _cleaned: false
        };
        this.emitters.push(emitter);
        return emitter;
    },

    removeEmitter(emitterId) {
        this.emitters = this.emitters.filter(e => e.id !== emitterId);
    },

    clear() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this._releaseParticle(this.particles[i]);
        }
        this.particles = [];
        this.emitters = [];
    },

    _randRange(min, max) {
        return min + Math.random() * (max - min);
    },

    _randInt(min, max) {
        return Math.floor(this._randRange(min, max + 1));
    },

    _lerpColor(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];
    },

    // ─── Preset Effects ────────────────────────────────────────────

    damageEffect(x, y, amount) {
        const count = Math.min(30, Math.max(10, Math.floor(amount * 1.5)));

        // White flash
        this.emit({
            x: x, y: y,
            vx: 0, vy: 0,
            size: 40 + amount * 2,
            life: 0.15, maxLife: 0.15, decay: 0.05,
            color: [255, 255, 255], alpha: 0.8,
            shape: 'circle', fadeOut: true, shrink: true,
            glow: true, glowSize: 30, glowColor: [255, 200, 100]
        });

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            const colors = [
                [255, 60, 30], [255, 120, 40], [255, 80, 20],
                [255, 160, 50], [200, 40, 20]
            ];
            const color = colors[this._randInt(0, colors.length - 1)];

            this.emit({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                life: 0.4 + Math.random() * 0.5,
                maxLife: 0.9, decay: 0.015,
                color: color, alpha: 1.0,
                shape: Math.random() > 0.6 ? 'spark' : 'circle',
                gravity: 0.15, friction: 0.96,
                fadeOut: true, shrink: true,
                glow: Math.random() > 0.5, glowSize: 6,
                rotation: angle,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }

        // Small trailing sparks
        for (let i = 0; i < Math.floor(count / 3); i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.emit({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1 + Math.random() * 2,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1.0, decay: 0.012,
                color: [255, 220, 100], alpha: 0.9,
                shape: 'circle',
                gravity: 0.08, friction: 0.98,
                fadeOut: true, shrink: true,
                glow: true, glowSize: 4
            });
        }
    },

    healEffect(x, y) {
        // Soft glow base
        this.emit({
            x: x, y: y,
            vx: 0, vy: 0,
            size: 35, life: 0.5, maxLife: 0.5, decay: 0.015,
            color: [100, 255, 130], alpha: 0.4,
            shape: 'circle', fadeOut: true, shrink: false,
            glow: true, glowSize: 25, glowColor: [80, 255, 100]
        });

        for (let i = 0; i < 18; i++) {
            const offsetX = (Math.random() - 0.5) * 30;
            const isPlus = Math.random() > 0.6;
            const colors = [
                [80, 255, 100], [120, 255, 140],
                [60, 220, 80], [150, 255, 170]
            ];
            this.emit({
                x: x + offsetX, y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 0.8,
                vy: -1.5 - Math.random() * 2.5,
                size: isPlus ? 5 + Math.random() * 3 : 3 + Math.random() * 3,
                life: 0.8 + Math.random() * 0.5,
                maxLife: 1.3, decay: 0.012,
                color: colors[this._randInt(0, colors.length - 1)],
                alpha: 0.85,
                shape: isPlus ? 'plus' : 'circle',
                gravity: -0.02, friction: 0.98,
                fadeOut: true, shrink: true,
                glow: true, glowSize: 8
            });
        }
    },

    blockEffect(x, y) {
        // Shield flash
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 30, life: 0.3, maxLife: 0.3, decay: 0.025,
            color: [100, 160, 255], alpha: 0.5,
            shape: 'ring', fadeOut: true, shrink: false,
            glow: true, glowSize: 20, glowColor: [80, 140, 255]
        });

        // Expanding ring
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 5, maxSize: 50, life: 0.4, maxLife: 0.4, decay: 0.02,
            color: [140, 200, 255], alpha: 0.6,
            shape: 'ring', fadeOut: true, shrink: false,
            glow: true, glowSize: 12
        });

        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            const colors = [
                [100, 160, 255], [140, 200, 255],
                [180, 220, 255], [80, 140, 240]
            ];
            this.emit({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                life: 0.3 + Math.random() * 0.4,
                maxLife: 0.7, decay: 0.02,
                color: colors[this._randInt(0, colors.length - 1)],
                alpha: 0.9,
                shape: Math.random() > 0.5 ? 'square' : 'spark',
                friction: 0.92, gravity: 0,
                fadeOut: true, shrink: true,
                rotation: angle,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                glow: true, glowSize: 5
            });
        }
    },

    poisonEffect(x, y) {
        // Bubbles rising
        for (let i = 0; i < 15; i++) {
            const offsetX = (Math.random() - 0.5) * 40;
            const colors = [
                [80, 200, 50], [60, 180, 30],
                [100, 220, 70], [50, 160, 20]
            ];
            this.emit({
                x: x + offsetX, y: y + Math.random() * 10,
                vx: Math.sin(Date.now() * 0.001 + i) * 0.5,
                vy: -1.0 - Math.random() * 1.5,
                ax: Math.sin(i * 0.7) * 0.02,
                size: 3 + Math.random() * 5,
                life: 0.7 + Math.random() * 0.6,
                maxLife: 1.3, decay: 0.012,
                color: colors[this._randInt(0, colors.length - 1)],
                alpha: 0.7,
                shape: 'circle',
                gravity: -0.03, friction: 0.98,
                fadeOut: true, shrink: true,
                glow: true, glowSize: 6, glowColor: [60, 180, 30]
            });
        }

        // Dripping effect
        for (let i = 0; i < 6; i++) {
            this.emit({
                x: x + (Math.random() - 0.5) * 30,
                y: y - 5,
                vx: (Math.random() - 0.5) * 0.5,
                vy: 1.0 + Math.random() * 2.0,
                size: 2 + Math.random() * 2,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8, decay: 0.018,
                color: [50, 160, 20], alpha: 0.6,
                shape: 'circle',
                gravity: 0.2, friction: 0.99,
                fadeOut: true, shrink: false
            });
        }
    },

    deathEffect(x, y) {
        // Shockwave ring
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 5, life: 0.5, maxLife: 0.5, decay: 0.015,
            color: [255, 100, 50], alpha: 0.7,
            shape: 'ring', fadeOut: true, shrink: false,
            glow: true, glowSize: 20, glowColor: [255, 80, 30]
        });

        // Large burst
        for (let i = 0; i < 55; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 7;
            const colors = [
                [180, 30, 20], [220, 60, 30], [255, 100, 40],
                [40, 40, 40], [80, 20, 10], [150, 40, 20]
            ];
            const color = colors[this._randInt(0, colors.length - 1)];
            const isSmoke = color[0] < 100;

            this.emit({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: isSmoke ? (5 + Math.random() * 10) : (2 + Math.random() * 5),
                life: 0.6 + Math.random() * 0.8,
                maxLife: 1.4, decay: 0.01,
                color: color, alpha: isSmoke ? 0.5 : 0.9,
                shape: isSmoke ? 'circle' : (Math.random() > 0.5 ? 'spark' : 'triangle'),
                gravity: isSmoke ? -0.08 : 0.12,
                friction: isSmoke ? 0.97 : 0.95,
                fadeOut: true, shrink: !isSmoke,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.15,
                glow: !isSmoke, glowSize: 8
            });
        }

        // Secondary flash
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 60, life: 0.2, maxLife: 0.2, decay: 0.04,
            color: [255, 200, 150], alpha: 0.6,
            shape: 'circle', fadeOut: true, shrink: true,
            glow: true, glowSize: 40
        });
    },

    cardPlayEffect(x, y, cardType) {
        switch (cardType) {
            case 'ATTACK':
                this._attackCardEffect(x, y);
                break;
            case 'SKILL':
                this._skillCardEffect(x, y);
                break;
            case 'POWER':
                this._powerCardEffect(x, y);
                break;
            default:
                this._skillCardEffect(x, y);
        }
    },

    _attackCardEffect(x, y) {
        // Slash trail
        for (let i = 0; i < 15; i++) {
            const t = i / 15;
            const sx = x - 30 + t * 60;
            const sy = y + 20 - Math.sin(t * Math.PI) * 40;
            this.emit({
                x: sx, y: sy,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: 3 + Math.random() * 3,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6, decay: 0.025,
                color: [255, 80 + Math.random() * 60, 30],
                alpha: 0.9,
                shape: 'spark', fadeOut: true, shrink: true,
                rotation: Math.atan2(sy - y, sx - x),
                glow: true, glowSize: 6
            });
        }

        // Trailing embers
        for (let i = 0; i < 8; i++) {
            this.emit({
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 3,
                vy: -1 - Math.random() * 2,
                size: 1 + Math.random() * 2,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7, decay: 0.02,
                color: [255, 180, 50], alpha: 0.8,
                shape: 'circle', fadeOut: true, shrink: true,
                gravity: 0.05, friction: 0.97,
                glow: true, glowSize: 4
            });
        }
    },

    _skillCardEffect(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const radius = 15 + Math.random() * 10;
            this.emit({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius,
                vx: Math.cos(angle + Math.PI / 2) * 2,
                vy: Math.sin(angle + Math.PI / 2) * 2,
                size: 2 + Math.random() * 3,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7, decay: 0.02,
                color: [60 + Math.random() * 40, 180 + Math.random() * 40, 255],
                alpha: 0.8,
                shape: 'circle', fadeOut: true, shrink: true,
                friction: 0.95,
                glow: true, glowSize: 8, glowColor: [80, 200, 255]
            });
        }
    },

    _powerCardEffect(x, y) {
        for (let i = 0; i < 18; i++) {
            const offsetX = (Math.random() - 0.5) * 30;
            this.emit({
                x: x + offsetX, y: y + Math.random() * 10,
                vx: (Math.random() - 0.5) * 1.0,
                vy: -2 - Math.random() * 3,
                size: 2 + Math.random() * 3,
                life: 0.6 + Math.random() * 0.5,
                maxLife: 1.1, decay: 0.013,
                color: [255, 200 + Math.random() * 55, 50],
                alpha: 0.9,
                shape: Math.random() > 0.5 ? 'star' : 'circle',
                gravity: -0.04, friction: 0.98,
                fadeOut: true, shrink: false,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1,
                glow: true, glowSize: 10, glowColor: [255, 220, 100]
            });
        }
    },

    fireEffect(x, y) {
        return this.createEmitter({
            x: x, y: y,
            rate: 25,
            duration: -1,
            spread: 0.6,
            direction: -Math.PI / 2,
            speed: [1, 3],
            sizeRange: [3, 8],
            lifeRange: [0.3, 0.7],
            colorVariance: 30,
            particleConfig: {
                color: [255, 120, 30],
                alpha: 0.85,
                shape: 'circle',
                gravity: -0.1,
                friction: 0.97,
                fadeOut: true,
                shrink: true,
                glow: true,
                glowSize: 10,
                glowColor: [255, 80, 20]
            }
        });
    },

    energyOrbEffect(x, y) {
        // Core glow
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 12, life: 0.6, maxLife: 0.6, decay: 0.012,
            color: [120, 180, 255], alpha: 0.5,
            shape: 'circle', fadeOut: true,
            glow: true, glowSize: 20, glowColor: [100, 160, 255]
        });

        // Orbiting particles
        const now = Date.now() * 0.003;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + now;
            const orbRadius = 15 + Math.sin(now + i) * 5;
            this.emit({
                x: x + Math.cos(angle) * orbRadius,
                y: y + Math.sin(angle) * orbRadius,
                vx: Math.cos(angle + Math.PI / 2) * 1.5,
                vy: Math.sin(angle + Math.PI / 2) * 1.5,
                size: 1.5 + Math.random() * 2,
                life: 0.3 + Math.random() * 0.2,
                maxLife: 0.5, decay: 0.025,
                color: [150 + Math.random() * 50, 200 + Math.random() * 55, 255],
                alpha: 0.8,
                shape: 'circle', fadeOut: true, shrink: true,
                friction: 0.95,
                glow: true, glowSize: 6
            });
        }

        // Pulse ring
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 8, life: 0.4, maxLife: 0.4, decay: 0.02,
            color: [180, 220, 255], alpha: 0.3,
            shape: 'ring', fadeOut: true,
            glow: true, glowSize: 15
        });
    },

    victoryEffect() {
        const w = this.canvas ? this.canvas.width : 800;
        const h = this.canvas ? this.canvas.height : 600;

        // Confetti bursts from multiple points
        const burstPoints = [
            { x: w * 0.2, y: h * 0.8 },
            { x: w * 0.5, y: h * 0.9 },
            { x: w * 0.8, y: h * 0.8 }
        ];

        const confettiColors = [
            [255, 80, 80], [80, 200, 255], [255, 220, 50],
            [100, 255, 120], [255, 150, 50], [200, 100, 255],
            [255, 180, 200], [50, 255, 200]
        ];

        burstPoints.forEach(pt => {
            for (let i = 0; i < 40; i++) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
                const speed = 4 + Math.random() * 8;
                this.emit({
                    x: pt.x, y: pt.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 3 + Math.random() * 4,
                    life: 1.0 + Math.random() * 1.0,
                    maxLife: 2.0, decay: 0.007,
                    color: confettiColors[this._randInt(0, confettiColors.length - 1)],
                    alpha: 1.0,
                    shape: Math.random() > 0.5 ? 'square' : 'star',
                    gravity: 0.08, friction: 0.99,
                    fadeOut: true, shrink: false,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.2
                });
            }
        });

        // Sparkle rain
        for (let i = 0; i < 30; i++) {
            this.emit({
                x: Math.random() * w,
                y: -10 - Math.random() * 50,
                vx: (Math.random() - 0.5) * 1.5,
                vy: 1.5 + Math.random() * 2,
                size: 1 + Math.random() * 2,
                life: 1.5 + Math.random() * 1.0,
                maxLife: 2.5, decay: 0.006,
                color: [255, 255, 200 + Math.random() * 55],
                alpha: 0.7,
                shape: 'star', fadeOut: true,
                gravity: 0.02, friction: 0.995,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: 0.05,
                glow: true, glowSize: 5
            });
        }
    },

    bossIntroEffect(x, y) {
        // Dark vortex base
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 50, life: 1.0, maxLife: 1.0, decay: 0.008,
            color: [60, 20, 80], alpha: 0.5,
            shape: 'circle', fadeOut: true,
            glow: true, glowSize: 40, glowColor: [80, 30, 120]
        });

        // Spiraling particles inward
        for (let i = 0; i < 35; i++) {
            const angle = (i / 35) * Math.PI * 4;
            const dist = 80 + Math.random() * 60;
            const startX = x + Math.cos(angle) * dist;
            const startY = y + Math.sin(angle) * dist;
            const toCenter = Math.atan2(y - startY, x - startX);
            const speed = 2 + Math.random() * 3;

            const colors = [
                [160, 50, 200], [200, 60, 80], [120, 30, 180],
                [180, 40, 100], [100, 20, 150]
            ];
            this.emit({
                x: startX, y: startY,
                vx: Math.cos(toCenter + 0.5) * speed,
                vy: Math.sin(toCenter + 0.5) * speed,
                size: 2 + Math.random() * 3,
                life: 0.6 + Math.random() * 0.5,
                maxLife: 1.1, decay: 0.012,
                color: colors[this._randInt(0, colors.length - 1)],
                alpha: 0.8,
                shape: 'spark', fadeOut: true, shrink: true,
                friction: 0.97,
                rotation: toCenter,
                glow: true, glowSize: 6, glowColor: [150, 40, 200]
            });
        }

        // Lightning sparks
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 40;
            this.emit({
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: 1 + Math.random() * 2,
                life: 0.1 + Math.random() * 0.15,
                maxLife: 0.25, decay: 0.05,
                color: [220, 200, 255], alpha: 1.0,
                shape: 'line', fadeOut: true,
                rotation: Math.random() * Math.PI,
                glow: true, glowSize: 12, glowColor: [180, 160, 255]
            });
        }
    },

    relicPickupEffect(x, y) {
        // Golden burst
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 30, life: 0.4, maxLife: 0.4, decay: 0.02,
            color: [255, 220, 100], alpha: 0.6,
            shape: 'circle', fadeOut: true,
            glow: true, glowSize: 25, glowColor: [255, 200, 50]
        });

        for (let i = 0; i < 25; i++) {
            const angle = (i / 25) * Math.PI * 2;
            const speed = 3 + Math.random() * 4;
            this.emit({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0, decay: 0.015,
                color: [255, 200 + Math.random() * 55, 50 + Math.random() * 50],
                alpha: 0.9,
                shape: Math.random() > 0.6 ? 'star' : 'spark',
                friction: 0.94, gravity: 0,
                fadeOut: true, shrink: true,
                rotation: angle,
                rotationSpeed: 0.05,
                glow: true, glowSize: 8
            });
        }
    },

    goldEffect(x, y) {
        for (let i = 0; i < 12; i++) {
            this.emit({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 2,
                vy: -1.5 - Math.random() * 2,
                size: 2 + Math.random() * 2,
                life: 0.5 + Math.random() * 0.4,
                maxLife: 0.9, decay: 0.016,
                color: [255, 215, 0], alpha: 0.9,
                shape: Math.random() > 0.5 ? 'circle' : 'star',
                gravity: 0.05, friction: 0.97,
                fadeOut: true, shrink: true,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: 0.08,
                glow: true, glowSize: 5, glowColor: [255, 200, 50]
            });
        }
    },

    strengthEffect(x, y) {
        // Red/orange power aura
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 25, life: 0.4, maxLife: 0.4, decay: 0.02,
            color: [255, 80, 40], alpha: 0.4,
            shape: 'circle', fadeOut: true,
            glow: true, glowSize: 20, glowColor: [255, 60, 30]
        });

        for (let i = 0; i < 14; i++) {
            this.emit({
                x: x + (Math.random() - 0.5) * 25,
                y: y + Math.random() * 5,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -2 - Math.random() * 3,
                size: 3 + Math.random() * 3,
                life: 0.5 + Math.random() * 0.4,
                maxLife: 0.9, decay: 0.015,
                color: [255, 60 + Math.random() * 80, 20 + Math.random() * 30],
                alpha: 0.85,
                shape: 'triangle',
                gravity: -0.05, friction: 0.97,
                fadeOut: true, shrink: true,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1,
                glow: true, glowSize: 7
            });
        }
    },

    upgradeEffect(x, y) {
        // Bright white flash
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 40, life: 0.3, maxLife: 0.3, decay: 0.025,
            color: [255, 255, 255], alpha: 0.7,
            shape: 'circle', fadeOut: true, shrink: true,
            glow: true, glowSize: 30, glowColor: [200, 230, 255]
        });

        // Ascending sparkles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.emit({
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed * 0.5,
                vy: -2 - Math.random() * 3,
                size: 2 + Math.random() * 3,
                life: 0.6 + Math.random() * 0.5,
                maxLife: 1.1, decay: 0.013,
                color: [200 + Math.random() * 55, 230 + Math.random() * 25, 255],
                alpha: 0.9,
                shape: Math.random() > 0.4 ? 'star' : 'spark',
                gravity: -0.03, friction: 0.98,
                fadeOut: true, shrink: true,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: 0.06,
                glow: true, glowSize: 8, glowColor: [180, 210, 255]
            });
        }

        // Expanding ring
        this.emit({
            x: x, y: y, vx: 0, vy: 0,
            size: 10, life: 0.4, maxLife: 0.4, decay: 0.02,
            color: [220, 240, 255], alpha: 0.5,
            shape: 'ring', fadeOut: true,
            glow: true, glowSize: 15
        });
    },

    ambientDust() {
        const w = this.canvas ? this.canvas.width : 800;
        const h = this.canvas ? this.canvas.height : 600;

        return this.createEmitter({
            id: 'ambient_dust',
            x: w / 2, y: h / 2,
            rate: 2,
            duration: -1,
            spread: Math.PI * 2,
            direction: 0,
            speed: [0.2, 0.8],
            sizeRange: [1, 3],
            lifeRange: [2.0, 5.0],
            colorVariance: 20,
            particleConfig: {
                color: [200, 200, 210],
                alpha: 0.15,
                shape: 'circle',
                gravity: -0.005,
                friction: 0.998,
                fadeOut: true,
                shrink: false,
                glow: false
            }
        });
    },

    campfireParticles(x, y) {
        // Fire emitter
        const fireEmitter = this.createEmitter({
            id: 'campfire_fire',
            x: x, y: y,
            rate: 20,
            duration: -1,
            spread: 0.5,
            direction: -Math.PI / 2,
            speed: [1, 3],
            sizeRange: [3, 7],
            lifeRange: [0.3, 0.7],
            colorVariance: 25,
            particleConfig: {
                color: [255, 130, 40],
                alpha: 0.8,
                shape: 'circle',
                gravity: -0.08,
                friction: 0.97,
                fadeOut: true,
                shrink: true,
                glow: true,
                glowSize: 12,
                glowColor: [255, 80, 20]
            }
        });

        // Ember emitter
        const emberEmitter = this.createEmitter({
            id: 'campfire_embers',
            x: x, y: y - 10,
            rate: 4,
            duration: -1,
            spread: 0.8,
            direction: -Math.PI / 2,
            speed: [0.5, 2],
            sizeRange: [1, 2],
            lifeRange: [1.0, 2.5],
            colorVariance: 15,
            particleConfig: {
                color: [255, 180, 60],
                alpha: 0.7,
                shape: 'circle',
                gravity: -0.03,
                friction: 0.995,
                fadeOut: true,
                shrink: true,
                glow: true,
                glowSize: 4,
                glowColor: [255, 150, 30]
            }
        });

        // Warm glow at base
        this.emit({
            x: x, y: y + 5, vx: 0, vy: 0,
            size: 30, life: 100, maxLife: 100, decay: 0.0001,
            color: [255, 120, 40], alpha: 0.2,
            shape: 'circle', fadeOut: false,
            glow: true, glowSize: 35, glowColor: [255, 100, 20]
        });

        return { fire: fireEmitter, embers: emberEmitter };
    }
};
