window.STS = window.STS || {};

(function () {
    'use strict';

    var _instanceCounter = 0;

    var RARITY = {
        STARTER: 'STARTER',
        COMMON: 'COMMON',
        UNCOMMON: 'UNCOMMON',
        RARE: 'RARE',
        BOSS: 'BOSS',
        SHOP: 'SHOP',
        EVENT: 'EVENT'
    };

    var definitions = {

        /* ------------------------------------------------------------------ */
        /*  STARTER                                                           */
        /* ------------------------------------------------------------------ */

        BURNING_BLOOD: {
            id: 'BURNING_BLOOD',
            name: 'Burning Blood',
            description: 'At the end of combat, heal 6 HP.',
            rarity: RARITY.STARTER,
            image: 'burning-blood',
            color: '#ff4444',
            counter: -1,
            maxCounter: -1,
            flavorText: 'The old blood still burns.',

            onCombatEnd: function (state) {
                if (!state || !state.player) return;
                var before = state.player.hp;
                state.player.hp = Math.min(state.player.hp + 6, state.player.maxHp);
                var healed = state.player.hp - before;
                if (healed > 0 && typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                    STS.Combat.log('Burning Blood heals ' + healed + ' HP.');
                }
                return { healed: healed };
            }
        },

        /* ------------------------------------------------------------------ */
        /*  COMMON                                                            */
        /* ------------------------------------------------------------------ */

        ANCHOR: {
            id: 'ANCHOR',
            name: 'Anchor',
            description: 'Start each combat with 10 Block.',
            rarity: RARITY.COMMON,
            image: 'anchor',
            color: '#5599cc',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Holding this, you feel grounded.',

            onCombatStart: function (state) {
                if (!state || !state.player) return;
                state.player.block = (state.player.block || 0) + 10;
                return { blockGained: 10 };
            }
        },

        BAG_OF_MARBLES: {
            id: 'BAG_OF_MARBLES',
            name: 'Bag of Marbles',
            description: 'At the start of combat, apply 1 Vulnerable to ALL enemies.',
            rarity: RARITY.COMMON,
            image: 'bag-of-marbles',
            color: '#aaddff',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Such pretty colors...',

            onCombatStart: function (state) {
                if (!state || !state.enemies) return;
                for (var i = 0; i < state.enemies.length; i++) {
                    var enemy = state.enemies[i];
                    if (enemy && enemy.hp > 0) {
                        enemy.vulnerable = (enemy.vulnerable || 0) + 1;
                    }
                }
                return { applied: 'Vulnerable', amount: 1 };
            }
        },

        BLOOD_VIAL: {
            id: 'BLOOD_VIAL',
            name: 'Blood Vial',
            description: 'At the start of combat, heal 2 HP.',
            rarity: RARITY.COMMON,
            image: 'blood-vial',
            color: '#cc2222',
            counter: -1,
            maxCounter: -1,
            flavorText: 'A vial of thick red liquid.',

            onCombatStart: function (state) {
                if (!state || !state.player) return;
                var before = state.player.hp;
                state.player.hp = Math.min(state.player.hp + 2, state.player.maxHp);
                return { healed: state.player.hp - before };
            }
        },

        BRONZE_SCALES: {
            id: 'BRONZE_SCALES',
            name: 'Bronze Scales',
            description: 'Whenever you take attack damage, deal 3 damage back.',
            rarity: RARITY.COMMON,
            image: 'bronze-scales',
            color: '#cc8844',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Forged from the scales of a bronze dragon.',

            onDamageTaken: function (state, data) {
                if (!data || !data.source || data.source === 'self' || data.type === 'poison' || data.type === 'burn') return;
                var attacker = data.sourceEnemy;
                if (attacker && attacker.hp > 0) {
                    attacker.hp = Math.max(0, attacker.hp - 3);
                    if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                        STS.Combat.log('Bronze Scales deals 3 damage to ' + (attacker.name || 'enemy') + '.');
                    }
                    return { thorns: 3, target: attacker };
                }
            }
        },

        ORICHALCUM: {
            id: 'ORICHALCUM',
            name: 'Orichalcum',
            description: 'If you end your turn with 0 Block, gain 6 Block.',
            rarity: RARITY.COMMON,
            image: 'orichalcum',
            color: '#ddaa33',
            counter: -1,
            maxCounter: -1,
            flavorText: 'A shard of the mythical metal.',

            onTurnEnd: function (state) {
                if (!state || !state.player) return;
                if ((state.player.block || 0) === 0) {
                    state.player.block = 6;
                    return { blockGained: 6 };
                }
            }
        },

        VAJRA: {
            id: 'VAJRA',
            name: 'Vajra',
            description: 'At the start of each combat, gain 1 Strength.',
            rarity: RARITY.COMMON,
            image: 'vajra',
            color: '#ff6666',
            counter: -1,
            maxCounter: -1,
            flavorText: 'The thunderbolt of the gods.',

            onPickup: function (state) {
                if (!state || !state.player) return;
                state.player.strength = (state.player.strength || 0) + 1;
                return { strengthGained: 1 };
            },

            onCombatStart: function (state) {
                if (!state || !state.player) return;
                state.player.strength = (state.player.strength || 0) + 1;
                return { strengthGained: 1 };
            }
        },

        ODDLY_SMOOTH_STONE: {
            id: 'ODDLY_SMOOTH_STONE',
            name: 'Oddly Smooth Stone',
            description: 'At the start of each combat, gain 1 Dexterity.',
            rarity: RARITY.COMMON,
            image: 'oddly-smooth-stone',
            color: '#77cc77',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Suspiciously smooth.',

            onPickup: function (state) {
                if (!state || !state.player) return;
                state.player.dexterity = (state.player.dexterity || 0) + 1;
                return { dexterityGained: 1 };
            },

            onCombatStart: function (state) {
                if (!state || !state.player) return;
                state.player.dexterity = (state.player.dexterity || 0) + 1;
                return { dexterityGained: 1 };
            }
        },

        /* ------------------------------------------------------------------ */
        /*  UNCOMMON                                                          */
        /* ------------------------------------------------------------------ */

        HORN_CLEAT: {
            id: 'HORN_CLEAT',
            name: 'Horn Cleat',
            description: 'At the start of your 2nd turn each combat, gain 14 Block.',
            rarity: RARITY.UNCOMMON,
            image: 'horn-cleat',
            color: '#8899aa',
            counter: 0,
            maxCounter: 2,
            flavorText: 'Sailors swear by it.',

            onCombatStart: function () {
                this.counter = 0;
            },

            onTurnStart: function (state) {
                this.counter++;
                if (this.counter === 2) {
                    if (!state || !state.player) return;
                    state.player.block = (state.player.block || 0) + 14;
                    return { blockGained: 14 };
                }
            }
        },

        NUNCHAKU: {
            id: 'NUNCHAKU',
            name: 'Nunchaku',
            description: 'Every time you play 10 Attacks, gain 1 Energy.',
            rarity: RARITY.UNCOMMON,
            image: 'nunchaku',
            color: '#bb8855',
            counter: 0,
            maxCounter: 10,
            flavorText: 'A weapon that requires discipline.',

            onCardPlayed: function (state, card) {
                if (!card || card.type !== 'ATTACK') return;
                this.counter = (this.counter || 0) + 1;
                if (this.counter >= 10) {
                    this.counter = 0;
                    if (state && state.player) {
                        state.player.energy = (state.player.energy || 0) + 1;
                        if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                            STS.Combat.log('Nunchaku grants 1 Energy!');
                        }
                        return { energyGained: 1 };
                    }
                }
            }
        },

        PEN_NIB: {
            id: 'PEN_NIB',
            name: 'Pen Nib',
            description: 'Every 10th Attack you play deals double damage.',
            rarity: RARITY.UNCOMMON,
            image: 'pen-nib',
            color: '#334466',
            counter: 0,
            maxCounter: 10,
            flavorText: 'Mightier than the sword.',

            onCardPlayed: function (state, card) {
                if (!card || card.type !== 'ATTACK') return;
                this.counter = (this.counter || 0) + 1;
                if (this.counter >= 10) {
                    this.counter = 0;
                    if (state && state.player) {
                        state.player.penNibActive = true;
                        if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                            STS.Combat.log('Pen Nib activates! Next attack deals double damage!');
                        }
                        return { penNibActive: true };
                    }
                }
            }
        },

        SHURIKEN: {
            id: 'SHURIKEN',
            name: 'Shuriken',
            description: 'Every time you play 3 Attacks in a single turn, gain 1 Strength.',
            rarity: RARITY.UNCOMMON,
            image: 'shuriken',
            color: '#666666',
            counter: 0,
            maxCounter: 3,
            flavorText: 'A weapon of precision.',

            onTurnStart: function () {
                this._turnAttacks = 0;
            },

            onCombatStart: function () {
                this._turnAttacks = 0;
            },

            onCardPlayed: function (state, card) {
                if (!card || card.type !== 'ATTACK') return;
                this._turnAttacks = (this._turnAttacks || 0) + 1;
                if (this._turnAttacks >= 3) {
                    this._turnAttacks = 0;
                    if (state && state.player) {
                        state.player.strength = (state.player.strength || 0) + 1;
                        if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                            STS.Combat.log('Shuriken grants 1 Strength!');
                        }
                        return { strengthGained: 1 };
                    }
                }
            }
        },

        KUNAI: {
            id: 'KUNAI',
            name: 'Kunai',
            description: 'Every time you play 3 Attacks in a single turn, gain 1 Dexterity.',
            rarity: RARITY.UNCOMMON,
            image: 'kunai',
            color: '#445566',
            counter: 0,
            maxCounter: 3,
            flavorText: 'A hidden blade for the worthy.',

            onTurnStart: function () {
                this._turnAttacks = 0;
            },

            onCombatStart: function () {
                this._turnAttacks = 0;
            },

            onCardPlayed: function (state, card) {
                if (!card || card.type !== 'ATTACK') return;
                this._turnAttacks = (this._turnAttacks || 0) + 1;
                if (this._turnAttacks >= 3) {
                    this._turnAttacks = 0;
                    if (state && state.player) {
                        state.player.dexterity = (state.player.dexterity || 0) + 1;
                        if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                            STS.Combat.log('Kunai grants 1 Dexterity!');
                        }
                        return { dexterityGained: 1 };
                    }
                }
            }
        },

        MEAT_ON_THE_BONE: {
            id: 'MEAT_ON_THE_BONE',
            name: 'Meat on the Bone',
            description: 'If you are at 50% HP or less at the end of combat, heal 12 HP.',
            rarity: RARITY.UNCOMMON,
            image: 'meat-on-the-bone',
            color: '#dd5533',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Still good.',

            onCombatEnd: function (state) {
                if (!state || !state.player) return;
                if (state.player.hp <= Math.floor(state.player.maxHp / 2)) {
                    var before = state.player.hp;
                    state.player.hp = Math.min(state.player.hp + 12, state.player.maxHp);
                    var healed = state.player.hp - before;
                    if (healed > 0 && typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                        STS.Combat.log('Meat on the Bone heals ' + healed + ' HP.');
                    }
                    return { healed: healed };
                }
            }
        },

        /* ------------------------------------------------------------------ */
        /*  RARE                                                              */
        /* ------------------------------------------------------------------ */

        DEAD_BRANCH: {
            id: 'DEAD_BRANCH',
            name: 'Dead Branch',
            description: 'Whenever you Exhaust a card, add a random card to your hand.',
            rarity: RARITY.RARE,
            image: 'dead-branch',
            color: '#664422',
            counter: -1,
            maxCounter: -1,
            flavorText: 'From the World Tree itself.',

            onCardExhausted: function (state) {
                if (!state || !state.player) return;
                var newCard = null;
                if (typeof STS.Cards !== 'undefined' && STS.Cards.getRandomCard) {
                    newCard = STS.Cards.getRandomCard();
                }
                if (newCard && state.player.hand) {
                    state.player.hand.push(newCard);
                    if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                        STS.Combat.log('Dead Branch adds ' + newCard.name + ' to your hand.');
                    }
                    return { cardAdded: newCard };
                }
            }
        },

        TUNGSTEN_ROD: {
            id: 'TUNGSTEN_ROD',
            name: 'Tungsten Rod',
            description: 'Whenever you would lose HP, lose 1 less.',
            rarity: RARITY.RARE,
            image: 'tungsten-rod',
            color: '#aaaaaa',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Absurdly heavy.',

            onDamageTaken: function (state, data) {
                if (!data) return;
                if (typeof data.damage === 'number' && data.damage > 0) {
                    data.damage = Math.max(1, data.damage - 1);
                    if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                        STS.Combat.log('Tungsten Rod reduces damage by 1.');
                    }
                    return { damageReduced: 1 };
                }
            }
        },

        TORII: {
            id: 'TORII',
            name: 'Torii',
            description: 'Whenever you receive attack damage of 5 or less, reduce it to 1.',
            rarity: RARITY.RARE,
            image: 'torii',
            color: '#ff3333',
            counter: -1,
            maxCounter: -1,
            flavorText: 'A gate to another world.',

            onDamageTaken: function (state, data) {
                if (!data) return;
                if (data.type === 'attack' && typeof data.damage === 'number' && data.damage > 0 && data.damage <= 5) {
                    var reduced = data.damage - 1;
                    data.damage = 1;
                    if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                        STS.Combat.log('Torii reduces damage to 1.');
                    }
                    return { damageReduced: reduced };
                }
            }
        },

        CENTENNIAL_PUZZLE: {
            id: 'CENTENNIAL_PUZZLE',
            name: 'Centennial Puzzle',
            description: 'The first time you lose HP each combat, draw 3 cards.',
            rarity: RARITY.RARE,
            image: 'centennial-puzzle',
            color: '#9966cc',
            counter: -1,
            maxCounter: -1,
            flavorText: 'You can barely make out the picture.',

            onCombatStart: function () {
                this._triggeredThisCombat = false;
            },

            onDamageTaken: function (state, data) {
                if (this._triggeredThisCombat) return;
                if (!data || typeof data.damage !== 'number' || data.damage <= 0) return;
                this._triggeredThisCombat = true;
                if (typeof STS.Combat !== 'undefined' && STS.Combat.drawCards) {
                    STS.Combat.drawCards(3);
                    if (STS.Combat.log) {
                        STS.Combat.log('Centennial Puzzle draws 3 cards!');
                    }
                }
                return { cardsDrawn: 3 };
            }
        },

        /* ------------------------------------------------------------------ */
        /*  BOSS                                                              */
        /* ------------------------------------------------------------------ */

        BLACK_STAR: {
            id: 'BLACK_STAR',
            name: 'Black Star',
            description: 'Elites drop an additional Relic.',
            rarity: RARITY.BOSS,
            image: 'black-star',
            color: '#222244',
            counter: -1,
            maxCounter: -1,
            flavorText: 'It pulses with dark energy.'
        },

        CURSED_KEY: {
            id: 'CURSED_KEY',
            name: 'Cursed Key',
            description: 'Gain 1 Energy at the start of each turn. Whenever you open a non-boss chest, obtain a Curse.',
            rarity: RARITY.BOSS,
            image: 'cursed-key',
            color: '#993399',
            counter: -1,
            maxCounter: -1,
            flavorText: 'It feels wrong to hold.',

            onPickup: function (state) {
                if (!state || !state.player) return;
                state.player.maxEnergy = (state.player.maxEnergy || 3) + 1;
                return { maxEnergyGained: 1 };
            }
        },

        /* ------------------------------------------------------------------ */
        /*  SHOP                                                              */
        /* ------------------------------------------------------------------ */

        MEMBERSHIP_CARD: {
            id: 'MEMBERSHIP_CARD',
            name: 'Membership Card',
            description: '50% discount at shops.',
            rarity: RARITY.SHOP,
            image: 'membership-card',
            color: '#ffcc00',
            counter: -1,
            maxCounter: -1,
            flavorText: 'Courtesy of the Merchant Guild.'
        },

        LEES_WAFFLE: {
            id: 'LEES_WAFFLE',
            name: "Lee's Waffle",
            description: 'Raise Max HP by 7. Heal all HP.',
            rarity: RARITY.SHOP,
            image: 'lees-waffle',
            color: '#ffdd88',
            counter: -1,
            maxCounter: -1,
            flavorText: "Lee's secret recipe.",

            onPickup: function (state) {
                if (!state || !state.player) return;
                state.player.maxHp = (state.player.maxHp || 80) + 7;
                state.player.hp = state.player.maxHp;
                return { maxHpGained: 7, healedToFull: true };
            }
        }
    };

    /* ====================================================================== */
    /*  Helper: deep-clone a relic definition into a live instance            */
    /* ====================================================================== */

    function cloneDefinition(def) {
        var instance = {};
        var keys = Object.keys(def);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (typeof def[k] === 'function') {
                instance[k] = def[k];
            } else if (typeof def[k] === 'object' && def[k] !== null) {
                instance[k] = JSON.parse(JSON.stringify(def[k]));
            } else {
                instance[k] = def[k];
            }
        }
        return instance;
    }

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    STS.Relics = {

        definitions: definitions,

        RARITY: RARITY,

        /**
         * Create a live relic instance from a definition id.
         * Each instance gets a unique `instanceId` for UI flash targeting.
         */
        createInstance: function (relicId) {
            var def = definitions[relicId];
            if (!def) {
                console.warn('[Relics] Unknown relic id: ' + relicId);
                return null;
            }
            var instance = cloneDefinition(def);
            instance.instanceId = 'relic_' + (++_instanceCounter);
            return instance;
        },

        /**
         * Fire an event across every relic the player currently holds.
         *
         * @param {string}  event  One of: CombatStart, CombatEnd, TurnStart,
         *                         TurnEnd, CardPlayed, DamageDealt, DamageTaken,
         *                         Heal, GoldChanged, BlockGained, PotionUsed,
         *                         EnemyDied, CardExhausted, DrawCard, Pickup
         * @param {*}       data   Payload passed as second arg to the handler.
         * @returns {Array}        Collected non-undefined return values.
         */
        trigger: function (event, data) {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player || !Array.isArray(state.player.relics)) return [];

            var handlerName = 'on' + event;
            var results = [];

            for (var i = 0; i < state.player.relics.length; i++) {
                var relic = state.player.relics[i];
                if (!relic) continue;
                var handler = relic[handlerName];
                if (typeof handler === 'function') {
                    try {
                        var result = handler.call(relic, state, data);
                        if (result !== undefined) {
                            results.push(result);
                        }
                        if (typeof STS.UI !== 'undefined' && STS.UI.flashRelic) {
                            STS.UI.flashRelic(relic.instanceId);
                        }
                    } catch (err) {
                        console.error('[Relics] Error in ' + relic.id + '.' + handlerName + ':', err);
                    }
                }
            }
            return results;
        },

        /**
         * Convenience: return a fresh Burning Blood instance.
         */
        getStarterRelic: function () {
            return this.createInstance('BURNING_BLOOD');
        },

        /**
         * Return all relic ids that match the given rarity.
         */
        getRelicPool: function (rarity) {
            var pool = [];
            var ids = Object.keys(definitions);
            for (var i = 0; i < ids.length; i++) {
                if (definitions[ids[i]].rarity === rarity) {
                    pool.push(ids[i]);
                }
            }
            return pool;
        },

        /**
         * Return a random relic instance of the requested rarity.
         * If the player already owns a relic in the pool the method keeps trying
         * (up to the pool size) so duplicates are avoided.
         */
        getRandomRelic: function (rarity) {
            var pool = this.getRelicPool(rarity);
            if (pool.length === 0) return null;

            var owned = {};
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (state && state.player && Array.isArray(state.player.relics)) {
                for (var j = 0; j < state.player.relics.length; j++) {
                    owned[state.player.relics[j].id] = true;
                }
            }

            var available = [];
            for (var k = 0; k < pool.length; k++) {
                if (!owned[pool[k]]) {
                    available.push(pool[k]);
                }
            }

            if (available.length === 0) return null;
            var idx = Math.floor(Math.random() * available.length);
            return this.createInstance(available[idx]);
        },

        /**
         * Build a human-readable description string for a relic instance.
         */
        getDescription: function (relic) {
            if (!relic) return '';
            var text = relic.name + ': ' + relic.description;
            if (relic.flavorText) {
                text += '\n"' + relic.flavorText + '"';
            }
            return text;
        },

        /**
         * Return an array of *all* definition objects (not instances).
         */
        getAllRelics: function () {
            var all = [];
            var ids = Object.keys(definitions);
            for (var i = 0; i < ids.length; i++) {
                all.push(definitions[ids[i]]);
            }
            return all;
        },

        /**
         * Check whether the player owns a specific relic by id.
         */
        playerHasRelic: function (relicId) {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player || !Array.isArray(state.player.relics)) return false;
            for (var i = 0; i < state.player.relics.length; i++) {
                if (state.player.relics[i].id === relicId) return true;
            }
            return false;
        },

        /**
         * Return the live relic instance with the given id from the player's relics.
         */
        getPlayerRelic: function (relicId) {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player || !Array.isArray(state.player.relics)) return null;
            for (var i = 0; i < state.player.relics.length; i++) {
                if (state.player.relics[i].id === relicId) return state.player.relics[i];
            }
            return null;
        },

        /**
         * Give a relic to the player by definition id.
         * Fires the onPickup handler automatically.
         */
        addRelicToPlayer: function (relicId) {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player) {
                console.warn('[Relics] Cannot add relic – no player state.');
                return null;
            }
            if (!Array.isArray(state.player.relics)) {
                state.player.relics = [];
            }

            if (this.playerHasRelic(relicId)) {
                console.warn('[Relics] Player already owns ' + relicId);
                return null;
            }

            var instance = this.createInstance(relicId);
            if (!instance) return null;

            state.player.relics.push(instance);

            if (typeof instance.onPickup === 'function') {
                try {
                    instance.onPickup.call(instance, state);
                } catch (err) {
                    console.error('[Relics] onPickup error for ' + relicId + ':', err);
                }
            }

            if (typeof STS.UI !== 'undefined' && STS.UI.updateRelics) {
                STS.UI.updateRelics();
            }

            return instance;
        },

        /**
         * Remove a relic from the player's inventory by id.
         */
        removeRelicFromPlayer: function (relicId) {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player || !Array.isArray(state.player.relics)) return false;
            for (var i = 0; i < state.player.relics.length; i++) {
                if (state.player.relics[i].id === relicId) {
                    state.player.relics.splice(i, 1);
                    if (typeof STS.UI !== 'undefined' && STS.UI.updateRelics) {
                        STS.UI.updateRelics();
                    }
                    return true;
                }
            }
            return false;
        },

        /**
         * Reset per-combat state on all player relics (counters, flags).
         * Called at combat start before onCombatStart triggers.
         */
        resetCombatState: function () {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player || !Array.isArray(state.player.relics)) return;

            for (var i = 0; i < state.player.relics.length; i++) {
                var relic = state.player.relics[i];
                if (relic._triggeredThisCombat !== undefined) {
                    relic._triggeredThisCombat = false;
                }
                if (relic._turnAttacks !== undefined) {
                    relic._turnAttacks = 0;
                }
            }
        }
    };
})();
