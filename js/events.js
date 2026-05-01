window.STS = window.STS || {};

(function () {
    'use strict';

    var _currentEvent = null;
    var _currentResult = null;

    /* ====================================================================== */
    /*  Helpers                                                               */
    /* ====================================================================== */

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function healPlayer(amount) {
        var state = getState();
        if (!state) return 0;
        var before = state.player.hp;
        state.player.hp = Math.min(state.player.hp + amount, state.player.maxHp);
        return state.player.hp - before;
    }

    function damagePlayer(amount) {
        var state = getState();
        if (!state) return 0;
        state.player.hp = Math.max(0, state.player.hp - amount);
        return amount;
    }

    function addGold(amount) {
        var state = getState();
        if (!state) return;
        state.player.gold = Math.max(0, (state.player.gold || 0) + amount);
    }

    function hasGold(amount) {
        var state = getState();
        if (!state) return false;
        return (state.player.gold || 0) >= amount;
    }

    function getState() {
        if (typeof STS.Game !== 'undefined' && STS.Game.state && STS.Game.state.player) {
            return STS.Game.state;
        }
        return null;
    }

    function removeRandomCard(state) {
        if (!state || !state.player || !Array.isArray(state.player.deck) || state.player.deck.length === 0) {
            return null;
        }
        var idx = Math.floor(Math.random() * state.player.deck.length);
        return state.player.deck.splice(idx, 1)[0];
    }

    function upgradeRandomCard(state) {
        if (!state || !state.player || !Array.isArray(state.player.deck)) return null;
        var upgradeable = [];
        for (var i = 0; i < state.player.deck.length; i++) {
            if (!state.player.deck[i].upgraded) {
                upgradeable.push(i);
            }
        }
        if (upgradeable.length === 0) return null;
        var idx = upgradeable[Math.floor(Math.random() * upgradeable.length)];
        var card = state.player.deck[idx];
        card.upgraded = true;
        if (card.name && card.name.indexOf('+') === -1) {
            card.name = card.name + '+';
        }
        if (typeof STS.Cards !== 'undefined' && STS.Cards.applyUpgrade) {
            STS.Cards.applyUpgrade(card);
        }
        return card;
    }

    function transformRandomCard(state) {
        var removed = removeRandomCard(state);
        if (!removed) return null;
        if (typeof STS.Cards !== 'undefined' && STS.Cards.getRandomCard) {
            var newCard = STS.Cards.getRandomCard();
            state.player.deck.push(newCard);
            return { removed: removed, added: newCard };
        }
        return { removed: removed, added: null };
    }

    function giveRandomRelic(state) {
        if (typeof STS.Relics === 'undefined') return null;
        var rarities = ['COMMON', 'UNCOMMON', 'RARE'];
        var rarity = rarities[Math.floor(Math.random() * rarities.length)];
        var relic = STS.Relics.getRandomRelic(rarity);
        if (relic && state && state.player) {
            if (!Array.isArray(state.player.relics)) state.player.relics = [];
            state.player.relics.push(relic);
            if (typeof relic.onPickup === 'function') {
                try { relic.onPickup.call(relic, state); } catch (e) { console.error(e); }
            }
        }
        return relic;
    }

    function giveRandomPotion(state) {
        if (typeof STS.Potions === 'undefined' || !STS.Potions.getRandomPotion) return null;
        var potion = STS.Potions.getRandomPotion();
        if (potion && state && state.player) {
            if (!Array.isArray(state.player.potions)) state.player.potions = [];
            var maxPotions = state.player.maxPotions || 3;
            if (state.player.potions.length < maxPotions) {
                state.player.potions.push(potion);
                return potion;
            }
        }
        return null;
    }

    function addCurseToPlayerDeck(state) {
        if (!state || !state.player || !Array.isArray(state.player.deck)) return;
        var curse = {
            id: 'CURSE_REGRET',
            name: 'Regret',
            type: 'CURSE',
            cost: -1,
            description: 'Unplayable. At the end of your turn, lose 1 HP for each card in your hand.',
            rarity: 'CURSE',
            playable: false,
            exhaustOnPlay: false
        };
        if (typeof STS.Cards !== 'undefined' && STS.Cards.createInstance) {
            var c = STS.Cards.createInstance('CURSE_REGRET');
            if (c) { curse = c; }
        }
        state.player.deck.push(curse);
    }

    /* ====================================================================== */
    /*  Event Definitions                                                     */
    /* ====================================================================== */

    var definitions = {

        /* ------------------------------------------------------------------ */
        /*  ACT 1                                                             */
        /* ------------------------------------------------------------------ */

        BIG_FISH: {
            id: 'BIG_FISH',
            name: 'Big Fish',
            description: 'You come across a massive golden fish lying on the riverbank. Its scales shimmer in the fading light.',
            image: 'event-fish',
            act: [1, 2],
            options: [
                {
                    text: 'Eat (Heal 5 HP)',
                    effect: function (state) {
                        healPlayer(5);
                        return 'You eat the fish and feel restored. Healed 5 HP.';
                    }
                },
                {
                    text: 'Feed (Gain 5 Max HP)',
                    effect: function (state) {
                        state.player.maxHp += 5;
                        healPlayer(5);
                        return 'The fish transforms and blesses you. Max HP increased by 5.';
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'You leave the strange fish behind.';
                    }
                }
            ]
        },

        THE_CLERIC: {
            id: 'THE_CLERIC',
            name: 'The Cleric',
            description: 'A wandering cleric offers services in exchange for gold.',
            image: 'event-cleric',
            act: [1],
            options: [
                {
                    text: 'Heal (35 Gold) – Heal 25% Max HP',
                    condition: function (state) {
                        return hasGold(35);
                    },
                    effect: function (state) {
                        addGold(-35);
                        var amount = Math.floor(state.player.maxHp * 0.25);
                        healPlayer(amount);
                        return 'The Cleric heals your wounds. Healed ' + amount + ' HP.';
                    }
                },
                {
                    text: 'Purify (50 Gold) – Remove a card',
                    condition: function (state) {
                        return hasGold(50) && state.player.deck && state.player.deck.length > 0;
                    },
                    effect: function (state) {
                        addGold(-50);
                        var removed = removeRandomCard(state);
                        var cardName = removed ? removed.name : 'a card';
                        return 'The Cleric purifies your soul. Removed ' + cardName + ' from your deck.';
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'You nod and walk away.';
                    }
                }
            ]
        },

        GOLDEN_SHRINE: {
            id: 'GOLDEN_SHRINE',
            name: 'Golden Shrine',
            description: 'A golden shrine radiates warmth. An inscription reads: "Offer your devotion."',
            image: 'event-shrine',
            act: [1, 2],
            options: [
                {
                    text: 'Pray (Gain 100 Gold)',
                    effect: function (state) {
                        addGold(100);
                        return 'You bow your head. 100 Gold materializes in your pack.';
                    }
                },
                {
                    text: 'Desecrate (Gain 275 Gold, gain a Curse)',
                    effect: function (state) {
                        addGold(275);
                        addCurseToPlayerDeck(state);
                        return 'You defile the shrine. 275 Gold pours out, but darkness clings to your deck.';
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'You leave the shrine undisturbed.';
                    }
                }
            ]
        },

        LIVING_WALL: {
            id: 'LIVING_WALL',
            name: 'Living Wall',
            description: 'A wall of vines blocks the path. Faces peer from the foliage, whispering offers.',
            image: 'event-wall',
            act: [1],
            options: [
                {
                    text: 'Forget (Remove a card)',
                    condition: function (state) {
                        return state.player.deck && state.player.deck.length > 0;
                    },
                    effect: function (state) {
                        var removed = removeRandomCard(state);
                        return 'The wall absorbs ' + (removed ? removed.name : 'a card') + ' from your mind.';
                    }
                },
                {
                    text: 'Change (Transform a card)',
                    condition: function (state) {
                        return state.player.deck && state.player.deck.length > 0;
                    },
                    effect: function (state) {
                        var result = transformRandomCard(state);
                        if (result) {
                            return 'The wall reshapes ' + (result.removed ? result.removed.name : 'a card') +
                                (result.added ? ' into ' + result.added.name : '') + '.';
                        }
                        return 'The wall shifts but nothing changes.';
                    }
                },
                {
                    text: 'Grow (Upgrade a card)',
                    condition: function (state) {
                        return state.player.deck && state.player.deck.length > 0;
                    },
                    effect: function (state) {
                        var upgraded = upgradeRandomCard(state);
                        if (upgraded) {
                            return 'The wall\'s energy flows into ' + upgraded.name + '.';
                        }
                        return 'No cards could be upgraded.';
                    }
                }
            ]
        },

        SCRAP_OOZE: {
            id: 'SCRAP_OOZE',
            name: 'Scrap Ooze',
            description: 'A heap of scrap metal and slime blocks the corridor. Something gleams inside.',
            image: 'event-ooze',
            act: [1],
            options: [
                {
                    text: 'Reach In (Take 3 damage, 75% chance for a relic)',
                    effect: function (state) {
                        damagePlayer(3);
                        if (Math.random() < 0.75) {
                            var relic = giveRandomRelic(state);
                            if (relic) {
                                return 'You wince as slime burns your hand (-3 HP), but pull out ' + relic.name + '!';
                            }
                            return 'You wince (-3 HP), but find a small trinket.';
                        }
                        damagePlayer(3);
                        return 'You reach in and the ooze bites! You take 6 total damage and find nothing.';
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'You carefully step around the ooze.';
                    }
                }
            ]
        },

        WORLD_OF_GOOP: {
            id: 'WORLD_OF_GOOP',
            name: 'World of Goop',
            description: 'The floor is covered in shimmering golden goop. Gold coins are scattered throughout.',
            image: 'event-goop',
            act: [1],
            options: [
                {
                    text: 'Gather Gold (Gain 75 Gold, lose 11 HP)',
                    effect: function (state) {
                        addGold(75);
                        damagePlayer(11);
                        return 'You scoop up handfuls of gold (+75 Gold), but the goop burns (-11 HP)!';
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'Not worth the risk. You move on.';
                    }
                }
            ]
        },

        BONFIRE_SPIRITS: {
            id: 'BONFIRE_SPIRITS',
            name: 'Bonfire Spirits',
            description: 'Spirits dance around a warm bonfire, beckoning you to offer something.',
            image: 'event-bonfire',
            act: [1, 2],
            options: [
                {
                    text: 'Offer a card (Remove a card, heal to full)',
                    condition: function (state) {
                        return state.player.deck && state.player.deck.length > 0;
                    },
                    effect: function (state) {
                        var removed = removeRandomCard(state);
                        state.player.hp = state.player.maxHp;
                        return 'The spirits accept ' + (removed ? removed.name : 'your offering') +
                            ' and restore you fully.';
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'You warm yourself briefly and move on.';
                    }
                }
            ]
        },

        THE_LIBRARY: {
            id: 'THE_LIBRARY',
            name: 'The Library',
            description: 'You stumble upon an ancient library. Dusty tomes line endless shelves.',
            image: 'event-library',
            act: [1, 2],
            options: [
                {
                    text: 'Read (Choose from 3 random cards)',
                    effect: function (state) {
                        if (typeof STS.Cards !== 'undefined' && STS.Cards.getRandomCard) {
                            var choices = [];
                            for (var i = 0; i < 3; i++) {
                                var c = STS.Cards.getRandomCard();
                                if (c) choices.push(c);
                            }
                            if (choices.length > 0) {
                                var picked = choices[Math.floor(Math.random() * choices.length)];
                                state.player.deck.push(picked);
                                return 'You study the tomes and learn ' + picked.name + '.';
                            }
                        }
                        return 'The books crumble at your touch. You learn nothing.';
                    }
                },
                {
                    text: 'Sleep (Heal 30% Max HP)',
                    effect: function (state) {
                        var amount = Math.floor(state.player.maxHp * 0.30);
                        healPlayer(amount);
                        return 'You doze off in a cozy alcove. Healed ' + amount + ' HP.';
                    }
                }
            ]
        },

        /* ------------------------------------------------------------------ */
        /*  ACT 1-2                                                           */
        /* ------------------------------------------------------------------ */

        DRUG_DEALER: {
            id: 'DRUG_DEALER',
            name: 'Drug Dealer',
            description: 'A hooded figure blocks your path, offering strange vials filled with swirling liquid.',
            image: 'event-dealer',
            act: [1, 2],
            options: [
                {
                    text: 'Inject (Gain a random potion)',
                    effect: function (state) {
                        var potion = giveRandomPotion(state);
                        if (potion) {
                            return 'You drink the vial. Gained ' + potion.name + '.';
                        }
                        return 'Your potion slots are full. The liquid spills.';
                    }
                },
                {
                    text: 'Negotiate (2 random potions, lose 10% Max HP)',
                    effect: function (state) {
                        var hpLoss = Math.max(1, Math.floor(state.player.maxHp * 0.10));
                        state.player.maxHp -= hpLoss;
                        state.player.hp = Math.min(state.player.hp, state.player.maxHp);
                        var names = [];
                        for (var i = 0; i < 2; i++) {
                            var p = giveRandomPotion(state);
                            if (p) names.push(p.name);
                        }
                        return 'You negotiate hard. Lost ' + hpLoss + ' Max HP. Gained: ' +
                            (names.length > 0 ? names.join(', ') : 'nothing (slots full)') + '.';
                    }
                },
                {
                    text: '[Refuse]',
                    effect: function () {
                        return '"Your loss," the figure mutters, and vanishes.';
                    }
                }
            ]
        },

        /* ------------------------------------------------------------------ */
        /*  ACT 2                                                             */
        /* ------------------------------------------------------------------ */

        FORGOTTEN_ALTAR: {
            id: 'FORGOTTEN_ALTAR',
            name: 'Forgotten Altar',
            description: 'An altar stained with ancient blood hums with power. Offerings may yield great rewards.',
            image: 'event-altar',
            act: [2],
            options: [
                {
                    text: 'Sacrifice (Lose 25% current HP, gain a relic)',
                    effect: function (state) {
                        var hpLoss = Math.max(1, Math.floor(state.player.hp * 0.25));
                        damagePlayer(hpLoss);
                        var relic = giveRandomRelic(state);
                        return 'Blood drips onto the altar (-' + hpLoss + ' HP). ' +
                            (relic ? 'You receive ' + relic.name + '.' : 'Nothing happens.');
                    }
                },
                {
                    text: 'Offer Gold (Pay 100 Gold, gain a relic)',
                    condition: function (state) {
                        return hasGold(100);
                    },
                    effect: function (state) {
                        addGold(-100);
                        var relic = giveRandomRelic(state);
                        return 'You place 100 Gold on the altar. ' +
                            (relic ? 'It transforms into ' + relic.name + '.' : 'The gold vanishes.');
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'You back away from the altar slowly.';
                    }
                }
            ]
        },

        MYSTERIOUS_SPHERE: {
            id: 'MYSTERIOUS_SPHERE',
            name: 'Mysterious Sphere',
            description: 'A strange metallic sphere floats silently before you, emitting a low hum.',
            image: 'event-sphere',
            act: [2],
            options: [
                {
                    text: 'Open (Fight an elite for a relic)',
                    effect: function (state) {
                        if (typeof STS.Game !== 'undefined' && STS.Game.startEliteCombat) {
                            STS.Game.startEliteCombat({ eventSource: true, rewardRelic: true });
                            return 'The sphere shatters and a guardian emerges!';
                        }
                        var relic = giveRandomRelic(state);
                        damagePlayer(15);
                        return 'The sphere explodes (-15 HP)! ' +
                            (relic ? 'Inside you find ' + relic.name + '.' : 'It was empty.');
                    }
                },
                {
                    text: '[Leave]',
                    effect: function () {
                        return 'Best not to tamper with the unknown.';
                    }
                }
            ]
        },

        VAMPIRES: {
            id: 'VAMPIRES',
            name: 'Vampires',
            description: 'A coven of vampires blocks your path. Their leader steps forward with an offer.',
            image: 'event-vampires',
            act: [2],
            options: [
                {
                    text: 'Accept (Lose all Strikes, gain 5 Bites, lose Burning Blood)',
                    effect: function (state) {
                        if (!state.player.deck) return 'Something went wrong.';

                        var removed = 0;
                        for (var i = state.player.deck.length - 1; i >= 0; i--) {
                            if (state.player.deck[i].id === 'STRIKE' || state.player.deck[i].id === 'STRIKE_R') {
                                state.player.deck.splice(i, 1);
                                removed++;
                            }
                        }

                        for (var j = 0; j < 5; j++) {
                            var bite = {
                                id: 'BITE',
                                name: 'Bite',
                                type: 'ATTACK',
                                cost: 1,
                                damage: 7,
                                description: 'Deal 7 damage. Heal 2 HP.',
                                rarity: 'SPECIAL',
                                healOnPlay: 2
                            };
                            if (typeof STS.Cards !== 'undefined' && STS.Cards.createInstance) {
                                var b = STS.Cards.createInstance('BITE');
                                if (b) bite = b;
                            }
                            state.player.deck.push(bite);
                        }

                        if (typeof STS.Relics !== 'undefined') {
                            STS.Relics.removeRelicFromPlayer('BURNING_BLOOD');
                        }

                        return 'You accept the dark gift. Removed ' + removed +
                            ' Strikes, gained 5 Bites, lost Burning Blood.';
                    }
                },
                {
                    text: 'Refuse (Fight the vampires)',
                    effect: function (state) {
                        if (typeof STS.Game !== 'undefined' && STS.Game.startEliteCombat) {
                            STS.Game.startEliteCombat({
                                eventSource: true,
                                enemyGroup: 'VAMPIRES',
                                rewardRelic: false
                            });
                            return 'The vampires bare their fangs! Prepare for battle!';
                        }
                        damagePlayer(20);
                        return 'You fight the vampires and barely escape (-20 HP).';
                    }
                }
            ]
        }
    };

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */
    /*  Named EventEncounters so we do NOT overwrite STS.Events from game.js
     *  (the publish/subscribe bus: on / off / emit / clear).                */

    STS.EventEncounters = {

        definitions: definitions,

        /**
         * Get a random event appropriate for the given act number.
         * Avoids returning events the player has already seen this run.
         */
        getRandomEvent: function (act) {
            act = act || 1;
            var state = getState();
            var seen = {};
            if (state && Array.isArray(state.seenEvents)) {
                for (var s = 0; s < state.seenEvents.length; s++) {
                    seen[state.seenEvents[s]] = true;
                }
            }

            var pool = [];
            var ids = Object.keys(definitions);
            for (var i = 0; i < ids.length; i++) {
                var evt = definitions[ids[i]];
                if (evt.act && evt.act.indexOf(act) !== -1 && !seen[evt.id]) {
                    pool.push(evt);
                }
            }

            if (pool.length === 0) {
                // All seen – reset and allow repeats
                pool = [];
                for (var j = 0; j < ids.length; j++) {
                    var e2 = definitions[ids[j]];
                    if (e2.act && e2.act.indexOf(act) !== -1) {
                        pool.push(e2);
                    }
                }
            }

            if (pool.length === 0) return null;
            return pool[Math.floor(Math.random() * pool.length)];
        },

        /**
         * Start an event by id.  Sets `_currentEvent` and returns the event object.
         */
        startEvent: function (eventId) {
            var evt = definitions[eventId];
            if (!evt) {
                console.warn('[Events] Unknown event id: ' + eventId);
                return null;
            }

            _currentEvent = {
                definition: evt,
                availableOptions: this._resolveOptions(evt)
            };
            _currentResult = null;

            var state = getState();
            if (state) {
                if (!Array.isArray(state.seenEvents)) state.seenEvents = [];
                if (state.seenEvents.indexOf(eventId) === -1) {
                    state.seenEvents.push(eventId);
                }
            }

            if (typeof STS.UI !== 'undefined' && STS.UI.showEvent) {
                STS.UI.showEvent(_currentEvent);
            }

            return _currentEvent;
        },

        /**
         * Choose an option by index.  Executes the option's effect and
         * returns the result text.
         */
        chooseOption: function (optionIndex) {
            if (!_currentEvent) {
                console.warn('[Events] No active event.');
                return null;
            }

            var options = _currentEvent.availableOptions;
            if (optionIndex < 0 || optionIndex >= options.length) {
                console.warn('[Events] Invalid option index: ' + optionIndex);
                return null;
            }

            var option = options[optionIndex];
            var state = getState();
            var resultText = '';

            if (typeof option.effect === 'function') {
                try {
                    resultText = option.effect(state) || '';
                } catch (err) {
                    console.error('[Events] Error executing option:', err);
                    resultText = 'Something went wrong...';
                }
            }

            _currentResult = {
                eventId: _currentEvent.definition.id,
                optionIndex: optionIndex,
                optionText: option.text,
                resultText: resultText
            };

            if (typeof STS.UI !== 'undefined' && STS.UI.showEventResult) {
                STS.UI.showEventResult(_currentResult);
            }

            return _currentResult;
        },

        /**
         * Return the active event or null.
         */
        getCurrentEvent: function () {
            return _currentEvent;
        },

        /**
         * Return the result of the last option chosen.
         */
        getCurrentResult: function () {
            return _currentResult;
        },

        /**
         * Close the current event.
         */
        closeEvent: function () {
            _currentEvent = null;
            _currentResult = null;
        },

        /**
         * Return all event definitions for a given act.
         */
        getEventsForAct: function (act) {
            var result = [];
            var ids = Object.keys(definitions);
            for (var i = 0; i < ids.length; i++) {
                var evt = definitions[ids[i]];
                if (evt.act && evt.act.indexOf(act) !== -1) {
                    result.push(evt);
                }
            }
            return result;
        },

        /* ------------------------------------------------------------------ */
        /*  Internal helpers                                                  */
        /* ------------------------------------------------------------------ */

        /**
         * Filter options by their condition function (if any).
         */
        _resolveOptions: function (evt) {
            var state = getState();
            var available = [];
            if (!evt.options) return available;

            for (var i = 0; i < evt.options.length; i++) {
                var opt = evt.options[i];
                if (typeof opt.condition === 'function') {
                    try {
                        if (!opt.condition(state)) continue;
                    } catch (e) {
                        continue;
                    }
                }
                available.push(opt);
            }
            return available;
        }
    };
})();
