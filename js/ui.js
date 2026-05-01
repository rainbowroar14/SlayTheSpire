window.STS = window.STS || {};

STS.UI = (function () {
    'use strict';

    var SCREEN = {
        TITLE: 'TITLE',
        MAP: 'MAP',
        COMBAT: 'COMBAT',
        SHOP: 'SHOP',
        EVENT: 'EVENT',
        REST: 'REST',
        REWARD: 'REWARD',
        GAME_OVER: 'GAME_OVER',
        VICTORY: 'VICTORY',
        DECK_VIEW: 'DECK_VIEW',
        SETTINGS: 'SETTINGS'
    };

    var KEYWORDS = [
        'Vulnerable', 'Weak', 'Weakness', 'Frail', 'Poison', 'Exhaust',
        'Ethereal', 'Innate', 'Retain', 'Scry', 'Intangible', 'Barricade',
        'Metallicize', 'Entangled', 'Strength', 'Dexterity', 'Vigor',
        'Artifact', 'Block', 'Thorns', 'Plated Armor', 'Ritual',
        'Regeneration', 'Draw', 'Energy', 'Unplayable'
    ];

    var INTENT_DISPLAY = {
        ATTACK:         { icon: '⚔️', color: '#ff4444', label: 'Attack' },
        DEFEND:         { icon: '🛡️', color: '#4488ff', label: 'Defend' },
        BUFF:           { icon: '⬆️', color: '#44cc44', label: 'Buff' },
        DEBUFF:         { icon: '⬇️', color: '#aa44cc', label: 'Debuff' },
        ATTACK_DEBUFF:  { icon: '⚔️', color: '#ff4444', label: 'Attack' },
        ATTACK_DEFEND:  { icon: '⚔️', color: '#ff8844', label: 'Attack' },
        ATTACK_BUFF:    { icon: '⚔️', color: '#ff4444', label: 'Attack' },
        UNKNOWN:        { icon: '❓', color: '#aaaaaa', label: 'Unknown' },
        SLEEP:          { icon: '💤', color: '#8888cc', label: 'Sleeping' }
    };

    var _previousScreen = null;
    var _animFrameId = null;
    var _targetingArrowCtx = null;
    var _mouseX = 0;
    var _mouseY = 0;
    var _cardSelectCallback = null;
    var _cardSelectCount = 1;
    var _cardSelectSelected = [];
    var _deckSortMode = 'type';

    /* ==================================================================
     *  PUBLIC API
     * ================================================================== */

    var ui = {
        currentScreen: null,
        elements: {},
        selectedCard: null,
        hoveredCard: null,
        draggedCard: null,
        targetingMode: false,
        targetingCard: null,
        targetingCardIndex: -1,
        animationQueue: [],
        tooltipTimeout: null,

        /* --------------------------------------------------------------
         *  init
         * -------------------------------------------------------------- */

        init: function () {
            _buildGameContainer();
            _cacheElements();
            _bindGlobalEvents();
            _startUpdateLoop();

            STS.Events.on('SCREEN_CHANGED', function (data) {
                ui.showScreen(data.to);
            });
            STS.Events.on('CARD_PLAYED', function (data) {
                ui.playCardAnimation(data.card, data.target);
            });
            STS.Events.on('DAMAGE_DEALT', function (data) {
                if (data.hpDamage > 0) {
                    ui.dealDamageAnimation(data.target, data.hpDamage);
                }
                if (data.blocked > 0) {
                    ui.gainBlockAnimation(data.target, -data.blocked);
                }
            });
            STS.Events.on('DAMAGE_TAKEN', function (data) {
                if (data.hpDamage > 0) {
                    ui.dealDamageAnimation(data.target, data.hpDamage);
                }
            });
            STS.Events.on('BLOCK_GAINED', function (data) {
                ui.gainBlockAnimation(data.target, data.amount);
            });
            STS.Events.on('HEAL', function (data) {
                ui.healAnimation(null, data.amount);
                ui._updateMapHudStats();
            });
            STS.Events.on('ENEMY_DIED', function (data) {
                ui.deathAnimation(data.index);
            });
            STS.Events.on('RELIC_OBTAINED', function (data) {
                if (data.relic) ui.flashRelic(data.relic.id);
                ui.renderRelicBar();
            });
            STS.Events.on('CARD_DRAWN', function () {
                if (ui.currentScreen === SCREEN.COMBAT) ui.renderHand();
            });
            STS.Events.on('GOLD_CHANGED', function () {
                ui.updateGoldDisplay();
                ui._updateMapHudStats();
            });
            STS.Events.on('TURN_START', function () {
                if (ui.currentScreen === SCREEN.COMBAT) ui.updateEnemyIntents();
            });

            console.log('[STS.UI] Initialised.');
        },

        /* --------------------------------------------------------------
         *  showScreen
         * -------------------------------------------------------------- */

        showScreen: function (screenId) {
            _previousScreen = ui.currentScreen;
            ui.currentScreen = screenId;
            ui.exitTargetingMode();
            ui.hideTooltip();
            ui.hideCardPreview();

            var container = document.getElementById('game-container');
            if (!container) return;

            var screens = container.querySelectorAll('.screen');
            for (var i = 0; i < screens.length; i++) {
                screens[i].classList.remove('screen-active');
                /* Must use !important so we override any inline !important on #title-screen */
                screens[i].style.setProperty('display', 'none', 'important');
                screens[i].style.setProperty('opacity', '0', 'important');
                screens[i].style.setProperty('pointer-events', 'none', 'important');
            }

            var overlay = document.getElementById('settings-overlay');
            if (overlay) overlay.style.display = 'none';

            switch (screenId) {
                case SCREEN.TITLE:    ui.renderTitleScreen(); break;
                case SCREEN.MAP:      ui.renderMapScreen(); break;
                case SCREEN.COMBAT:   ui.renderCombatScreen(); break;
                case SCREEN.SHOP:     ui.renderShopScreen(); break;
                case SCREEN.EVENT:    ui.renderEventScreen(); break;
                case SCREEN.REST:     ui.renderRestScreen(); break;
                case SCREEN.REWARD:   ui.renderRewardScreen(); break;
                case SCREEN.DECK_VIEW: ui.renderDeckViewScreen(); break;
                case SCREEN.GAME_OVER: ui.renderGameOverScreen(); break;
                case SCREEN.VICTORY:  ui.renderVictoryScreen(); break;
                case SCREEN.SETTINGS: ui.renderSettingsOverlay(); return;
            }

            var target = document.getElementById(_screenDomId(screenId));
            if (target) {
                target.style.setProperty('display', 'flex', 'important');
                target.style.setProperty('opacity', '1', 'important');
                target.style.setProperty('pointer-events', 'auto', 'important');
                target.classList.add('screen-active');
            }
        },

        /* --------------------------------------------------------------
         *  update  (animation frame loop)
         * -------------------------------------------------------------- */

        update: function () {
            _processAnimationQueue();

            if (ui.currentScreen === SCREEN.COMBAT) {
                _updateIntentBob();
            }

            if (ui.targetingMode) {
                _drawTargetingArrow();
            }

            _animFrameId = requestAnimationFrame(function () { ui.update(); });
        },

        /* ==============================================================
         *  SCREEN RENDERERS
         * ============================================================== */

        renderTitleScreen: function () {
            var el = _ensureScreen('title-screen');

            // If the title screen already has content (from HTML), just re-wire buttons
            var existingBtn = document.getElementById('btn-new-run');
            if (!existingBtn) {
                el.innerHTML =
                    '<div class="title-bg" style="pointer-events:none;"></div>' +
                    '<div class="title-content" style="position:relative;z-index:10;">' +
                        '<h1 class="game-title">SLAY THE SPIRE</h1>' +
                        '<div class="title-buttons">' +
                            '<button class="btn-title" id="btn-new-run">NEW RUN</button>' +
                            '<button class="btn-title" id="btn-settings">SETTINGS</button>' +
                        '</div>' +
                        '<div class="title-footer">A Roguelike Deckbuilder</div>' +
                    '</div>';
            }

            _on('btn-new-run', 'click', function () { ui.onNewRun(); });
            _on('btn-settings', 'click', function () { ui.onSettings(); });
        },

        renderCombatScreen: function () {
            var st = _state();
            if (!st) return;

            var act = (st.map && st.map.currentAct) || 1;
            var combatBgByAct = {
                1: 'assets/backgrounds/combat_bg.png',
                2: 'assets/backgrounds/combat_bg.png',
                3: 'assets/backgrounds/title_bg.png'
            };
            var combatBgUrl = combatBgByAct[act] || 'assets/backgrounds/combat_bg.png';
            var combatBgStyle =
                'background-image:linear-gradient(180deg,rgba(8,10,22,0.65) 0%,rgba(12,14,32,0.5) 45%,rgba(6,8,18,0.75) 100%),url(\'' +
                combatBgUrl +
                '\');background-size:cover;background-position:center;';

            var el = _ensureScreen('combat-screen');
            el.innerHTML =
                '<div class="combat-bg" style="' + combatBgStyle + '"></div>' +
                '<div class="combat-top-bar">' +
                    '<div class="relic-bar" id="relic-bar"></div>' +
                    '<div class="top-right-controls">' +
                        '<div class="gold-display" id="gold-display">💰 <span id="gold-value">0</span></div>' +
                        '<button class="btn-icon btn-deck" id="btn-open-deck" title="Deck">📋</button>' +
                        '<button class="btn-icon btn-settings-small" id="btn-settings-combat" title="Settings">⚙️</button>' +
                    '</div>' +
                '</div>' +
                '<div class="combat-field">' +
                    '<div class="combat-stage-left">' +
                        '<div class="player-info combat-player-info" id="player-info"></div>' +
                    '</div>' +
                    '<div class="enemy-area" id="enemy-area"></div>' +
                '</div>' +
                '<div class="combat-bottom">' +
                    '<div class="pile-display-left">' +
                        '<div class="energy-orb-container" id="energy-orb"></div>' +
                    '</div>' +
                    '<div class="hand-area">' +
                        '<div class="hand-container" id="hand-container"></div>' +
                    '</div>' +
                    '<div class="pile-display-right">' +
                        '<div class="draw-pile" id="draw-pile" title="Draw Pile">' +
                            '<span class="pile-icon">📥</span>' +
                            '<span class="pile-count" id="draw-count">0</span>' +
                        '</div>' +
                        '<div class="discard-pile" id="discard-pile" title="Discard Pile">' +
                            '<span class="pile-icon">📤</span>' +
                            '<span class="pile-count" id="discard-count">0</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="end-turn-container">' +
                    '<button class="btn-end-turn" id="btn-end-turn">END TURN</button>' +
                '</div>' +
                '<div class="potion-bar" id="potion-bar"></div>' +
                '<div class="combat-log" id="combat-log"></div>' +
                '<canvas id="targeting-canvas" class="targeting-canvas"></canvas>';

            _on('btn-end-turn', 'click', function () { ui.onEndTurn(); });
            _on('btn-open-deck', 'click', function () {
                _previousScreen = SCREEN.COMBAT;
                ui.showDeckView();
            });
            _on('btn-settings-combat', 'click', function () { ui.onSettings(); });
            _on('draw-pile', 'click', function () { ui._showPileView('draw'); });
            _on('discard-pile', 'click', function () { ui._showPileView('discard'); });

            var canvas = document.getElementById('targeting-canvas');
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                _targetingArrowCtx = canvas.getContext('2d');
            }

            ui.renderEnemies();
            ui.renderPlayerInfo();
            ui.renderRelicBar();
            ui.renderPotionBar();
            ui.renderEnergyOrb();
            ui.renderDrawDiscardPiles();
            ui.renderHand();
            ui.updateGoldDisplay();
            ui.updateEndTurnButton();
            ui.renderCombatLog();
        },

        renderMapScreen: function () {
            var st = _state();
            if (!st) return;

            var act = st.map.currentAct || 1;
            var actBg = {
                1: "assets/backgrounds/map_bg.png",
                2: "assets/backgrounds/combat_bg.png",
                3: "assets/backgrounds/title_bg.png"
            }[act] || "assets/backgrounds/map_bg.png";

            var p = st.player;
            var classLine = p.characterClass || 'the Ironclad';
            var deckCount = (p.deck && p.deck.length) ? p.deck.length : 0;
            var potionSlots = p.potions && p.potions.length ? p.potions.length : 3;
            var potionHtml = '';
            for (var si = 0; si < potionSlots; si++) {
                var pot = p.potions[si];
                if (pot) {
                    potionHtml +=
                        '<div class="map-hud-potion map-hud-potion-filled" data-map-potion-idx="' + si + '" style="--potion-c:' + (pot.color || '#88ccff') + '">' +
                        '<span class="map-hud-potion-ic">🧪</span></div>';
                } else {
                    potionHtml += '<div class="map-hud-potion map-hud-potion-empty" title="Empty potion slot"></div>';
                }
            }

            var el = _ensureScreen('map-screen');
            el.style.setProperty('display', 'flex', 'important');
            el.style.setProperty('flex-direction', 'column', 'important');
            el.style.setProperty('width', '100%', 'important');
            el.style.setProperty('min-height', '100%', 'important');
            el.style.setProperty('height', '100%', 'important');
            el.style.setProperty('position', 'relative', 'important');
            el.style.setProperty('overflow', 'hidden', 'important');

            el.innerHTML =
                '<div class="map-bg" style="background-image:linear-gradient(180deg,rgba(12,10,8,0.88) 0%,rgba(18,16,14,0.72) 50%,rgba(8,8,10,0.9) 100%),url(\'' + actBg + '\');background-size:cover;background-position:center;"></div>' +
                '<div class="map-chrome">' +
                '<div class="map-hud">' +
                    '<div class="map-hud-left">' +
                        '<div class="map-hud-identity">' +
                            '<span class="map-hud-name">' + _escHtml(p.name) + '</span> ' +
                            '<span class="map-hud-class">' + _escHtml(classLine) + '</span>' +
                        '</div>' +
                        '<div class="map-hud-statrow">' +
                            '<span class="map-hud-heart" aria-hidden="true">♥</span> ' +
                            '<span class="map-hud-hp" id="map-hud-hp">' + p.hp + '/' + p.maxHp + '</span>' +
                            '<span class="map-hud-goldrow"><span class="map-hud-gold-ic" aria-hidden="true">💰</span> ' +
                            '<span class="map-hud-gold" id="map-hud-gold">' + p.gold + '</span></span>' +
                        '</div>' +
                        '<div class="map-hud-potions" id="map-hud-potions">' + potionHtml + '</div>' +
                    '</div>' +
                    '<div class="map-hud-center">' +
                        '<span class="map-hud-asc" title="Act"><span class="map-hud-flame" aria-hidden="true">🔥</span> Act ' + act + '</span>' +
                    '</div>' +
                    '<div class="map-hud-right">' +
                        '<button type="button" class="map-hud-deck-btn" id="btn-deck-map" title="Deck">🃏 ' +
                        '<span class="map-hud-deckct" id="map-hud-deck">' + deckCount + '</span></button>' +
                        '<button type="button" class="btn-icon map-hud-gear" id="btn-settings-map" title="Settings">⚙️</button>' +
                    '</div>' +
                '</div>' +
                '<div class="map-relic-row">' +
                    '<span class="map-relic-label">Relics</span>' +
                    '<div class="map-relic-bar" id="map-relic-bar"></div>' +
                '</div>' +
                '</div>' +
                '<div class="map-body">' +
                    '<div class="map-parchment-outer">' +
                        '<div class="map-parchment" id="map-parchment">' +
                            '<div class="map-container" id="map-container">' +
                                '<div class="map-scroll" id="map-scroll"></div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<aside class="map-legend" aria-label="Map legend">' +
                        '<h3 class="map-legend-title">Legend</h3>' +
                        '<ul class="map-legend-list">' +
                            '<li><span class="map-leg-ic map-leg-q">?</span> Unknown / Event</li>' +
                            '<li><span class="map-leg-ic map-leg-bag">🛍</span> Merchant</li>' +
                            '<li><span class="map-leg-ic map-leg-chest">📦</span> Treasure</li>' +
                            '<li><span class="map-leg-ic map-leg-fire">🔥</span> Rest</li>' +
                            '<li><span class="map-leg-ic map-leg-mob">💀</span> Enemy</li>' +
                            '<li><span class="map-leg-ic map-leg-elite">👹</span> Elite</li>' +
                        '</ul>' +
                    '</aside>' +
                '</div>';

            _on('btn-deck-map', 'click', function () {
                _previousScreen = SCREEN.MAP;
                ui.showDeckView();
            });
            _on('btn-settings-map', 'click', function () { ui.onSettings(); });

            var potEls = el.querySelectorAll('.map-hud-potion-filled');
            for (var pe = 0; pe < potEls.length; pe++) {
                (function (idx, node) {
                    var potion = p.potions[idx];
                    if (!potion) return;
                    node.addEventListener('mouseenter', function () {
                        ui.showTooltip(node,
                            '<strong>' + _escHtml(potion.name) + '</strong><br>' +
                            '<span class="tooltip-desc">' + _escHtml(potion.description || '') + '</span> (use in combat)',
                            'bottom');
                    });
                    node.addEventListener('mouseleave', function () { ui.hideTooltip(); });
                })(parseInt(potEls[pe].getAttribute('data-map-potion-idx'), 10), potEls[pe]);
            }

            ui.renderRelicBar();

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    _renderMapNodes();
                });
            });
        },

        renderShopScreen: function () {
            var st = _state();
            if (!st) return;

            if (st.shopData && typeof STS.Shop !== 'undefined' && STS.Shop) {
                STS.Shop.currentShop = st.shopData;
            }

            var shopData = st.shopData || (STS.Shop && STS.Shop.currentShop);
            if (!shopData) return;

            var el = _ensureScreen('shop-screen');
            var html =
                '<div class="shop-bg"></div>' +
                '<div class="shop-header">' +
                    '<h2>SHOP</h2>' +
                    '<div class="gold-display">💰 <span id="shop-gold">' + st.player.gold + '</span></div>' +
                '</div>' +
                '<div class="shop-content">';

            html += '<div class="shop-section"><h3>Cards</h3><div class="shop-row">';
            var cards = shopData.cards || [];
            for (var i = 0; i < cards.length; i++) {
                var item = cards[i];
                var soldClass = item.sold ? ' shop-item-sold' : '';
                var affordable = st.player.gold >= item.price ? '' : ' shop-item-expensive';
                html +=
                    '<div class="shop-item' + soldClass + affordable + '" data-type="card" data-index="' + i + '">' +
                        '<div class="shop-card-preview">' +
                            '<div class="card card-' + (item.card.type || 'attack').toLowerCase() + ' card-mini">' +
                                '<div class="card-inner">' +
                                    '<div class="card-cost">' + (item.card.energy === -1 ? 'X' : (item.card.energy || 0)) + '</div>' +
                                    '<div class="card-name">' + (item.card.name || 'Card') + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="shop-price">' + (item.sold ? 'SOLD' : '💰 ' + item.price) + '</div>' +
                    '</div>';
            }
            html += '</div></div>';

            html += '<div class="shop-section"><h3>Relics</h3><div class="shop-row">';
            var relics = shopData.relics || [];
            for (var i = 0; i < relics.length; i++) {
                var item = relics[i];
                var soldClass = item.sold ? ' shop-item-sold' : '';
                var affordable = st.player.gold >= item.price ? '' : ' shop-item-expensive';
                html +=
                    '<div class="shop-item' + soldClass + affordable + '" data-type="relic" data-index="' + i + '">' +
                        '<div class="shop-relic-icon">' + (item.relic.icon || '🔮') + '</div>' +
                        '<div class="shop-item-name">' + (item.relic.name || 'Relic') + '</div>' +
                        '<div class="shop-price">' + (item.sold ? 'SOLD' : '💰 ' + item.price) + '</div>' +
                    '</div>';
            }
            html += '</div></div>';

            html += '<div class="shop-section"><h3>Potions</h3><div class="shop-row">';
            var potions = shopData.potions || [];
            for (var i = 0; i < potions.length; i++) {
                var item = potions[i];
                var soldClass = item.sold ? ' shop-item-sold' : '';
                var affordable = st.player.gold >= item.price ? '' : ' shop-item-expensive';
                html +=
                    '<div class="shop-item' + soldClass + affordable + '" data-type="potion" data-index="' + i + '">' +
                        '<div class="shop-potion-icon" style="color:' + (item.potion.color || '#fff') + '">🧪</div>' +
                        '<div class="shop-item-name">' + (item.potion.name || 'Potion') + '</div>' +
                        '<div class="shop-price">' + (item.sold ? 'SOLD' : '💰 ' + item.price) + '</div>' +
                    '</div>';
            }
            html += '</div></div>';

            var removePrice = shopData.cardRemovePrice || 75;
            html +=
                '<div class="shop-section shop-remove">' +
                    '<button class="btn-shop-remove" id="btn-shop-remove">' +
                        'Remove a Card — 💰 ' + removePrice +
                    '</button>' +
                '</div>';

            html += '</div>';
            html += '<button class="btn-large btn-leave-shop" id="btn-leave-shop">Leave Shop</button>';

            el.innerHTML = html;

            var shopItems = el.querySelectorAll('.shop-item');
            for (var i = 0; i < shopItems.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        var type = item.getAttribute('data-type');
                        var idx = parseInt(item.getAttribute('data-index'), 10);
                        ui._onShopBuy(type, idx);
                    });
                    item.addEventListener('mouseenter', function () {
                        var type = item.getAttribute('data-type');
                        var idx = parseInt(item.getAttribute('data-index'), 10);
                        ui._showShopTooltip(item, type, idx);
                    });
                    item.addEventListener('mouseleave', function () { ui.hideTooltip(); });
                })(shopItems[i]);
            }

            _on('btn-shop-remove', 'click', function () {
                ui.showCardSelect(st.player.deck, 1, function (selected) {
                    if (selected.length > 0) {
                        var idx = selected[0].index;
                        var ok = false;
                        if (STS.Shop && STS.Shop.removeCard) {
                            ok = STS.Shop.removeCard(idx);
                        } else {
                            ok = STS.Game.shopRemoveCard(idx);
                        }
                        if (!ok) {
                            ui.showFloatingText(
                                window.innerWidth / 2, window.innerHeight / 2,
                                'Cannot remove (gold or invalid pick).', '#ff8844', 24
                            );
                        }
                        ui.renderShopScreen();
                        ui.showScreen(SCREEN.SHOP);
                    }
                }, 'Choose a Card to Remove');
            });

            _on('btn-leave-shop', 'click', function () {
                if (STS.Shop && STS.Shop.close) STS.Shop.close();
                STS.Game.changeScreen(SCREEN.MAP);
            });
        },

        renderEventScreen: function () {
            var st = _state();
            if (!st || !st.eventData) return;

            var ev = st.eventData;
            var el = _ensureScreen('event-screen');
            var artUrl = _getEventImageUrl(ev);
            var html =
                '<div class="event-bg"></div>' +
                '<div class="event-content">' +
                    '<div class="event-image-area"><div class="event-image">' +
                    '<img class="event-image-img" src="' + _escHtml(artUrl) + '" alt="' + _escHtml(ev.name) + '" />' +
                    '</div></div>' +
                    '<h2 class="event-title">' + _escHtml(ev.name) + '</h2>' +
                    '<p class="event-description" id="event-desc"></p>' +
                    '<div class="event-choices" id="event-choices">';

            for (var i = 0; i < ev.choices.length; i++) {
                html += '<button class="btn-event-choice" data-choice="' + i + '">' +
                    _escHtml(ev.choices[i].text) + '</button>';
            }
            html += '</div>' +
                '<div class="event-result" id="event-result" style="display:none"></div>' +
                '</div>';

            el.innerHTML = html;

            var evImg = el.querySelector('.event-image-img');
            if (evImg) {
                evImg.addEventListener('error', function onEvImgErr() {
                    evImg.removeEventListener('error', onEvImgErr);
                    evImg.src = _eventArtDataUrl(ev);
                });
            }

            _typewriterEffect('event-desc', ev.description);

            var btns = el.querySelectorAll('.btn-event-choice');
            for (var i = 0; i < btns.length; i++) {
                (function (btn) {
                    btn.addEventListener('click', function () {
                        var idx = parseInt(btn.getAttribute('data-choice'), 10);
                        ui._onEventChoice(idx);
                    });
                })(btns[i]);
            }
        },

        renderRestScreen: function () {
            var st = _state();
            if (!st) return;

            var healAmount = Math.floor(st.player.maxHp * 0.3);
            var el = _ensureScreen('rest-screen');
            el.innerHTML =
                '<div class="rest-bg"></div>' +
                '<div class="rest-content">' +
                    '<div class="campfire">' +
                        '<div class="fire-particle fp1"></div>' +
                        '<div class="fire-particle fp2"></div>' +
                        '<div class="fire-particle fp3"></div>' +
                        '<div class="fire-base">🔥</div>' +
                        '<div class="fire-glow"></div>' +
                    '</div>' +
                    '<h2 class="rest-title">Rest Site</h2>' +
                    '<div class="rest-options">' +
                        '<button class="btn-rest-option" id="btn-rest">' +
                            '<span class="rest-option-icon">💤</span>' +
                            '<span class="rest-option-label">Rest</span>' +
                            '<span class="rest-option-desc">Heal ' + healAmount + ' HP (' + st.player.hp + '/' + st.player.maxHp + ')</span>' +
                        '</button>' +
                        '<button class="btn-rest-option" id="btn-smith">' +
                            '<span class="rest-option-icon">🔨</span>' +
                            '<span class="rest-option-label">Smith</span>' +
                            '<span class="rest-option-desc">Upgrade a card</span>' +
                        '</button>' +
                    '</div>' +
                '</div>';

            _on('btn-rest', 'click', function () {
                STS.Game.rest();
            });

            _on('btn-smith', 'click', function () {
                var upgradeable = st.player.deck.filter(function (c) { return !c.upgraded; });
                if (upgradeable.length === 0) {
                    ui.showConfirmDialog('No Cards', 'No upgradeable cards in your deck.', function () {});
                    return;
                }
                ui.showCardSelect(upgradeable, 1, function (selected) {
                    if (selected.length > 0) {
                        var realIdx = st.player.deck.indexOf(selected[0].card);
                        if (realIdx >= 0) STS.Game.smith(realIdx);
                    }
                }, 'Choose a Card to Upgrade');
            });
        },

        renderRewardScreen: function () {
            var st = _state();
            if (!st) return;

            var el = _ensureScreen('reward-screen');
            var html =
                '<div class="reward-bg"></div>' +
                '<div class="reward-content">' +
                    '<h2 class="reward-title">Rewards</h2>' +
                    '<div class="reward-list" id="reward-list">';

            var rewards = st.rewards || [];
            for (var i = 0; i < rewards.length; i++) {
                var r = rewards[i];
                var icon = '', label = '';
                switch (r.type) {
                    case 'GOLD':
                        icon = '💰'; label = r.amount + ' Gold'; break;
                    case 'CARD_CHOICE':
                        icon = '🃏'; label = 'Card Reward'; break;
                    case 'POTION':
                        icon = '🧪'; label = r.potion.name; break;
                    case 'RELIC':
                        icon = r.relic.icon || '🔮'; label = r.relic.name; break;
                }
                html +=
                    '<div class="reward-item" data-index="' + i + '">' +
                        '<span class="reward-icon">' + icon + '</span>' +
                        '<span class="reward-label">' + _escHtml(label) + '</span>' +
                    '</div>';
            }

            html += '</div>';
            html += '<button class="btn-large btn-proceed" id="btn-skip-rewards">Proceed</button>';
            html += '</div>';

            el.innerHTML = html;

            var items = el.querySelectorAll('.reward-item');
            for (var i = 0; i < items.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        var idx = parseInt(item.getAttribute('data-index'), 10);
                        ui._onRewardClaim(idx);
                    });
                })(items[i]);
            }

            _on('btn-skip-rewards', 'click', function () {
                STS.Game.skipRewards();
            });
        },

        renderDeckViewScreen: function () {
            var st = _state();
            if (!st) return;

            var el = _ensureScreen('deck-view-screen');
            var deck = st.player.deck.slice();
            deck = _sortDeck(deck, _deckSortMode);

            var html =
                '<div class="deck-view-bg"></div>' +
                '<div class="deck-view-content">' +
                    '<div class="deck-view-header">' +
                        '<h2>Deck (' + deck.length + ' cards)</h2>' +
                        '<div class="deck-sort-buttons">' +
                            '<button class="btn-sort' + (_deckSortMode === 'type' ? ' active' : '') + '" data-sort="type">Type</button>' +
                            '<button class="btn-sort' + (_deckSortMode === 'cost' ? ' active' : '') + '" data-sort="cost">Cost</button>' +
                            '<button class="btn-sort' + (_deckSortMode === 'name' ? ' active' : '') + '" data-sort="name">Name</button>' +
                            '<button class="btn-sort' + (_deckSortMode === 'rarity' ? ' active' : '') + '" data-sort="rarity">Rarity</button>' +
                        '</div>' +
                        '<button class="btn-close-deck" id="btn-close-deck">✕</button>' +
                    '</div>' +
                    '<div class="deck-grid" id="deck-grid">';

            for (var i = 0; i < deck.length; i++) {
                html += '<div class="deck-card-slot" data-deck-index="' + i + '"></div>';
            }

            html += '</div></div>';
            el.innerHTML = html;

            var slots = el.querySelectorAll('.deck-card-slot');
            for (var i = 0; i < slots.length; i++) {
                var cardEl = ui.createCardElement(deck[i], false);
                cardEl.classList.add('card-in-deck');
                (function (card, slot) {
                    slot.addEventListener('mouseenter', function () {
                        ui.showCardPreview(card);
                    });
                    slot.addEventListener('mouseleave', function () {
                        ui.hideCardPreview();
                    });
                })(deck[i], slots[i]);
                slots[i].appendChild(cardEl);
            }

            var sortBtns = el.querySelectorAll('.btn-sort');
            for (var i = 0; i < sortBtns.length; i++) {
                (function (btn) {
                    btn.addEventListener('click', function () {
                        _deckSortMode = btn.getAttribute('data-sort');
                        ui.renderDeckViewScreen();
                        ui.showScreen(SCREEN.DECK_VIEW);
                    });
                })(sortBtns[i]);
            }

            _on('btn-close-deck', 'click', function () {
                STS.Game.changeScreen(_previousScreen || SCREEN.MAP);
            });
        },

        renderGameOverScreen: function () {
            var st = _state();
            var run = st ? st.run : {};

            var el = _ensureScreen('gameover-screen');
            el.innerHTML =
                '<div class="gameover-bg"></div>' +
                '<div class="gameover-content">' +
                    '<h1 class="gameover-title">DEFEAT</h1>' +
                    '<div class="gameover-stats">' +
                        '<div class="stat-row"><span>Floors Climbed</span><span>' + (run.floorsClimbed || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Monsters Slain</span><span>' + (run.monstersKilled || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Elites Slain</span><span>' + (run.elitesKilled || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Bosses Slain</span><span>' + (run.bossesKilled || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Gold Earned</span><span>' + (run.goldEarned || 0) + '</span></div>' +
                        '<div class="stat-row stat-total"><span>Score</span><span>' + (run.score || 0) + '</span></div>' +
                    '</div>' +
                    '<div class="gameover-buttons">' +
                        '<button class="btn-large" id="btn-retry">Try Again</button>' +
                        '<button class="btn-large btn-secondary" id="btn-main-menu">Main Menu</button>' +
                    '</div>' +
                '</div>';

            _on('btn-retry', 'click', function () { STS.Game.newRun(); });
            _on('btn-main-menu', 'click', function () { STS.Game.changeScreen(SCREEN.TITLE); });
        },

        renderVictoryScreen: function () {
            var st = _state();
            var run = st ? st.run : {};

            var el = _ensureScreen('victory-screen');
            el.innerHTML =
                '<div class="victory-bg"></div>' +
                '<div class="victory-particles" id="victory-particles"></div>' +
                '<div class="victory-content">' +
                    '<h1 class="victory-title">VICTORY!</h1>' +
                    '<div class="victory-stats">' +
                        '<div class="stat-row"><span>Floors Climbed</span><span>' + (run.floorsClimbed || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Monsters Slain</span><span>' + (run.monstersKilled || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Elites Slain</span><span>' + (run.elitesKilled || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Bosses Slain</span><span>' + (run.bossesKilled || 0) + '</span></div>' +
                        '<div class="stat-row"><span>Gold Earned</span><span>' + (run.goldEarned || 0) + '</span></div>' +
                        '<div class="stat-row stat-total"><span>Score</span><span>' + (run.score || 0) + '</span></div>' +
                    '</div>' +
                    '<div class="victory-buttons">' +
                        '<button class="btn-large" id="btn-play-again">Play Again</button>' +
                        '<button class="btn-large btn-secondary" id="btn-main-victory">Main Menu</button>' +
                    '</div>' +
                '</div>';

            _on('btn-play-again', 'click', function () { STS.Game.newRun(); });
            _on('btn-main-victory', 'click', function () { STS.Game.changeScreen(SCREEN.TITLE); });

            _spawnVictoryParticles();
        },

        renderSettingsOverlay: function () {
            var st = _state();
            var settings = st ? st.settings : {
                musicVolume: 0.5,
                sfxVolume: 0.7,
                screenShake: true,
                fastMode: false,
                showDamageNumbers: true
            };

            var overlay = document.getElementById('settings-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'settings-overlay';
                overlay.className = 'overlay';
                document.getElementById('game-container').appendChild(overlay);
            }

            overlay.innerHTML =
                '<div class="settings-panel">' +
                    '<h2>Settings</h2>' +
                    '<div class="setting-row">' +
                        '<label>Music Volume</label>' +
                        '<input type="range" id="setting-music" min="0" max="100" value="' + Math.round(settings.musicVolume * 100) + '">' +
                        '<span id="music-val">' + Math.round(settings.musicVolume * 100) + '%</span>' +
                    '</div>' +
                    '<div class="setting-row">' +
                        '<label>SFX Volume</label>' +
                        '<input type="range" id="setting-sfx" min="0" max="100" value="' + Math.round(settings.sfxVolume * 100) + '">' +
                        '<span id="sfx-val">' + Math.round(settings.sfxVolume * 100) + '%</span>' +
                    '</div>' +
                    '<div class="setting-row">' +
                        '<label>Screen Shake</label>' +
                        '<input type="checkbox" id="setting-shake"' + (settings.screenShake ? ' checked' : '') + '>' +
                    '</div>' +
                    '<div class="setting-row">' +
                        '<label>Fast Mode</label>' +
                        '<input type="checkbox" id="setting-fast"' + (settings.fastMode ? ' checked' : '') + '>' +
                    '</div>' +
                    '<div class="setting-row">' +
                        '<label>Damage Numbers</label>' +
                        '<input type="checkbox" id="setting-dmgnums"' + (settings.showDamageNumbers ? ' checked' : '') + '>' +
                    '</div>' +
                    '<div class="settings-buttons">' +
                        '<button class="btn-large" id="btn-save-settings">Save</button>' +
                        '<button class="btn-large btn-secondary" id="btn-close-settings">Close</button>' +
                    '</div>' +
                '</div>';

            overlay.style.display = 'flex';

            var musicSlider = document.getElementById('setting-music');
            var sfxSlider = document.getElementById('setting-sfx');
            if (musicSlider) {
                musicSlider.addEventListener('input', function () {
                    document.getElementById('music-val').textContent = musicSlider.value + '%';
                });
            }
            if (sfxSlider) {
                sfxSlider.addEventListener('input', function () {
                    document.getElementById('sfx-val').textContent = sfxSlider.value + '%';
                });
            }

            _on('btn-save-settings', 'click', function () {
                ui._saveSettings();
                overlay.style.display = 'none';
            });
            _on('btn-close-settings', 'click', function () {
                overlay.style.display = 'none';
                if (_previousScreen && _previousScreen !== SCREEN.SETTINGS) {
                    ui.currentScreen = _previousScreen;
                }
            });
        },

        /* ==============================================================
         *  COMBAT UI COMPONENTS
         * ============================================================== */

        renderHand: function () {
            var st = _state();
            if (!st) return;

            var hand = st.player.hand;
            var container = document.getElementById('hand-container');
            if (!container) return;
            container.innerHTML = '';

            var cardCount = hand.length;
            if (cardCount === 0) return;

            var maxWidth = Math.min(container.offsetWidth || 900, 900);
            var cardWidth = 150;
            var totalWidth = Math.min(cardCount * cardWidth, maxWidth);
            var spacing = cardCount > 1 ? totalWidth / (cardCount - 1) : 0;
            var startX = ((container.offsetWidth || maxWidth) - totalWidth) / 2;

            var maxRotation = 15;
            var maxLift = 30;

            for (var i = 0; i < hand.length; i++) {
                (function (card, idx) {
                    var el = ui.createCardElement(card, true);
                    el.dataset.handIndex = idx;
                    el.classList.add('card-in-hand');

                    var progress = cardCount > 1 ? idx / (cardCount - 1) : 0.5;
                    var x = startX + progress * totalWidth;
                    var rotation = (progress - 0.5) * maxRotation * 2;
                    var lift = -Math.pow((progress - 0.5) * 2, 2) * maxLift + maxLift;

                    el.style.position = 'absolute';
                    el.style.left = x + 'px';
                    el.style.transform = 'rotate(' + rotation + 'deg) translateY(' + (-lift) + 'px)';
                    el.style.zIndex = idx;
                    el.dataset.origTransform = 'rotate(' + rotation + 'deg) translateY(' + (-lift) + 'px)';
                    el.dataset.origZ = idx;

                    container.appendChild(el);
                })(hand[i], i);
            }
        },

        renderEnemies: function () {
            var st = _state();
            if (!st) return;

            var area = document.getElementById('enemy-area');
            if (!area) return;
            area.innerHTML = '';

            var enemies = st.combat.enemies;
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                var el = ui.createEnemyElement(enemies[i], i);
                area.appendChild(el);
            }

            ui.updateEnemyIntents();
        },

        renderPlayerInfo: function () {
            var st = _state();
            if (!st) return;

            var container = document.getElementById('player-info');
            if (!container) return;

            var p = st.player;
            var hpPercent = p.maxHp > 0 ? (p.hp / p.maxHp * 100) : 0;
            var blockHtml = p.block > 0
                ? '<div class="player-block"><span class="block-icon">🛡️</span><span class="block-value">' + p.block + '</span></div>'
                : '';

            container.innerHTML =
                '<div class="player-avatar"><img src="assets/hero.png" alt="' + _escHtml(p.name) + '" onerror="this.style.display=\'none\'"><div class="player-avatar-fallback">⚔️</div></div>' +
                '<div class="player-name">' + _escHtml(p.name) + '</div>' +
                '<div class="player-hp-bar">' +
                    '<div class="hp-bar-fill" style="width:' + hpPercent + '%"></div>' +
                    '<span class="hp-text">' + p.hp + '/' + p.maxHp + '</span>' +
                '</div>' +
                blockHtml +
                '<div class="player-effects" id="player-effects"></div>';

            ui.renderStatusEffects(p, document.getElementById('player-effects'));
        },

        renderRelicBar: function () {
            var st = _state();
            if (!st) return;

            var bars = [document.getElementById('relic-bar'), document.getElementById('map-relic-bar')];
            for (var b = 0; b < bars.length; b++) {
                var bar = bars[b];
                if (!bar) continue;
                bar.innerHTML = '';
                for (var i = 0; i < st.player.relics.length; i++) {
                    bar.appendChild(ui.createRelicElement(st.player.relics[i]));
                }
            }
        },

        renderPotionBar: function () {
            var st = _state();
            if (!st) return;

            var bar = document.getElementById('potion-bar');
            if (!bar) return;
            bar.innerHTML = '';

            var potions = st.player.potions;
            var slots = potions.length || 3;
            for (var i = 0; i < slots; i++) {
                var el = ui.createPotionElement(potions[i], i);
                bar.appendChild(el);
            }
        },

        renderEnergyOrb: function () {
            var st = _state();
            if (!st) return;

            var container = document.getElementById('energy-orb');
            if (!container) return;

            var energy = st.player.energy;
            var maxEnergy = st.player.maxEnergy;
            var hasEnergy = energy > 0;

            container.innerHTML =
                '<div class="energy-orb ' + (hasEnergy ? 'has-energy' : 'no-energy') + '">' +
                    '<span class="energy-current">' + energy + '</span>' +
                    '<span class="energy-separator">/</span>' +
                    '<span class="energy-max">' + maxEnergy + '</span>' +
                '</div>';
        },

        renderDrawDiscardPiles: function () {
            var st = _state();
            if (!st) return;

            var drawEl = document.getElementById('draw-count');
            var discardEl = document.getElementById('discard-count');
            if (drawEl) drawEl.textContent = st.player.drawPile.length;
            if (discardEl) discardEl.textContent = st.player.discardPile.length;
        },

        renderCombatLog: function () {
            var st = _state();
            if (!st) return;

            var logEl = document.getElementById('combat-log');
            if (!logEl) return;

            var logs = st.log || [];
            var recent = logs.slice(-8);
            var html = '';
            for (var i = 0; i < recent.length; i++) {
                html += '<div class="log-entry log-' + (recent[i].type || 'info') + '">' +
                    _escHtml(recent[i].message) + '</div>';
            }
            logEl.innerHTML = html;
            logEl.scrollTop = logEl.scrollHeight;
        },

        renderStatusEffects: function (target, container) {
            if (!container) return;
            container.innerHTML = '';

            if (!target || !target.statusEffects) return;

            var effects = STS.Effects ? STS.Effects.getActiveEffects(target) : [];

            for (var i = 0; i < effects.length; i++) {
                var fx = effects[i];
                var icon = ui.createStatusEffectIcon(fx.id, fx.amount);
                container.appendChild(icon);
            }
        },

        /* ==============================================================
         *  CARD INTERACTIONS
         * ============================================================== */

        onCardHover: function (card, el) {
            if (ui.targetingMode) return;
            ui.hoveredCard = card;

            if (el) {
                el.classList.add('card-hovered');
                el.style.transform = 'translateY(-50px) scale(1.3)';
                el.style.zIndex = 100;
                el.style.transition = 'transform 0.15s ease, z-index 0s';
            }

            ui.showCardPreview(card);
        },

        onCardLeave: function (card, el) {
            if (ui.targetingMode) return;
            ui.hoveredCard = null;

            if (el) {
                el.classList.remove('card-hovered');
                el.style.transform = el.dataset.origTransform || '';
                el.style.zIndex = el.dataset.origZ || 0;
                el.style.transition = 'transform 0.2s ease, z-index 0s';
            }

            ui.hideCardPreview();
        },

        onCardClick: function (card) {
            var st = _state();
            if (!st || !st.combat.playerTurn) return;

            if (ui.targetingMode) {
                ui.exitTargetingMode();
                return;
            }

            var handIndex = st.player.hand.indexOf(card);
            if (handIndex < 0) return;

            if (!_canPlayCard(card, st)) {
                _flashElement(document.querySelectorAll('.card-in-hand')[handIndex], 'card-flash-unplayable');
                return;
            }

            var target = card.target || 'SELF';
            if (target === 'SINGLE_ENEMY' || target === 'SINGLE') {
                ui.enterTargetingMode(card, handIndex);
            } else {
                STS.Game.playCard(handIndex);
                ui._refreshCombat();
            }
        },

        onCardDragStart: function () {},
        onCardDrag: function () {},
        onCardDragEnd: function () {},

        onEnemyClick: function (enemyIndex) {
            var st = _state();
            if (!st) return;

            if (ui.targetingMode && ui.targetingCard) {
                var handIndex = ui.targetingCardIndex;
                ui.exitTargetingMode();
                STS.Game.playCard(handIndex, enemyIndex);
                ui._refreshCombat();
            }
        },

        enterTargetingMode: function (card, handIndex) {
            ui.targetingMode = true;
            ui.targetingCard = card;
            ui.targetingCardIndex = handIndex;

            var enemies = document.querySelectorAll('.enemy');
            for (var i = 0; i < enemies.length; i++) {
                enemies[i].classList.add('enemy-targetable');
            }

            var canvas = document.getElementById('targeting-canvas');
            if (canvas) {
                canvas.style.pointerEvents = 'none';
                canvas.style.display = 'block';
            }

            document.body.classList.add('targeting-active');
        },

        exitTargetingMode: function () {
            ui.targetingMode = false;
            ui.targetingCard = null;
            ui.targetingCardIndex = -1;

            var enemies = document.querySelectorAll('.enemy');
            for (var i = 0; i < enemies.length; i++) {
                enemies[i].classList.remove('enemy-targetable');
            }

            var canvas = document.getElementById('targeting-canvas');
            if (canvas && _targetingArrowCtx) {
                _targetingArrowCtx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.style.display = 'none';
            }

            document.body.classList.remove('targeting-active');
        },

        /* ==============================================================
         *  ANIMATIONS
         * ============================================================== */

        playCardAnimation: function (card, target) {
            if (!card) return;
            var handContainer = document.getElementById('hand-container');
            if (!handContainer) return;

            var clone = ui.createCardElement(card, false);
            clone.classList.add('card-playing');
            clone.style.position = 'fixed';
            clone.style.left = (_mouseX - 75) + 'px';
            clone.style.top = (_mouseY - 100) + 'px';
            clone.style.zIndex = 9999;
            clone.style.transition = 'all 0.4s ease';
            document.body.appendChild(clone);

            var targetEl = null;
            if (target) {
                var st = _state();
                if (st) {
                    var idx = st.combat.enemies.indexOf(target);
                    if (idx >= 0) targetEl = document.querySelector('.enemy[data-enemy-index="' + idx + '"]');
                }
            }

            requestAnimationFrame(function () {
                if (targetEl) {
                    var rect = targetEl.getBoundingClientRect();
                    clone.style.left = (rect.left + rect.width / 2 - 75) + 'px';
                    clone.style.top = (rect.top - 50) + 'px';
                } else {
                    clone.style.top = (parseInt(clone.style.top) - 200) + 'px';
                }
                clone.style.opacity = '0';
                clone.style.transform = 'scale(0.5)';
            });

            setTimeout(function () { if (clone.parentNode) clone.parentNode.removeChild(clone); }, 500);
        },

        dealDamageAnimation: function (target, amount) {
            var st = _state();
            if (!st) return;

            var targetEl = _resolveTargetElement(target, st);
            if (!targetEl) return;

            targetEl.classList.add('damage-flash');
            setTimeout(function () { targetEl.classList.remove('damage-flash'); }, 300);

            if (st.settings && st.settings.showDamageNumbers) {
                ui.showDamageNumber(targetEl, amount, 'damage');
            }

            if (st.settings && st.settings.screenShake) {
                var intensity = Math.min(amount * 0.5, 15);
                ui.screenShake(intensity, 200);
            }

            _updateHpBar(target, st);
        },

        gainBlockAnimation: function (target, amount) {
            var st = _state();
            if (!st) return;

            var targetEl = _resolveTargetElement(target, st);
            if (!targetEl) return;

            if (amount > 0 && st.settings && st.settings.showDamageNumbers) {
                ui.showDamageNumber(targetEl, amount, 'block');
            }
        },

        healAnimation: function (target, amount) {
            var st = _state();
            if (!st) return;

            var targetEl = target ? _resolveTargetElement(target, st) : document.getElementById('player-info');
            if (!targetEl) return;

            if (st.settings && st.settings.showDamageNumbers) {
                ui.showDamageNumber(targetEl, amount, 'heal');
            }
        },

        statusEffectAnimation: function (target, effect) {
            var st = _state();
            if (!st) return;

            var targetEl = _resolveTargetElement(target, st);
            if (targetEl) {
                var flash = document.createElement('div');
                flash.className = 'status-effect-flash';
                flash.textContent = effect;
                targetEl.appendChild(flash);
                setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 600);
            }
        },

        cardDrawAnimation: function () {
            ui.renderHand();
        },

        enemyAttackAnimation: function (enemy, damage) {
            var st = _state();
            if (!st) return;

            var idx = st.combat.enemies.indexOf(enemy);
            if (idx < 0) return;
            var el = document.querySelector('.enemy[data-enemy-index="' + idx + '"]');
            if (!el) return;

            el.classList.add('enemy-attacking');
            setTimeout(function () { el.classList.remove('enemy-attacking'); }, 400);

            if (st.settings && st.settings.showDamageNumbers) {
                var playerEl = document.getElementById('player-info');
                if (playerEl) ui.showDamageNumber(playerEl, damage, 'damage');
            }
        },

        deathAnimation: function (enemyIndex) {
            var el = document.querySelector('.enemy[data-enemy-index="' + enemyIndex + '"]');
            if (!el) return;

            el.classList.add('enemy-dying');
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 800);
        },

        screenShake: function (intensity, duration) {
            var st = _state();
            if (st && st.settings && !st.settings.screenShake) return;

            intensity = intensity || 5;
            duration = duration || 200;

            var gameContainer = document.getElementById('game-container');
            if (!gameContainer) return;

            var startTime = Date.now();

            function shake() {
                var elapsed = Date.now() - startTime;
                if (elapsed > duration) {
                    gameContainer.style.transform = '';
                    return;
                }
                var decay = 1 - elapsed / duration;
                var x = (Math.random() - 0.5) * intensity * decay;
                var y = (Math.random() - 0.5) * intensity * decay;
                gameContainer.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
                requestAnimationFrame(shake);
            }
            shake();
        },

        flashRelic: function (relicId) {
            var relicEls = document.querySelectorAll('.relic-icon');
            for (var i = 0; i < relicEls.length; i++) {
                if (relicEls[i].dataset.relicId === relicId) {
                    relicEls[i].classList.add('relic-flash');
                    (function (el) {
                        setTimeout(function () { el.classList.remove('relic-flash'); }, 600);
                    })(relicEls[i]);
                }
            }
        },

        /* ==============================================================
         *  TOOLTIPS
         * ============================================================== */

        showTooltip: function (element, content, position) {
            ui.hideTooltip();

            var tooltip = document.getElementById('game-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'game-tooltip';
                tooltip.className = 'game-tooltip';
                document.body.appendChild(tooltip);
            }

            tooltip.innerHTML = content;
            tooltip.style.display = 'block';

            var rect = element.getBoundingClientRect();
            var pos = position || 'top';

            switch (pos) {
                case 'top':
                    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                    tooltip.style.top = (rect.top - 8) + 'px';
                    tooltip.style.transform = 'translate(-50%, -100%)';
                    break;
                case 'bottom':
                    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                    tooltip.style.top = (rect.bottom + 8) + 'px';
                    tooltip.style.transform = 'translate(-50%, 0)';
                    break;
                case 'right':
                    tooltip.style.left = (rect.right + 8) + 'px';
                    tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                    tooltip.style.transform = 'translate(0, -50%)';
                    break;
                case 'left':
                    tooltip.style.left = (rect.left - 8) + 'px';
                    tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                    tooltip.style.transform = 'translate(-100%, -50%)';
                    break;
            }

            _clampTooltipPosition(tooltip);
        },

        hideTooltip: function () {
            var tooltip = document.getElementById('game-tooltip');
            if (tooltip) tooltip.style.display = 'none';
            if (ui.tooltipTimeout) {
                clearTimeout(ui.tooltipTimeout);
                ui.tooltipTimeout = null;
            }
        },

        showCardPreview: function (card) {
            if (!card) return;

            var preview = document.getElementById('card-preview');
            if (!preview) {
                preview = document.createElement('div');
                preview.id = 'card-preview';
                preview.className = 'card-preview-overlay';
                document.body.appendChild(preview);
            }

            var desc = _getCardDescription(card);
            var costDisplay = card.energy === -1 ? 'X' : card.energy;
            var typeLine = card.type;
            if (card.rarity && card.rarity !== 'STARTER' && card.rarity !== 'BASIC' &&
                card.rarity !== 'STATUS' && card.rarity !== 'CURSE') {
                typeLine += ' — ' + card.rarity;
            }

            preview.innerHTML =
                '<div class="card-preview-card card-' + (card.type || 'attack').toLowerCase() +
                (card.upgraded ? ' card-upgraded' : '') + '">' +
                    '<div class="card-preview-cost">' + costDisplay + '</div>' +
                    '<div class="card-preview-name">' + _escHtml(card.upgraded ? (card.name || '') : (card.name || '')) + '</div>' +
                    '<div class="card-preview-art ' + (card.artClass || '') + '"></div>' +
                    '<div class="card-preview-type">' + typeLine + '</div>' +
                    '<div class="card-preview-desc">' + ui.formatDescription(desc) + '</div>' +
                '</div>';

            var artHost = preview.querySelector('.card-preview-art');
            if (artHost) {
                _attachCardArtToHost(artHost, card, 'card-preview-art-img');
            }

            preview.style.display = 'block';
        },

        hideCardPreview: function () {
            var preview = document.getElementById('card-preview');
            if (preview) preview.style.display = 'none';
        },

        /* ==============================================================
         *  MODALS / OVERLAYS
         * ============================================================== */

        showCardReward: function (cards) {
            var overlay = _createOverlay('card-reward-overlay');
            var html =
                '<div class="card-reward-panel">' +
                    '<h3>Choose a Card</h3>' +
                    '<div class="card-reward-options" id="card-reward-options"></div>' +
                    '<button class="btn-large btn-secondary" id="btn-skip-card">Skip</button>' +
                '</div>';

            overlay.innerHTML = html;

            var optContainer = document.getElementById('card-reward-options');
            for (var i = 0; i < cards.length; i++) {
                (function (card, idx) {
                    var wrapper = document.createElement('div');
                    wrapper.className = 'card-reward-option';
                    var el = ui.createCardElement(card, false);
                    el.classList.add('card-reward-pick');
                    wrapper.appendChild(el);

                    wrapper.addEventListener('click', function () {
                        _removeOverlay('card-reward-overlay');
                        STS.Game.claimReward(ui._pendingRewardIndex, idx);
                        ui.renderRewardScreen();
                        ui.showScreen(SCREEN.REWARD);
                    });

                    wrapper.addEventListener('mouseenter', function () { ui.showCardPreview(card); });
                    wrapper.addEventListener('mouseleave', function () { ui.hideCardPreview(); });

                    optContainer.appendChild(wrapper);
                })(cards[i], i);
            }

            _on('btn-skip-card', 'click', function () {
                _removeOverlay('card-reward-overlay');
            });
        },

        showCardSelect: function (cards, count, action, title) {
            _cardSelectCallback = action;
            _cardSelectCount = count;
            _cardSelectSelected = [];

            var overlay = _createOverlay('card-select-overlay');
            var html =
                '<div class="card-select-panel">' +
                    '<h3>' + _escHtml(title || 'Select ' + count + ' Card(s)') + '</h3>' +
                    '<div class="card-select-grid" id="card-select-grid"></div>' +
                    '<div class="card-select-actions">' +
                        '<button class="btn-large" id="btn-confirm-select" disabled>Confirm</button>' +
                        '<button class="btn-large btn-secondary" id="btn-cancel-select">Cancel</button>' +
                    '</div>' +
                '</div>';

            overlay.innerHTML = html;

            var grid = document.getElementById('card-select-grid');
            for (var i = 0; i < cards.length; i++) {
                (function (card, idx) {
                    var wrapper = document.createElement('div');
                    wrapper.className = 'card-select-item';
                    wrapper.dataset.selectIndex = idx;
                    var el = ui.createCardElement(card, false);
                    wrapper.appendChild(el);

                    wrapper.addEventListener('click', function () {
                        var selIdx = -1;
                        for (var si = 0; si < _cardSelectSelected.length; si++) {
                            if (_cardSelectSelected[si].index === idx) {
                                selIdx = si;
                                break;
                            }
                        }
                        if (selIdx >= 0) {
                            _cardSelectSelected.splice(selIdx, 1);
                            wrapper.classList.remove('card-selected');
                        } else if (_cardSelectSelected.length < _cardSelectCount) {
                            _cardSelectSelected.push({ card: card, index: idx });
                            wrapper.classList.add('card-selected');
                        }

                        var confirmBtn = document.getElementById('btn-confirm-select');
                        if (confirmBtn) {
                            confirmBtn.disabled = _cardSelectSelected.length === 0;
                        }
                    });

                    wrapper.addEventListener('mouseenter', function () { ui.showCardPreview(card); });
                    wrapper.addEventListener('mouseleave', function () { ui.hideCardPreview(); });

                    grid.appendChild(wrapper);
                })(cards[i], i);
            }

            _on('btn-confirm-select', 'click', function () {
                _removeOverlay('card-select-overlay');
                if (_cardSelectCallback) {
                    _cardSelectCallback(_cardSelectSelected);
                    _cardSelectCallback = null;
                }
            });

            _on('btn-cancel-select', 'click', function () {
                _removeOverlay('card-select-overlay');
                _cardSelectCallback = null;
            });
        },

        showConfirmDialog: function (title, message, onConfirm) {
            var overlay = _createOverlay('confirm-overlay');
            overlay.innerHTML =
                '<div class="confirm-panel">' +
                    '<h3>' + _escHtml(title) + '</h3>' +
                    '<p>' + _escHtml(message) + '</p>' +
                    '<div class="confirm-buttons">' +
                        '<button class="btn-large" id="btn-confirm-yes">OK</button>' +
                        '<button class="btn-large btn-secondary" id="btn-confirm-no">Cancel</button>' +
                    '</div>' +
                '</div>';

            _on('btn-confirm-yes', 'click', function () {
                _removeOverlay('confirm-overlay');
                if (onConfirm) onConfirm();
            });
            _on('btn-confirm-no', 'click', function () {
                _removeOverlay('confirm-overlay');
            });
        },

        showDeckView: function () {
            _previousScreen = ui.currentScreen;
            STS.Game.changeScreen(SCREEN.DECK_VIEW);
        },

        /* ==============================================================
         *  FLOATING TEXT
         * ============================================================== */

        showFloatingText: function (x, y, text, color, size) {
            var el = document.createElement('div');
            el.className = 'floating-text';
            el.textContent = text;
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.color = color || '#ffffff';
            el.style.fontSize = (size || 24) + 'px';
            document.body.appendChild(el);

            requestAnimationFrame(function () {
                el.style.transform = 'translateY(-80px)';
                el.style.opacity = '0';
            });

            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
        },

        showDamageNumber: function (targetEl, amount, type) {
            if (!targetEl) return;

            var numEl = document.createElement('div');
            numEl.className = 'damage-number damage-' + type;

            switch (type) {
                case 'heal':
                    numEl.textContent = '+' + amount;
                    break;
                case 'block':
                    numEl.textContent = '+' + amount + '🛡️';
                    break;
                case 'poison':
                    numEl.textContent = amount + '☠️';
                    break;
                default:
                    numEl.textContent = '-' + amount;
            }

            var rect = targetEl.getBoundingClientRect();
            numEl.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 40) + 'px';
            numEl.style.top = rect.top + 'px';

            document.body.appendChild(numEl);

            requestAnimationFrame(function () {
                numEl.style.transform = 'translateY(-80px)';
                numEl.style.opacity = '0';
            });

            setTimeout(function () { if (numEl.parentNode) numEl.parentNode.removeChild(numEl); }, 1000);
        },

        /* ==============================================================
         *  ELEMENT FACTORIES
         * ============================================================== */

        createCardElement: function (card, interactive) {
            if (interactive === undefined) interactive = true;

            var el = document.createElement('div');
            el.className = 'card card-' + (card.type || 'attack').toLowerCase() +
                ' card-rarity-' + (card.rarity || 'common').toLowerCase();
            if (card.upgraded) el.classList.add('card-upgraded');

            if (interactive && !_canPlayCard(card, _state())) {
                el.classList.add('card-unplayable');
            }

            var costDisplay = card.energy === -1 ? 'X' : (card.energy >= 0 ? card.energy : '');
            var nameDisplay = card.name || 'Card';
            var desc = _getCardDescription(card);
            var typeLine = card.type || '';
            if (card.rarity && card.rarity !== 'STARTER' && card.rarity !== 'BASIC' &&
                card.rarity !== 'STATUS' && card.rarity !== 'CURSE') {
                typeLine += ' — ' + card.rarity;
            }

            el.innerHTML =
                '<div class="card-inner">' +
                    '<div class="card-cost">' + costDisplay + '</div>' +
                    '<div class="card-name">' + _escHtml(nameDisplay) + '</div>' +
                    '<div class="card-art ' + (card.artClass || '') + '"></div>' +
                    '<div class="card-type-line">' + typeLine + '</div>' +
                    '<div class="card-description">' + ui.formatDescription(desc) + '</div>' +
                '</div>';

            var artHost = el.querySelector('.card-art');
            if (artHost) {
                _attachCardArtToHost(artHost, card, 'card-art-img');
            }

            if (interactive) {
                el.addEventListener('mouseenter', function () { ui.onCardHover(card, el); });
                el.addEventListener('mouseleave', function () { ui.onCardLeave(card, el); });
                el.addEventListener('click', function (e) {
                    e.stopPropagation();
                    ui.onCardClick(card);
                });
            }

            return el;
        },

        createRelicElement: function (relic) {
            var el = document.createElement('div');
            el.className = 'relic-icon';
            el.dataset.relicId = relic.id;
            el.title = relic.name;

            el.innerHTML = '<span class="relic-emoji">' + (relic.icon || '🔮') + '</span>';
            if (relic.counter !== undefined && relic.counter >= 0) {
                el.innerHTML += '<span class="relic-counter">' + relic.counter + '</span>';
            }

            el.addEventListener('mouseenter', function () {
                ui.showTooltip(el,
                    '<strong>' + _escHtml(relic.name) + '</strong><br>' +
                    '<span class="tooltip-desc">' + _escHtml(relic.description) + '</span>',
                    'bottom');
            });
            el.addEventListener('mouseleave', function () { ui.hideTooltip(); });

            return el;
        },

        createPotionElement: function (potion, slotIndex) {
            var el = document.createElement('div');
            el.className = 'potion-slot';
            el.dataset.slotIndex = slotIndex;

            if (potion) {
                el.classList.add('potion-filled');
                el.innerHTML =
                    '<span class="potion-icon" style="color:' + (potion.color || '#fff') + '">🧪</span>' +
                    '<span class="potion-name-label">' + _escHtml(potion.name) + '</span>';

                el.addEventListener('click', function () {
                    ui._onPotionUse(slotIndex);
                });
                el.addEventListener('contextmenu', function (e) {
                    e.preventDefault();
                    ui.showConfirmDialog('Discard Potion', 'Discard ' + potion.name + '?', function () {
                        var st = _state();
                        if (st) st.player.potions[slotIndex] = null;
                        ui.renderPotionBar();
                    });
                });
                el.addEventListener('mouseenter', function () {
                    ui.showTooltip(el,
                        '<strong>' + _escHtml(potion.name) + '</strong><br>' +
                        '<span class="tooltip-desc">' + _escHtml(potion.description) + '</span>',
                        'top');
                });
                el.addEventListener('mouseleave', function () { ui.hideTooltip(); });
            } else {
                el.classList.add('potion-empty');
                el.innerHTML = '<span class="potion-icon potion-empty-icon">◯</span>';
            }

            return el;
        },

        createEnemyElement: function (enemy, index) {
            var el = document.createElement('div');
            el.className = 'enemy';
            el.dataset.enemyIndex = index;

            var hpPercent = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp * 100) : 0;
            var blockHtml = enemy.block > 0
                ? '<div class="enemy-block-display"><span class="block-icon">🛡️</span><span class="block-value">' + enemy.block + '</span></div>'
                : '<div class="enemy-block-display" style="display:none"><span class="block-icon">🛡️</span><span class="block-value">0</span></div>';

            el.innerHTML =
                '<div class="enemy-intent" id="intent-' + index + '">' +
                    '<span class="intent-icon"></span>' +
                    '<span class="intent-value"></span>' +
                '</div>' +
                '<div class="enemy-image-container">' +
                    '<img src="' + (enemy.image || 'assets/enemies/default.png') + '" class="enemy-image" alt="' + _escHtml(enemy.name) + '" draggable="false" onerror="this.style.display=\'none\'">' +
                    '<div class="enemy-image-fallback">👹</div>' +
                    blockHtml +
                '</div>' +
                '<div class="enemy-name">' + _escHtml(enemy.name) + '</div>' +
                '<div class="enemy-hp-bar">' +
                    '<div class="hp-bar-fill" style="width:' + hpPercent + '%"></div>' +
                    '<div class="hp-bar-damage" style="width:0%"></div>' +
                    '<span class="hp-text">' + enemy.hp + '/' + enemy.maxHp + '</span>' +
                '</div>' +
                '<div class="enemy-effects" id="effects-' + index + '"></div>';

            el.addEventListener('click', function () { ui.onEnemyClick(index); });

            el.addEventListener('mouseenter', function () {
                var desc = _buildEnemyTooltip(enemy);
                ui.showTooltip(el, desc, 'top');
            });
            el.addEventListener('mouseleave', function () { ui.hideTooltip(); });

            ui.renderStatusEffects(enemy, el.querySelector('.enemy-effects'));

            return el;
        },

        createStatusEffectIcon: function (effectId, amount) {
            var el = document.createElement('div');
            el.className = 'status-effect-icon';

            var def = null;
            if (STS.Effects && STS.Effects.getActiveEffects) {
                var desc = STS.Effects.getDescription ? STS.Effects.getDescription(effectId, amount) : '';
                el.title = effectId + ': ' + desc;
            }

            if (typeof EFFECT_DEFINITIONS !== 'undefined' && EFFECT_DEFINITIONS[effectId]) {
                def = EFFECT_DEFINITIONS[effectId];
            }

            var icon = def ? def.icon : '❓';
            var color = def ? def.color : '#888';
            var type = def ? def.type : 'SPECIAL';

            el.classList.add('effect-' + type.toLowerCase());
            el.innerHTML =
                '<span class="effect-icon-symbol" style="color:' + color + '">' + icon + '</span>' +
                '<span class="effect-amount">' + amount + '</span>';

            el.addEventListener('mouseenter', function () {
                var name = def ? def.name : effectId;
                var descText = '';
                if (def && typeof def.description === 'function') {
                    descText = def.description(amount);
                } else if (STS.Effects && STS.Effects.getDescription) {
                    descText = STS.Effects.getDescription(effectId, amount);
                }
                ui.showTooltip(el,
                    '<strong>' + _escHtml(name) + '</strong> (' + amount + ')<br>' +
                    '<span class="tooltip-desc">' + _escHtml(descText) + '</span>',
                    'top');
            });
            el.addEventListener('mouseleave', function () { ui.hideTooltip(); });

            return el;
        },

        updateEnemyIntents: function () {
            var st = _state();
            if (!st) return;

            var enemies = st.combat.enemies;
            for (var i = 0; i < enemies.length; i++) {
                var enemy = enemies[i];
                if (!enemy.alive) continue;

                var intentEl = document.getElementById('intent-' + i);
                if (!intentEl) continue;

                var intent = enemy.currentIntent;
                if (!intent) {
                    intentEl.innerHTML = '';
                    intentEl.removeAttribute('title');
                    continue;
                }

                var intentType = (intent.type || 'UNKNOWN').toUpperCase();
                var display = INTENT_DISPLAY[intentType] || INTENT_DISPLAY.UNKNOWN;

                var idisp = null;
                if (STS.Enemies && typeof STS.Enemies.getIntentDisplay === 'function' &&
                    enemy.moveset && enemy.intent != null && enemy.intent !== undefined) {
                    try {
                        idisp = STS.Enemies.getIntentDisplay(enemy);
                    } catch (e) {
                        idisp = null;
                    }
                }

                var valueText = '';
                if (idisp && idisp.text && (intentType.indexOf('ATTACK') >= 0 || intentType === 'DEFEND')) {
                    valueText = idisp.text;
                } else if (intentType.indexOf('ATTACK') >= 0 && intent.damage !== undefined && intent.damage !== null) {
                    var dmg = intent.damage;
                    if (Array.isArray(dmg)) dmg = dmg[0] + '-' + dmg[1];
                    valueText = String(dmg);
                    if (intent.times && intent.times > 1) {
                        valueText += '×' + intent.times;
                    }
                } else if (intentType === 'DEFEND' && intent.block !== undefined && intent.block !== null) {
                    valueText = String(intent.block);
                } else if (intentType === 'BUFF' && intent.buff) {
                    valueText = String(intent.buff.amount != null ? intent.buff.amount : '');
                } else if ((intentType === 'DEBUFF' || intentType === 'DEBUFF_MULTI') && intent.debuff) {
                    valueText = String(intent.debuff.amount != null ? intent.debuff.amount : '');
                } else if (idisp && idisp.text && intentType !== 'ATTACK' && intentType.indexOf('ATTACK') < 0) {
                    valueText = idisp.text;
                }

                var tipName = (idisp && idisp.name) ? idisp.name : (intent.name || intentType);
                var tipExtra = (idisp && idisp.text && idisp.text !== valueText) ? idisp.text : '';
                intentEl.setAttribute('title', tipExtra ? (tipName + ' — ' + tipExtra) : tipName);

                intentEl.innerHTML =
                    '<span class="intent-icon" style="color:' + display.color + '">' + display.icon + '</span>' +
                    (valueText !== '' ? '<span class="intent-value intent-value-' + intentType.toLowerCase().replace(/_/g, '-') + '">' + valueText + '</span>' : '');

                intentEl.className = 'enemy-intent intent-bob';
            }
        },

        updatePlayerStats: function () {
            ui.renderPlayerInfo();
            ui.renderEnergyOrb();
            ui.renderDrawDiscardPiles();
        },

        updateGoldDisplay: function () {
            var st = _state();
            if (!st) return;

            var els = document.querySelectorAll('#gold-value, #shop-gold');
            for (var i = 0; i < els.length; i++) {
                els[i].textContent = st.player.gold;
            }
        },

        _updateMapHudStats: function () {
            var st = _state();
            if (!st || ui.currentScreen !== SCREEN.MAP) return;
            var h = document.getElementById('map-hud-hp');
            if (h) h.textContent = st.player.hp + '/' + st.player.maxHp;
            var g = document.getElementById('map-hud-gold');
            if (g) g.textContent = st.player.gold;
            var d = document.getElementById('map-hud-deck');
            if (d && st.player.deck) d.textContent = st.player.deck.length;
        },

        updateEnergyDisplay: function () {
            ui.renderEnergyOrb();
        },

        updateEndTurnButton: function () {
            var st = _state();
            if (!st) return;

            var btn = document.getElementById('btn-end-turn');
            if (!btn) return;

            if (st.combat.playerTurn) {
                btn.textContent = 'END TURN';
                btn.disabled = false;
                btn.classList.add('btn-end-turn-active');
                btn.classList.remove('btn-end-turn-waiting');
            } else {
                btn.textContent = 'ENEMY TURN';
                btn.disabled = true;
                btn.classList.remove('btn-end-turn-active');
                btn.classList.add('btn-end-turn-waiting');
            }
        },

        getCardColor: function (card) {
            var colors = {
                ATTACK: '#dc3545',
                SKILL: '#4a90d9',
                POWER: '#f0ad4e',
                STATUS: '#6c757d',
                CURSE: '#8b008b'
            };
            return colors[(card.type || '').toUpperCase()] || '#666';
        },

        formatDescription: function (text) {
            if (!text) return '';

            var result = text;

            result = result.replace(/(\d+)/g, function (match) {
                return '<span class="desc-number">' + match + '</span>';
            });

            for (var i = 0; i < KEYWORDS.length; i++) {
                var kw = KEYWORDS[i];
                var regex = new RegExp('\\b(' + _escRegex(kw) + ')\\b', 'gi');
                result = result.replace(regex, '<strong class="desc-keyword">$1</strong>');
            }

            result = result.replace(/Deal <span class="desc-number">(\d+)<\/span>/g,
                'Deal <span class="desc-number desc-damage">$1</span>');
            result = result.replace(/Gain <span class="desc-number">(\d+)<\/span> <strong class="desc-keyword">Block<\/strong>/g,
                'Gain <span class="desc-number desc-block">$1</span> <strong class="desc-keyword">Block</strong>');

            return result;
        },

        /* ==============================================================
         *  USER ACTIONS
         * ============================================================== */

        onNewRun: function () {
            STS.Game.newRun();
        },

        onSettings: function () {
            _previousScreen = ui.currentScreen;
            ui.renderSettingsOverlay();
        },

        onEndTurn: function () {
            var st = _state();
            if (!st || !st.combat.playerTurn) return;
            ui.exitTargetingMode();
            STS.Game.endPlayerTurn();
            ui._refreshCombat();
        },

        /* ==============================================================
         *  INTERNAL HELPERS (exposed for other modules)
         * ============================================================== */

        _refreshCombat: function () {
            if (ui.currentScreen !== SCREEN.COMBAT) return;
            ui.renderHand();
            ui.renderEnemies();
            ui.renderPlayerInfo();
            ui.renderEnergyOrb();
            ui.renderDrawDiscardPiles();
            ui.updateGoldDisplay();
            ui.updateEndTurnButton();
            ui.renderPotionBar();
            ui.renderRelicBar();
            ui.renderCombatLog();
        },

        _onShopBuy: function (type, index) {
            var success = false;
            switch (type) {
                case 'card':
                    if (STS.Shop && STS.Shop.buyCard) {
                        success = STS.Shop.buyCard(index);
                    } else {
                        success = STS.Game.buyCard(index);
                    }
                    break;
                case 'relic':
                    if (STS.Shop && STS.Shop.buyRelic) {
                        success = STS.Shop.buyRelic(index);
                    } else if (STS.Game.buyRelic) {
                        success = STS.Game.buyRelic(index);
                    }
                    break;
                case 'potion':
                    if (STS.Shop && STS.Shop.buyPotion) {
                        success = STS.Shop.buyPotion(index);
                    } else {
                        success = STS.Game.buyPotion(index);
                    }
                    break;
            }

            if (!success) {
                var st = _state();
                var shopData = st ? (st.shopData || (STS.Shop && STS.Shop.currentShop)) : null;
                if (shopData) {
                    var itemArr = type === 'card' ? shopData.cards : (type === 'relic' ? shopData.relics : shopData.potions);
                    if (itemArr && itemArr[index] && !itemArr[index].sold) {
                        ui.showFloatingText(
                            window.innerWidth / 2, window.innerHeight / 2,
                            'Not enough gold!', '#ff4444', 28
                        );
                    }
                }
            }

            ui.renderShopScreen();
            ui.showScreen(SCREEN.SHOP);
        },

        _showShopTooltip: function (element, type, index) {
            var st = _state();
            if (!st) return;
            var shopData = st.shopData || (STS.Shop && STS.Shop.currentShop);
            if (!shopData) return;

            var content = '';
            switch (type) {
                case 'card':
                    var slot = shopData.cards[index];
                    if (slot && slot.card) {
                        content = '<strong>' + _escHtml(slot.card.name) + '</strong><br>' +
                            '<span class="tooltip-desc">' + ui.formatDescription(slot.card.description || '') + '</span>';
                    }
                    break;
                case 'relic':
                    var slot = shopData.relics[index];
                    if (slot && slot.relic) {
                        content = '<strong>' + _escHtml(slot.relic.name) + '</strong><br>' +
                            '<span class="tooltip-desc">' + _escHtml(slot.relic.description || '') + '</span>';
                    }
                    break;
                case 'potion':
                    var slot = shopData.potions[index];
                    if (slot && slot.potion) {
                        content = '<strong>' + _escHtml(slot.potion.name) + '</strong><br>' +
                            '<span class="tooltip-desc">' + _escHtml(slot.potion.description || '') + '</span>';
                    }
                    break;
            }

            if (content) ui.showTooltip(element, content, 'right');
        },

        _onPotionUse: function (slotIndex) {
            var st = _state();
            if (!st || st.screen !== SCREEN.COMBAT) return;

            var potion = st.player.potions[slotIndex];
            if (!potion) return;

            if (potion.requiresTarget) {
                ui.targetingMode = true;
                ui.targetingCard = null;
                ui.targetingCardIndex = -1;

                var enemies = document.querySelectorAll('.enemy');
                for (var i = 0; i < enemies.length; i++) {
                    enemies[i].classList.add('enemy-targetable');
                }

                var origHandler = ui.onEnemyClick;
                ui.onEnemyClick = function (enemyIndex) {
                    ui.onEnemyClick = origHandler;
                    ui.exitTargetingMode();
                    STS.Game.usePotion(slotIndex, enemyIndex);
                    ui._refreshCombat();
                };
                return;
            }

            STS.Game.usePotion(slotIndex);
            ui._refreshCombat();
        },

        _onRewardClaim: function (rewardIndex) {
            var st = _state();
            if (!st || !st.rewards) return;

            var reward = st.rewards[rewardIndex];
            if (!reward) return;

            if (reward.type === 'CARD_CHOICE') {
                ui._pendingRewardIndex = rewardIndex;
                ui.showCardReward(reward.cards);
                return;
            }

            STS.Game.claimReward(rewardIndex);
            ui.renderRewardScreen();
            ui.showScreen(SCREEN.REWARD);
        },

        _pendingRewardIndex: -1,

        _onEventChoice: function (choiceIndex) {
            var st = _state();
            if (!st || !st.eventData) return;

            var choices = document.querySelectorAll('.btn-event-choice');
            for (var i = 0; i < choices.length; i++) {
                choices[i].disabled = true;
            }

            var choice = st.eventData.choices[choiceIndex];
            var resultEl = document.getElementById('event-result');

            STS.Game.chooseEventOption(choiceIndex);

            if (resultEl && choice) {
                resultEl.textContent = choice.text;
                resultEl.style.display = 'block';
            }
        },

        _showPileView: function (pileType) {
            var st = _state();
            if (!st) return;

            var cards = pileType === 'draw' ? st.player.drawPile : st.player.discardPile;
            var title = pileType === 'draw' ? 'Draw Pile (' + cards.length + ')' : 'Discard Pile (' + cards.length + ')';

            var overlay = _createOverlay('pile-view-overlay');
            var html =
                '<div class="pile-view-panel">' +
                    '<h3>' + title + '</h3>' +
                    '<div class="pile-view-grid" id="pile-view-grid"></div>' +
                    '<button class="btn-large" id="btn-close-pile">Close</button>' +
                '</div>';

            overlay.innerHTML = html;

            var grid = document.getElementById('pile-view-grid');
            var sorted = cards.slice();
            if (pileType === 'draw') {
                sorted.sort(function () { return Math.random() - 0.5; });
            }

            for (var i = 0; i < sorted.length; i++) {
                (function (card) {
                    var wrapper = document.createElement('div');
                    wrapper.className = 'pile-card-slot';
                    var el = ui.createCardElement(card, false);
                    if (pileType === 'draw') el.classList.add('card-face-down');
                    wrapper.appendChild(el);

                    wrapper.addEventListener('mouseenter', function () {
                        if (pileType !== 'draw') ui.showCardPreview(card);
                    });
                    wrapper.addEventListener('mouseleave', function () { ui.hideCardPreview(); });

                    grid.appendChild(wrapper);
                })(sorted[i]);
            }

            _on('btn-close-pile', 'click', function () {
                _removeOverlay('pile-view-overlay');
            });
        },

        _saveSettings: function () {
            var musicSlider = document.getElementById('setting-music');
            var sfxSlider = document.getElementById('setting-sfx');
            var shakeCheck = document.getElementById('setting-shake');
            var fastCheck = document.getElementById('setting-fast');
            var dmgCheck = document.getElementById('setting-dmgnums');

            if (musicSlider) STS.Game.setSetting('musicVolume', parseInt(musicSlider.value) / 100);
            if (sfxSlider) STS.Game.setSetting('sfxVolume', parseInt(sfxSlider.value) / 100);
            if (shakeCheck) STS.Game.setSetting('screenShake', shakeCheck.checked);
            if (fastCheck) STS.Game.setSetting('fastMode', fastCheck.checked);
            if (dmgCheck) STS.Game.setSetting('showDamageNumbers', dmgCheck.checked);

            STS.Game.saveSettings();
        }
    };

    /* ==================================================================
     *  PRIVATE FUNCTIONS
     * ================================================================== */

    function _state() {
        return STS.Game && STS.Game.state ? STS.Game.state : null;
    }

    function _canPlayCard(card, st) {
        if (!card || !st) return false;
        if (card.unplayable) return false;
        if (!st.combat.playerTurn) return false;
        var cost = STS.Game.getCardCost ? STS.Game.getCardCost(card) : card.energy;
        if (cost > st.player.energy && cost >= 0) return false;
        if (card.type === 'ATTACK' && STS.Effects && !STS.Effects.canPlayAttack(st.player)) return false;
        return true;
    }

    function _getCardDescription(card) {
        if (STS.Game && STS.Game.getCardDescription) {
            return STS.Game.getCardDescription(card);
        }
        if (STS.Cards && STS.Cards.getDescription) {
            return STS.Cards.getDescription(card, _state());
        }
        return card.description || '';
    }

    /**
     * Load card illustration: tries assets/cards/{id}.png then illustrated procedural SVG (enemy-style mood, no letter tile).
     */
    function _attachCardArtToHost(host, card, imgClass) {
        if (!host || !card) return;
        host.innerHTML = '';
        var safeId = (card.id || 'card').replace(/[^a-zA-Z0-9_-]/g, '_');
        var artImg = document.createElement('img');
        artImg.className = imgClass || 'card-art-img';
        artImg.alt = '';
        artImg.draggable = false;
        artImg.src = 'assets/cards/' + safeId + '.png';
        artImg.onerror = function () {
            this.onerror = null;
            this.src = _cardArtDataUrl(card);
        };
        host.appendChild(artImg);
    }

    /**
     * Deterministic illustrated placeholder when assets/cards/{id}.png is missing (painted fantasy look, per-card variation).
     */
    function _cardArtDataUrl(card) {
        var id = (card && card.id) ? String(card.id) : 'CARD';
        var h = 0;
        for (var i = 0; i < id.length; i++) {
            h = ((h << 5) - h) + id.charCodeAt(i);
            h |= 0;
        }
        var hue = Math.abs(h) % 360;
        var hue2 = (hue + 42) % 360;
        var hue3 = (hue + 96) % 360;
        var type = (card && card.type) ? String(card.type).toUpperCase() : 'ATTACK';
        var accent = type === 'ATTACK' ? '#ff5c5c' : type === 'SKILL' ? '#5ec8ff' : type === 'POWER' ? '#ffb347' : type === 'CURSE' ? '#c56bff' : '#9ca3c4';
        var tilt = (Math.abs(h) % 21) - 10;
        var motif = '';
        if (type === 'ATTACK') {
            motif =
                '<g fill="none" stroke="rgba(255,240,220,0.55)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M72 124 L118 36 L128 40 L84 130 Z" fill="rgba(40,12,12,0.5)"/>' +
                '<path d="M118 36 L154 28 L132 48 Z" fill="rgba(255,200,180,0.25)"/>' +
                '<path d="M76 118 Q100 108 122 98" opacity="0.7"/>' +
                '<path d="M56 132 L144 120" stroke="' + accent + '" stroke-opacity="0.35" stroke-width="3"/>' +
                '</g>' +
                '<ellipse cx="138" cy="118" rx="28" ry="14" transform="rotate(' + tilt + ' 138 118)" fill="rgba(0,0,0,0.35)" opacity="0.5"/>';
        } else if (type === 'SKILL') {
            motif =
                '<path d="M100 38 C132 38 152 62 152 92 C152 124 128 142 100 142 C72 142 48 124 48 92 C48 62 68 38 100 38 Z" fill="rgba(20,40,72,0.55)" stroke="rgba(180,220,255,0.45)" stroke-width="2"/>' +
                '<path d="M100 56 L100 108 M76 82 L124 82" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-linecap="round"/>' +
                '<circle cx="100" cy="82" r="22" fill="none" stroke="' + accent + '" stroke-opacity="0.35" stroke-width="2.5"/>';
        } else if (type === 'POWER') {
            motif =
                '<path d="M100 28 Q132 68 100 118 Q68 68 100 28 Z" fill="rgba(80,50,10,0.45)" stroke="rgba(255,200,120,0.5)" stroke-width="2"/>' +
                '<path d="M100 44 L100 104 M72 74 L128 74" stroke="' + accent + '" stroke-opacity="0.4" stroke-width="2"/>' +
                '<circle cx="100" cy="74" r="36" fill="none" stroke="rgba(255,180,80,0.2)" stroke-width="1.5"/>' +
                '<circle cx="100" cy="74" r="8" fill="' + accent + '" fill-opacity="0.5"/>';
        } else if (type === 'CURSE') {
            motif =
                '<path d="M52 48 Q100 20 148 48 L138 120 Q100 100 62 120 Z" fill="rgba(40,10,48,0.55)" stroke="rgba(200,120,255,0.4)" stroke-width="2"/>' +
                '<path d="M76 72 L124 96 M124 72 L76 96" stroke="' + accent + '" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>';
        } else {
            motif =
                '<rect x="56" y="48" width="88" height="72" rx="10" fill="rgba(36,36,44,0.6)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>' +
                '<path d="M72 68 L128 68 M72 88 L128 88 M72 108 L108 108" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/>';
        }

        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="168" viewBox="0 0 200 168">' +
            '<defs>' +
            '<linearGradient id="cdbg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="hsl(' + hue + ',52%,22%)"/>' +
            '<stop offset="0.45" stop-color="hsl(' + hue2 + ',45%,14%)"/>' +
            '<stop offset="1" stop-color="hsl(' + hue3 + ',38%,9%)"/>' +
            '</linearGradient>' +
            '<radialGradient id="cdburst" cx="50%" cy="42%" r="68%">' +
            '<stop offset="0" stop-color="' + accent + '" stop-opacity="0.38"/>' +
            '<stop offset="0.5" stop-color="' + accent + '" stop-opacity="0.08"/>' +
            '<stop offset="1" stop-color="#000" stop-opacity="0"/>' +
            '</radialGradient>' +
            '<radialGradient id="cdvig" cx="50%" cy="50%" r="75%">' +
            '<stop offset="0.55" stop-color="rgba(0,0,0,0)"/>' +
            '<stop offset="1" stop-color="rgba(0,0,0,0.55)"/>' +
            '</radialGradient>' +
            '</defs>' +
            '<rect width="200" height="168" fill="url(#cdbg)"/>' +
            '<rect width="200" height="168" fill="url(#cdburst)"/>' +
            '<g opacity="0.85">' + motif + '</g>' +
            '<g opacity="0.12" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="0.8">' +
            '<path d="M24 40 Q100 12 176 40"/>' +
            '<path d="M32 128 Q100 154 168 128"/>' +
            '</g>' +
            '<rect width="200" height="168" fill="url(#cdvig)"/>' +
            '<rect x="3" y="3" width="194" height="162" rx="4" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>' +
            '<rect x="8" y="8" width="184" height="152" rx="2" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>' +
            '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /**
     * Placeholder for event art when the remote image fails to load.
     */
    function _eventArtDataUrl(ev) {
        var id = (ev && ev.id) ? String(ev.id) : 'EVENT';
        var h = 0;
        for (var i = 0; i < id.length; i++) {
            h = ((h << 5) - h) + id.charCodeAt(i);
            h |= 0;
        }
        var hue = Math.abs(h) % 360;
        var hue2 = (hue + 40) % 360;
        var letter = (ev && ev.name) ? String(ev.name).charAt(0).toUpperCase() : '?';
        if (letter === '<' || letter === '&' || letter === '>') letter = '?';
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
            '<defs>' +
            '<linearGradient id="evbg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="hsl(' + hue + ',45%,22%)"/>' +
            '<stop offset="1" stop-color="hsl(' + hue2 + ',40%,10%)"/>' +
            '</linearGradient>' +
            '<radialGradient id="glow" cx="50%" cy="40%" r="60%">' +
            '<stop offset="0" stop-color="rgba(255,215,0,0.25)"/>' +
            '<stop offset="1" stop-color="rgba(0,0,0,0)"/>' +
            '</radialGradient>' +
            '</defs>' +
            '<rect width="400" height="300" fill="url(#evbg)"/>' +
            '<rect width="400" height="300" fill="url(#glow)"/>' +
            '<rect x="4" y="4" width="392" height="292" fill="none" stroke="rgba(255,215,0,0.4)" stroke-width="3" rx="12"/>' +
            '<text x="200" y="175" text-anchor="middle" fill="rgba(255,255,255,0.12)" font-size="120" font-weight="900" font-family="Georgia,serif">' +
            letter +
            '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function _getEventImageUrl(ev) {
        var st = _state();
        var runSeed = (st && st.run && st.run.seed != null) ? String(st.run.seed) : '0';
        var base = (ev && ev.imagePrompt) ? String(ev.imagePrompt) : (
            (ev && ev.name ? ev.name : 'Mystery') + ', ' + (ev && ev.description ? ev.description : '') +
            ', dark fantasy roguelike game event, single scene illustration, dramatic lighting, no text, no watermark'
        );
        var s = (ev && ev.id ? String(ev.id) : 'ev') + runSeed;
        var seed = 0;
        for (var j = 0; j < s.length; j++) {
            seed = ((seed << 5) - seed) + s.charCodeAt(j);
            seed |= 0;
        }
        seed = Math.abs(seed) % 1000000;
        return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(base) +
            '?width=640&height=400&nologo=true&seed=' + seed;
    }

    function _escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _escRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function _screenDomId(screen) {
        var map = {
            TITLE: 'title-screen',
            MAP: 'map-screen',
            COMBAT: 'combat-screen',
            SHOP: 'shop-screen',
            EVENT: 'event-screen',
            REST: 'rest-screen',
            REWARD: 'reward-screen',
            DECK_VIEW: 'deck-view-screen',
            GAME_OVER: 'gameover-screen',
            VICTORY: 'victory-screen'
        };
        return map[screen] || 'title-screen';
    }

    function _buildGameContainer() {
        var existing = document.getElementById('game-container');
        if (existing) return;

        var container = document.createElement('div');
        container.id = 'game-container';
        container.className = 'game-container';
        document.body.appendChild(container);
    }

    function _ensureScreen(id) {
        var container = document.getElementById('game-container');
        if (!container) {
            _buildGameContainer();
            container = document.getElementById('game-container');
        }

        var el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'screen';
            container.appendChild(el);
        }
        return el;
    }

    function _cacheElements() {
        ui.elements.gameContainer = document.getElementById('game-container');
    }

    function _on(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    function _createOverlay(id) {
        _removeOverlay(id);

        var overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'overlay';
        overlay.style.display = 'flex';

        var container = document.getElementById('game-container') || document.body;
        container.appendChild(overlay);
        return overlay;
    }

    function _removeOverlay(id) {
        var existing = document.getElementById(id);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    }

    function _bindGlobalEvents() {
        window.addEventListener('resize', _onResize);

        document.addEventListener('mousemove', function (e) {
            _mouseX = e.clientX;
            _mouseY = e.clientY;
        });

        document.addEventListener('keydown', function (e) {
            switch (e.key) {
                case 'Escape':
                    if (ui.targetingMode) {
                        ui.exitTargetingMode();
                    } else {
                        _removeOverlay('card-reward-overlay');
                        _removeOverlay('card-select-overlay');
                        _removeOverlay('pile-view-overlay');
                        _removeOverlay('confirm-overlay');
                        var settingsOverlay = document.getElementById('settings-overlay');
                        if (settingsOverlay && settingsOverlay.style.display !== 'none') {
                            settingsOverlay.style.display = 'none';
                            if (_previousScreen) ui.currentScreen = _previousScreen;
                        }
                    }
                    break;

                case ' ':
                    e.preventDefault();
                    if (ui.currentScreen === SCREEN.COMBAT) {
                        ui.onEndTurn();
                    }
                    break;

                case 'd':
                case 'D':
                    if (ui.currentScreen === SCREEN.COMBAT || ui.currentScreen === SCREEN.MAP) {
                        ui.showDeckView();
                    }
                    break;
            }
        });

        document.addEventListener('contextmenu', function (e) {
            if (ui.targetingMode) {
                e.preventDefault();
                ui.exitTargetingMode();
            }
        });
    }

    function _onResize() {
        var canvas = document.getElementById('targeting-canvas');
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        if (ui.currentScreen === SCREEN.COMBAT) {
            ui.renderHand();
        }
    }

    function _startUpdateLoop() {
        if (_animFrameId) cancelAnimationFrame(_animFrameId);
        ui.update();
    }

    function _processAnimationQueue() {
        if (ui.animationQueue.length === 0) return;

        var now = Date.now();
        var remaining = [];
        for (var i = 0; i < ui.animationQueue.length; i++) {
            var anim = ui.animationQueue[i];
            if (now >= anim.startTime) {
                if (typeof anim.execute === 'function') anim.execute();
            } else {
                remaining.push(anim);
            }
        }
        ui.animationQueue = remaining;
    }

    function _updateIntentBob() {
        var intents = document.querySelectorAll('.intent-bob');
        var time = Date.now() * 0.003;
        for (var i = 0; i < intents.length; i++) {
            var offset = Math.sin(time + i * 0.7) * 4;
            /* Keep translateX(-50%) from layout — inline translateY was wiping it and hiding intents. */
            intents[i].style.transform = 'translateX(-50%) translateY(' + offset + 'px)';
        }
    }

    function _drawTargetingArrow() {
        var canvas = document.getElementById('targeting-canvas');
        if (!canvas || !_targetingArrowCtx) return;

        var ctx = _targetingArrowCtx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var handContainer = document.getElementById('hand-container');
        if (!handContainer) return;

        var handRect = handContainer.getBoundingClientRect();
        var startX = handRect.left + handRect.width / 2;
        var startY = handRect.top;

        var endX = _mouseX;
        var endY = _mouseY;

        var midX = (startX + endX) / 2;
        var midY = Math.min(startY, endY) - 80;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        var angle = Math.atan2(endY - midY, endX - midX);
        var arrowSize = 12;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle - 0.4),
            endY - arrowSize * Math.sin(angle - 0.4)
        );
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle + 0.4),
            endY - arrowSize * Math.sin(angle + 0.4)
        );
        ctx.closePath();
        ctx.fillStyle = '#ff4444';
        ctx.fill();
    }

    function _resolveTargetElement(target, st) {
        if (!target || !st) return null;

        if (target === st.player) {
            return document.getElementById('player-info');
        }

        var enemies = st.combat.enemies;
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i] === target) {
                return document.querySelector('.enemy[data-enemy-index="' + i + '"]');
            }
        }

        return null;
    }

    function _updateHpBar(target, st) {
        if (!target || !st) return;

        if (target === st.player) {
            ui.renderPlayerInfo();
            return;
        }

        var enemies = st.combat.enemies;
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i] === target) {
                var el = document.querySelector('.enemy[data-enemy-index="' + i + '"]');
                if (!el) return;
                var hpBar = el.querySelector('.hp-bar-fill');
                var hpText = el.querySelector('.hp-text');
                var dmgBar = el.querySelector('.hp-bar-damage');
                if (hpBar) {
                    var oldWidth = parseFloat(hpBar.style.width) || 100;
                    var newWidth = target.maxHp > 0 ? (target.hp / target.maxHp * 100) : 0;

                    if (dmgBar && oldWidth > newWidth) {
                        dmgBar.style.width = oldWidth + '%';
                        dmgBar.style.transition = 'none';
                        hpBar.style.width = newWidth + '%';

                        requestAnimationFrame(function () {
                            dmgBar.style.transition = 'width 0.5s ease';
                            dmgBar.style.width = newWidth + '%';
                        });
                    } else {
                        hpBar.style.width = newWidth + '%';
                    }
                }
                if (hpText) {
                    hpText.textContent = target.hp + '/' + target.maxHp;
                }

                var blockDisplay = el.querySelector('.enemy-block-display');
                if (blockDisplay) {
                    if (target.block > 0) {
                        blockDisplay.style.display = '';
                        var blockVal = blockDisplay.querySelector('.block-value');
                        if (blockVal) blockVal.textContent = target.block;
                    } else {
                        blockDisplay.style.display = 'none';
                    }
                }

                ui.renderStatusEffects(target, el.querySelector('.enemy-effects'));
                return;
            }
        }
    }

    function _flashElement(el, className) {
        if (!el) return;
        el.classList.add(className);
        setTimeout(function () { el.classList.remove(className); }, 400);
    }

    function _buildEnemyTooltip(enemy) {
        var html = '<strong>' + _escHtml(enemy.name) + '</strong><br>';
        html += 'HP: ' + enemy.hp + '/' + enemy.maxHp + '<br>';
        if (enemy.block > 0) html += 'Block: ' + enemy.block + '<br>';

        if (enemy.statusEffects) {
            var effects = STS.Effects ? STS.Effects.getActiveEffects(enemy) : [];
            for (var i = 0; i < effects.length; i++) {
                html += '<span style="color:' + (effects[i].def.color || '#aaa') + '">' +
                    effects[i].def.icon + ' ' + effects[i].def.name + ' ' + effects[i].amount + '</span><br>';
            }
        }
        return html;
    }

    function _renderMapNodes() {
        var st = _state();
        if (!st || !st.map || !st.map.nodes) return;

        var container = document.getElementById('map-scroll');
        if (!container) return;
        container.innerHTML = '';

        var nodes = st.map.nodes;
        var paths = st.map.paths;

        var floors = {};
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!floors[n.floor]) floors[n.floor] = [];
            floors[n.floor].push(n);
        }

        var floorKeys = Object.keys(floors).map(Number).sort(function (a, b) { return a - b; });

        /* Slay the Spire–style map symbols (dark disc + icon) */
        var NODE_EMOJI = {
            MONSTER:  '💀',
            ELITE:    '👹',
            BOSS:     '☠\uFE0F',
            REST:     '🔥',
            SHOP:     '💰',
            EVENT:    '❓',
            TREASURE: '📦'
        };

        var mapWrap = document.getElementById('map-container');
        var containerWidth = 0;
        if (mapWrap) {
            var br = mapWrap.getBoundingClientRect();
            containerWidth = Math.floor(br.width);
        }
        if (containerWidth < 400) {
            containerWidth = Math.max(400, Math.min(window.innerWidth - 32, 1400));
        }
        container.style.width = '100%';
        container.style.maxWidth = '100%';
        container.style.margin = '0 auto';
        container.style.minWidth = '';

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'map-paths');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.pointerEvents = 'none';
        container.appendChild(svg);

        var nodePositions = {};
        var nodeJitter = {};
        var rowHeight = 110;
        var nodeGap = Math.max(24, Math.min(68, Math.floor(containerWidth / 8)));
        var totalHeight = floorKeys.length * rowHeight + 100;
        container.style.minHeight = totalHeight + 'px';
        container.style.height = totalHeight + 'px';
        svg.setAttribute('height', totalHeight);
        svg.setAttribute('width', containerWidth);

        for (var fi = floorKeys.length - 1; fi >= 0; fi--) {
            var floor = floorKeys[fi];
            var floorNodes = floors[floor];
            var y = (floorKeys.length - 1 - fi) * rowHeight + 52;

            var rowEl = document.createElement('div');
            rowEl.className = 'map-row';
            rowEl.style.position = 'absolute';
            rowEl.style.top = y + 'px';
            rowEl.style.left = '0';
            rowEl.style.right = '0';
            rowEl.style.width = '100%';
            rowEl.style.display = 'flex';
            rowEl.style.flexDirection = 'row';
            rowEl.style.flexWrap = 'nowrap';
            rowEl.style.justifyContent = 'center';
            rowEl.style.alignItems = 'center';
            rowEl.style.gap = nodeGap + 'px';
            rowEl.style.padding = '0 16px';
            rowEl.style.boxSizing = 'border-box';

            for (var ni = 0; ni < floorNodes.length; ni++) {
                var node = floorNodes[ni];
                var nodeEl = document.createElement('div');
                nodeEl.className = 'map-node';
                nodeEl.dataset.nodeId = node.id;

                if (node.visited) nodeEl.classList.add('map-node-visited');
                else if (node.available) nodeEl.classList.add('map-node-available');
                else nodeEl.classList.add('map-node-locked');

                if (st.map.currentNodeId === node.id) nodeEl.classList.add('map-node-current');
                if (node.type === 'BOSS') nodeEl.classList.add('map-node-boss');

                var sym = NODE_EMOJI[node.type] || NODE_EMOJI.MONSTER;
                var sid = String(node.id);
                var hsh = 0;
                for (var cc = 0; cc < sid.length; cc++) hsh += sid.charCodeAt(cc);
                var jx = (hsh + ni * 7) % 21 - 10;
                var jy = (hsh * 3 + floor * 5) % 19 - 9;
                nodeJitter[node.id] = { x: jx, y: jy };
                nodeEl.style.position = 'relative';
                nodeEl.style.left = jx + 'px';
                nodeEl.style.top = jy + 'px';

                nodeEl.innerHTML = '<div class="map-node-disc" aria-hidden="true">' +
                    '<span class="map-node-emoji">' + sym + '</span></div>';
                nodeEl.title = (node.type || 'NODE') + ' (Floor ' + node.floor + ')';

                (function (n) {
                    nodeEl.addEventListener('click', function () {
                        if (n.available && !n.visited) {
                            STS.Game.advanceToNode(n.id);
                        }
                    });
                })(node);

                rowEl.appendChild(nodeEl);
            }

            container.appendChild(rowEl);

            var nodeImgSize = 80;
            var rowW = floorNodes.length * nodeImgSize + Math.max(0, floorNodes.length - 1) * nodeGap;
            var rowStart = (containerWidth - rowW) / 2;
            for (var ri = 0; ri < floorNodes.length; ri++) {
                var nid = floorNodes[ri].id;
                var j = nodeJitter[nid] || { x: 0, y: 0 };
                nodePositions[nid] = {
                    x: rowStart + ri * (nodeImgSize + nodeGap) + nodeImgSize / 2 + j.x,
                    y: y + 46 + j.y
                };
            }
        }

        for (var pi = 0; pi < paths.length; pi++) {
            var p = paths[pi];
            var fromPos = nodePositions[p.from];
            var toPos = nodePositions[p.to];
            if (!fromPos || !toPos) continue;

            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromPos.x);
            line.setAttribute('y1', fromPos.y);
            line.setAttribute('x2', toPos.x);
            line.setAttribute('y2', toPos.y);
            line.setAttribute('stroke', '#4a4036');
            line.setAttribute('stroke-width', '2.5');
            line.setAttribute('stroke-dasharray', '4 6');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('opacity', '0.75');

            var fromNode = null, toNode = null;
            for (var ni = 0; ni < nodes.length; ni++) {
                if (nodes[ni].id === p.from) fromNode = nodes[ni];
                if (nodes[ni].id === p.to) toNode = nodes[ni];
            }
            if (fromNode && fromNode.visited && toNode && toNode.visited) {
                line.setAttribute('stroke', '#88aa66');
                line.setAttribute('opacity', '1');
            }

            svg.appendChild(line);
        }
    }

    function _typewriterEffect(elementId, text) {
        var el = document.getElementById(elementId);
        if (!el) return;

        el.textContent = '';
        var i = 0;
        var speed = 20;

        function type() {
            if (i < text.length) {
                el.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    function _sortDeck(deck, mode) {
        var sorted = deck.slice();
        switch (mode) {
            case 'type':
                var typeOrder = { ATTACK: 0, SKILL: 1, POWER: 2, STATUS: 3, CURSE: 4 };
                sorted.sort(function (a, b) {
                    var ta = typeOrder[(a.type || '').toUpperCase()] || 99;
                    var tb = typeOrder[(b.type || '').toUpperCase()] || 99;
                    if (ta !== tb) return ta - tb;
                    return (a.name || '').localeCompare(b.name || '');
                });
                break;
            case 'cost':
                sorted.sort(function (a, b) {
                    var ca = a.energy === -1 ? 99 : (a.energy || 0);
                    var cb = b.energy === -1 ? 99 : (b.energy || 0);
                    if (ca !== cb) return ca - cb;
                    return (a.name || '').localeCompare(b.name || '');
                });
                break;
            case 'name':
                sorted.sort(function (a, b) {
                    return (a.name || '').localeCompare(b.name || '');
                });
                break;
            case 'rarity':
                var rarityOrder = { STARTER: 0, BASIC: 0, COMMON: 1, UNCOMMON: 2, RARE: 3, STATUS: 4, CURSE: 5 };
                sorted.sort(function (a, b) {
                    var ra = rarityOrder[(a.rarity || '').toUpperCase()];
                    var rb = rarityOrder[(b.rarity || '').toUpperCase()];
                    if (ra === undefined) ra = 99;
                    if (rb === undefined) rb = 99;
                    if (ra !== rb) return ra - rb;
                    return (a.name || '').localeCompare(b.name || '');
                });
                break;
        }
        return sorted;
    }

    function _spawnVictoryParticles() {
        var container = document.getElementById('victory-particles');
        if (!container) return;

        var colors = ['#ffd700', '#ff6347', '#7fff00', '#00bfff', '#ff69b4', '#ffffff'];
        var count = 50;

        for (var i = 0; i < count; i++) {
            (function (idx) {
                setTimeout(function () {
                    var particle = document.createElement('div');
                    particle.className = 'victory-particle';
                    particle.style.left = (Math.random() * 100) + '%';
                    particle.style.animationDelay = (Math.random() * 2) + 's';
                    particle.style.animationDuration = (2 + Math.random() * 3) + 's';
                    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    particle.style.width = (4 + Math.random() * 6) + 'px';
                    particle.style.height = particle.style.width;
                    container.appendChild(particle);

                    setTimeout(function () {
                        if (particle.parentNode) particle.parentNode.removeChild(particle);
                    }, 5000);
                }, idx * 100);
            })(i);
        }
    }

    function _clampTooltipPosition(tooltip) {
        if (!tooltip) return;

        var rect = tooltip.getBoundingClientRect();
        var pad = 8;

        if (rect.right > window.innerWidth - pad) {
            tooltip.style.left = (window.innerWidth - pad - rect.width) + 'px';
            tooltip.style.transform = 'translate(0, -100%)';
        }
        if (rect.left < pad) {
            tooltip.style.left = pad + 'px';
            tooltip.style.transform = 'translate(0, -100%)';
        }
        if (rect.top < pad) {
            tooltip.style.top = pad + 'px';
            tooltip.style.transform = 'translate(-50%, 0)';
        }
        if (rect.bottom > window.innerHeight - pad) {
            tooltip.style.top = (window.innerHeight - pad - rect.height) + 'px';
            tooltip.style.transform = 'translate(-50%, 0)';
        }
    }

    return ui;
})();

/* ======================================================================
 *  INJECT DEFAULT STYLES
 *  Ensures the game is styled even without an external CSS file.
 * ====================================================================== */

(function () {
    'use strict';

    if (document.getElementById('sts-ui-styles')) return;

    var style = document.createElement('style');
    style.id = 'sts-ui-styles';
    style.textContent = [

        /* -- Reset & Base ------------------------------------------------ */
        '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
        'body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background: #0a0a14; color: #e0d8c8; overflow: hidden; }',

        /* -- Game Container ---------------------------------------------- */
        '.game-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; }',

        /* -- Screens ----------------------------------------------------- */
        '.screen { position: absolute; inset: 0; display: none; opacity: 0; transition: opacity 0.35s ease; }',
        '.screen-active { display: flex !important; opacity: 1 !important; flex-direction: column; align-items: center; justify-content: center; }',
        '#combat-screen.screen-active { align-items: stretch !important; justify-content: flex-start !important; }',
        '#map-screen.screen-active { align-items: stretch !important; justify-content: flex-start !important; width: 100% !important; min-height: 100% !important; }',

        /* -- Title Screen ------------------------------------------------ */
        '.title-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #1a0a2e 0%, #0d0d24 50%, #0a0a14 100%); pointer-events: none; }',
        '.title-content { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; z-index: 1; }',
        '.game-title { font-size: 4rem; font-weight: 900; letter-spacing: 0.3em; text-transform: uppercase; color: #ffd700; text-shadow: 0 0 30px rgba(255,215,0,0.6), 0 4px 8px rgba(0,0,0,0.8); animation: titlePulse 3s ease-in-out infinite; margin-bottom: 60px; }',
        '@keyframes titlePulse { 0%,100%{ text-shadow: 0 0 30px rgba(255,215,0,0.4), 0 4px 8px rgba(0,0,0,0.8); } 50%{ text-shadow: 0 0 50px rgba(255,215,0,0.8), 0 4px 12px rgba(0,0,0,0.9); } }',
        '.title-buttons { display: flex; flex-direction: column; gap: 16px; align-items: center; }',
        '.btn-title { width: 280px; padding: 16px 32px; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; border: 2px solid #ffd700; background: rgba(255,215,0,0.1); color: #ffd700; cursor: pointer; transition: all 0.25s ease; border-radius: 4px; }',
        '.btn-title:hover { background: rgba(255,215,0,0.25); transform: scale(1.05); box-shadow: 0 0 20px rgba(255,215,0,0.3); }',
        '.btn-title:active { transform: scale(0.98); }',
        '.title-footer { margin-top: 40px; font-size: 1rem; color: #888; letter-spacing: 0.1em; }',

        /* -- Buttons (generic) ------------------------------------------- */
        '.btn-large { padding: 14px 36px; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border: 2px solid #ffd700; background: rgba(255,215,0,0.15); color: #ffd700; cursor: pointer; transition: all 0.2s ease; border-radius: 4px; }',
        '.btn-large:hover { background: rgba(255,215,0,0.3); transform: translateY(-2px); }',
        '.btn-large:active { transform: translateY(0); }',
        '.btn-large:disabled { opacity: 0.4; cursor: default; transform: none; }',
        '.btn-secondary { border-color: #888; color: #ccc; background: rgba(128,128,128,0.1); }',
        '.btn-secondary:hover { background: rgba(128,128,128,0.25); }',
        '.btn-icon { width: 40px; height: 40px; font-size: 1.2rem; border: 1px solid #555; background: rgba(0,0,0,0.3); color: #ccc; cursor: pointer; border-radius: 4px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }',
        '.btn-icon:hover { background: rgba(255,255,255,0.1); border-color: #888; }',

        /* -- Combat Screen ----------------------------------------------- */
        '.combat-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; background-color: #121828; background-repeat: no-repeat; }',
        '.combat-top-bar { position: absolute; top: 0; left: 0; right: 0; height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 10; background: rgba(0,0,0,0.4); }',
        '.relic-bar { display: flex; gap: 4px; flex-wrap: wrap; max-width: 60%; }',
        '.top-right-controls { display: flex; gap: 8px; align-items: center; }',
        '.gold-display { font-size: 1.1rem; font-weight: 700; color: #ffd700; margin-right: 8px; }',

        /* -- Combat Field (STS-style: player left, enemies right) --------- */
        '.combat-field { position: absolute; top: 50px; left: 0; right: 0; height: 42%; min-height: 260px; display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between; padding: 0 clamp(12px, 3vw, 40px) 0; box-sizing: border-box; z-index: 2; pointer-events: none; }',
        '.combat-field .combat-stage-left, .combat-field .enemy-area { pointer-events: auto; }',
        '.combat-stage-left { flex: 0 0 auto; width: clamp(140px, 26vw, 280px); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 4px; align-self: flex-end; }',
        '.combat-player-info { align-items: center; }',
        '.combat-player-info .player-avatar { width: clamp(88px, 14vmin, 140px); height: clamp(88px, 14vmin, 140px); border-radius: 12px; border-width: 3px; box-shadow: 0 8px 24px rgba(0,0,0,0.45); background: transparent; }',
        '.combat-player-info .player-avatar img { object-fit: contain; }',
        '.combat-player-info .player-hp-bar { width: clamp(130px, 22vw, 200px); }',
        '.combat-field .enemy-area { position: relative !important; left: auto !important; top: auto !important; transform: none !important; display: flex; flex: 1; flex-direction: row; gap: clamp(12px, 2.5vw, 36px); align-items: flex-end; justify-content: flex-end; padding-right: clamp(8px, 2vw, 28px); min-width: 0; z-index: 3; }',

        /* -- Enemies ----------------------------------------------------- */
        '.enemy { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.3s ease, filter 0.3s ease; position: relative; min-width: clamp(140px, 18vw, 220px); }',
        '.enemy:hover { transform: translateY(-6px); }',
        '.enemy-targetable { filter: drop-shadow(0 0 12px #ff4444); cursor: crosshair; }',
        '.enemy-image-container { position: relative; width: clamp(200px, 32vmin, 360px); height: clamp(220px, 38vmin, 420px); display: flex; align-items: flex-end; justify-content: center; background: transparent; }',
        '.enemy-image { width: 100%; height: 100%; object-fit: contain; object-position: bottom center; image-rendering: auto; filter: drop-shadow(0 12px 20px rgba(0,0,0,0.55)); }',
        '.enemy-image-fallback { font-size: clamp(3rem, 8vmin, 5rem); opacity: 0.85; }',
        '.enemy-name { font-size: 0.85rem; font-weight: 700; margin: 4px 0; color: #ff8888; }',
        '.enemy-intent { position: absolute; top: clamp(-48px, -6vmin, -32px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; font-size: clamp(1rem, 2.2vmin, 1.25rem); font-weight: 700; white-space: nowrap; z-index: 5; text-shadow: 0 2px 6px rgba(0,0,0,0.9); }',
        '.intent-icon { font-size: 1.3rem; }',
        '.intent-value { font-size: 1rem; }',
        '.intent-bob { transition: transform 0.1s linear; }',

        /* -- HP Bars ----------------------------------------------------- */
        '.enemy-hp-bar, .player-hp-bar { position: relative; width: clamp(120px, 20vw, 200px); height: 16px; background: #333; border: 1px solid #555; border-radius: 3px; overflow: hidden; }',
        '.hp-bar-fill { height: 100%; background: linear-gradient(90deg, #cc2222 0%, #ff4444 100%); transition: width 0.3s ease; position: absolute; top: 0; left: 0; z-index: 2; }',
        '.hp-bar-damage { height: 100%; background: #ff8800; position: absolute; top: 0; left: 0; z-index: 1; }',
        '.hp-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #fff; text-shadow: 1px 1px 2px #000; z-index: 3; }',

        /* -- Enemy Effects ----------------------------------------------- */
        '.enemy-effects { display: flex; gap: 2px; margin-top: 4px; flex-wrap: wrap; justify-content: center; }',

        /* -- Block Display ----------------------------------------------- */
        '.enemy-block-display, .player-block { display: flex; align-items: center; gap: 2px; font-weight: 700; color: #66bbff; font-size: 0.9rem; }',
        '.enemy-block-display { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px; z-index: 5; }',

        /* -- Damage flash ------------------------------------------------ */
        '.damage-flash { animation: dmgFlash 0.3s ease; }',
        '@keyframes dmgFlash { 0%{ filter: brightness(1); } 20%{ filter: brightness(2) saturate(2); } 100%{ filter: brightness(1); } }',

        /* -- Enemy attack anim ------------------------------------------- */
        '.enemy-attacking { animation: enemyLunge 0.4s ease; }',
        '@keyframes enemyLunge { 0%{ transform: translateY(0); } 30%{ transform: translateY(20px) scale(1.1); } 100%{ transform: translateY(0); } }',

        /* -- Enemy death ------------------------------------------------- */
        '.enemy-dying { animation: enemyDeath 0.8s ease forwards; }',
        '@keyframes enemyDeath { 0%{ opacity:1; transform:scale(1); } 100%{ opacity:0; transform:scale(0.3) translateY(40px); } }',

        /* -- Combat Bottom ----------------------------------------------- */
        '.combat-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 260px; z-index: 5; }',
        '.player-info { display: flex; flex-direction: column; align-items: center; gap: 4px; }',
        '.player-avatar { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #ffd700; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #1a1a2e; }',
        '.player-avatar img { width: 100%; height: 100%; object-fit: cover; }',
        '.player-avatar-fallback { font-size: 2rem; }',
        '.player-name { font-size: 0.85rem; font-weight: 700; color: #ffd700; }',
        '.player-effects { display: flex; gap: 2px; margin-top: 4px; flex-wrap: wrap; }',

        /* -- Energy Orb -------------------------------------------------- */
        '.pile-display-left { position: absolute; bottom: 150px; left: 20px; z-index: 10; }',
        '.energy-orb { width: 70px; height: 70px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; font-size: 1.5rem; border: 3px solid #cc8800; background: radial-gradient(circle, #ff9900 0%, #cc6600 60%, #663300 100%); box-shadow: 0 0 20px rgba(255,153,0,0.5); color: #fff; text-shadow: 0 0 6px rgba(0,0,0,0.8); }',
        '.energy-orb.no-energy { border-color: #555; background: radial-gradient(circle, #444 0%, #222 100%); box-shadow: none; color: #888; }',
        '.energy-separator { font-size: 0.7rem; line-height: 0.6; }',
        '.energy-max { font-size: 0.8rem; }',

        /* -- Hand -------------------------------------------------------- */
        '.hand-area { position: absolute; bottom: 20px; left: 100px; right: 200px; height: 220px; z-index: 8; overflow: visible; }',
        '.hand-container { position: relative; width: 100%; height: 100%; overflow: visible; }',

        /* -- Cards (graphic frame + glow, STS-inspired) ------------------ */
        '.card { width: 150px; height: 210px; border-radius: 10px; overflow: hidden; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; position: relative; flex-shrink: 0; }',
        '.card-inner { width: 100%; height: 100%; display: flex; flex-direction: column; padding: 7px 8px 8px; position: relative; border-radius: 10px; border: 3px solid rgba(255,255,255,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 18px rgba(0,0,0,0.55); }',
        '.card-attack .card-inner { background: linear-gradient(165deg, #5c1818 0%, #2a0a0a 45%, #1a0508 100%); border-color: #e84a5f; box-shadow: inset 0 1px 0 rgba(255,180,180,0.15), 0 0 14px rgba(232,74,95,0.25), 0 4px 18px rgba(0,0,0,0.55); }',
        '.card-skill .card-inner { background: linear-gradient(165deg, #0f3d5c 0%, #082030 50%, #051018 100%); border-color: #5ec8ff; box-shadow: inset 0 1px 0 rgba(180,230,255,0.12), 0 0 14px rgba(94,200,255,0.22), 0 4px 18px rgba(0,0,0,0.55); }',
        '.card-power .card-inner { background: linear-gradient(165deg, #4a3510 0%, #281808 50%, #140c04 100%); border-color: #ffb84d; box-shadow: inset 0 1px 0 rgba(255,220,160,0.12), 0 0 14px rgba(255,184,77,0.2), 0 4px 18px rgba(0,0,0,0.55); }',
        '.card-status .card-inner { background: linear-gradient(165deg, #353535 0%, #1a1a1a 100%); border-color: #8a8a8a; }',
        '.card-curse .card-inner { background: linear-gradient(165deg, #3a1538 0%, #140814 100%); border-color: #c44fd4; }',
        '.card-upgraded .card-inner { border-color: #7fff00 !important; box-shadow: inset 0 1px 0 rgba(200,255,160,0.2), 0 0 18px rgba(127,255,0,0.35), 0 4px 18px rgba(0,0,0,0.55) !important; }',
        '.card-upgraded .card-name { color: #b8ff7a; }',
        '.card-unplayable { opacity: 0.5; cursor: default; filter: grayscale(0.25); }',
        '.card-unplayable:hover { transform: none !important; }',

        '.card-cost { position: absolute; top: 5px; left: 5px; width: 30px; height: 30px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #3a3a3a 0%, #151515 100%); border: 2px solid rgba(255,215,0,0.85); box-shadow: 0 0 8px rgba(255,215,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1rem; color: #ffe8a0; z-index: 2; }',
        '.card-attack .card-cost { border-color: rgba(255,120,140,0.9); box-shadow: 0 0 10px rgba(255,100,120,0.35), inset 0 1px 0 rgba(255,255,255,0.15); }',
        '.card-skill .card-cost { border-color: rgba(120,210,255,0.95); box-shadow: 0 0 10px rgba(100,200,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15); }',
        '.card-name { text-align: center; font-weight: 800; font-size: 0.72rem; margin-top: 2px; padding: 5px 30px 5px 32px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.9); background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.45) 20%, rgba(0,0,0,0.45) 80%, transparent 100%); border-radius: 4px; letter-spacing: 0.02em; }',
        '.card-art { flex: 1; margin: 3px 0 2px; background: rgba(0,0,0,0.25); border-radius: 6px; min-height: 68px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 2px 8px rgba(0,0,0,0.4); }',
        '.card-art::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%, rgba(0,0,0,0.2) 100%); }',
        '.card-art-img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; position: relative; z-index: 0; }',
        '.card-type-line { font-size: 0.58rem; text-align: center; color: #c8c8d0; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; padding: 2px 6px; background: rgba(0,0,0,0.35); border-radius: 3px; align-self: center; max-width: 92%; }',
        '.card-description { font-size: 0.64rem; text-align: center; color: #e8e4dc; line-height: 1.35; padding: 4px 5px 3px; min-height: 38px; background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.45) 100%); border-radius: 0 0 6px 6px; margin: 0 -2px -2px; }',

        '.card-in-hand { position: absolute; bottom: 0; transform-origin: bottom center; }',
        '.card-in-hand:hover { z-index: 100 !important; filter: brightness(1.08); }',
        '.card-hovered { box-shadow: 0 0 22px rgba(120,220,255,0.45), 0 0 8px rgba(255,255,255,0.2); }',
        '.card-playing { pointer-events: none; }',
        '.card-flash-unplayable { animation: flashRed 0.4s ease; }',
        '@keyframes flashRed { 0%{ box-shadow: none; } 50%{ box-shadow: 0 0 15px #ff0000; } 100%{ box-shadow: none; } }',

        '.card-in-deck { width: 120px; height: 168px; }',
        '.card-mini { width: 100px; height: 140px; }',
        '.card-mini .card-cost { width: 22px; height: 22px; font-size: 0.8rem; }',
        '.card-mini .card-name { font-size: 0.65rem; padding-left: 22px; }',
        '.card-mini .card-description { display: none; }',
        '.card-mini .card-type-line { display: none; }',

        '.card-face-down .card-inner { background: linear-gradient(135deg, #2a2a6a 0%, #1a1a3a 100%) !important; }',
        '.card-face-down .card-cost, .card-face-down .card-name, .card-face-down .card-art, .card-face-down .card-type-line, .card-face-down .card-description { visibility: hidden; }',

        /* -- Card Preview ------------------------------------------------ */
        '.card-preview-overlay { position: fixed; top: 50%; right: 20px; transform: translateY(-50%); z-index: 9000; pointer-events: none; }',
        '.card-preview-card { width: 250px; padding: 16px; border-radius: 12px; border: 3px solid rgba(255,255,255,0.3); }',
        '.card-preview-card.card-attack { background: linear-gradient(180deg, #4a1010, #2a0808); border-color: #dc3545; }',
        '.card-preview-card.card-skill { background: linear-gradient(180deg, #0a2a4a, #081828); border-color: #4a90d9; }',
        '.card-preview-card.card-power { background: linear-gradient(180deg, #3a2a0a, #281a08); border-color: #f0ad4e; }',
        '.card-preview-card.card-status { background: linear-gradient(180deg, #2a2a2a, #1a1a1a); border-color: #6c757d; }',
        '.card-preview-card.card-curse { background: linear-gradient(180deg, #2a0a2a, #1a081a); border-color: #8b008b; }',
        '.card-preview-card.card-upgraded { border-color: #7fff00 !important; }',
        '.card-preview-cost { font-size: 2rem; font-weight: 900; color: #ffd700; }',
        '.card-preview-name { font-size: 1.2rem; font-weight: 700; color: #fff; margin: 8px 0; }',
        '.card-preview-art { position: relative; height: 100px; background: rgba(255,255,255,0.05); border-radius: 6px; margin: 8px 0; overflow: hidden; }',
        '.card-preview-art-img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }',
        '.card-preview-type { font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.1em; margin: 4px 0; }',
        '.card-preview-desc { font-size: 0.9rem; color: #ddd; line-height: 1.5; }',

        /* -- Description formatting -------------------------------------- */
        '.desc-number { font-weight: 700; color: #ffcc00; }',
        '.desc-damage { color: #ff4444; }',
        '.desc-block { color: #66bbff; }',
        '.desc-keyword { color: #ffd700; }',

        /* -- Draw / Discard Piles ---------------------------------------- */
        '.pile-display-right { position: absolute; bottom: 160px; right: 20px; display: flex; flex-direction: column; gap: 12px; z-index: 10; }',
        '.draw-pile, .discard-pile { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: rgba(0,0,0,0.4); border: 1px solid #555; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }',
        '.draw-pile:hover, .discard-pile:hover { background: rgba(255,255,255,0.1); border-color: #888; }',
        '.pile-icon { font-size: 1.3rem; }',
        '.pile-count { font-weight: 700; font-size: 1rem; }',

        /* -- End Turn Button --------------------------------------------- */
        '.end-turn-container { position: absolute; bottom: 230px; right: 20px; z-index: 10; }',
        '.btn-end-turn { padding: 12px 28px; font-size: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; border: 2px solid #ffd700; background: rgba(255,215,0,0.2); color: #ffd700; cursor: pointer; border-radius: 6px; transition: all 0.2s ease; }',
        '.btn-end-turn:hover { background: rgba(255,215,0,0.35); transform: scale(1.05); box-shadow: 0 0 15px rgba(255,215,0,0.3); }',
        '.btn-end-turn:active { transform: scale(0.97); }',
        '.btn-end-turn:disabled { opacity: 0.4; cursor: default; transform: none !important; box-shadow: none; }',
        '.btn-end-turn-active { animation: endTurnPulse 2s ease-in-out infinite; }',
        '@keyframes endTurnPulse { 0%,100%{ box-shadow: 0 0 5px rgba(255,215,0,0.2); } 50%{ box-shadow: 0 0 20px rgba(255,215,0,0.5); } }',
        '.btn-end-turn-waiting { border-color: #666; color: #888; background: rgba(100,100,100,0.1); }',

        /* -- Potion Bar -------------------------------------------------- */
        '.potion-bar { position: absolute; bottom: 10px; left: 20px; display: flex; gap: 8px; z-index: 10; }',
        '.potion-slot { width: 48px; height: 48px; border: 2px solid #444; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; background: rgba(0,0,0,0.3); }',
        '.potion-slot:hover { border-color: #888; background: rgba(255,255,255,0.05); }',
        '.potion-filled { border-color: #66aa88; }',
        '.potion-icon { font-size: 1.5rem; }',
        '.potion-empty-icon { color: #333; font-size: 1.2rem; }',
        '.potion-name-label { font-size: 0.45rem; color: #aaa; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 44px; }',

        /* -- Relic Icons ------------------------------------------------- */
        '.relic-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid #555; border-radius: 4px; background: rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s ease; position: relative; }',
        '.relic-icon:hover { border-color: #ffd700; background: rgba(255,215,0,0.1); transform: scale(1.15); }',
        '.relic-emoji { font-size: 1.2rem; }',
        '.relic-counter { position: absolute; bottom: -2px; right: -2px; font-size: 0.55rem; font-weight: 700; background: #222; border: 1px solid #888; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; color: #ffd700; }',
        '.relic-flash { animation: relicGlow 0.6s ease; }',
        '@keyframes relicGlow { 0%{ box-shadow: none; } 50%{ box-shadow: 0 0 12px #ffd700; } 100%{ box-shadow: none; } }',

        /* -- Status Effect Icons ----------------------------------------- */
        '.status-effect-icon { display: inline-flex; align-items: center; gap: 1px; padding: 2px 4px; background: rgba(0,0,0,0.4); border-radius: 4px; font-size: 0.7rem; cursor: pointer; }',
        '.effect-icon-symbol { font-size: 0.85rem; }',
        '.effect-amount { font-weight: 700; }',
        '.effect-buff .effect-amount { color: #44cc44; }',
        '.effect-debuff .effect-amount { color: #ff4444; }',
        '.effect-special .effect-amount { color: #ffcc00; }',
        '.status-effect-flash { position: absolute; top: -20px; font-weight: 700; color: #ffd700; animation: statusFlash 0.6s ease forwards; pointer-events: none; }',
        '@keyframes statusFlash { 0%{ opacity:1; transform:translateY(0); } 100%{ opacity:0; transform:translateY(-30px); } }',

        /* -- Combat Log -------------------------------------------------- */
        '.combat-log { position: absolute; bottom: 270px; left: 20px; width: 250px; max-height: 150px; overflow-y: auto; z-index: 6; font-size: 0.7rem; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 4px; pointer-events: none; }',
        '.log-entry { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }',
        '.log-combat { color: #ff8888; }',
        '.log-system { color: #888; }',
        '.log-heal { color: #66ff66; }',
        '.log-gold { color: #ffd700; }',
        '.log-relic { color: #cc88ff; }',
        '.log-potion { color: #66cccc; }',
        '.log-error { color: #ff4444; }',

        /* -- Targeting Canvas -------------------------------------------- */
        '.targeting-canvas { position: fixed; inset: 0; z-index: 50; pointer-events: none; display: none; }',
        '.targeting-active { cursor: crosshair; }',

        /* -- Floating Text & Damage Numbers ------------------------------ */
        '.floating-text { position: fixed; pointer-events: none; font-weight: 900; z-index: 9999; transition: all 1s ease; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }',
        '.damage-number { position: fixed; pointer-events: none; font-weight: 900; font-size: 1.5rem; z-index: 9999; transition: all 1s ease; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }',
        '.damage-damage { color: #ff4444; }',
        '.damage-block { color: #66bbff; }',
        '.damage-heal { color: #66ff66; }',
        '.damage-poison { color: #44aa44; }',

        /* -- Tooltip ----------------------------------------------------- */
        '.game-tooltip { position: fixed; z-index: 10000; background: rgba(15,15,30,0.95); border: 1px solid #555; border-radius: 6px; padding: 10px 14px; max-width: 280px; font-size: 0.85rem; line-height: 1.4; color: #e0d8c8; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.6); display: none; }',
        '.tooltip-desc { color: #aaa; font-size: 0.8rem; }',

        /* -- Map Screen (parchment + STS-style HUD) ------------------------ */
        '#map-screen { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 100vh; position: relative; overflow: hidden; }',
        '.map-bg { position: absolute; inset: 0; z-index: 0; background-color: #141210; background-repeat: no-repeat; filter: saturate(0.85) contrast(1.05); }',
        '.map-chrome { position: relative; z-index: 7; width: 100%; flex: 0 0 auto; align-self: stretch; box-sizing: border-box; }',
        '.map-hud { position: relative; z-index: 1; width: 100%; box-sizing: border-box; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; padding: 10px 20px 10px; background: linear-gradient(180deg, #2a2824 0%, #1a1814 50%, #12100e 100%); border-bottom: 1px solid rgba(80,70,50,0.5); box-shadow: 0 4px 20px rgba(0,0,0,0.5); }',
        '.map-hud-left { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; flex: 1 1 200px; }',
        '.map-hud-identity { line-height: 1.2; }',
        '.map-hud-name { font-size: 1.15rem; font-weight: 800; color: #f0ebe4; text-shadow: 0 1px 3px #000; }',
        '.map-hud-class { font-size: 0.8rem; color: #8a8578; font-weight: 500; }',
        '.map-hud-statrow { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; font-weight: 700; }',
        '.map-hud-heart { color: #c62828; font-size: 1.1rem; }',
        '.map-hud-hp { color: #e84a4a; min-width: 3.2em; }',
        '.map-hud-goldrow { color: #ffd44d; }',
        '.map-hud-gold-ic { filter: none; }',
        '.map-hud-potions { display: flex; gap: 6px; margin-top: 2px; }',
        '.map-hud-potion { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }',
        '.map-hud-potion-empty { border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.25); opacity: 0.5; }',
        '.map-hud-potion-filled { border: 1px solid rgba(255,255,255,0.25); background: rgba(30,40,50,0.5); cursor: default; }',
        '.map-hud-potion-ic { font-size: 1.1rem; }',
        '.map-hud-center { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }',
        '.map-hud-asc { font-size: 0.95rem; font-weight: 700; color: #c85a2e; text-shadow: 0 0 8px rgba(200,80,30,0.4); }',
        '.map-hud-flame { margin-right: 4px; }',
        '.map-hud-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; margin-left: auto; }',
        '.map-hud-deck-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.9rem; font-weight: 700; color: #d8d4c8; background: rgba(0,0,0,0.35); border: 1px solid #555; border-radius: 6px; cursor: pointer; }',
        '.map-hud-deck-btn:hover { background: rgba(80,60,20,0.4); border-color: #8a7; }',
        '.map-hud-deckct { min-width: 1.2em; color: #f44; }',
        '.map-hud-gear { }',
        '.map-relic-row { position: relative; z-index: 1; width: 100%; box-sizing: border-box; display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 6px 20px 8px; background: rgba(0,0,0,0.45); border-top: 1px solid rgba(60,50,40,0.5); border-bottom: 1px solid rgba(40,30,20,0.6); }',
        '.map-relic-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; color: #7a6e5a; font-weight: 800; }',
        '.map-relic-bar { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 40px; flex: 1; }',
        '.map-relic-bar .relic-icon { width: 40px; height: 40px; min-width: 40px; border-radius: 6px; }',
        '.map-relic-bar .relic-emoji { font-size: 1.3rem; }',
        '.map-body { position: relative; z-index: 2; display: flex; flex-direction: row; flex: 1 1 0; min-height: 0; width: 100%; align-items: stretch; align-self: stretch; background: linear-gradient(180deg, #0c0a08 0%, #141210 100%); }',
        '.map-parchment-outer { flex: 1 1 0%; min-width: 0; padding: 10px 8px 20px 12px; display: flex; box-sizing: border-box; }',
        '.map-parchment { flex: 1 1 auto; min-height: 0; min-width: 0; width: 100%; display: flex; flex-direction: column; position: relative; border-radius: 8px; border: 2px solid #2a1e12; ' +
        'box-shadow: inset 0 0 60px rgba(0,0,0,0.2), 0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1); ' +
        'background: linear-gradient(165deg, #d4b896 0%, #b89a6e 20%, #9a7a4a 50%, #7a5a30 100%); }',
        '.map-parchment::after { content: ""; position: absolute; inset: 0; border-radius: 6px; pointer-events: none; ' +
        'box-shadow: inset 0 0 80px rgba(60,40,20,0.25), inset 0 2px 0 rgba(255,255,255,0.15); }',
        '.map-legend { flex: 0 0 200px; width: 200px; max-width: min(200px, 32vw); box-sizing: border-box; margin: 10px 12px 20px 0; padding: 10px 12px; ' +
        'align-self: stretch; ' +
        'background: linear-gradient(180deg, #5a6a7a 0%, #3a4a5a 100%); border: 1px solid #2a3a4a; border-radius: 6px; ' +
        'box-shadow: 0 4px 16px rgba(0,0,0,0.4); }',
        '.map-legend-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.12em; color: #c8d0d8; margin: 0 0 8px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 6px; }',
        '.map-legend-list { list-style: none; font-size: 0.7rem; line-height: 1.65; color: #b8c0c8; margin: 0; padding: 0; }',
        '.map-legend-list li { display: flex; align-items: center; gap: 8px; }',
        '.map-leg-ic { display: inline-flex; width: 1.2em; justify-content: center; }',
        '.map-container { position: relative; z-index: 2; width: 100%; min-width: 0; min-height: 0; flex: 1 1 auto; height: 100%; overflow-y: auto; overflow-x: auto; padding: 20px 12px 36px; box-sizing: border-box; -webkit-overflow-scrolling: touch; }',
        '.map-scroll { position: relative; width: 100%; max-width: 100%; margin: 0 auto; min-height: 400px; box-sizing: border-box; }',
        '.map-paths { position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 1; }',
        '.map-row { position: absolute; left: 0; right: 0; width: 100%; display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: center; align-items: center; box-sizing: border-box; }',
        '.map-node { flex: 0 0 auto; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; cursor: default; ' +
        'transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease, opacity 0.2s ease; border: none; background: transparent; box-sizing: border-box; }',
        '.map-node-disc { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; ' +
        'background: radial-gradient(circle at 30% 25%, #2a2a2e 0%, #0e0e12 100%); ' +
        'box-shadow: inset 0 2px 4px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.5); border: 2px solid #0a0a0c; }',
        '.map-node-emoji { font-size: 1.4rem; line-height: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8)); }',
        '.map-node-boss .map-node-disc { width: 68px; height: 68px; background: radial-gradient(circle at 30% 25%, #1a0a0a 0%, #0a0a0c 100%); ' +
        'box-shadow: 0 0 0 2px rgba(200,100,100,0.4), 0 0 24px rgba(255,200,200,0.2), inset 0 2px 4px rgba(255,255,255,0.1); }',
        '.map-node-boss .map-node-emoji { font-size: 1.6rem; }',
        '.map-node-available:hover .map-node-disc { transform: scale(1.06); }',
        '.map-node-available { cursor: pointer; }',
        '.map-node-available .map-node-disc { box-shadow: 0 0 0 2px rgba(255,215,0,0.85), 0 0 16px rgba(255,220,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1); animation: mapNodeGold 1.5s ease-in-out infinite; }',
        '@keyframes mapNodeGold { 0%,100%{ box-shadow: 0 0 0 2px rgba(255,215,0,0.6), 0 0 10px rgba(255,200,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1); } 50%{ box-shadow: 0 0 0 3px rgba(255,230,0,0.95), 0 0 20px rgba(255,220,0,0.5), inset 0 2px 4px rgba(255,255,255,0.12); } }',
        '.map-node-visited { opacity: 0.72; }',
        '.map-node-visited .map-node-disc { filter: grayscale(0.5) brightness(0.7); }',
        '.map-node-locked { opacity: 0.5; }',
        '.map-node-locked .map-node-disc { filter: grayscale(1) brightness(0.5); }',
        '.map-node-current .map-node-disc { box-shadow: 0 0 0 3px rgba(80,220,100,0.9), 0 0 18px rgba(100,255,120,0.45) !important; }',
        '.map-node-img { width: 76px; height: 76px; object-fit: contain; }',

        /* -- Shop Screen ------------------------------------------------- */
        '.shop-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #1a0a00 0%, #0f0800 100%); }',
        '.shop-header { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 20px 30px; }',
        '.shop-header h2 { color: #ffd700; font-size: 2rem; letter-spacing: 0.2em; }',
        '.shop-content { position: relative; z-index: 2; padding: 0 30px; overflow-y: auto; max-height: calc(100vh - 180px); }',
        '.shop-section { margin-bottom: 24px; }',
        '.shop-section h3 { color: #cc9944; font-size: 1.1rem; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; }',
        '.shop-row { display: flex; gap: 16px; flex-wrap: wrap; }',
        '.shop-item { padding: 12px; border: 1px solid #444; border-radius: 8px; background: rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s ease; text-align: center; min-width: 110px; }',
        '.shop-item:hover { border-color: #ffd700; background: rgba(255,215,0,0.05); transform: translateY(-4px); }',
        '.shop-item-sold { opacity: 0.3; pointer-events: none; }',
        '.shop-item-sold .shop-price { text-decoration: line-through; }',
        '.shop-item-expensive .shop-price { color: #ff4444; }',
        '.shop-relic-icon, .shop-potion-icon { font-size: 2rem; margin-bottom: 4px; }',
        '.shop-item-name { font-size: 0.8rem; color: #ddd; margin-bottom: 4px; }',
        '.shop-price { font-weight: 700; color: #ffd700; font-size: 0.9rem; }',
        '.shop-remove { text-align: center; margin-top: 20px; }',
        '.btn-shop-remove { padding: 12px 24px; font-size: 1rem; font-weight: 700; border: 2px solid #cc4444; background: rgba(204,68,68,0.1); color: #ff6666; cursor: pointer; border-radius: 6px; transition: all 0.2s ease; }',
        '.btn-shop-remove:hover { background: rgba(204,68,68,0.25); }',
        '.btn-leave-shop { position: absolute; bottom: 20px; right: 30px; z-index: 5; }',

        /* -- Event Screen ------------------------------------------------ */
        '.event-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 100%); }',
        '.event-content { position: relative; z-index: 2; max-width: 600px; margin: 0 auto; padding: 60px 30px; text-align: center; }',
        '#event-screen .event-image-area { margin-bottom: 20px; }',
        '#event-screen .event-image { width: min(92vw, 400px); max-width: 400px; height: auto; min-height: 200px; margin: 0 auto; aspect-ratio: 4/3; background: rgba(0,0,0,0.35); border: 2px solid rgba(255,215,0,0.45); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; }',
        '#event-screen .event-image-img { width: 100%; height: 100%; min-height: 200px; object-fit: cover; object-position: center; display: block; }',
        '.event-title { color: #ffd700; font-size: 1.8rem; margin-bottom: 16px; }',
        '.event-description { color: #ccc; font-size: 1rem; line-height: 1.6; margin-bottom: 30px; min-height: 2em; }',
        '.event-choices { display: flex; flex-direction: column; gap: 12px; }',
        '.btn-event-choice { padding: 14px 24px; font-size: 1rem; border: 1px solid #555; background: rgba(255,255,255,0.05); color: #ddd; cursor: pointer; border-radius: 6px; transition: all 0.2s ease; text-align: left; }',
        '.btn-event-choice:hover { border-color: #ffd700; background: rgba(255,215,0,0.1); color: #fff; }',
        '.btn-event-choice:disabled { opacity: 0.4; cursor: default; }',
        '.event-result { margin-top: 20px; padding: 16px; background: rgba(255,215,0,0.1); border: 1px solid #ffd700; border-radius: 6px; color: #ffd700; }',

        /* -- Rest Screen ------------------------------------------------- */
        '.rest-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #0a0a14 0%, #1a0e00 50%, #0a0a14 100%); }',
        '.rest-content { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }',
        '.campfire { position: relative; width: 120px; height: 120px; margin-bottom: 30px; display: flex; align-items: center; justify-content: center; }',
        '.fire-base { font-size: 4rem; animation: fireFlicker 0.5s ease-in-out infinite alternate; }',
        '@keyframes fireFlicker { 0%{ transform: scale(1) rotate(-2deg); } 100%{ transform: scale(1.05) rotate(2deg); } }',
        '.fire-glow { position: absolute; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(255,100,0,0.3) 0%, transparent 70%); animation: glowPulse 2s ease-in-out infinite; pointer-events: none; }',
        '@keyframes glowPulse { 0%,100%{ opacity: 0.6; transform: scale(1); } 50%{ opacity: 1; transform: scale(1.1); } }',
        '.fire-particle { position: absolute; width: 6px; height: 6px; border-radius: 50%; }',
        '.fp1 { background: #ff6600; animation: particleRise 1.5s ease-in infinite; left: 45%; }',
        '.fp2 { background: #ffaa00; animation: particleRise 2s ease-in infinite 0.5s; left: 55%; }',
        '.fp3 { background: #ff4400; animation: particleRise 1.8s ease-in infinite 1s; left: 50%; }',
        '@keyframes particleRise { 0%{ bottom: 50%; opacity: 1; } 100%{ bottom: 100%; opacity: 0; transform: translateX(' + ((Math.random()-0.5)*30) + 'px); } }',
        '.rest-title { color: #ffd700; font-size: 2rem; margin-bottom: 30px; }',
        '.rest-options { display: flex; gap: 24px; }',
        '.btn-rest-option { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 32px; border: 2px solid #555; background: rgba(0,0,0,0.3); color: #ddd; cursor: pointer; border-radius: 12px; transition: all 0.3s ease; min-width: 180px; }',
        '.btn-rest-option:hover { border-color: #ffd700; background: rgba(255,215,0,0.1); transform: translateY(-4px); }',
        '.rest-option-icon { font-size: 2.5rem; }',
        '.rest-option-label { font-size: 1.2rem; font-weight: 700; color: #ffd700; }',
        '.rest-option-desc { font-size: 0.8rem; color: #999; }',

        /* -- Reward Screen ----------------------------------------------- */
        '.reward-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #0a140a 0%, #0a0a14 100%); }',
        '.reward-content { position: relative; z-index: 2; max-width: 500px; margin: 0 auto; padding: 60px 30px; text-align: center; }',
        '.reward-title { color: #ffd700; font-size: 2rem; margin-bottom: 30px; }',
        '.reward-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; }',
        '.reward-item { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border: 1px solid #555; background: rgba(0,0,0,0.3); border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }',
        '.reward-item:hover { border-color: #ffd700; background: rgba(255,215,0,0.1); transform: translateX(4px); }',
        '.reward-icon { font-size: 1.5rem; }',
        '.reward-label { font-size: 1rem; font-weight: 600; }',
        '.btn-proceed { margin-top: 10px; }',

        /* -- Deck View --------------------------------------------------- */
        '.deck-view-bg { position: absolute; inset: 0; background: rgba(10,10,20,0.95); }',
        '.deck-view-content { position: relative; z-index: 2; padding: 20px; height: 100%; display: flex; flex-direction: column; }',
        '.deck-view-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }',
        '.deck-view-header h2 { color: #ffd700; }',
        '.deck-sort-buttons { display: flex; gap: 8px; }',
        '.btn-sort { padding: 6px 14px; border: 1px solid #555; background: rgba(0,0,0,0.3); color: #ccc; cursor: pointer; border-radius: 4px; font-size: 0.8rem; transition: all 0.2s ease; }',
        '.btn-sort:hover { border-color: #888; }',
        '.btn-sort.active { border-color: #ffd700; color: #ffd700; background: rgba(255,215,0,0.1); }',
        '.btn-close-deck { width: 36px; height: 36px; font-size: 1.2rem; border: 1px solid #555; background: rgba(0,0,0,0.3); color: #ccc; cursor: pointer; border-radius: 50%; transition: all 0.2s ease; }',
        '.btn-close-deck:hover { border-color: #ff4444; color: #ff4444; }',
        '.deck-grid { display: flex; flex-wrap: wrap; gap: 12px; overflow-y: auto; flex: 1; align-content: flex-start; padding: 8px 0; }',
        '.deck-card-slot { transition: transform 0.2s ease; }',
        '.deck-card-slot:hover { transform: translateY(-6px); }',

        /* -- Game Over --------------------------------------------------- */
        '.gameover-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #1a0000 0%, #0a0000 100%); }',
        '.gameover-content { position: relative; z-index: 2; max-width: 500px; margin: 0 auto; padding: 80px 30px; text-align: center; }',
        '.gameover-title { font-size: 4rem; color: #cc2222; text-shadow: 0 0 30px rgba(204,34,34,0.5); margin-bottom: 40px; animation: defeatPulse 2s ease-in-out infinite; }',
        '@keyframes defeatPulse { 0%,100%{ text-shadow: 0 0 20px rgba(204,34,34,0.3); } 50%{ text-shadow: 0 0 40px rgba(204,34,34,0.7); } }',
        '.gameover-stats, .victory-stats { margin-bottom: 30px; }',
        '.stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1rem; }',
        '.stat-total { font-weight: 700; font-size: 1.2rem; color: #ffd700; border-bottom: none; border-top: 2px solid rgba(255,215,0,0.3); margin-top: 8px; padding-top: 12px; }',
        '.gameover-buttons, .victory-buttons { display: flex; gap: 16px; justify-content: center; }',

        /* -- Victory ----------------------------------------------------- */
        '.victory-bg { position: absolute; inset: 0; background: linear-gradient(180deg, #0a1a0a 0%, #001a00 100%); }',
        '.victory-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; }',
        '.victory-content { position: relative; z-index: 2; max-width: 500px; margin: 0 auto; padding: 80px 30px; text-align: center; }',
        '.victory-title { font-size: 4rem; color: #ffd700; text-shadow: 0 0 30px rgba(255,215,0,0.5); margin-bottom: 40px; animation: victoryShine 2s ease-in-out infinite; }',
        '@keyframes victoryShine { 0%,100%{ text-shadow: 0 0 20px rgba(255,215,0,0.3); } 50%{ text-shadow: 0 0 50px rgba(255,215,0,0.8); } }',
        '.victory-particle { position: absolute; top: -10px; border-radius: 50%; animation: confettiFall linear infinite; }',
        '@keyframes confettiFall { 0%{ transform: translateY(0) rotate(0deg); opacity: 1; } 100%{ transform: translateY(100vh) rotate(720deg); opacity: 0; } }',

        /* -- Settings Overlay -------------------------------------------- */
        '.overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9000; }',
        '.settings-panel, .confirm-panel { background: #1a1a2e; border: 2px solid #555; border-radius: 12px; padding: 30px; min-width: 400px; max-width: 500px; }',
        '.settings-panel h2, .confirm-panel h3 { color: #ffd700; margin-bottom: 24px; text-align: center; }',
        '.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }',
        '.setting-row label { color: #ddd; font-size: 0.95rem; }',
        '.setting-row input[type="range"] { width: 150px; accent-color: #ffd700; }',
        '.setting-row input[type="checkbox"] { width: 20px; height: 20px; accent-color: #ffd700; }',
        '.settings-buttons, .confirm-buttons { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }',

        /* -- Card Reward Overlay ----------------------------------------- */
        '.card-reward-panel, .card-select-panel, .pile-view-panel { background: rgba(20,20,40,0.95); border: 2px solid #555; border-radius: 12px; padding: 30px; max-width: 90vw; max-height: 85vh; overflow-y: auto; text-align: center; }',
        '.card-reward-panel h3, .card-select-panel h3, .pile-view-panel h3 { color: #ffd700; margin-bottom: 20px; }',
        '.card-reward-options { display: flex; gap: 20px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap; }',
        '.card-reward-option { cursor: pointer; transition: all 0.2s ease; padding: 8px; border-radius: 8px; }',
        '.card-reward-option:hover { transform: translateY(-8px); box-shadow: 0 8px 20px rgba(255,215,0,0.2); }',

        /* -- Card Select ------------------------------------------------- */
        '.card-select-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-bottom: 20px; }',
        '.card-select-item { cursor: pointer; padding: 6px; border: 2px solid transparent; border-radius: 8px; transition: all 0.2s ease; }',
        '.card-select-item:hover { border-color: rgba(255,215,0,0.3); }',
        '.card-selected { border-color: #ffd700 !important; box-shadow: 0 0 12px rgba(255,215,0,0.3); }',
        '.card-select-actions { display: flex; gap: 12px; justify-content: center; }',

        /* -- Pile View --------------------------------------------------- */
        '.pile-view-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 20px; }',
        '.pile-card-slot { transition: transform 0.2s ease; }',
        '.pile-card-slot:hover { transform: translateY(-4px); }'

    ].join('\n');

    document.head.appendChild(style);
})();

console.log('[STS] ui.js loaded – UI system ready');
