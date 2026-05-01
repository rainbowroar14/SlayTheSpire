window.STS = window.STS || {};

(function () {
    'use strict';

    /* ====================================================================== */
    /*  Potion Definitions & API                                              */
    /* ====================================================================== */

    var _potionInstanceCounter = 0;

    var potionDefinitions = {

        FIRE_POTION: {
            id: 'FIRE_POTION',
            name: 'Fire Potion',
            description: 'Deal 20 damage to a target enemy.',
            rarity: 'COMMON',
            color: '#ff4422',
            image: 'potion-fire',
            requiresTarget: true,

            effect: function (state, targetIndex) {
                if (!state || !state.enemies) return;
                var target = state.enemies[targetIndex];
                if (!target || target.hp <= 0) return;
                var damage = 20;
                target.hp = Math.max(0, target.hp - damage);
                return { damage: damage, target: targetIndex };
            }
        },

        BLOCK_POTION: {
            id: 'BLOCK_POTION',
            name: 'Block Potion',
            description: 'Gain 12 Block.',
            rarity: 'COMMON',
            color: '#4488cc',
            image: 'potion-block',
            requiresTarget: false,

            effect: function (state) {
                if (!state || !state.player) return;
                state.player.block = (state.player.block || 0) + 12;
                return { blockGained: 12 };
            }
        },

        STRENGTH_POTION: {
            id: 'STRENGTH_POTION',
            name: 'Strength Potion',
            description: 'Gain 2 Strength for this combat.',
            rarity: 'COMMON',
            color: '#ff6644',
            image: 'potion-strength',
            requiresTarget: false,

            effect: function (state) {
                if (!state || !state.player) return;
                state.player.strength = (state.player.strength || 0) + 2;
                return { strengthGained: 2 };
            }
        },

        DEXTERITY_POTION: {
            id: 'DEXTERITY_POTION',
            name: 'Dexterity Potion',
            description: 'Gain 2 Dexterity for this combat.',
            rarity: 'COMMON',
            color: '#44cc44',
            image: 'potion-dexterity',
            requiresTarget: false,

            effect: function (state) {
                if (!state || !state.player) return;
                state.player.dexterity = (state.player.dexterity || 0) + 2;
                return { dexterityGained: 2 };
            }
        },

        ENERGY_POTION: {
            id: 'ENERGY_POTION',
            name: 'Energy Potion',
            description: 'Gain 2 Energy this turn.',
            rarity: 'UNCOMMON',
            color: '#ffcc00',
            image: 'potion-energy',
            requiresTarget: false,

            effect: function (state) {
                if (!state || !state.player) return;
                state.player.energy = (state.player.energy || 0) + 2;
                return { energyGained: 2 };
            }
        },

        SWIFT_POTION: {
            id: 'SWIFT_POTION',
            name: 'Swift Potion',
            description: 'Draw 3 cards.',
            rarity: 'COMMON',
            color: '#88ccff',
            image: 'potion-swift',
            requiresTarget: false,

            effect: function (state) {
                if (typeof STS.Combat !== 'undefined' && STS.Combat.drawCards) {
                    STS.Combat.drawCards(3);
                    return { cardsDrawn: 3 };
                }
                return null;
            }
        },

        POISON_POTION: {
            id: 'POISON_POTION',
            name: 'Poison Potion',
            description: 'Apply 6 Poison to a target enemy.',
            rarity: 'COMMON',
            color: '#44aa44',
            image: 'potion-poison',
            requiresTarget: true,

            effect: function (state, targetIndex) {
                if (!state || !state.enemies) return;
                var target = state.enemies[targetIndex];
                if (!target || target.hp <= 0) return;
                target.poison = (target.poison || 0) + 6;
                return { poisonApplied: 6, target: targetIndex };
            }
        },

        REGEN_POTION: {
            id: 'REGEN_POTION',
            name: 'Regen Potion',
            description: 'Gain 5 Regeneration.',
            rarity: 'UNCOMMON',
            color: '#55dd55',
            image: 'potion-regen',
            requiresTarget: false,

            effect: function (state) {
                if (!state || !state.player) return;
                state.player.regeneration = (state.player.regeneration || 0) + 5;
                return { regeneration: 5 };
            }
        }
    };

    STS.Potions = {

        definitions: potionDefinitions,

        /**
         * Create a potion instance from a definition id.
         */
        createInstance: function (potionId) {
            var def = potionDefinitions[potionId];
            if (!def) {
                console.warn('[Potions] Unknown potion id: ' + potionId);
                return null;
            }
            var instance = {};
            var keys = Object.keys(def);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                instance[k] = (typeof def[k] === 'function') ? def[k] : def[k];
            }
            instance.instanceId = 'potion_' + (++_potionInstanceCounter);
            return instance;
        },

        /**
         * Use a potion on an optional target.
         * Removes the potion from the player's inventory.
         */
        usePotion: function (potion, targetIndex) {
            if (!potion) return null;
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player) return null;

            if (potion.requiresTarget && (targetIndex === undefined || targetIndex === null)) {
                console.warn('[Potions] ' + potion.name + ' requires a target.');
                return null;
            }

            var result = null;
            if (typeof potion.effect === 'function') {
                try {
                    result = potion.effect(state, targetIndex);
                } catch (err) {
                    console.error('[Potions] Error using ' + potion.name + ':', err);
                }
            }

            if (Array.isArray(state.player.potions)) {
                for (var i = 0; i < state.player.potions.length; i++) {
                    if (state.player.potions[i].instanceId === potion.instanceId) {
                        state.player.potions.splice(i, 1);
                        break;
                    }
                }
            }

            if (typeof STS.Relics !== 'undefined') {
                STS.Relics.trigger('PotionUsed', potion);
            }

            if (typeof STS.UI !== 'undefined' && STS.UI.updatePotions) {
                STS.UI.updatePotions();
            }

            if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                STS.Combat.log('Used ' + potion.name + '.');
            }

            return result;
        },

        /**
         * Return a random potion instance.
         */
        getRandomPotion: function () {
            var ids = Object.keys(potionDefinitions);
            if (ids.length === 0) return null;
            var id = ids[Math.floor(Math.random() * ids.length)];
            return this.createInstance(id);
        },

        /**
         * Return all potion definition ids.
         */
        getAllPotionIds: function () {
            return Object.keys(potionDefinitions);
        }
    };

    /* ====================================================================== */
    /*  Price Helpers                                                         */
    /* ====================================================================== */

    var PRICE_RANGES = {
        COMMON:   { cardMin: 45,  cardMax: 80  },
        UNCOMMON: { cardMin: 68,  cardMax: 120 },
        RARE:     { cardMin: 135, cardMax: 200 }
    };

    var RELIC_PRICES = {
        COMMON:   150,
        UNCOMMON: 250,
        RARE:     300,
        SHOP:     200
    };

    var POTION_PRICE = { min: 48, max: 95 };

    var BASE_CARD_REMOVE_PRICE = 75;
    var CARD_REMOVE_INCREMENT  = 25;

    function randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function applyVariance(price) {
        var variance = Math.round(price * 0.10);
        return price + randomInRange(-variance, variance);
    }

    function getCardPrice(rarity) {
        var range = PRICE_RANGES[rarity] || PRICE_RANGES.COMMON;
        return applyVariance(randomInRange(range.cardMin, range.cardMax));
    }

    function getRelicPrice(rarity) {
        var base = RELIC_PRICES[rarity] || RELIC_PRICES.COMMON;
        return applyVariance(base);
    }

    function getPotionPrice() {
        return applyVariance(randomInRange(POTION_PRICE.min, POTION_PRICE.max));
    }

    /* ====================================================================== */
    /*  Card Generation Helpers                                               */
    /* ====================================================================== */

    function generateShopCards() {
        var cards = [];
        var raritySlots = [
            'COMMON', 'COMMON', 'COMMON', 'COMMON',
            'UNCOMMON', 'UNCOMMON',
            'RARE'
        ];

        for (var i = 0; i < raritySlots.length; i++) {
            var rarity = raritySlots[i];
            var card = null;

            if (typeof STS.Cards !== 'undefined' && STS.Cards.getRandomCard) {
                card = STS.Cards.getRandomCard(rarity);
            }

            if (!card) {
                card = {
                    id: 'PLACEHOLDER_' + i,
                    name: 'Mystery Card',
                    type: 'ATTACK',
                    cost: 1,
                    damage: 6,
                    description: 'A mysterious card.',
                    rarity: rarity
                };
            }

            cards.push({
                card: card,
                price: getCardPrice(rarity),
                sold: false
            });
        }

        return cards;
    }

    function generateShopRelics() {
        var relics = [];
        var raritySlots = ['COMMON', 'UNCOMMON', 'SHOP'];

        for (var i = 0; i < raritySlots.length; i++) {
            var rarity = raritySlots[i];
            var relic = null;

            if (typeof STS.Relics !== 'undefined') {
                relic = STS.Relics.getRandomRelic(rarity);
            }

            if (!relic) continue;

            relics.push({
                relic: relic,
                price: getRelicPrice(rarity),
                sold: false
            });
        }

        return relics;
    }

    function generateShopPotions() {
        var potions = [];

        for (var i = 0; i < 3; i++) {
            var potion = STS.Potions.getRandomPotion();
            if (!potion) continue;

            potions.push({
                potion: potion,
                price: getPotionPrice(),
                sold: false
            });
        }

        return potions;
    }

    /* ====================================================================== */
    /*  Shop API                                                              */
    /* ====================================================================== */

    STS.Shop = {

        currentShop: null,

        /**
         * Generate a new shop inventory for the given act.
         */
        generate: function (act) {
            act = act || 1;

            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            var removesUsed = 0;
            if (state && typeof state.cardRemovesUsed === 'number') {
                removesUsed = state.cardRemovesUsed;
            }

            this.currentShop = {
                cards: generateShopCards(),
                relics: generateShopRelics(),
                potions: generateShopPotions(),
                cardRemovePrice: BASE_CARD_REMOVE_PRICE + (removesUsed * CARD_REMOVE_INCREMENT),
                cardRemovesUsed: removesUsed
            };

            if (typeof STS.UI !== 'undefined' && STS.UI.renderShop) {
                STS.UI.renderShop(this.currentShop);
            }

            return this.currentShop;
        },

        /**
         * Attempt to buy a card from the shop by index.
         * @returns {boolean} true if purchase succeeded
         */
        buyCard: function (index) {
            if (!this.currentShop) {
                console.warn('[Shop] No shop is open.');
                return false;
            }
            var slot = this.currentShop.cards[index];
            if (!slot || slot.sold) {
                console.warn('[Shop] Card slot unavailable.');
                return false;
            }

            var price = this.applyDiscount(slot.price);

            if (!this.canAfford(price)) {
                console.warn('[Shop] Not enough gold.');
                return false;
            }

            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player) return false;

            state.player.gold -= price;
            slot.sold = true;

            if (!Array.isArray(state.player.deck)) state.player.deck = [];
            state.player.deck.push(slot.card);

            if (typeof STS.Relics !== 'undefined') {
                STS.Relics.trigger('GoldChanged', -price);
            }

            if (typeof STS.UI !== 'undefined') {
                if (STS.UI.renderShop) STS.UI.renderShop(this.currentShop);
                if (STS.UI.updateGold) STS.UI.updateGold();
            }

            return true;
        },

        /**
         * Attempt to buy a relic from the shop by index.
         */
        buyRelic: function (index) {
            if (!this.currentShop) {
                console.warn('[Shop] No shop is open.');
                return false;
            }
            var slot = this.currentShop.relics[index];
            if (!slot || slot.sold) {
                console.warn('[Shop] Relic slot unavailable.');
                return false;
            }

            var price = this.applyDiscount(slot.price);

            if (!this.canAfford(price)) {
                console.warn('[Shop] Not enough gold.');
                return false;
            }

            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player) return false;

            state.player.gold -= price;
            slot.sold = true;

            if (!Array.isArray(state.player.relics)) state.player.relics = [];

            if (typeof STS.Relics !== 'undefined' && STS.Relics.playerHasRelic && STS.Relics.playerHasRelic(slot.relic.id)) {
                console.warn('[Shop] Player already owns this relic.');
                state.player.gold += price;
                slot.sold = false;
                return false;
            }

            state.player.relics.push(slot.relic);

            if (typeof slot.relic.onPickup === 'function') {
                try {
                    slot.relic.onPickup.call(slot.relic, state);
                } catch (err) {
                    console.error('[Shop] onPickup error:', err);
                }
            }

            if (typeof STS.Relics !== 'undefined') {
                STS.Relics.trigger('GoldChanged', -price);
            }

            if (typeof STS.UI !== 'undefined') {
                if (STS.UI.renderShop) STS.UI.renderShop(this.currentShop);
                if (STS.UI.updateGold)  STS.UI.updateGold();
                if (STS.UI.updateRelics) STS.UI.updateRelics();
            }

            return true;
        },

        /**
         * Attempt to buy a potion from the shop by index.
         */
        buyPotion: function (index) {
            if (!this.currentShop) {
                console.warn('[Shop] No shop is open.');
                return false;
            }
            var slot = this.currentShop.potions[index];
            if (!slot || slot.sold) {
                console.warn('[Shop] Potion slot unavailable.');
                return false;
            }

            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player) return false;

            var hasEmptyPotionSlot = false;
            if (Array.isArray(state.player.potions)) {
                for (var pi = 0; pi < state.player.potions.length; pi++) {
                    if (state.player.potions[pi] == null) {
                        hasEmptyPotionSlot = true;
                        break;
                    }
                }
            }
            if (!hasEmptyPotionSlot) {
                console.warn('[Shop] Potion slots full.');
                return false;
            }

            var price = this.applyDiscount(slot.price);

            if (!this.canAfford(price)) {
                console.warn('[Shop] Not enough gold.');
                return false;
            }

            state.player.gold -= price;
            slot.sold = true;

            if (typeof STS.Game !== 'undefined' && STS.Game.addPotion) {
                if (!STS.Game.addPotion(slot.potion)) {
                    state.player.gold += price;
                    slot.sold = false;
                    console.warn('[Shop] Could not add potion after purchase.');
                    return false;
                }
            } else {
                if (!Array.isArray(state.player.potions)) state.player.potions = [];
                state.player.potions.push(slot.potion);
            }

            if (typeof STS.Relics !== 'undefined') {
                STS.Relics.trigger('GoldChanged', -price);
            }

            if (typeof STS.UI !== 'undefined') {
                if (STS.UI.renderShop) STS.UI.renderShop(this.currentShop);
                if (STS.UI.updateGold)   STS.UI.updateGold();
                if (STS.UI.updatePotions) STS.UI.updatePotions();
            }

            return true;
        },

        /**
         * Pay to remove a card from the player's deck.
         * @param {number} cardIndex  Index into state.player.deck
         */
        removeCard: function (cardIndex) {
            if (!this.currentShop) {
                console.warn('[Shop] No shop is open.');
                return false;
            }

            var price = this.applyDiscount(this.getRemovePrice());

            if (!this.canAfford(price)) {
                console.warn('[Shop] Not enough gold for card removal.');
                return false;
            }

            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player || !Array.isArray(state.player.deck)) return false;

            if (cardIndex < 0 || cardIndex >= state.player.deck.length) {
                console.warn('[Shop] Invalid card index.');
                return false;
            }

            var removedCard = state.player.deck.splice(cardIndex, 1)[0];
            state.player.gold -= price;

            if (typeof state.cardRemovesUsed !== 'number') state.cardRemovesUsed = 0;
            state.cardRemovesUsed++;
            var floorBonus = (state.run && typeof state.run.floorsClimbed === 'number')
                ? state.run.floorsClimbed * 2
                : 0;
            this.currentShop.cardRemovePrice = BASE_CARD_REMOVE_PRICE +
                (state.cardRemovesUsed * CARD_REMOVE_INCREMENT) + floorBonus;
            this.currentShop.cardRemovesUsed = state.cardRemovesUsed;

            if (typeof STS.Relics !== 'undefined') {
                STS.Relics.trigger('GoldChanged', -price);
            }

            if (typeof STS.UI !== 'undefined') {
                if (STS.UI.renderShop) STS.UI.renderShop(this.currentShop);
                if (STS.UI.updateGold) STS.UI.updateGold();
                if (STS.UI.updateDeck) STS.UI.updateDeck();
            }

            if (typeof STS.Combat !== 'undefined' && STS.Combat.log) {
                STS.Combat.log('Removed ' + (removedCard ? removedCard.name : 'a card') + ' from deck.');
            }

            return true;
        },

        /**
         * Current price for card removal (escalates with each use).
         */
        getRemovePrice: function () {
            if (this.currentShop) {
                return this.currentShop.cardRemovePrice;
            }
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            var used = (state && typeof state.cardRemovesUsed === 'number') ? state.cardRemovesUsed : 0;
            return BASE_CARD_REMOVE_PRICE + (used * CARD_REMOVE_INCREMENT);
        },

        /**
         * Check whether the player can afford a given price.
         */
        canAfford: function (price) {
            var state = (typeof STS.Game !== 'undefined' && STS.Game.state) ? STS.Game.state : null;
            if (!state || !state.player) return false;
            return (state.player.gold || 0) >= price;
        },

        /**
         * Apply the Membership Card 50% discount if the player owns it.
         */
        applyDiscount: function (price) {
            if (typeof STS.Relics !== 'undefined' && STS.Relics.playerHasRelic &&
                STS.Relics.playerHasRelic('MEMBERSHIP_CARD')) {
                return Math.floor(price * 0.5);
            }
            return price;
        },

        /**
         * Return all items in the current shop that haven't been sold,
         * categorised by type. Useful for UI rendering.
         */
        getAvailableItems: function () {
            if (!this.currentShop) return { cards: [], relics: [], potions: [] };

            var available = { cards: [], relics: [], potions: [] };

            for (var c = 0; c < this.currentShop.cards.length; c++) {
                if (!this.currentShop.cards[c].sold) {
                    available.cards.push(this.currentShop.cards[c]);
                }
            }
            for (var r = 0; r < this.currentShop.relics.length; r++) {
                if (!this.currentShop.relics[r].sold) {
                    available.relics.push(this.currentShop.relics[r]);
                }
            }
            for (var p = 0; p < this.currentShop.potions.length; p++) {
                if (!this.currentShop.potions[p].sold) {
                    available.potions.push(this.currentShop.potions[p]);
                }
            }

            return available;
        },

        /**
         * Close the current shop.
         */
        close: function () {
            this.currentShop = null;
            if (typeof STS.UI !== 'undefined' && STS.UI.closeShop) {
                STS.UI.closeShop();
            }
        }
    };
})();
