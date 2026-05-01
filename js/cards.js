window.STS = window.STS || {};

(function() {
    'use strict';

    var _nextInstanceId = 1;

    var CARD_COLORS = {
        ATTACK: '#dc3545',
        SKILL: '#4a90d9',
        POWER: '#f0ad4e',
        STATUS: '#6c757d',
        CURSE: '#8b008b'
    };

    // =========================================================================
    //  CARD DEFINITIONS
    // =========================================================================

    var definitions = {

        // =====================================================================
        //  STARTER CARDS
        // =====================================================================

        STRIKE: {
            id: 'STRIKE',
            name: 'Strike',
            type: 'ATTACK',
            rarity: 'STARTER',
            energy: 1,
            damage: 6,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 6 damage.',
            upgraded: false,
            upgradeName: 'Strike+',
            upgradeDamage: 9,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 9 damage.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-strike'
        },

        DEFEND: {
            id: 'DEFEND',
            name: 'Defend',
            type: 'SKILL',
            rarity: 'STARTER',
            energy: 1,
            damage: 0,
            block: 5,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 5 Block.',
            upgraded: false,
            upgradeName: 'Defend+',
            upgradeDamage: 0,
            upgradeBlock: 8,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 8 Block.',
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-defend'
        },

        BASH: {
            id: 'BASH',
            name: 'Bash',
            type: 'ATTACK',
            rarity: 'STARTER',
            energy: 2,
            damage: 8,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 8 damage. Apply 2 Vulnerable.',
            upgraded: false,
            upgradeName: 'Bash+',
            upgradeDamage: 10,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 10 damage. Apply 3 Vulnerable.',
            effect: function(state, targetIndex, card) {
                var vulnAmount = card.upgraded ? 3 : 2;
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
                STS.Effects.apply(state.combat.enemies[targetIndex], 'VULNERABLE', vulnAmount, 'Bash');
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-bash'
        },

        // =====================================================================
        //  COMMON ATTACKS
        // =====================================================================

        CLEAVE: {
            id: 'CLEAVE',
            name: 'Cleave',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 1,
            damage: 8,
            block: 0,
            target: 'ALL',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 8 damage to ALL enemies.',
            upgraded: false,
            upgradeName: 'Cleave+',
            upgradeDamage: 11,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 11 damage to ALL enemies.',
            effect: function(state, targetIndex, card) {
                for (var i = 0; i < state.combat.enemies.length; i++) {
                    if (state.combat.enemies[i].hp > 0) {
                        STS.Game.dealDamage('player', i, card.damage, 1);
                    }
                }
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-cleave'
        },

        IRON_WAVE: {
            id: 'IRON_WAVE',
            name: 'Iron Wave',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 1,
            damage: 5,
            block: 5,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 5 Block. Deal 5 damage.',
            upgraded: false,
            upgradeName: 'Iron Wave+',
            upgradeDamage: 7,
            upgradeBlock: 7,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 7 Block. Deal 7 damage.',
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-iron-wave'
        },

        POMMEL_STRIKE: {
            id: 'POMMEL_STRIKE',
            name: 'Pommel Strike',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 1,
            damage: 9,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 9 damage. Draw 1 card.',
            upgraded: false,
            upgradeName: 'Pommel Strike+',
            upgradeDamage: 10,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 10 damage. Draw 2 cards.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
                var drawCount = card.upgraded ? 2 : 1;
                STS.Game.drawCards(drawCount);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-pommel-strike'
        },

        TWIN_STRIKE: {
            id: 'TWIN_STRIKE',
            name: 'Twin Strike',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 1,
            damage: 5,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 5 damage twice.',
            upgraded: false,
            upgradeName: 'Twin Strike+',
            upgradeDamage: 7,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 7 damage twice.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-twin-strike'
        },

        ANGER: {
            id: 'ANGER',
            name: 'Anger',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 0,
            damage: 6,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 6 damage. Add a copy of this card to your discard pile.',
            upgraded: false,
            upgradeName: 'Anger+',
            upgradeDamage: 8,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 8 damage. Add a copy of this card to your discard pile.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
                var copy = STS.Cards.createInstance('ANGER');
                if (card.upgraded) {
                    STS.Cards.upgradeCard(copy);
                }
                state.combat.discardPile.push(copy);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-anger'
        },

        BODY_SLAM: {
            id: 'BODY_SLAM',
            name: 'Body Slam',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal damage equal to your current Block.',
            upgraded: false,
            upgradeName: 'Body Slam+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: 0,
            upgradeDescription: 'Deal damage equal to your current Block.',
            effect: function(state, targetIndex, card) {
                var dmg = state.player.block || 0;
                STS.Game.dealDamage('player', targetIndex, dmg, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-body-slam'
        },

        CLASH: {
            id: 'CLASH',
            name: 'Clash',
            type: 'ATTACK',
            rarity: 'COMMON',
            energy: 0,
            damage: 14,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Can only be played if every card in your hand is an Attack. Deal 14 damage.',
            upgraded: false,
            upgradeName: 'Clash+',
            upgradeDamage: 18,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Can only be played if every card in your hand is an Attack. Deal 18 damage.',
            canPlay: function(state) {
                var hand = state.combat.hand;
                for (var i = 0; i < hand.length; i++) {
                    if (hand[i].type !== 'ATTACK') {
                        return false;
                    }
                }
                return true;
            },
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-clash'
        },

        // =====================================================================
        //  COMMON SKILLS
        // =====================================================================

        SHRUG_IT_OFF: {
            id: 'SHRUG_IT_OFF',
            name: 'Shrug It Off',
            type: 'SKILL',
            rarity: 'COMMON',
            energy: 1,
            damage: 0,
            block: 8,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 8 Block. Draw 1 card.',
            upgraded: false,
            upgradeName: 'Shrug It Off+',
            upgradeDamage: 0,
            upgradeBlock: 11,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 11 Block. Draw 1 card.',
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
                STS.Game.drawCards(1);
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-shrug-it-off'
        },

        TRUE_GRIT: {
            id: 'TRUE_GRIT',
            name: 'True Grit',
            type: 'SKILL',
            rarity: 'COMMON',
            energy: 1,
            damage: 0,
            block: 7,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 7 Block. Exhaust a random card from your hand.',
            upgraded: false,
            upgradeName: 'True Grit+',
            upgradeDamage: 0,
            upgradeBlock: 9,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 9 Block. Choose a card in your hand to Exhaust.',
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
                if (card.upgraded) {
                    STS.Game.promptExhaustCard(state);
                } else {
                    var hand = state.combat.hand;
                    var candidates = [];
                    for (var i = 0; i < hand.length; i++) {
                        if (hand[i].instanceId !== card.instanceId) {
                            candidates.push(i);
                        }
                    }
                    if (candidates.length > 0) {
                        var idx = candidates[Math.floor(Math.random() * candidates.length)];
                        STS.Game.exhaustCard(state, idx);
                    }
                }
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-true-grit'
        },

        ARMAMENTS: {
            id: 'ARMAMENTS',
            name: 'Armaments',
            type: 'SKILL',
            rarity: 'COMMON',
            energy: 1,
            damage: 0,
            block: 5,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 5 Block. Upgrade a random card in your hand for the rest of combat.',
            upgraded: false,
            upgradeName: 'Armaments+',
            upgradeDamage: 0,
            upgradeBlock: 5,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 5 Block. Upgrade ALL cards in your hand for the rest of combat.',
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
                var hand = state.combat.hand;
                if (card.upgraded) {
                    for (var i = 0; i < hand.length; i++) {
                        if (!hand[i].upgraded) {
                            STS.Cards.upgradeCard(hand[i]);
                        }
                    }
                } else {
                    var upgradeable = [];
                    for (var i = 0; i < hand.length; i++) {
                        if (!hand[i].upgraded && hand[i].instanceId !== card.instanceId) {
                            upgradeable.push(hand[i]);
                        }
                    }
                    if (upgradeable.length > 0) {
                        var chosen = upgradeable[Math.floor(Math.random() * upgradeable.length)];
                        STS.Cards.upgradeCard(chosen);
                    }
                }
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-armaments'
        },

        HAVOC: {
            id: 'HAVOC',
            name: 'Havoc',
            type: 'SKILL',
            rarity: 'COMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Play the top card of your draw pile and Exhaust it.',
            upgraded: false,
            upgradeName: 'Havoc+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: 0,
            upgradeDescription: 'Play the top card of your draw pile and Exhaust it.',
            effect: function(state, targetIndex, card) {
                if (state.combat.drawPile.length > 0) {
                    var topCard = state.combat.drawPile.pop();
                    STS.Game.playCard(state, topCard, targetIndex, true);
                }
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-havoc'
        },

        // =====================================================================
        //  UNCOMMON ATTACKS
        // =====================================================================

        CARNAGE: {
            id: 'CARNAGE',
            name: 'Carnage',
            type: 'ATTACK',
            rarity: 'UNCOMMON',
            energy: 2,
            damage: 20,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: true,
            innate: false,
            unplayable: false,
            description: 'Ethereal. Deal 20 damage.',
            upgraded: false,
            upgradeName: 'Carnage+',
            upgradeDamage: 28,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Ethereal. Deal 28 damage.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-carnage'
        },

        UPPERCUT: {
            id: 'UPPERCUT',
            name: 'Uppercut',
            type: 'ATTACK',
            rarity: 'UNCOMMON',
            energy: 2,
            damage: 13,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 13 damage. Apply 1 Weak. Apply 1 Vulnerable.',
            upgraded: false,
            upgradeName: 'Uppercut+',
            upgradeDamage: 13,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 13 damage. Apply 2 Weak. Apply 2 Vulnerable.',
            effect: function(state, targetIndex, card) {
                var debuffAmount = card.upgraded ? 2 : 1;
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
                STS.Effects.apply(state.combat.enemies[targetIndex], 'WEAK', debuffAmount, 'Uppercut');
                STS.Effects.apply(state.combat.enemies[targetIndex], 'VULNERABLE', debuffAmount, 'Uppercut');
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-uppercut'
        },

        RAMPAGE: {
            id: 'RAMPAGE',
            name: 'Rampage',
            type: 'ATTACK',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 8,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 8 damage. Increase this card\'s damage by 5 for the rest of combat.',
            upgraded: false,
            upgradeName: 'Rampage+',
            upgradeDamage: 8,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 8 damage. Increase this card\'s damage by 8 for the rest of combat.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
                var increase = card.upgraded ? 8 : 5;
                card.damage += increase;
                card.description = 'Deal ' + card.damage + ' damage. Increase this card\'s damage by ' + increase + ' for the rest of combat.';
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-rampage'
        },

        HEMOKINESIS: {
            id: 'HEMOKINESIS',
            name: 'Hemokinesis',
            type: 'ATTACK',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 15,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Lose 2 HP. Deal 15 damage.',
            upgraded: false,
            upgradeName: 'Hemokinesis+',
            upgradeDamage: 20,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Lose 2 HP. Deal 20 damage.',
            effect: function(state, targetIndex, card) {
                STS.Game.loseHP('player', 2);
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-hemokinesis'
        },

        WHIRLWIND: {
            id: 'WHIRLWIND',
            name: 'Whirlwind',
            type: 'ATTACK',
            rarity: 'UNCOMMON',
            energy: -1,
            damage: 5,
            block: 0,
            target: 'ALL',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 5 damage to ALL enemies X times.',
            upgraded: false,
            upgradeName: 'Whirlwind+',
            upgradeDamage: 8,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 8 damage to ALL enemies X times.',
            effect: function(state, targetIndex, card) {
                var times = state.player.energy;
                state.player.energy = 0;
                for (var t = 0; t < times; t++) {
                    for (var i = 0; i < state.combat.enemies.length; i++) {
                        if (state.combat.enemies[i].hp > 0) {
                            STS.Game.dealDamage('player', i, card.damage, 1);
                        }
                    }
                }
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-whirlwind'
        },

        SEARING_BLOW: {
            id: 'SEARING_BLOW',
            name: 'Searing Blow',
            type: 'ATTACK',
            rarity: 'UNCOMMON',
            energy: 2,
            damage: 12,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 12 damage. Can be upgraded any number of times.',
            upgraded: false,
            upgradeName: 'Searing Blow+',
            upgradeDamage: 16,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 16 damage. Can be upgraded any number of times.',
            _upgradeCount: 0,
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-searing-blow'
        },

        // =====================================================================
        //  UNCOMMON SKILLS
        // =====================================================================

        BATTLE_TRANCE: {
            id: 'BATTLE_TRANCE',
            name: 'Battle Trance',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 0,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Draw 3 cards. You cannot draw additional cards this turn.',
            upgraded: false,
            upgradeName: 'Battle Trance+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Draw 4 cards. You cannot draw additional cards this turn.',
            effect: function(state, targetIndex, card) {
                var drawCount = card.upgraded ? 4 : 3;
                STS.Game.drawCards(drawCount);
                state.combat.noDrawThisTurn = true;
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-battle-trance'
        },

        BLOODLETTING: {
            id: 'BLOODLETTING',
            name: 'Bloodletting',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 0,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Lose 3 HP. Gain 2 Energy.',
            upgraded: false,
            upgradeName: 'Bloodletting+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Lose 3 HP. Gain 3 Energy.',
            effect: function(state, targetIndex, card) {
                STS.Game.loseHP('player', 3);
                var energyGain = card.upgraded ? 3 : 2;
                state.player.energy += energyGain;
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-bloodletting'
        },

        BURNING_PACT: {
            id: 'BURNING_PACT',
            name: 'Burning Pact',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust 1 card. Draw 2 cards.',
            upgraded: false,
            upgradeName: 'Burning Pact+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Exhaust 1 card. Draw 3 cards.',
            effect: function(state, targetIndex, card) {
                var drawCount = card.upgraded ? 3 : 2;
                STS.Game.promptExhaustCard(state, function() {
                    STS.Game.drawCards(drawCount);
                });
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-burning-pact'
        },

        DISARM: {
            id: 'DISARM',
            name: 'Disarm',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SINGLE',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust. Enemy loses 2 Strength.',
            upgraded: false,
            upgradeName: 'Disarm+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Exhaust. Enemy loses 3 Strength.',
            effect: function(state, targetIndex, card) {
                var strLoss = card.upgraded ? 3 : 2;
                STS.Effects.apply(state.combat.enemies[targetIndex], 'STRENGTH', -strLoss, 'Disarm');
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-disarm'
        },

        INTIMIDATE: {
            id: 'INTIMIDATE',
            name: 'Intimidate',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 0,
            damage: 0,
            block: 0,
            target: 'ALL',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust. Apply 1 Weak to ALL enemies.',
            upgraded: false,
            upgradeName: 'Intimidate+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Exhaust. Apply 2 Weak to ALL enemies.',
            effect: function(state, targetIndex, card) {
                var weakAmount = card.upgraded ? 2 : 1;
                for (var i = 0; i < state.combat.enemies.length; i++) {
                    if (state.combat.enemies[i].hp > 0) {
                        STS.Effects.apply(state.combat.enemies[i], 'WEAK', weakAmount, 'Intimidate');
                    }
                }
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-intimidate'
        },

        SENTINEL: {
            id: 'SENTINEL',
            name: 'Sentinel',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 0,
            block: 5,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 5 Block. If this card is Exhausted, gain 2 Energy.',
            upgraded: false,
            upgradeName: 'Sentinel+',
            upgradeDamage: 0,
            upgradeBlock: 8,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 8 Block. If this card is Exhausted, gain 3 Energy.',
            onExhaust: function(state, card) {
                var energyGain = card.upgraded ? 3 : 2;
                state.player.energy += energyGain;
            },
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-sentinel'
        },

        SHOCKWAVE: {
            id: 'SHOCKWAVE',
            name: 'Shockwave',
            type: 'SKILL',
            rarity: 'UNCOMMON',
            energy: 2,
            damage: 0,
            block: 0,
            target: 'ALL',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust. Apply 3 Weak and 3 Vulnerable to ALL enemies.',
            upgraded: false,
            upgradeName: 'Shockwave+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Exhaust. Apply 5 Weak and 5 Vulnerable to ALL enemies.',
            effect: function(state, targetIndex, card) {
                var amount = card.upgraded ? 5 : 3;
                for (var i = 0; i < state.combat.enemies.length; i++) {
                    if (state.combat.enemies[i].hp > 0) {
                        STS.Effects.apply(state.combat.enemies[i], 'WEAK', amount, 'Shockwave');
                        STS.Effects.apply(state.combat.enemies[i], 'VULNERABLE', amount, 'Shockwave');
                    }
                }
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-shockwave'
        },

        // =====================================================================
        //  UNCOMMON POWERS
        // =====================================================================

        INFLAME: {
            id: 'INFLAME',
            name: 'Inflame',
            type: 'POWER',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Gain 2 Strength.',
            upgraded: false,
            upgradeName: 'Inflame+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Gain 3 Strength.',
            effect: function(state, targetIndex, card) {
                var strGain = card.upgraded ? 3 : 2;
                STS.Effects.apply(state.player, 'STRENGTH', strGain, 'Inflame');
            },
            color: CARD_COLORS.POWER,
            artClass: 'card-art-inflame'
        },

        METALLICIZE: {
            id: 'METALLICIZE',
            name: 'Metallicize',
            type: 'POWER',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'At the end of your turn, gain 3 Block.',
            upgraded: false,
            upgradeName: 'Metallicize+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'At the end of your turn, gain 4 Block.',
            effect: function(state, targetIndex, card) {
                var blockAmount = card.upgraded ? 4 : 3;
                STS.Game.addPower(state.player, {
                    id: 'METALLICIZE',
                    name: 'Metallicize',
                    amount: blockAmount,
                    type: 'BUFF',
                    onTurnEnd: function(owner, power) {
                        STS.Game.gainBlock('player', power.amount);
                    }
                });
            },
            color: CARD_COLORS.POWER,
            artClass: 'card-art-metallicize'
        },

        COMBUST: {
            id: 'COMBUST',
            name: 'Combust',
            type: 'POWER',
            rarity: 'UNCOMMON',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'At the end of your turn, lose 1 HP and deal 5 damage to ALL enemies.',
            upgraded: false,
            upgradeName: 'Combust+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'At the end of your turn, lose 1 HP and deal 7 damage to ALL enemies.',
            effect: function(state, targetIndex, card) {
                var dmg = card.upgraded ? 7 : 5;
                STS.Game.addPower(state.player, {
                    id: 'COMBUST',
                    name: 'Combust',
                    amount: dmg,
                    type: 'BUFF',
                    onTurnEnd: function(owner, power, gameState) {
                        STS.Game.loseHP('player', 1);
                        for (var i = 0; i < gameState.combat.enemies.length; i++) {
                            if (gameState.combat.enemies[i].hp > 0) {
                                STS.Game.dealDamage('player', i, power.amount, 1);
                            }
                        }
                    }
                });
            },
            color: CARD_COLORS.POWER,
            artClass: 'card-art-combust'
        },

        // =====================================================================
        //  RARE ATTACKS
        // =====================================================================

        BLUDGEON: {
            id: 'BLUDGEON',
            name: 'Bludgeon',
            type: 'ATTACK',
            rarity: 'RARE',
            energy: 3,
            damage: 32,
            block: 0,
            target: 'SINGLE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 32 damage.',
            upgraded: false,
            upgradeName: 'Bludgeon+',
            upgradeDamage: 42,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 42 damage.',
            effect: function(state, targetIndex, card) {
                STS.Game.dealDamage('player', targetIndex, card.damage, 1);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-bludgeon'
        },

        IMMOLATE: {
            id: 'IMMOLATE',
            name: 'Immolate',
            type: 'ATTACK',
            rarity: 'RARE',
            energy: 2,
            damage: 21,
            block: 0,
            target: 'ALL',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 21 damage to ALL enemies. Add a Burn to your discard pile.',
            upgraded: false,
            upgradeName: 'Immolate+',
            upgradeDamage: 28,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 28 damage to ALL enemies. Add a Burn to your discard pile.',
            effect: function(state, targetIndex, card) {
                for (var i = 0; i < state.combat.enemies.length; i++) {
                    if (state.combat.enemies[i].hp > 0) {
                        STS.Game.dealDamage('player', i, card.damage, 1);
                    }
                }
                var burn = STS.Cards.createInstance('BURN');
                state.combat.discardPile.push(burn);
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-immolate'
        },

        REAPER: {
            id: 'REAPER',
            name: 'Reaper',
            type: 'ATTACK',
            rarity: 'RARE',
            energy: 2,
            damage: 4,
            block: 0,
            target: 'ALL',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Deal 4 damage to ALL enemies. Heal HP equal to unblocked damage dealt.',
            upgraded: false,
            upgradeName: 'Reaper+',
            upgradeDamage: 5,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Deal 5 damage to ALL enemies. Heal HP equal to unblocked damage dealt.',
            effect: function(state, targetIndex, card) {
                var totalHealing = 0;
                for (var i = 0; i < state.combat.enemies.length; i++) {
                    if (state.combat.enemies[i].hp > 0) {
                        var enemy = state.combat.enemies[i];
                        var blocked = Math.min(enemy.block || 0, card.damage);
                        var unblocked = Math.max(0, card.damage - blocked);
                        var actualDamage = Math.min(unblocked, enemy.hp);
                        totalHealing += actualDamage;
                        STS.Game.dealDamage('player', i, card.damage, 1);
                    }
                }
                if (totalHealing > 0) {
                    STS.Game.healHP('player', totalHealing);
                }
            },
            color: CARD_COLORS.ATTACK,
            artClass: 'card-art-reaper'
        },

        // =====================================================================
        //  RARE SKILLS
        // =====================================================================

        IMPERVIOUS: {
            id: 'IMPERVIOUS',
            name: 'Impervious',
            type: 'SKILL',
            rarity: 'RARE',
            energy: 2,
            damage: 0,
            block: 30,
            target: 'SELF',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust. Gain 30 Block.',
            upgraded: false,
            upgradeName: 'Impervious+',
            upgradeDamage: 0,
            upgradeBlock: 40,
            upgradeEnergy: null,
            upgradeDescription: 'Exhaust. Gain 40 Block.',
            effect: function(state, targetIndex, card) {
                STS.Game.gainBlock('player', card.block);
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-impervious'
        },

        OFFERING: {
            id: 'OFFERING',
            name: 'Offering',
            type: 'SKILL',
            rarity: 'RARE',
            energy: 0,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust. Lose 6 HP. Gain 2 Energy. Draw 3 cards.',
            upgraded: false,
            upgradeName: 'Offering+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Exhaust. Lose 6 HP. Gain 2 Energy. Draw 5 cards.',
            effect: function(state, targetIndex, card) {
                var drawCount = card.upgraded ? 5 : 3;
                STS.Game.loseHP('player', 6);
                state.player.energy += 2;
                STS.Game.drawCards(drawCount);
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-offering'
        },

        EXHUME: {
            id: 'EXHUME',
            name: 'Exhume',
            type: 'SKILL',
            rarity: 'RARE',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust. Put a card from your Exhaust pile into your hand.',
            upgraded: false,
            upgradeName: 'Exhume+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: 0,
            upgradeDescription: 'Exhaust. Put a card from your Exhaust pile into your hand.',
            effect: function(state, targetIndex, card) {
                STS.Game.promptSelectFromExhaust(state, function(selectedCard) {
                    if (selectedCard) {
                        var idx = state.combat.exhaustPile.indexOf(selectedCard);
                        if (idx !== -1) {
                            state.combat.exhaustPile.splice(idx, 1);
                            state.combat.hand.push(selectedCard);
                        }
                    }
                });
            },
            color: CARD_COLORS.SKILL,
            artClass: 'card-art-exhume'
        },

        // =====================================================================
        //  RARE POWERS
        // =====================================================================

        DEMON_FORM: {
            id: 'DEMON_FORM',
            name: 'Demon Form',
            type: 'POWER',
            rarity: 'RARE',
            energy: 3,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'At the start of your turn, gain 2 Strength.',
            upgraded: false,
            upgradeName: 'Demon Form+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'At the start of your turn, gain 3 Strength.',
            effect: function(state, targetIndex, card) {
                var strGain = card.upgraded ? 3 : 2;
                STS.Game.addPower(state.player, {
                    id: 'DEMON_FORM',
                    name: 'Demon Form',
                    amount: strGain,
                    type: 'BUFF',
                    onTurnStart: function(owner, power) {
                        STS.Effects.apply(owner, 'STRENGTH', power.amount, 'Demon Form');
                    }
                });
            },
            color: CARD_COLORS.POWER,
            artClass: 'card-art-demon-form'
        },

        BARRICADE: {
            id: 'BARRICADE',
            name: 'Barricade',
            type: 'POWER',
            rarity: 'RARE',
            energy: 3,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Block is not removed at the start of your turn.',
            upgraded: false,
            upgradeName: 'Barricade+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: 2,
            upgradeDescription: 'Block is not removed at the start of your turn.',
            effect: function(state, targetIndex, card) {
                STS.Game.addPower(state.player, {
                    id: 'BARRICADE',
                    name: 'Barricade',
                    amount: 1,
                    type: 'BUFF',
                    retainBlock: true
                });
            },
            color: CARD_COLORS.POWER,
            artClass: 'card-art-barricade'
        },

        JUGGERNAUT: {
            id: 'JUGGERNAUT',
            name: 'Juggernaut',
            type: 'POWER',
            rarity: 'RARE',
            energy: 2,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Whenever you gain Block, deal 5 damage to a random enemy.',
            upgraded: false,
            upgradeName: 'Juggernaut+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Whenever you gain Block, deal 7 damage to a random enemy.',
            effect: function(state, targetIndex, card) {
                var dmg = card.upgraded ? 7 : 5;
                STS.Game.addPower(state.player, {
                    id: 'JUGGERNAUT',
                    name: 'Juggernaut',
                    amount: dmg,
                    type: 'BUFF',
                    onGainBlock: function(owner, power, gameState) {
                        var alive = [];
                        for (var i = 0; i < gameState.combat.enemies.length; i++) {
                            if (gameState.combat.enemies[i].hp > 0) {
                                alive.push(i);
                            }
                        }
                        if (alive.length > 0) {
                            var randomTarget = alive[Math.floor(Math.random() * alive.length)];
                            STS.Game.dealDamage('player', randomTarget, power.amount, 1);
                        }
                    }
                });
            },
            color: CARD_COLORS.POWER,
            artClass: 'card-art-juggernaut'
        },

        // =====================================================================
        //  STATUS CARDS
        // =====================================================================

        WOUND: {
            id: 'WOUND',
            name: 'Wound',
            type: 'STATUS',
            rarity: 'STATUS',
            energy: -2,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: true,
            description: 'Unplayable.',
            upgraded: false,
            upgradeName: null,
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: null,
            effect: null,
            color: CARD_COLORS.STATUS,
            artClass: 'card-art-wound'
        },

        DAZED: {
            id: 'DAZED',
            name: 'Dazed',
            type: 'STATUS',
            rarity: 'STATUS',
            energy: -2,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: true,
            innate: false,
            unplayable: true,
            description: 'Unplayable. Ethereal.',
            upgraded: false,
            upgradeName: null,
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: null,
            effect: null,
            color: CARD_COLORS.STATUS,
            artClass: 'card-art-dazed'
        },

        BURN: {
            id: 'BURN',
            name: 'Burn',
            type: 'STATUS',
            rarity: 'STATUS',
            energy: -2,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: true,
            description: 'Unplayable. At the end of your turn, take 2 damage.',
            upgraded: false,
            upgradeName: 'Burn+',
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: 'Unplayable. At the end of your turn, take 4 damage.',
            onTurnEnd: function(state, card) {
                var dmg = card.upgraded ? 4 : 2;
                STS.Game.loseHP('player', dmg);
            },
            effect: null,
            color: CARD_COLORS.STATUS,
            artClass: 'card-art-burn'
        },

        SLIMED: {
            id: 'SLIMED',
            name: 'Slimed',
            type: 'STATUS',
            rarity: 'STATUS',
            energy: 1,
            damage: 0,
            block: 0,
            target: 'SELF',
            exhaust: true,
            ethereal: false,
            innate: false,
            unplayable: false,
            description: 'Exhaust.',
            upgraded: false,
            upgradeName: null,
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: null,
            effect: function() {},
            color: CARD_COLORS.STATUS,
            artClass: 'card-art-slimed'
        },

        // =====================================================================
        //  CURSE CARDS
        // =====================================================================

        PARASITE: {
            id: 'PARASITE',
            name: 'Parasite',
            type: 'CURSE',
            rarity: 'CURSE',
            energy: -2,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: true,
            description: 'Unplayable. If removed from your deck, lose 3 Max HP.',
            upgraded: false,
            upgradeName: null,
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: null,
            onRemove: function(state) {
                state.player.maxHp = Math.max(1, state.player.maxHp - 3);
                if (state.player.hp > state.player.maxHp) {
                    state.player.hp = state.player.maxHp;
                }
            },
            effect: null,
            color: CARD_COLORS.CURSE,
            artClass: 'card-art-parasite'
        },

        REGRET: {
            id: 'REGRET',
            name: 'Regret',
            type: 'CURSE',
            rarity: 'CURSE',
            energy: -2,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: true,
            description: 'Unplayable. At the end of your turn, lose HP equal to the number of cards in your hand.',
            upgraded: false,
            upgradeName: null,
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: null,
            onTurnEnd: function(state) {
                var handSize = state.combat.hand.length;
                if (handSize > 0) {
                    STS.Game.loseHP('player', handSize);
                }
            },
            effect: null,
            color: CARD_COLORS.CURSE,
            artClass: 'card-art-regret'
        },

        DOUBT: {
            id: 'DOUBT',
            name: 'Doubt',
            type: 'CURSE',
            rarity: 'CURSE',
            energy: -2,
            damage: 0,
            block: 0,
            target: 'NONE',
            exhaust: false,
            ethereal: false,
            innate: false,
            unplayable: true,
            description: 'Unplayable. At the end of your turn, gain 1 Weak.',
            upgraded: false,
            upgradeName: null,
            upgradeDamage: 0,
            upgradeBlock: 0,
            upgradeEnergy: null,
            upgradeDescription: null,
            onTurnEnd: function(state) {
                STS.Effects.apply(state.player, 'WEAK', 1, 'Doubt');
            },
            effect: null,
            color: CARD_COLORS.CURSE,
            artClass: 'card-art-doubt'
        }
    };

    // =========================================================================
    //  HELPER FUNCTIONS
    // =========================================================================

    function deepCopy(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (typeof obj === 'function') {
            return obj;
        }
        if (Array.isArray(obj)) {
            var arrCopy = [];
            for (var i = 0; i < obj.length; i++) {
                arrCopy[i] = deepCopy(obj[i]);
            }
            return arrCopy;
        }
        var copy = {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                copy[key] = deepCopy(obj[key]);
            }
        }
        return copy;
    }

    function createInstance(cardId) {
        var def = definitions[cardId];
        if (!def) {
            console.error('Card definition not found: ' + cardId);
            return null;
        }
        var instance = deepCopy(def);
        instance.instanceId = _nextInstanceId++;
        return instance;
    }

    function upgradeCard(cardInstance) {
        if (!cardInstance) return;

        if (cardInstance.id === 'SEARING_BLOW') {
            cardInstance._upgradeCount = (cardInstance._upgradeCount || 0) + 1;
            var n = cardInstance._upgradeCount;
            var bonusDamage = 0;
            for (var i = 1; i <= n; i++) {
                bonusDamage += 4 * i;
            }
            cardInstance.damage = 12 + bonusDamage;
            cardInstance.upgraded = true;
            cardInstance.name = 'Searing Blow+' + n;
            cardInstance.description = 'Deal ' + cardInstance.damage + ' damage. Can be upgraded any number of times.';
            return;
        }

        if (cardInstance.upgraded) return;
        if (!cardInstance.upgradeName) return;

        cardInstance.upgraded = true;
        cardInstance.name = cardInstance.upgradeName;

        if (cardInstance.upgradeDamage) {
            cardInstance.damage = cardInstance.upgradeDamage;
        }
        if (cardInstance.upgradeBlock) {
            cardInstance.block = cardInstance.upgradeBlock;
        }
        if (cardInstance.upgradeEnergy !== null && cardInstance.upgradeEnergy !== undefined) {
            cardInstance.energy = cardInstance.upgradeEnergy;
        }
        if (cardInstance.upgradeDescription) {
            cardInstance.description = cardInstance.upgradeDescription;
        }
    }

    function getStarterDeck() {
        var deck = [];
        for (var i = 0; i < 5; i++) {
            deck.push(createInstance('STRIKE'));
        }
        for (var i = 0; i < 4; i++) {
            deck.push(createInstance('DEFEND'));
        }
        deck.push(createInstance('BASH'));
        return deck;
    }

    function getCardPool(rarity, type) {
        var pool = [];
        for (var id in definitions) {
            if (!definitions.hasOwnProperty(id)) continue;
            var def = definitions[id];
            if (def.rarity === 'STARTER' || def.rarity === 'STATUS' || def.rarity === 'CURSE' || def.rarity === 'SPECIAL') {
                continue;
            }
            if (rarity && def.rarity !== rarity) continue;
            if (type && def.type !== type) continue;
            pool.push(def);
        }
        return pool;
    }

    function getDescription(card, state) {
        if (!state) return card.description;

        var desc = card.description;
        var strength = 0;
        var dexterity = 0;

        if (state.player) {
            var buffs = state.player.buffs || state.player.powers || [];
            for (var i = 0; i < buffs.length; i++) {
                if (buffs[i].id === 'STRENGTH') strength = buffs[i].amount;
                if (buffs[i].id === 'DEXTERITY') dexterity = buffs[i].amount;
            }
        }

        if (card.type === 'ATTACK' && strength !== 0 && card.damage > 0) {
            var effectiveDmg = card.damage + strength;
            desc = desc.replace(
                /Deal (\d+) damage/,
                'Deal ' + effectiveDmg + ' damage'
            );
        }

        if (card.block > 0 && dexterity !== 0) {
            var effectiveBlock = card.block + dexterity;
            desc = desc.replace(
                /Gain (\d+) Block/,
                'Gain ' + effectiveBlock + ' Block'
            );
        }

        return desc;
    }

    function getRandomCards(count, rarity) {
        var weights = {
            COMMON: 60,
            UNCOMMON: 30,
            RARE: 10
        };

        var pool;
        if (rarity) {
            pool = getCardPool(rarity);
        } else {
            pool = [];
            var rarities = ['COMMON', 'UNCOMMON', 'RARE'];
            for (var r = 0; r < rarities.length; r++) {
                var rarityPool = getCardPool(rarities[r]);
                var weight = weights[rarities[r]];
                for (var p = 0; p < rarityPool.length; p++) {
                    pool.push({ card: rarityPool[p], weight: weight });
                }
            }
        }

        if (pool.length === 0) return [];

        var results = [];
        var usedIds = {};

        for (var i = 0; i < count && Object.keys(usedIds).length < pool.length; i++) {
            var selected = null;

            if (rarity) {
                var attempts = 0;
                do {
                    var idx = Math.floor(Math.random() * pool.length);
                    selected = pool[idx];
                    attempts++;
                } while (usedIds[selected.id] && attempts < 100);

                if (usedIds[selected.id]) break;
            } else {
                var totalWeight = 0;
                for (var w = 0; w < pool.length; w++) {
                    if (!usedIds[pool[w].card.id]) {
                        totalWeight += pool[w].weight;
                    }
                }

                if (totalWeight === 0) break;

                var roll = Math.random() * totalWeight;
                var cumulative = 0;
                for (var w = 0; w < pool.length; w++) {
                    if (usedIds[pool[w].card.id]) continue;
                    cumulative += pool[w].weight;
                    if (roll <= cumulative) {
                        selected = pool[w].card;
                        break;
                    }
                }
            }

            if (selected) {
                var cardId = rarity ? selected.id : selected.id;
                usedIds[cardId] = true;
                results.push(createInstance(cardId));
            }
        }

        return results;
    }

    function getAllCards() {
        var all = [];
        for (var id in definitions) {
            if (definitions.hasOwnProperty(id)) {
                all.push(definitions[id]);
            }
        }
        return all;
    }

    // =========================================================================
    //  PUBLIC API
    // =========================================================================

    STS.Cards = {
        definitions: definitions,
        getStarterDeck: getStarterDeck,
        getCardPool: getCardPool,
        createInstance: createInstance,
        upgradeCard: upgradeCard,
        getDescription: getDescription,
        getRandomCards: getRandomCards,
        getAllCards: getAllCards
    };

})();
