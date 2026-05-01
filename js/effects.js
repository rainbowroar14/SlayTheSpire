/**
 * @file effects.js
 * @description Status effects system for Slay the Spire web app.
 * Each effect has a definition with handlers for different game timings.
 * Uses the global STS namespace pattern.
 */

window.STS = window.STS || {};

/* ======================================================================
 *  EFFECT DEFINITIONS
 * ====================================================================== */

/**
 * @typedef {Object} EffectDefinition
 * @property {string}   id          - Unique identifier (e.g. 'POISON').
 * @property {string}   name        - Human-readable name.
 * @property {'BUFF'|'DEBUFF'|'SPECIAL'} type - Category.
 * @property {'INTENSITY'|'DURATION'|'COUNTER'|'SPECIAL'} stackType
 * @property {string}   icon        - Emoji or CSS class for rendering.
 * @property {string}   color       - Hex colour used in the UI.
 * @property {function(number):string} description - Dynamic tooltip.
 * @property {function|null} onApply
 * @property {function|null} onTurnStart
 * @property {function|null} onTurnEnd
 * @property {function|null} onDamageDealt
 * @property {function|null} onDamageTaken
 * @property {function|null} onBlockGained
 * @property {function|null} onRemove
 */

/**
 * Master table of every status effect in the game, keyed by id.
 * @type {Object.<string, EffectDefinition>}
 */
const EFFECT_DEFINITIONS = {

    /* ------------------------------------------------------------------
     *  BUFFS
     * ------------------------------------------------------------------ */

    STRENGTH: {
        id: 'STRENGTH',
        name: 'Strength',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '⚔️',
        color: '#e83b3b',
        description: (amt) => `Increases attack damage by ${amt}.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    DEXTERITY: {
        id: 'DEXTERITY',
        name: 'Dexterity',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '🛡️',
        color: '#3bc4e8',
        description: (amt) => `Increases block gained by ${amt}.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    ARTIFACT: {
        id: 'ARTIFACT',
        name: 'Artifact',
        type: 'BUFF',
        stackType: 'COUNTER',
        icon: '💎',
        color: '#f5a623',
        description: (amt) => `Negates the next ${amt} debuff${amt !== 1 ? 's' : ''} applied.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    THORNS: {
        id: 'THORNS',
        name: 'Thorns',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '🌹',
        color: '#8b4513',
        description: (amt) => `When attacked, deal ${amt} damage back.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        /**
         * Thorns triggers via the onDamageTaken handler.
         * Actual retaliatory damage is handled by STS.Game.dealDamage calling
         * back into the attacker – this hook is used by the game engine.
         */
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    REGENERATION: {
        id: 'REGENERATION',
        name: 'Regeneration',
        type: 'BUFF',
        stackType: 'DURATION',
        icon: '💚',
        color: '#4caf50',
        description: (amt) => `Heal ${amt} HP at end of turn. Reduces by 1.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: function (target) {
            const fx = _getEffect(target, 'REGENERATION');
            if (!fx) return;
            if (typeof STS.Game !== 'undefined' && STS.Game.healPlayer && target === _player()) {
                STS.Game.healPlayer(fx.amount);
            } else if (target.hp !== undefined) {
                target.hp = Math.min(target.hp + fx.amount, target.maxHp || target.hp + fx.amount);
            }
            fx.amount -= 1;
            if (fx.amount <= 0) {
                STS.Effects.remove(target, 'REGENERATION');
            }
        },
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    METALLICIZE: {
        id: 'METALLICIZE',
        name: 'Metallicize',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '🔩',
        color: '#9e9e9e',
        description: (amt) => `Gain ${amt} Block at the end of each turn.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: function (target) {
            const fx = _getEffect(target, 'METALLICIZE');
            if (!fx) return;
            if (typeof STS.Game !== 'undefined' && STS.Game.gainBlock) {
                STS.Game.gainBlock(target, fx.amount);
            } else {
                target.block = (target.block || 0) + fx.amount;
            }
        },
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    PLATED_ARMOR: {
        id: 'PLATED_ARMOR',
        name: 'Plated Armor',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '🪖',
        color: '#607d8b',
        description: (amt) => `Gain ${amt} Block at end of turn. Loses 1 when receiving unblocked damage.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: function (target) {
            const fx = _getEffect(target, 'PLATED_ARMOR');
            if (!fx) return;
            if (typeof STS.Game !== 'undefined' && STS.Game.gainBlock) {
                STS.Game.gainBlock(target, fx.amount);
            } else {
                target.block = (target.block || 0) + fx.amount;
            }
        },
        onDamageDealt: null,
        onDamageTaken: function (target, _damage, unblocked) {
            if (unblocked > 0) {
                const fx = _getEffect(target, 'PLATED_ARMOR');
                if (!fx) return;
                fx.amount -= 1;
                if (fx.amount <= 0) {
                    STS.Effects.remove(target, 'PLATED_ARMOR');
                }
            }
        },
        onBlockGained: null,
        onRemove: null
    },

    RITUAL: {
        id: 'RITUAL',
        name: 'Ritual',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '🕯️',
        color: '#9c27b0',
        description: (amt) => `Gain ${amt} Strength at the end of each turn.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: function (target) {
            const fx = _getEffect(target, 'RITUAL');
            if (!fx) return;
            STS.Effects.apply(target, 'STRENGTH', fx.amount, 'Ritual');
        },
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    BARRICADE: {
        id: 'BARRICADE',
        name: 'Barricade',
        type: 'BUFF',
        stackType: 'SPECIAL',
        icon: '🧱',
        color: '#795548',
        description: () => 'Block is not removed at the start of your turn.',
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    VIGOR: {
        id: 'VIGOR',
        name: 'Vigor',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '🔥',
        color: '#ff5722',
        description: (amt) => `Your next Attack deals ${amt} additional damage. Then removed.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    INTANGIBLE: {
        id: 'INTANGIBLE',
        name: 'Intangible',
        type: 'BUFF',
        stackType: 'DURATION',
        icon: '👻',
        color: '#b0bec5',
        description: (amt) => `Reduce ALL damage taken to 1. Lasts ${amt} turn${amt !== 1 ? 's' : ''}.`,
        onApply: null,
        onTurnStart: function (target) {
            const fx = _getEffect(target, 'INTANGIBLE');
            if (!fx) return;
            fx.amount -= 1;
            if (fx.amount <= 0) {
                STS.Effects.remove(target, 'INTANGIBLE');
            }
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    ENRAGE: {
        id: 'ENRAGE',
        name: 'Enrage',
        type: 'BUFF',
        stackType: 'INTENSITY',
        icon: '😡',
        color: '#d32f2f',
        description: (amt) => `Gain ${amt} Strength whenever a Skill is played.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    /* ------------------------------------------------------------------
     *  DEBUFFS
     * ------------------------------------------------------------------ */

    POISON: {
        id: 'POISON',
        name: 'Poison',
        type: 'DEBUFF',
        stackType: 'INTENSITY',
        icon: '☠️',
        color: '#00e676',
        description: (amt) => `Take ${amt} damage at start of turn. Reduces by 1.`,
        onApply: null,
        onTurnStart: function (target) {
            const fx = _getEffect(target, 'POISON');
            if (!fx) return;
            // Poison damage bypasses block entirely – deal unblockable HP loss
            const dmg = fx.amount;
            if (typeof STS.Game !== 'undefined' && STS.Game.dealDamage) {
                STS.Game.dealDamage(null, target, dmg, 1, { poison: true });
            } else {
                target.hp = Math.max(0, (target.hp || 0) - dmg);
            }
            fx.amount -= 1;
            if (fx.amount <= 0) {
                STS.Effects.remove(target, 'POISON');
            }
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    WEAKNESS: {
        id: 'WEAKNESS',
        name: 'Weakness',
        type: 'DEBUFF',
        stackType: 'DURATION',
        icon: '🗡️',
        color: '#ef9a9a',
        description: (amt) => `Deal 25% less attack damage. Lasts ${amt} turn${amt !== 1 ? 's' : ''}.`,
        onApply: null,
        onTurnStart: function (target) {
            const fx = _getEffect(target, 'WEAKNESS');
            if (!fx) return;
            fx.amount -= 1;
            if (fx.amount <= 0) {
                STS.Effects.remove(target, 'WEAKNESS');
            }
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    VULNERABLE: {
        id: 'VULNERABLE',
        name: 'Vulnerable',
        type: 'DEBUFF',
        stackType: 'DURATION',
        icon: '🛡️‍💥',
        color: '#ff8a65',
        description: (amt) => `Take 50% more damage. Lasts ${amt} turn${amt !== 1 ? 's' : ''}.`,
        onApply: null,
        onTurnStart: function (target) {
            const fx = _getEffect(target, 'VULNERABLE');
            if (!fx) return;
            fx.amount -= 1;
            if (fx.amount <= 0) {
                STS.Effects.remove(target, 'VULNERABLE');
            }
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    FRAIL: {
        id: 'FRAIL',
        name: 'Frail',
        type: 'DEBUFF',
        stackType: 'DURATION',
        icon: '💔',
        color: '#ce93d8',
        description: (amt) => `Gain 25% less Block from cards. Lasts ${amt} turn${amt !== 1 ? 's' : ''}.`,
        onApply: null,
        onTurnStart: function (target) {
            const fx = _getEffect(target, 'FRAIL');
            if (!fx) return;
            fx.amount -= 1;
            if (fx.amount <= 0) {
                STS.Effects.remove(target, 'FRAIL');
            }
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    CONSTRICTED: {
        id: 'CONSTRICTED',
        name: 'Constricted',
        type: 'DEBUFF',
        stackType: 'INTENSITY',
        icon: '🐍',
        color: '#8d6e63',
        description: (amt) => `Take ${amt} damage at the end of each turn.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: function (target) {
            const fx = _getEffect(target, 'CONSTRICTED');
            if (!fx) return;
            if (typeof STS.Game !== 'undefined' && STS.Game.dealDamage) {
                STS.Game.dealDamage(null, target, fx.amount, 1, { constrict: true });
            } else {
                target.hp = Math.max(0, (target.hp || 0) - fx.amount);
            }
        },
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    ENTANGLED: {
        id: 'ENTANGLED',
        name: 'Entangled',
        type: 'DEBUFF',
        stackType: 'SPECIAL',
        icon: '🕸️',
        color: '#a1887f',
        description: () => 'Cannot play Attacks this turn.',
        onApply: null,
        onTurnStart: function (target) {
            STS.Effects.remove(target, 'ENTANGLED');
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    NO_DRAW: {
        id: 'NO_DRAW',
        name: 'No Draw',
        type: 'DEBUFF',
        stackType: 'SPECIAL',
        icon: '🔒',
        color: '#78909c',
        description: () => 'You may not draw any more cards this turn.',
        onApply: null,
        onTurnStart: function (target) {
            STS.Effects.remove(target, 'NO_DRAW');
        },
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    },

    HEX: {
        id: 'HEX',
        name: 'Hex',
        type: 'DEBUFF',
        stackType: 'SPECIAL',
        icon: '🔮',
        color: '#7e57c2',
        description: (amt) => `Whenever you play a non-Attack card, shuffle ${amt} Dazed into your draw pile.`,
        onApply: null,
        onTurnStart: null,
        onTurnEnd: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onBlockGained: null,
        onRemove: null
    }
};

/* ======================================================================
 *  INTERNAL HELPERS
 * ====================================================================== */

/**
 * Safely retrieve the player reference from the game state.
 * @returns {Object|null}
 */
function _player() {
    if (typeof STS.Game !== 'undefined' && STS.Game.state && STS.Game.state.player) {
        return STS.Game.state.player;
    }
    return null;
}

/**
 * Return the live effect entry on a target, or null.
 * @param {Object} target
 * @param {string} effectId
 * @returns {Object|null} { amount, duration, source }
 */
function _getEffect(target, effectId) {
    if (!target || !target.statusEffects) return null;
    return target.statusEffects[effectId] || null;
}

/**
 * Ensure the statusEffects map exists on a target.
 * @param {Object} target
 */
function _ensureEffectsMap(target) {
    if (!target.statusEffects) {
        target.statusEffects = {};
    }
}

/**
 * Look up the definition for an effect id. Throws if unknown.
 * @param {string} effectId
 * @returns {EffectDefinition}
 */
function _getDef(effectId) {
    const def = EFFECT_DEFINITIONS[effectId];
    if (!def) {
        console.error(`[Effects] Unknown effect id: ${effectId}`);
        return null;
    }
    return def;
}

/**
 * Emit an event through the game event bus when available.
 * @param {string} event
 * @param {Object} data
 */
function _emit(event, data) {
    if (typeof STS.Events !== 'undefined' && STS.Events.emit) {
        STS.Events.emit(event, data);
    }
}

/* ======================================================================
 *  PUBLIC API – STS.Effects
 * ====================================================================== */

STS.Effects = {

    /** Expose definitions for UI look-ups and debugging. */
    definitions: EFFECT_DEFINITIONS,

    /* ------------------------------------------------------------------
     *  apply
     * ------------------------------------------------------------------ */

    /**
     * Apply (or stack) a status effect on a target.
     *
     * Handles Artifact negation for debuffs, stacking logic per stackType,
     * and fires the onApply handler + STATUS_APPLIED event.
     *
     * @param {Object}  target   - Player or enemy object with statusEffects.
     * @param {string}  effectId - Key into EFFECT_DEFINITIONS.
     * @param {number}  amount   - Stacks / duration / counter to apply.
     * @param {string}  [source=''] - Descriptive source for logging.
     * @returns {boolean} true if the effect was actually applied.
     */
    apply: function (target, effectId, amount, source) {
        if (!target) {
            console.warn('[Effects.apply] null target');
            return false;
        }

        const def = _getDef(effectId);
        if (!def) return false;

        _ensureEffectsMap(target);

        // --- Artifact negation for debuffs ---
        if (def.type === 'DEBUFF') {
            const artifact = _getEffect(target, 'ARTIFACT');
            if (artifact && artifact.amount > 0) {
                artifact.amount -= 1;
                if (artifact.amount <= 0) {
                    STS.Effects.remove(target, 'ARTIFACT');
                }
                _emit('STATUS_APPLIED', {
                    target,
                    effectId,
                    amount,
                    negated: true,
                    source: source || ''
                });
                if (typeof STS.Game !== 'undefined' && STS.Game.log) {
                    STS.Game.log(`Artifact negated ${def.name}!`, 'effect');
                }
                return false;
            }
        }

        // --- Stack or create the effect ---
        const existing = target.statusEffects[effectId];

        if (existing) {
            switch (def.stackType) {
                case 'INTENSITY':
                    existing.amount += amount;
                    break;
                case 'DURATION':
                    // Duration effects keep the higher value
                    existing.amount = Math.max(existing.amount, amount);
                    break;
                case 'COUNTER':
                    existing.amount += amount;
                    break;
                case 'SPECIAL':
                    // For special effects like Barricade, just refresh
                    existing.amount = amount || 1;
                    break;
                default:
                    existing.amount += amount;
            }
            existing.source = source || existing.source;
        } else {
            target.statusEffects[effectId] = {
                amount: amount,
                duration: amount,
                source: source || ''
            };
        }

        // --- onApply callback ---
        if (def.onApply) {
            def.onApply(target, amount);
        }

        _emit('STATUS_APPLIED', {
            target,
            effectId,
            amount,
            negated: false,
            source: source || ''
        });

        if (typeof STS.Game !== 'undefined' && STS.Game.log) {
            const sign = def.type === 'DEBUFF' ? '' : '+';
            STS.Game.log(
                `${target.name || 'Target'} gained ${sign}${amount} ${def.name}`,
                'effect'
            );
        }

        return true;
    },

    /* ------------------------------------------------------------------
     *  remove
     * ------------------------------------------------------------------ */

    /**
     * Fully remove a status effect from a target.
     *
     * @param {Object} target
     * @param {string} effectId
     */
    remove: function (target, effectId) {
        if (!target || !target.statusEffects) return;
        if (!target.statusEffects[effectId]) return;

        const def = _getDef(effectId);

        if (def && def.onRemove) {
            def.onRemove(target);
        }

        delete target.statusEffects[effectId];

        _emit('STATUS_REMOVED', { target, effectId });
    },

    /* ------------------------------------------------------------------
     *  tick  — process effects at a specific timing
     * ------------------------------------------------------------------ */

    /**
     * Tick all effects on a target for a given timing phase.
     *
     * @param {Object} target
     * @param {'TURN_START'|'TURN_END'} timing
     */
    tick: function (target, timing) {
        if (!target || !target.statusEffects) return;

        // Snapshot keys so mutations during iteration are safe
        const ids = Object.keys(target.statusEffects);

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            if (!target.statusEffects[id]) continue; // may have been removed

            const def = _getDef(id);
            if (!def) continue;

            if (timing === 'TURN_START' && def.onTurnStart) {
                def.onTurnStart(target);
            } else if (timing === 'TURN_END' && def.onTurnEnd) {
                def.onTurnEnd(target);
            }
        }
    },

    /* ------------------------------------------------------------------
     *  getAmount / hasEffect
     * ------------------------------------------------------------------ */

    /**
     * Get the current stack amount of an effect, or 0.
     *
     * @param {Object} target
     * @param {string} effectId
     * @returns {number}
     */
    getAmount: function (target, effectId) {
        const fx = _getEffect(target, effectId);
        return fx ? fx.amount : 0;
    },

    /**
     * Check whether a target currently has an effect.
     *
     * @param {Object} target
     * @param {string} effectId
     * @returns {boolean}
     */
    hasEffect: function (target, effectId) {
        return !!_getEffect(target, effectId);
    },

    /* ------------------------------------------------------------------
     *  getModifier  — real-time damage / block modifiers
     * ------------------------------------------------------------------ */

    /**
     * Calculate a multiplicative / additive modifier based on the target's
     * active effects.
     *
     * @param {Object} target   - The entity whose effects are queried.
     * @param {'DAMAGE_DEALT'|'DAMAGE_TAKEN'|'BLOCK_GAINED'} modType
     * @param {Object} [ctx={}] - Extra context: { baseDamage, baseBlock, attacker, defender }
     * @returns {{ flat: number, multiplier: number, consumed: string[] }}
     *   flat      – additive bonus/penalty applied BEFORE the multiplier
     *   multiplier – cumulative multiplier (starts at 1.0)
     *   consumed  – effect ids that should be removed after use
     */
    getModifier: function (target, modType, ctx) {
        ctx = ctx || {};
        const result = { flat: 0, multiplier: 1.0, consumed: [] };

        if (!target || !target.statusEffects) return result;

        switch (modType) {
            /* ----- outgoing attack damage ----- */
            case 'DAMAGE_DEALT': {
                // Strength
                const str = STS.Effects.getAmount(target, 'STRENGTH');
                if (str !== 0) {
                    result.flat += str;
                }

                // Vigor (consumed after use)
                const vigor = STS.Effects.getAmount(target, 'VIGOR');
                if (vigor > 0) {
                    result.flat += vigor;
                    result.consumed.push('VIGOR');
                }

                // Weakness (-25 %)
                if (STS.Effects.hasEffect(target, 'WEAKNESS')) {
                    result.multiplier *= 0.75;
                }
                break;
            }

            /* ----- incoming damage ----- */
            case 'DAMAGE_TAKEN': {
                // Vulnerable (+50 %)
                if (STS.Effects.hasEffect(target, 'VULNERABLE')) {
                    result.multiplier *= 1.5;
                }

                // Intangible (reduce to 1) – handled externally as a cap, but
                // we signal via a special multiplier of 0 so the caller can clamp.
                if (STS.Effects.hasEffect(target, 'INTANGIBLE')) {
                    result.intangible = true;
                }
                break;
            }

            /* ----- block gained ----- */
            case 'BLOCK_GAINED': {
                // Dexterity
                const dex = STS.Effects.getAmount(target, 'DEXTERITY');
                if (dex !== 0) {
                    result.flat += dex;
                }

                // Frail (-25 %)
                if (STS.Effects.hasEffect(target, 'FRAIL')) {
                    result.multiplier *= 0.75;
                }
                break;
            }

            default:
                console.warn(`[Effects.getModifier] Unknown modType: ${modType}`);
        }

        return result;
    },

    /* ------------------------------------------------------------------
     *  getDescription
     * ------------------------------------------------------------------ */

    /**
     * Return the human-readable description for an effect at a given amount.
     *
     * @param {string} effectId
     * @param {number} amount
     * @returns {string}
     */
    getDescription: function (effectId, amount) {
        const def = _getDef(effectId);
        if (!def) return '';
        return def.description(amount);
    },

    /* ------------------------------------------------------------------
     *  clearAll / clearDebuffs / clearBuffs
     * ------------------------------------------------------------------ */

    /**
     * Remove every status effect on a target.
     *
     * @param {Object} target
     */
    clearAll: function (target) {
        if (!target || !target.statusEffects) return;
        const ids = Object.keys(target.statusEffects);
        for (let i = 0; i < ids.length; i++) {
            STS.Effects.remove(target, ids[i]);
        }
    },

    /**
     * Remove all debuffs from a target.
     *
     * @param {Object} target
     */
    clearDebuffs: function (target) {
        if (!target || !target.statusEffects) return;
        const ids = Object.keys(target.statusEffects);
        for (let i = 0; i < ids.length; i++) {
            const def = _getDef(ids[i]);
            if (def && def.type === 'DEBUFF') {
                STS.Effects.remove(target, ids[i]);
            }
        }
    },

    /**
     * Remove all buffs from a target.
     *
     * @param {Object} target
     */
    clearBuffs: function (target) {
        if (!target || !target.statusEffects) return;
        const ids = Object.keys(target.statusEffects);
        for (let i = 0; i < ids.length; i++) {
            const def = _getDef(ids[i]);
            if (def && def.type === 'BUFF') {
                STS.Effects.remove(target, ids[i]);
            }
        }
    },

    /* ------------------------------------------------------------------
     *  Utility helpers
     * ------------------------------------------------------------------ */

    /**
     * Return an array of { id, def, amount } for every active effect on a target.
     * Useful for rendering the effect bar in the UI.
     *
     * @param {Object} target
     * @returns {Array<{ id: string, def: EffectDefinition, amount: number }>}
     */
    getActiveEffects: function (target) {
        if (!target || !target.statusEffects) return [];
        const out = [];
        const ids = Object.keys(target.statusEffects);
        for (let i = 0; i < ids.length; i++) {
            const def = _getDef(ids[i]);
            if (!def) continue;
            out.push({
                id: ids[i],
                def: def,
                amount: target.statusEffects[ids[i]].amount
            });
        }
        return out;
    },

    /**
     * Notify the effect system that a card was played. Handles Enrage and Hex.
     *
     * @param {Object} target - The entity that played the card.
     * @param {Object} card   - The card that was played.
     */
    onCardPlayed: function (target, card) {
        if (!target || !target.statusEffects) return;

        // Enrage: gain Strength when a Skill is played
        if (card && card.type === 'SKILL' && STS.Effects.hasEffect(target, 'ENRAGE')) {
            const amt = STS.Effects.getAmount(target, 'ENRAGE');
            STS.Effects.apply(target, 'STRENGTH', amt, 'Enrage');
        }

        // Hex: add Dazed to draw pile when a non-Attack is played
        if (card && card.type !== 'ATTACK' && STS.Effects.hasEffect(target, 'HEX')) {
            const hexAmt = STS.Effects.getAmount(target, 'HEX');
            if (typeof STS.Game !== 'undefined' && STS.Game.state) {
                for (let h = 0; h < hexAmt; h++) {
                    const dazed = _createDazed();
                    if (dazed && STS.Game.state.player.drawPile) {
                        STS.Game.state.player.drawPile.push(dazed);
                    }
                }
                if (typeof STS.Game.log === 'function') {
                    STS.Game.log(`Hex added ${hexAmt} Dazed to draw pile.`, 'effect');
                }
            }
        }
    },

    /**
     * Notify the effect system that damage was dealt to a target.
     * Handles Plated Armor reduction and Thorns retaliation.
     *
     * @param {Object} attacker - Who dealt the damage (may be null for effects).
     * @param {Object} target   - Who received the damage.
     * @param {number} totalDamage - Total damage before block.
     * @param {number} unblockedDamage - Damage that passed through block to HP.
     */
    onDamageTaken: function (attacker, target, totalDamage, unblockedDamage) {
        if (!target || !target.statusEffects) return;

        // Plated Armor
        const plated = EFFECT_DEFINITIONS.PLATED_ARMOR;
        if (plated.onDamageTaken && STS.Effects.hasEffect(target, 'PLATED_ARMOR')) {
            plated.onDamageTaken(target, totalDamage, unblockedDamage);
        }

        // Thorns – deal damage back to the attacker
        if (attacker && STS.Effects.hasEffect(target, 'THORNS')) {
            const thorns = STS.Effects.getAmount(target, 'THORNS');
            if (thorns > 0 && typeof STS.Game !== 'undefined' && STS.Game.dealDamage) {
                STS.Game.dealDamage(target, attacker, thorns, 1, { thorns: true });
            }
        }
    },

    /**
     * Check whether a target is prevented from playing attacks (Entangled).
     *
     * @param {Object} target
     * @returns {boolean}
     */
    canPlayAttack: function (target) {
        return !STS.Effects.hasEffect(target, 'ENTANGLED');
    },

    /**
     * Check whether a target is allowed to draw cards (No Draw).
     *
     * @param {Object} target
     * @returns {boolean}
     */
    canDraw: function (target) {
        return !STS.Effects.hasEffect(target, 'NO_DRAW');
    }
};

/* ======================================================================
 *  PRIVATE – Dazed card factory (used by Hex)
 * ====================================================================== */

/**
 * Create a Dazed status card instance.
 * @returns {Object} A Dazed card object.
 */
function _createDazed() {
    if (typeof STS.Game !== 'undefined' && STS.Game.createCardInstance) {
        return STS.Game.createCardInstance({
            id: 'DAZED',
            name: 'Dazed',
            type: 'STATUS',
            rarity: 'STATUS',
            energy: -1,
            description: 'Unplayable. Ethereal.',
            damage: 0,
            block: 0,
            exhaust: false,
            ethereal: true,
            unplayable: true,
            effects: []
        });
    }
    // Fallback when game engine hasn't loaded yet
    return {
        id: 'DAZED',
        name: 'Dazed',
        type: 'STATUS',
        rarity: 'STATUS',
        energy: -1,
        description: 'Unplayable. Ethereal.',
        damage: 0,
        block: 0,
        exhaust: false,
        ethereal: true,
        unplayable: true,
        effects: [],
        instanceId: Date.now() + Math.random()
    };
}

console.log('[STS] effects.js loaded –', Object.keys(EFFECT_DEFINITIONS).length, 'effects registered');
