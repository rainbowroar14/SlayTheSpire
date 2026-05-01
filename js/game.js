/**
 * @file game.js
 * @description Core game engine for Slay the Spire web app.
 * Manages all game state, coordinates between modules, and provides the main
 * game API.  Uses the global STS namespace pattern.
 */

window.STS = window.STS || {};

/* ======================================================================
 *  EVENT BUS
 * ====================================================================== */

/**
 * Lightweight publish / subscribe event bus for decoupled communication
 * between game systems (combat, relics, UI, effects, etc.).
 *
 * @namespace STS.Events
 */
STS.Events = {
    /** @type {Object.<string, Function[]>} */
    listeners: {},

    /**
     * Subscribe to a game event.
     *
     * @param {string}   event    - Event name (e.g. 'CARD_PLAYED').
     * @param {Function} callback - Handler receiving the event data object.
     */
    on: function (event, callback) {
        if (typeof callback !== 'function') {
            console.warn('[Events.on] callback is not a function for event:', event);
            return;
        }
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    /**
     * Unsubscribe a previously registered callback.
     *
     * @param {string}   event
     * @param {Function} callback
     */
    off: function (event, callback) {
        const list = this.listeners[event];
        if (!list) return;
        this.listeners[event] = list.filter(function (cb) { return cb !== callback; });
    },

    /**
     * Emit an event, calling every registered listener synchronously.
     *
     * @param {string} event
     * @param {*}      [data]
     */
    emit: function (event, data) {
        var list = this.listeners[event];
        if (!list || list.length === 0) return;
        // Iterate over a snapshot so listeners can safely un-register themselves
        var snapshot = list.slice();
        for (var i = 0; i < snapshot.length; i++) {
            try {
                snapshot[i](data);
            } catch (err) {
                console.error('[Events.emit] Error in listener for "' + event + '":', err);
            }
        }
    },

    /**
     * Remove every listener for every event.
     */
    clear: function () {
        this.listeners = {};
    }
};

/* ======================================================================
 *  SEEDED PRNG  –  xorshift128
 * ====================================================================== */

/**
 * @namespace STS.RNG
 * Deterministic pseudo-random number generator so runs are reproducible.
 */
STS.RNG = (function () {
    var s0 = 1, s1 = 2, s2 = 3, s3 = 4;

    /**
     * Seed the PRNG.  Accepts any positive integer.
     * @param {number} seed
     */
    function seed(val) {
        val = val >>> 0 || 1;
        s0 = val;
        s1 = val ^ 0xDEADBEEF;
        s2 = (val << 13) ^ val;
        s3 = (val >>> 7) ^ (val << 5);
        // Warm up
        for (var i = 0; i < 20; i++) next();
    }

    /**
     * Return a float in [0, 1).
     * @returns {number}
     */
    function next() {
        var t = s3;
        var s = s0;
        s3 = s2;
        s2 = s1;
        s1 = s0;
        t ^= t << 11;
        t ^= t >>> 8;
        s0 = t ^ s ^ (s >>> 19);
        return (s0 >>> 0) / 4294967296;
    }

    /**
     * Return a random integer in [min, max] (inclusive).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    function nextInt(min, max) {
        return Math.floor(next() * (max - min + 1)) + min;
    }

    /**
     * Pick a random element from an array.
     * @template T
     * @param {T[]} arr
     * @returns {T}
     */
    function pick(arr) {
        return arr[Math.floor(next() * arr.length)];
    }

    return { seed: seed, next: next, nextInt: nextInt, pick: pick };
})();

/* ======================================================================
 *  CONSTANTS
 * ====================================================================== */

/** @enum {string} */
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

var HAND_SIZE_LIMIT = 10;
var CARDS_DRAWN_PER_TURN = 5;
var STARTING_HP = 80;
var STARTING_ENERGY = 3;
var STARTING_GOLD = 99;
var POTION_SLOTS = 3;
var ACTS_TOTAL = 3;
/** Floors per act (rows 0 .. FLOORS_PER_ACT-1). Base was 17; +25% ≈ 21. */
var FLOORS_PER_ACT = 21;

/* ======================================================================
 *  STARTER CARD & RELIC DATA
 * ====================================================================== */

/**
 * Base definitions for the Ironclad starter cards.
 * Full card DB would live in cards.js – these cover the starter set.
 */
var STARTER_CARDS = {
    STRIKE: {
        id: 'STRIKE',
        name: 'Strike',
        type: 'ATTACK',
        rarity: 'BASIC',
        energy: 1,
        damage: 6,
        block: 0,
        description: 'Deal 6 damage.',
        descriptionUpgraded: 'Deal 9 damage.',
        target: 'SINGLE_ENEMY',
        exhaust: false,
        ethereal: false,
        unplayable: false,
        effects: [],
        upgrade: function () {
            this.upgraded = true;
            this.name = 'Strike+';
            this.damage = 9;
            this.baseDamage = 9;
            this.description = this.descriptionUpgraded;
        }
    },
    DEFEND: {
        id: 'DEFEND',
        name: 'Defend',
        type: 'SKILL',
        rarity: 'BASIC',
        energy: 1,
        damage: 0,
        block: 5,
        description: 'Gain 5 Block.',
        descriptionUpgraded: 'Gain 8 Block.',
        target: 'SELF',
        exhaust: false,
        ethereal: false,
        unplayable: false,
        effects: [],
        upgrade: function () {
            this.upgraded = true;
            this.name = 'Defend+';
            this.block = 8;
            this.baseBlock = 8;
            this.description = this.descriptionUpgraded;
        }
    },
    BASH: {
        id: 'BASH',
        name: 'Bash',
        type: 'ATTACK',
        rarity: 'BASIC',
        energy: 2,
        damage: 8,
        block: 0,
        description: 'Deal 8 damage. Apply 2 Vulnerable.',
        descriptionUpgraded: 'Deal 10 damage. Apply 3 Vulnerable.',
        target: 'SINGLE_ENEMY',
        exhaust: false,
        ethereal: false,
        unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'VULNERABLE', amount: 2, target: 'ENEMY' }],
        upgrade: function () {
            this.upgraded = true;
            this.name = 'Bash+';
            this.damage = 10;
            this.baseDamage = 10;
            this.effects = [{ type: 'STATUS', effectId: 'VULNERABLE', amount: 3, target: 'ENEMY' }];
            this.description = this.descriptionUpgraded;
        }
    }
};

var STARTER_RELICS = {
    BURNING_BLOOD: {
        id: 'BURNING_BLOOD',
        name: 'Burning Blood',
        description: 'At the end of combat, heal 6 HP.',
        rarity: 'STARTER',
        icon: '🩸',
        character: 'IRONCLAD',
        counter: -1,
        onPickup: null,
        onCombatStart: null,
        onCombatEnd: function () {
            STS.Game.healPlayer(6);
            STS.Game.log('Burning Blood healed 6 HP.', 'relic');
        },
        onTurnStart: null,
        onTurnEnd: null,
        onCardPlayed: null,
        onDamageDealt: null,
        onDamageTaken: null,
        onHeal: null,
        onGoldChanged: null
    }
};

/* ======================================================================
 *  MAP GENERATION
 * ====================================================================== */

/**
 * Lane counts per floor: single start, wide mid path (often 3–6 parallel nodes), then funnel to boss.
 * @param {number} floorCount
 * @returns {number[]}
 */
function _generateNodesPerRowForAct(floorCount) {
    var rng = STS.RNG;
    var rows = [];
    for (var f = 0; f < floorCount; f++) {
        if (f === 0) {
            rows.push(1);
        } else if (f === floorCount - 1) {
            rows.push(1);
        } else if (f === floorCount - 2) {
            rows.push(1);
        } else if (f === floorCount - 3) {
            rows.push(rng.nextInt(1, 2));
        } else if (f === floorCount - 4) {
            rows.push(rng.nextInt(2, 4));
        } else {
            rows.push(rng.nextInt(3, 6));
        }
    }
    return rows;
}

/**
 * Generate a procedural map for a single act.
 * Creates a layered graph of FLOORS_PER_ACT rows.
 *
 * Node types: MONSTER, ELITE, REST, SHOP, EVENT, TREASURE, BOSS
 *
 * @param {number} act - Current act number (1-3).
 * @returns {{ nodes: Object[], paths: Array[] }}
 */
function generateMap(act) {
    var nodes = [];
    var paths = [];
    var nodeId = 0;

    var nodesPerRow = _generateNodesPerRowForAct(FLOORS_PER_ACT);
    var treasureFloor = Math.max(2, Math.min(FLOORS_PER_ACT - 4, Math.round((FLOORS_PER_ACT - 1) * 0.5)));

    for (var floor = 0; floor < FLOORS_PER_ACT; floor++) {
        var count = nodesPerRow[floor] || 3;
        var rowNodes = [];

        for (var n = 0; n < count; n++) {
            var type = _pickNodeType(floor, act);
            rowNodes.push({
                id: nodeId++,
                floor: floor,
                col: n,
                type: type,
                visited: false,
                available: floor === 0,
                enemies: null,
                x: 0,
                y: 0
            });
        }
        nodes.push(rowNodes);
    }

    // Force first floor = MONSTER, last floor = BOSS, mid act = TREASURE
    if (nodes[0]) {
        for (var i = 0; i < nodes[0].length; i++) nodes[0][i].type = 'MONSTER';
    }
    if (nodes[treasureFloor]) {
        for (var i = 0; i < nodes[treasureFloor].length; i++) nodes[treasureFloor][i].type = 'TREASURE';
    }
    if (nodes[nodes.length - 1]) {
        for (var i = 0; i < nodes[nodes.length - 1].length; i++) {
            nodes[nodes.length - 1][i].type = 'BOSS';
        }
    }

    // Generate paths between adjacent floors
    for (var f = 0; f < nodes.length - 1; f++) {
        var current = nodes[f];
        var next = nodes[f + 1];
        for (var c = 0; c < current.length; c++) {
            var connections = [];
            // Connect to at least one node in the next row
            var primary = Math.min(c, next.length - 1);
            connections.push(primary);
            // Possibly connect to an adjacent node for branching
            if (STS.RNG.next() > 0.4 && primary > 0) {
                connections.push(primary - 1);
            }
            if (STS.RNG.next() > 0.4 && primary < next.length - 1) {
                connections.push(primary + 1);
            }
            // Deduplicate
            var unique = {};
            for (var j = 0; j < connections.length; j++) unique[connections[j]] = true;
            connections = Object.keys(unique).map(Number);

            for (var j = 0; j < connections.length; j++) {
                paths.push({
                    from: current[c].id,
                    to: next[connections[j]].id
                });
            }
        }
    }

    // Flatten nodes for storage
    var flat = [];
    for (var f = 0; f < nodes.length; f++) {
        for (var n = 0; n < nodes[f].length; n++) {
            flat.push(nodes[f][n]);
        }
    }

    return { nodes: flat, paths: paths };
}

/**
 * Pick a node type appropriate for the given floor.
 * @param {number} floor
 * @param {number} act
 * @returns {string}
 */
function _pickNodeType(floor, act) {
    // Early floors lean toward monsters, mid-game has more variety
    var roll = STS.RNG.next();

    if (floor <= 2) {
        // Early: mostly monsters
        if (roll < 0.65) return 'MONSTER';
        if (roll < 0.85) return 'EVENT';
        return 'MONSTER';
    }

    if (floor >= FLOORS_PER_ACT - 4) {
        // Late: rest sites and elites
        if (roll < 0.35) return 'ELITE';
        if (roll < 0.60) return 'REST';
        if (roll < 0.80) return 'MONSTER';
        return 'EVENT';
    }

    // Mid floors
    if (roll < 0.30) return 'MONSTER';
    if (roll < 0.45) return 'EVENT';
    if (roll < 0.58) return 'ELITE';
    if (roll < 0.72) return 'REST';
    if (roll < 0.85) return 'SHOP';
    return 'MONSTER';
}

/* ======================================================================
 *  ENEMY TEMPLATES
 * ====================================================================== */

/**
 * Simple enemy pool.  A full enemy database would live in enemies.js.
 */
var ENEMY_POOL = {
    ACT1_WEAK: [
        {
            id: 'JAW_WORM',
            name: 'Jaw Worm',
            hp: [40, 44],
            type: 'NORMAL',
            intents: [
                { type: 'ATTACK', damage: 11, name: 'Chomp' },
                { type: 'ATTACK_BUFF', damage: 7, buff: { id: 'STRENGTH', amount: 3 }, name: 'Bellow' },
                { type: 'DEFEND', block: 6, name: 'Thrash' }
            ]
        },
        {
            id: 'CULTIST',
            name: 'Cultist',
            hp: [48, 54],
            type: 'NORMAL',
            intents: [
                { type: 'BUFF', buff: { id: 'RITUAL', amount: 3 }, name: 'Incantation', firstOnly: true },
                { type: 'ATTACK', damage: 6, name: 'Dark Strike' }
            ]
        },
        {
            id: 'LOUSE_RED',
            name: 'Red Louse',
            hp: [10, 15],
            type: 'NORMAL',
            intents: [
                { type: 'ATTACK', damage: [5, 7], name: 'Bite' },
                { type: 'DEBUFF', debuff: { id: 'WEAKNESS', amount: 2 }, name: 'Grow' }
            ]
        },
        {
            id: 'LOUSE_GREEN',
            name: 'Green Louse',
            hp: [11, 17],
            type: 'NORMAL',
            intents: [
                { type: 'ATTACK', damage: [5, 7], name: 'Bite' },
                { type: 'DEBUFF', debuff: { id: 'WEAKNESS', amount: 2 }, name: 'Spit Web' }
            ]
        },
        {
            id: 'ACID_SLIME_S',
            name: 'Acid Slime (S)',
            hp: [8, 12],
            type: 'NORMAL',
            intents: [
                { type: 'ATTACK', damage: 3, name: 'Tackle' },
                { type: 'DEBUFF', debuff: { id: 'WEAKNESS', amount: 1 }, name: 'Lick' }
            ]
        },
        {
            id: 'SPIKE_SLIME_S',
            name: 'Spike Slime (S)',
            hp: [10, 14],
            type: 'NORMAL',
            intents: [
                { type: 'ATTACK', damage: 5, name: 'Tackle' }
            ]
        }
    ],
    ACT1_ELITE: [
        {
            id: 'GREMLIN_NOB',
            name: 'Gremlin Nob',
            hp: [82, 86],
            type: 'ELITE',
            intents: [
                { type: 'ATTACK', damage: 14, name: 'Rush' },
                { type: 'ATTACK', damage: 6, name: 'Skull Bash' },
                { type: 'BUFF', buff: { id: 'ENRAGE', amount: 2 }, name: 'Bellow', firstOnly: true }
            ]
        },
        {
            id: 'LAGAVULIN',
            name: 'Lagavulin',
            hp: [109, 111],
            type: 'ELITE',
            intents: [
                { type: 'ATTACK', damage: 18, name: 'Attack' },
                { type: 'DEBUFF_MULTI', debuffs: [
                    { id: 'STRENGTH', amount: -1 },
                    { id: 'DEXTERITY', amount: -1 }
                ], name: 'Siphon Soul' }
            ]
        },
        {
            id: 'SENTRIES',
            name: 'Sentry',
            hp: [38, 42],
            type: 'ELITE',
            intents: [
                { type: 'ATTACK', damage: 9, name: 'Bolt' },
                { type: 'DEBUFF', debuff: { id: 'FRAIL', amount: 2 }, name: 'Beam' }
            ]
        }
    ],
    ACT1_BOSS: [
        {
            id: 'SLIME_BOSS',
            name: 'Slime Boss',
            hp: [140, 140],
            type: 'BOSS',
            intents: [
                { type: 'ATTACK', damage: 35, name: 'Slam' },
                { type: 'DEBUFF', debuff: { id: 'FRAIL', amount: 3 }, name: 'Slime Gush' },
                { type: 'ATTACK', damage: 35, name: 'Slam' }
            ]
        },
        {
            id: 'THE_GUARDIAN',
            name: 'The Guardian',
            hp: [240, 240],
            type: 'BOSS',
            intents: [
                { type: 'ATTACK', damage: 32, name: 'Fierce Bash' },
                { type: 'ATTACK_DEBUFF', damage: 9, times: 2, debuff: { id: 'VULNERABLE', amount: 2 }, name: 'Twin Slam' },
                { type: 'DEFEND', block: 20, name: 'Roll Up' },
                { type: 'ATTACK', damage: 36, name: 'Whirlwind' }
            ]
        },
        {
            id: 'HEXAGHOST',
            name: 'Hexaghost',
            hp: [250, 250],
            type: 'BOSS',
            intents: [
                { type: 'ATTACK', damage: 2, times: 6, name: 'Sear' },
                { type: 'BUFF', buff: { id: 'STRENGTH', amount: 2 }, name: 'Inflame' },
                { type: 'ATTACK', damage: 6, times: 6, name: 'Inferno' }
            ]
        }
    ]
};

/**
 * Instantiate a live enemy from a template definition.
 * @param {Object} template
 * @returns {Object}
 */
function createEnemyInstance(template) {
    var hpRange = template.hp;
    var hp = Array.isArray(hpRange)
        ? STS.RNG.nextInt(hpRange[0], hpRange[1])
        : hpRange;

    return {
        id: template.id,
        name: template.name,
        hp: hp,
        maxHp: hp,
        block: 0,
        type: template.type,
        statusEffects: {},
        intents: JSON.parse(JSON.stringify(template.intents)),
        currentIntent: null,
        intentIndex: 0,
        turnsTaken: 0,
        alive: true
    };
}

/**
 * Select a random encounter for the given node type and act.
 * @param {string} nodeType - 'MONSTER', 'ELITE', or 'BOSS'.
 * @param {number} act
 * @returns {Object[]} Array of enemy instances.
 */
function selectEncounter(nodeType, act) {
    // Prefer enemies.js module if available
    if (STS.Enemies && typeof STS.Enemies.getRandomEncounter === 'function') {
        try {
            var enc = STS.Enemies.getRandomEncounter(act, nodeType);
            if (enc && enc.length > 0) return enc;
        } catch (e) {
            console.warn('[Game] Failed to use STS.Enemies, falling back:', e);
        }
    }

    var pool;
    if (nodeType === 'BOSS') {
        pool = ENEMY_POOL['ACT' + act + '_BOSS'] || ENEMY_POOL.ACT1_BOSS;
    } else if (nodeType === 'ELITE') {
        pool = ENEMY_POOL['ACT' + act + '_ELITE'] || ENEMY_POOL.ACT1_ELITE;
    } else {
        pool = ENEMY_POOL['ACT' + act + '_WEAK'] || ENEMY_POOL.ACT1_WEAK;
    }

    var template = STS.RNG.pick(pool);

    if (template.id === 'SENTRIES') {
        return [createEnemyInstance(template), createEnemyInstance(template), createEnemyInstance(template)];
    }

    if (nodeType === 'MONSTER' && STS.RNG.next() > 0.6) {
        var t2 = STS.RNG.pick(pool);
        return [createEnemyInstance(template), createEnemyInstance(t2)];
    }

    return [createEnemyInstance(template)];
}

/* ======================================================================
 *  STS.Game  –  MAIN ENGINE
 * ====================================================================== */

STS.Game = {

    /** @type {Object|null} Full game state tree. */
    state: null,

    /** Auto-incrementing id for card instances. */
    nextInstanceId: 1,

    /* ------------------------------------------------------------------
     *  init
     * ------------------------------------------------------------------ */

    /**
     * Initialise the game engine: load settings and start a new run
     * immediately so the player lands on the map.
     */
    init: function () {
        STS.Game.loadSettings();
        STS.Game.newRun();
        STS.Game.log('Game engine initialised — new run started.', 'system');
        STS.Events.emit('GAME_INIT', {});
    },

    /* ------------------------------------------------------------------
     *  newRun
     * ------------------------------------------------------------------ */

    /**
     * Begin a brand new run.
     * Resets all run state, builds the starter deck (5 Strikes, 4 Defends,
     * 1 Bash), awards the starter relic (Burning Blood) and generates the
     * Act 1 map.
     */
    newRun: function () {
        var seed = Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0);
        STS.RNG.seed(seed);

        STS.Game.nextInstanceId = 1;

        // Build starter deck – prefer definitions from cards.js if available
        var deck = [];
        var strikeDef = (STS.Cards && STS.Cards.definitions && STS.Cards.definitions.STRIKE) || STARTER_CARDS.STRIKE;
        var defendDef = (STS.Cards && STS.Cards.definitions && STS.Cards.definitions.DEFEND) || STARTER_CARDS.DEFEND;
        var bashDef   = (STS.Cards && STS.Cards.definitions && STS.Cards.definitions.BASH)   || STARTER_CARDS.BASH;
        for (var i = 0; i < 5; i++) deck.push(STS.Game.createCardInstance(strikeDef));
        for (var i = 0; i < 4; i++) deck.push(STS.Game.createCardInstance(defendDef));
        deck.push(STS.Game.createCardInstance(bashDef));

        var map = generateMap(1);

        STS.Game.state = {
            screen: SCREEN.MAP,
            player: {
                name: 'Ironclad',
                characterClass: 'the Ironclad',
                hp: STARTING_HP,
                maxHp: STARTING_HP,
                energy: STARTING_ENERGY,
                maxEnergy: STARTING_ENERGY,
                gold: STARTING_GOLD,
                block: 0,
                deck: deck,
                hand: [],
                drawPile: [],
                discardPile: [],
                exhaustPile: [],
                relics: [],
                statusEffects: {},
                potions: new Array(POTION_SLOTS).fill(null),
                powers: {}
            },
            combat: {
                enemies: [],
                turn: 0,
                playerTurn: true,
                cardsPlayedThisTurn: 0,
                cardsPlayedThisCombat: 0,
                attacksPlayedThisTurn: 0
            },
            map: {
                currentFloor: 0,
                currentAct: 1,
                nodes: map.nodes,
                paths: map.paths,
                currentNodeId: null,
                visitedNodes: []
            },
            run: {
                seed: seed,
                score: 0,
                floorsClimbed: 0,
                monstersKilled: 0,
                elitesKilled: 0,
                bossesKilled: 0,
                goldEarned: 0,
                longestWinStreak: 0
            },
            rewards: [],
            eventData: null,
            shopData: null,
            settings: (STS.Game.state && STS.Game.state.settings)
                ? STS.Game.state.settings
                : (STS.Game._pendingSettings || {
                    musicVolume: 0.5,
                    sfxVolume: 0.7,
                    screenShake: true,
                    fastMode: false,
                    showDamageNumbers: true
                }),
            animations: [],
            log: []
        };

        // Starter relic
        STS.Game.addRelic(Object.assign({}, STARTER_RELICS.BURNING_BLOOD));

        STS.Game.changeScreen(SCREEN.MAP);
        STS.Game.log('New run started. Seed: ' + seed, 'system');
    },

    /* ------------------------------------------------------------------
     *  Screen management
     * ------------------------------------------------------------------ */

    /**
     * Transition to a new screen, emitting SCREEN_CHANGED.
     * @param {string} screen - One of the SCREEN enum values.
     */
    changeScreen: function (screen) {
        var st = STS.Game.state;
        if (screen === SCREEN.MAP && st && st.screen === SCREEN.COMBAT) {
            STS.Game.log('You cannot open the map during combat.', 'combat');
            return;
        }
        var prev = st ? st.screen : null;
        if (st) st.screen = screen;
        STS.Events.emit('SCREEN_CHANGED', { from: prev, to: screen });
    },

    /* ------------------------------------------------------------------
     *  Card instance factory
     * ------------------------------------------------------------------ */

    /**
     * Create a live card instance from a card definition.
     * Each instance gets a unique instanceId and copies of base stats.
     *
     * @param {Object} cardDef - Template from the card database.
     * @returns {Object} Card instance.
     */
    createCardInstance: function (cardDef) {
        var instance = {};
        var keys = Object.keys(cardDef);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (typeof cardDef[k] === 'function') {
                instance[k] = cardDef[k];
            } else if (Array.isArray(cardDef[k])) {
                instance[k] = JSON.parse(JSON.stringify(cardDef[k]));
            } else if (typeof cardDef[k] === 'object' && cardDef[k] !== null) {
                instance[k] = JSON.parse(JSON.stringify(cardDef[k]));
            } else {
                instance[k] = cardDef[k];
            }
        }
        instance.instanceId = STS.Game.nextInstanceId++;
        instance.upgraded = instance.upgraded || false;
        instance.costModifier = 0;
        instance.baseDamage = cardDef.damage;
        instance.baseBlock = cardDef.block;
        instance.baseCost = cardDef.energy;
        return instance;
    },

    /* ------------------------------------------------------------------
     *  COMBAT LIFECYCLE
     * ------------------------------------------------------------------ */

    /**
     * Set up a combat encounter.
     *
     * @param {Object[]} enemies - Array of enemy instances.
     */
    startCombat: function (enemies) {
        var st = STS.Game.state;
        if (!st) return;

        st.combat.enemies = enemies;
        st.combat.turn = 0;
        st.combat.playerTurn = true;
        st.combat.cardsPlayedThisTurn = 0;
        st.combat.cardsPlayedThisCombat = 0;
        st.combat.attacksPlayedThisTurn = 0;

        // Reset player combat state
        st.player.hand = [];
        st.player.discardPile = [];
        st.player.exhaustPile = [];
        st.player.block = 0;

        // Shuffle full deck into draw pile
        st.player.drawPile = st.player.deck.map(function (c) { return c; });
        STS.Game.shuffleArray(st.player.drawPile);

        // Initialize and choose initial intents for enemies
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i].turnsTaken === undefined) enemies[i].turnsTaken = 0;
            if (enemies[i].alive === undefined) enemies[i].alive = true;
            if (enemies[i].block === undefined) enemies[i].block = 0;
            if (!enemies[i].statusEffects) enemies[i].statusEffects = {};
            if (!enemies[i].moveHistory) enemies[i].moveHistory = [];
            _chooseNextIntent(enemies[i]);
        }

        STS.Game.changeScreen(SCREEN.COMBAT);

        // Trigger onCombatStart for relics
        STS.Game.triggerRelics('onCombatStart', {});
        STS.Events.emit('COMBAT_START', { enemies: enemies });

        STS.Game.log('Combat started!', 'combat');

        // Draw opening hand
        STS.Game.startPlayerTurn();
    },

    /**
     * Draw cards from the draw pile into the player's hand.
     * If the draw pile is empty, shuffle the discard pile into it.
     * Respects the hand size limit of 10.
     *
     * @param {number} count - Number of cards to draw.
     */
    drawCards: function (count) {
        var st = STS.Game.state;
        if (!st) return;

        // Check No Draw
        if (STS.Effects && STS.Effects.canDraw && !STS.Effects.canDraw(st.player)) {
            STS.Game.log('Cannot draw – No Draw is active.', 'combat');
            return;
        }

        for (var i = 0; i < count; i++) {
            if (st.player.hand.length >= HAND_SIZE_LIMIT) {
                STS.Game.log('Hand is full.', 'combat');
                break;
            }

            // Shuffle discard into draw if empty
            if (st.player.drawPile.length === 0) {
                if (st.player.discardPile.length === 0) {
                    STS.Game.log('No cards left to draw.', 'combat');
                    break;
                }
                st.player.drawPile = st.player.discardPile.slice();
                st.player.discardPile = [];
                STS.Game.shuffleArray(st.player.drawPile);
                STS.Game.log('Shuffled discard pile into draw pile.', 'combat');
            }

            var card = st.player.drawPile.pop();
            st.player.hand.push(card);

            STS.Events.emit('CARD_DRAWN', { card: card });
        }
    },

    /**
     * Attempt to play a card from the player's hand.
     *
     * Validates energy, targeting, and restrictions (Entangled, unplayable).
     * Applies card effects, triggers relic hooks, and moves the card to
     * discard or exhaust.
     *
     * @param {number} cardIndex   - Index into player.hand.
     * @param {number} targetIndex - Index into combat.enemies (for targeted cards).
     * @returns {boolean} true if the card was successfully played.
     */
    playCard: function (cardIndex, targetIndex) {
        var st = STS.Game.state;
        if (!st || st.screen !== SCREEN.COMBAT) return false;
        if (!st.combat.playerTurn) {
            STS.Game.log('Not your turn!', 'combat');
            return false;
        }

        var hand = st.player.hand;
        if (cardIndex < 0 || cardIndex >= hand.length) {
            STS.Game.log('Invalid card index.', 'error');
            return false;
        }

        var card = hand[cardIndex];

        // Unplayable check
        if (card.unplayable) {
            STS.Game.log('That card cannot be played.', 'combat');
            return false;
        }

        // Entangled check
        if (card.type === 'ATTACK' && STS.Effects && !STS.Effects.canPlayAttack(st.player)) {
            STS.Game.log('Cannot play Attacks – Entangled!', 'combat');
            return false;
        }

        // Energy check
        var cost = STS.Game.getCardCost(card);
        if (cost > st.player.energy && cost >= 0) {
            STS.Game.log('Not enough energy to play that card.', 'combat');
            return false;
        }

        // Target validation for single-target attacks
        var target = null;
        if (card.target === 'SINGLE_ENEMY' || card.target === 'SINGLE') {
            if (targetIndex === undefined || targetIndex === null) {
                // Auto-target first alive enemy
                for (var i = 0; i < st.combat.enemies.length; i++) {
                    if (st.combat.enemies[i].alive) { targetIndex = i; break; }
                }
            }
            if (targetIndex === undefined || targetIndex === null ||
                targetIndex < 0 || targetIndex >= st.combat.enemies.length ||
                !st.combat.enemies[targetIndex].alive) {
                STS.Game.log('Invalid target.', 'combat');
                return false;
            }
            target = st.combat.enemies[targetIndex];
        }

        // --- Spend energy ---
        if (cost >= 0) {
            st.player.energy -= cost;
        }

        // --- Remove card from hand ---
        hand.splice(cardIndex, 1);

        STS.Game.log('Played a card.', 'combat');

        // --- Apply card effects ---
        _applyCardEffects(card, target, targetIndex);

        // --- Track statistics ---
        st.combat.cardsPlayedThisTurn++;
        st.combat.cardsPlayedThisCombat++;
        if (card.type === 'ATTACK') {
            st.combat.attacksPlayedThisTurn++;
        }

        // --- Trigger effects system (Enrage, Hex) ---
        if (STS.Effects && STS.Effects.onCardPlayed) {
            STS.Effects.onCardPlayed(st.player, card);
        }

        // --- Trigger relics ---
        STS.Game.triggerRelics('onCardPlayed', { card: card, target: target });

        STS.Events.emit('CARD_PLAYED', {
            card: card,
            target: target,
            targetIndex: targetIndex
        });

        // --- Dispose of card ---
        if (card.exhaust) {
            st.player.exhaustPile.push(card);
            STS.Events.emit('CARD_EXHAUSTED', { card: card });
            STS.Game.log('A card was exhausted.', 'combat');
        } else {
            st.player.discardPile.push(card);
        }

        // --- Ethereal cards in hand exhaust at end of turn (handled elsewhere) ---

        // Check for enemy deaths
        _checkEnemyDeaths();

        return true;
    },

    /**
     * Return the effective energy cost of a card (base + modifier, floored at 0).
     * A cost of -1 means "X cost" or unplayable.
     *
     * @param {Object} card
     * @returns {number}
     */
    getCardCost: function (card) {
        if (card.energy < 0) return card.energy; // X or unplayable
        return Math.max(0, card.energy + (card.costModifier || 0));
    },

    /* ------------------------------------------------------------------
     *  TURN LIFECYCLE
     * ------------------------------------------------------------------ */

    /**
     * End the player's turn.
     *
     * 1. Trigger end-of-turn status effects (Metallicize, Constricted, …).
     * 2. Discard remaining hand (exhaust Ethereal cards).
     * 3. Trigger onTurnEnd relics.
     * 4. Begin enemy turn.
     */
    endPlayerTurn: function () {
        var st = STS.Game.state;
        if (!st || st.screen !== SCREEN.COMBAT) return;
        if (!st.combat.playerTurn) return;

        st.combat.playerTurn = false;

        // End-of-turn effects on player
        if (STS.Effects) {
            STS.Effects.tick(st.player, 'TURN_END');
        }

        // Discard hand (ethereal cards exhaust)
        var hand = st.player.hand.slice();
        st.player.hand = [];
        for (var i = 0; i < hand.length; i++) {
            if (hand[i].ethereal) {
                st.player.exhaustPile.push(hand[i]);
                STS.Events.emit('CARD_EXHAUSTED', { card: hand[i] });
            } else {
                st.player.discardPile.push(hand[i]);
            }
        }

        STS.Game.triggerRelics('onTurnEnd', {});
        STS.Events.emit('TURN_END', { turn: st.combat.turn });

        STS.Game.log('Turn ' + st.combat.turn + ' ended.', 'combat');

        // Enemy turn
        STS.Game.enemyTurn();
    },

    /**
     * Start a new player turn.
     *
     * 1. Increment turn counter.
     * 2. Refill energy.
     * 3. Remove block (unless Barricade).
     * 4. Tick start-of-turn effects.
     * 5. Draw cards.
     * 6. Trigger onTurnStart relics.
     */
    startPlayerTurn: function () {
        var st = STS.Game.state;
        if (!st || st.screen !== SCREEN.COMBAT) return;

        st.combat.turn++;
        st.combat.playerTurn = true;
        st.combat.cardsPlayedThisTurn = 0;
        st.combat.attacksPlayedThisTurn = 0;

        // Refill energy
        st.player.energy = st.player.maxEnergy;

        // Remove block unless Barricade
        if (!STS.Effects || !STS.Effects.hasEffect(st.player, 'BARRICADE')) {
            st.player.block = 0;
        }

        // Start-of-turn effects
        if (STS.Effects) {
            STS.Effects.tick(st.player, 'TURN_START');
        }

        // Check if player died from poison etc.
        if (st.player.hp <= 0) {
            STS.Game.combatLost();
            return;
        }

        // Draw cards
        STS.Game.drawCards(CARDS_DRAWN_PER_TURN);

        STS.Game.triggerRelics('onTurnStart', { turn: st.combat.turn });
        STS.Events.emit('TURN_START', { turn: st.combat.turn });

        STS.Game.log('Turn ' + st.combat.turn + ' started.', 'combat');
    },

    /* ------------------------------------------------------------------
     *  ENEMY TURN
     * ------------------------------------------------------------------ */

    /**
     * Process each living enemy's current intent, then pick their next one.
     */
    enemyTurn: function () {
        var st = STS.Game.state;
        if (!st || st.screen !== SCREEN.COMBAT) return;

        var enemies = st.combat.enemies;
        for (var i = 0; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (!enemy.alive) continue;

            // Remove enemy block
            if (!STS.Effects || !STS.Effects.hasEffect(enemy, 'BARRICADE')) {
                enemy.block = 0;
            }

            // Start-of-turn effects on enemy
            if (STS.Effects) {
                STS.Effects.tick(enemy, 'TURN_START');
            }

            if (enemy.hp <= 0) {
                enemy.alive = false;
                STS.Game.enemyDied(i);
                continue;
            }

            // Execute intent
            _executeEnemyIntent(enemy, i);

            // End-of-turn effects on enemy
            if (STS.Effects) {
                STS.Effects.tick(enemy, 'TURN_END');
            }

            if (enemy.hp <= 0) {
                enemy.alive = false;
                STS.Game.enemyDied(i);
                continue;
            }

            enemy.turnsTaken++;
            _chooseNextIntent(enemy);
        }

        // Check player death
        if (st.player.hp <= 0) {
            STS.Game.combatLost();
            return;
        }

        // Check combat won
        if (_allEnemiesDead()) {
            STS.Game.combatWon();
            return;
        }

        // Start next player turn
        STS.Game.startPlayerTurn();
    },

    /* ------------------------------------------------------------------
     *  DAMAGE & BLOCK
     * ------------------------------------------------------------------ */

    /**
     * Deal damage from a source to a target, applying all modifiers.
     *
     * - Add Strength (for attacks from entities).
     * - Apply Weakness on attacker (×0.75).
     * - Apply Vigor on attacker (add, then consume).
     * - Apply Vulnerable on target (×1.5).
     * - Apply Intangible on target (cap at 1).
     * - Subtract block first; remainder goes to HP.
     * - Floor the final damage at 0.
     *
     * @param {Object|null} source - Attacker (player / enemy). null for effect damage.
     * @param {Object}      target - Defender.
     * @param {number}      amount - Base damage.
     * @param {number}      [times=1] - Number of hits (multi-strike).
     * @param {Object}      [opts={}] - { poison, constrict, thorns } flags.
     * @returns {number} Total actual damage dealt to HP.
     */
    dealDamage: function (source, target, amount, times, opts) {
        var st = STS.Game.state;
        if (source === 'player') source = st.player;
        if (target === 'player') target = st.player;
        if (typeof target === 'number' && st.combat.enemies[target]) target = st.combat.enemies[target];
        if (!target) return 0;
        times = times || 1;
        opts = opts || {};

        var totalHpDamage = 0;

        for (var hit = 0; hit < times; hit++) {
            var dmg = amount;

            // --- Source modifiers (only for non-effect damage) ---
            if (source && !opts.poison && !opts.constrict && !opts.thorns) {
                var srcMod = STS.Effects
                    ? STS.Effects.getModifier(source, 'DAMAGE_DEALT')
                    : { flat: 0, multiplier: 1, consumed: [] };
                dmg = (dmg + srcMod.flat) * srcMod.multiplier;

                // Consume effects like Vigor
                if (srcMod.consumed && srcMod.consumed.length && STS.Effects) {
                    for (var c = 0; c < srcMod.consumed.length; c++) {
                        STS.Effects.remove(source, srcMod.consumed[c]);
                    }
                }
            }

            // --- Target modifiers ---
            if (!opts.poison && !opts.constrict) {
                var tgtMod = STS.Effects
                    ? STS.Effects.getModifier(target, 'DAMAGE_TAKEN')
                    : { flat: 0, multiplier: 1 };
                dmg = dmg * tgtMod.multiplier;

                // Intangible cap
                if (tgtMod.intangible) {
                    dmg = 1;
                }
            }

            dmg = Math.floor(dmg);
            if (dmg < 0) dmg = 0;

            // --- Apply to block then HP ---
            var blocked = 0;
            var hpLoss = dmg;

            if (!opts.poison) {
                // Poison bypasses block
                if (target.block > 0) {
                    blocked = Math.min(target.block, dmg);
                    target.block -= blocked;
                    hpLoss = dmg - blocked;
                }
            }

            if (hpLoss > 0) {
                target.hp = Math.max(0, target.hp - hpLoss);
                totalHpDamage += hpLoss;
            }

            // --- Trigger onDamageTaken effects ---
            if (STS.Effects && STS.Effects.onDamageTaken && !opts.thorns) {
                STS.Effects.onDamageTaken(source, target, dmg, hpLoss);
            }

            // --- Trigger relics ---
            if (source) {
                STS.Game.triggerRelics('onDamageDealt', {
                    source: source,
                    target: target,
                    damage: dmg,
                    hpDamage: hpLoss
                });
            }
            STS.Game.triggerRelics('onDamageTaken', {
                source: source,
                target: target,
                damage: dmg,
                hpDamage: hpLoss
            });

            var eventName = _isPlayer(source) ? 'DAMAGE_DEALT' : 'DAMAGE_TAKEN';
            STS.Events.emit(eventName, {
                source: source,
                target: target,
                damage: dmg,
                hpDamage: hpLoss,
                blocked: blocked
            });
        }

        return totalHpDamage;
    },

    /**
     * Add block to a target, applying Dexterity and Frail modifiers.
     *
     * @param {Object} target
     * @param {number} amount - Base block value.
     * @returns {number} Actual block gained.
     */
    gainBlock: function (target, amount) {
        if (target === 'player') target = STS.Game.state.player;
        if (typeof target === 'number' && STS.Game.state.combat.enemies[target]) target = STS.Game.state.combat.enemies[target];
        if (!target) return 0;

        var mod = STS.Effects
            ? STS.Effects.getModifier(target, 'BLOCK_GAINED')
            : { flat: 0, multiplier: 1 };

        var total = Math.floor((amount + mod.flat) * mod.multiplier);
        if (total < 0) total = 0;

        target.block = (target.block || 0) + total;

        STS.Game.triggerRelics('onBlockGained', { target: target, amount: total });
        STS.Events.emit('BLOCK_GAINED', { target: target, amount: total });

        return total;
    },

    /* ------------------------------------------------------------------
     *  HP, GOLD & RESOURCE MANAGEMENT
     * ------------------------------------------------------------------ */

    /**
     * Heal the player, capped at maxHp.
     *
     * @param {number} amount
     * @returns {number} Actual amount healed.
     */
    healPlayer: function (amount) {
        var st = STS.Game.state;
        if (!st) return 0;
        var before = st.player.hp;
        st.player.hp = Math.min(st.player.hp + amount, st.player.maxHp);
        var healed = st.player.hp - before;

        if (healed > 0) {
            STS.Game.triggerRelics('onHeal', { amount: healed });
            STS.Events.emit('HEAL', { amount: healed, current: st.player.hp });
            STS.Game.log('Healed ' + healed + ' HP. (' + st.player.hp + '/' + st.player.maxHp + ')', 'heal');
        }
        return healed;
    },

    /**
     * Add gold to the player.
     *
     * @param {number} amount
     */
    addGold: function (amount) {
        var st = STS.Game.state;
        if (!st || amount <= 0) return;
        st.player.gold += amount;
        st.run.goldEarned += amount;
        STS.Game.triggerRelics('onGoldChanged', { amount: amount });
        STS.Events.emit('GOLD_CHANGED', { delta: amount, total: st.player.gold });
        STS.Game.log('Gained ' + amount + ' gold. Total: ' + st.player.gold, 'gold');
    },

    /**
     * Remove gold from the player.
     *
     * @param {number} amount
     * @returns {boolean} false if insufficient gold.
     */
    removeGold: function (amount) {
        var st = STS.Game.state;
        if (!st) return false;
        if (st.player.gold < amount) return false;
        st.player.gold -= amount;
        STS.Events.emit('GOLD_CHANGED', { delta: -amount, total: st.player.gold });
        STS.Game.log('Spent ' + amount + ' gold. Total: ' + st.player.gold, 'gold');
        return true;
    },

    /* ------------------------------------------------------------------
     *  DECK MANAGEMENT
     * ------------------------------------------------------------------ */

    /**
     * Add a card to the player's master deck.
     *
     * @param {Object} card - Card instance.
     */
    addCardToDeck: function (card) {
        var st = STS.Game.state;
        if (!st) return;
        st.player.deck.push(card);
        STS.Game.log('Added ' + card.name + ' to deck.', 'deck');
    },

    /**
     * Remove a card from the deck by index.
     *
     * @param {number} cardIndex
     * @returns {Object|null} The removed card, or null.
     */
    removeCardFromDeck: function (cardIndex) {
        var st = STS.Game.state;
        if (!st) return null;
        if (cardIndex < 0 || cardIndex >= st.player.deck.length) return null;
        var removed = st.player.deck.splice(cardIndex, 1)[0];
        STS.Game.log('Removed ' + removed.name + ' from deck.', 'deck');
        return removed;
    },

    /**
     * Upgrade a card in place by calling its upgrade() method.
     *
     * @param {Object} card
     * @returns {boolean} true if upgraded successfully.
     */
    upgradeCard: function (card) {
        if (!card || card.upgraded) return false;
        if (typeof card.upgrade === 'function') {
            card.upgrade();
            STS.Game.log('Upgraded ' + card.name + '.', 'deck');
            return true;
        }
        return false;
    },

    /* ------------------------------------------------------------------
     *  RELICS
     * ------------------------------------------------------------------ */

    /**
     * Add a relic to the player's collection and trigger its onPickup.
     *
     * @param {Object} relic
     */
    addRelic: function (relic) {
        var st = STS.Game.state;
        if (!st) return;

        // Prevent duplicates
        for (var i = 0; i < st.player.relics.length; i++) {
            if (st.player.relics[i].id === relic.id) {
                STS.Game.log('Already own ' + relic.name + '.', 'relic');
                return;
            }
        }

        st.player.relics.push(relic);

        if (typeof relic.onPickup === 'function') {
            relic.onPickup();
        }

        STS.Events.emit('RELIC_OBTAINED', { relic: relic });
        STS.Game.log('Obtained relic: ' + relic.name, 'relic');
    },

    /**
     * Iterate over all relics and call the named handler if it exists.
     *
     * @param {string} event  - Handler name (e.g. 'onTurnStart').
     * @param {Object} data   - Data payload to pass.
     */
    triggerRelics: function (event, data) {
        var st = STS.Game.state;
        if (!st) return;

        for (var i = 0; i < st.player.relics.length; i++) {
            var relic = st.player.relics[i];
            if (typeof relic[event] === 'function') {
                try {
                    relic[event](data);
                } catch (err) {
                    console.error('[Relic] Error in ' + relic.name + '.' + event + ':', err);
                }
            }
        }
    },

    /* ------------------------------------------------------------------
     *  POTIONS
     * ------------------------------------------------------------------ */

    /**
     * Add a potion to the first empty slot.
     *
     * @param {Object} potion
     * @returns {boolean} true if added, false if all slots full.
     */
    addPotion: function (potion) {
        var st = STS.Game.state;
        if (!st) return false;

        for (var i = 0; i < st.player.potions.length; i++) {
            if (st.player.potions[i] === null) {
                st.player.potions[i] = potion;
                STS.Game.log('Obtained potion: ' + potion.name, 'potion');
                return true;
            }
        }

        STS.Game.log('No potion slots available.', 'potion');
        return false;
    },

    /**
     * Use a potion from a slot, optionally targeting an enemy.
     *
     * @param {number} slotIndex
     * @param {number} [targetIndex] - Enemy index for targeted potions.
     * @returns {boolean}
     */
    usePotion: function (slotIndex, targetIndex) {
        var st = STS.Game.state;
        if (!st) return false;

        if (slotIndex < 0 || slotIndex >= st.player.potions.length) return false;
        var potion = st.player.potions[slotIndex];
        if (!potion) {
            STS.Game.log('No potion in that slot.', 'potion');
            return false;
        }

        var target = null;
        if (targetIndex !== undefined && targetIndex !== null && st.combat.enemies[targetIndex]) {
            target = st.combat.enemies[targetIndex];
        }

        // Apply potion effect
        if (typeof potion.use === 'function') {
            potion.use(target);
        } else {
            STS.Game.log(potion.name + ' has no use() handler.', 'error');
        }

        st.player.potions[slotIndex] = null;

        STS.Events.emit('POTION_USED', { potion: potion, target: target });
        STS.Game.log('Used potion: ' + potion.name, 'potion');
        return true;
    },

    /* ------------------------------------------------------------------
     *  STATUS EFFECTS  (delegate to STS.Effects)
     * ------------------------------------------------------------------ */

    /**
     * Apply a status effect to a target.  Delegates to STS.Effects.apply
     * and checks for Artifact negation.
     *
     * @param {Object} target
     * @param {string} effectId
     * @param {number} amount
     * @returns {boolean}
     */
    addStatusEffect: function (target, effectId, amount) {
        if (target === 'player') target = STS.Game.state.player;
        if (typeof target === 'number' && STS.Game.state.combat.enemies[target]) target = STS.Game.state.combat.enemies[target];
        if (!STS.Effects) {
            console.warn('[Game] Effects module not loaded.');
            return false;
        }
        return STS.Effects.apply(target, effectId, amount, '');
    },

    /**
     * Remove a status effect from a target.
     *
     * @param {Object} target
     * @param {string} effectId
     */
    removeStatusEffect: function (target, effectId) {
        if (!STS.Effects) return;
        STS.Effects.remove(target, effectId);
    },

    /**
     * Tick status effects on a target for a given timing.
     *
     * @param {Object} target
     * @param {'TURN_START'|'TURN_END'} timing
     */
    tickStatusEffects: function (target, timing) {
        if (!STS.Effects) return;
        STS.Effects.tick(target, timing);
    },

    /* ------------------------------------------------------------------
     *  COMBAT RESOLUTION
     * ------------------------------------------------------------------ */

    /**
     * Handle an enemy dying.
     *
     * @param {number} enemyIndex
     */
    enemyDied: function (enemyIndex) {
        var st = STS.Game.state;
        if (!st) return;

        var enemy = st.combat.enemies[enemyIndex];
        if (!enemy) return;

        enemy.alive = false;
        enemy.hp = 0;

        st.run.monstersKilled++;
        if (enemy.type === 'ELITE') st.run.elitesKilled++;
        if (enemy.type === 'BOSS') st.run.bossesKilled++;

        STS.Events.emit('ENEMY_DIED', { enemy: enemy, index: enemyIndex });
        STS.Game.log(enemy.name + ' defeated!', 'combat');

        if (_allEnemiesDead()) {
            STS.Game.combatWon();
        }
    },

    /**
     * Combat victory.
     * Shows the reward screen and triggers onCombatEnd relics.
     */
    combatWon: function () {
        var st = STS.Game.state;
        if (!st) return;

        STS.Game.log('Combat won!', 'combat');

        // Clear player combat status effects
        if (STS.Effects) {
            STS.Effects.clearAll(st.player);
        }

        STS.Game.triggerRelics('onCombatEnd', {});
        STS.Events.emit('COMBAT_END', { won: true });

        // Determine reward type based on encounter
        var node = _getCurrentNode();
        var rewardType = 'NORMAL';
        if (node) {
            if (node.type === 'ELITE') rewardType = 'ELITE';
            if (node.type === 'BOSS') rewardType = 'BOSS';
        }

        STS.Game.generateRewards(rewardType);
        STS.Game.changeScreen(SCREEN.REWARD);
    },

    /**
     * Player has been defeated – show game over screen.
     */
    combatLost: function () {
        var st = STS.Game.state;
        if (!st) return;

        STS.Game.log('You were defeated...', 'combat');

        if (STS.Effects) {
            STS.Effects.clearAll(st.player);
        }

        STS.Game.triggerRelics('onCombatEnd', {});
        STS.Events.emit('COMBAT_END', { won: false });
        STS.Events.emit('PLAYER_DIED', {});

        st.run.score = _calculateScore();
        STS.Game.changeScreen(SCREEN.GAME_OVER);
    },

    /* ------------------------------------------------------------------
     *  REWARDS
     * ------------------------------------------------------------------ */

    /**
     * Generate rewards after a combat encounter.
     *
     * @param {'NORMAL'|'ELITE'|'BOSS'} type
     */
    generateRewards: function (type) {
        var st = STS.Game.state;
        if (!st) return;

        var rewards = [];

        // Gold reward
        var goldBase = type === 'BOSS' ? 100 : (type === 'ELITE' ? 30 : 15);
        var goldAmount = goldBase + STS.RNG.nextInt(0, 10);
        rewards.push({ type: 'GOLD', amount: goldAmount });

        // Card rewards (pick from 3)
        var cardChoices = _generateCardChoices(3);
        if (cardChoices.length > 0) {
            rewards.push({ type: 'CARD_CHOICE', cards: cardChoices });
        }

        // Potion reward (30% chance)
        if (STS.RNG.next() < 0.3) {
            var potion = _generatePotion();
            if (potion) {
                rewards.push({ type: 'POTION', potion: potion });
            }
        }

        // Relic reward for elites and bosses
        if (type === 'ELITE' || type === 'BOSS') {
            var relic = _generateRelic(type);
            if (relic) {
                rewards.push({ type: 'RELIC', relic: relic });
            }
        }

        st.rewards = rewards;
        STS.Game.log('Rewards generated: ' + rewards.length + ' items.', 'reward');
    },

    /* ------------------------------------------------------------------
     *  MAP NAVIGATION
     * ------------------------------------------------------------------ */

    /**
     * Move to the next map node and start the appropriate encounter.
     *
     * @param {number} nodeId
     * @returns {boolean}
     */
    advanceToNode: function (nodeId) {
        var st = STS.Game.state;
        if (!st) return false;

        var node = _findNode(nodeId);
        if (!node) {
            STS.Game.log('Invalid node.', 'error');
            return false;
        }

        // Validate reachability via paths
        if (st.map.currentNodeId !== null) {
            var reachable = false;
            for (var i = 0; i < st.map.paths.length; i++) {
                if (st.map.paths[i].from === st.map.currentNodeId &&
                    st.map.paths[i].to === nodeId) {
                    reachable = true;
                    break;
                }
            }
            if (!reachable) {
                STS.Game.log('Node is not reachable from current position.', 'error');
                return false;
            }
        } else {
            // First move – must be on floor 0
            if (node.floor !== 0) {
                STS.Game.log('Must start on floor 0.', 'error');
                return false;
            }
        }

        // Mark visited
        node.visited = true;
        st.map.currentNodeId = nodeId;
        st.map.currentFloor = node.floor;
        st.map.visitedNodes.push(nodeId);
        st.run.floorsClimbed++;

        // Update availability
        _updateNodeAvailability();

        STS.Game.log('Advanced to floor ' + node.floor + ' – ' + node.type, 'map');

        // Start encounter based on node type
        switch (node.type) {
            case 'MONSTER':
            case 'ELITE':
            case 'BOSS':
                var enemies = selectEncounter(node.type, st.map.currentAct);
                STS.Game.startCombat(enemies);
                break;

            case 'REST':
                STS.Game.changeScreen(SCREEN.REST);
                break;

            case 'SHOP':
                STS.Game._generateShop();
                STS.Game.changeScreen(SCREEN.SHOP);
                break;

            case 'EVENT':
                STS.Game._generateEvent();
                STS.Game.changeScreen(SCREEN.EVENT);
                break;

            case 'TREASURE':
                STS.Game.generateRewards('ELITE');
                STS.Game.changeScreen(SCREEN.REWARD);
                break;

            default:
                STS.Game.changeScreen(SCREEN.MAP);
        }

        return true;
    },

    /**
     * Advance to the next act after defeating a boss.
     */
    advanceAct: function () {
        var st = STS.Game.state;
        if (!st) return;

        if (st.map.currentAct >= ACTS_TOTAL) {
            // Victory!
            st.run.score = _calculateScore();
            STS.Game.changeScreen(SCREEN.VICTORY);
            STS.Game.log('Victory! All acts completed!', 'system');
            return;
        }

        st.map.currentAct++;
        st.map.currentFloor = 0;
        st.map.currentNodeId = null;
        st.map.visitedNodes = [];

        var map = generateMap(st.map.currentAct);
        st.map.nodes = map.nodes;
        st.map.paths = map.paths;

        STS.Game.changeScreen(SCREEN.MAP);
        STS.Game.log('Advanced to Act ' + st.map.currentAct + '.', 'system');
    },

    /* ------------------------------------------------------------------
     *  REST SITE
     * ------------------------------------------------------------------ */

    /**
     * Rest at a campfire – heal 30% of max HP.
     */
    rest: function () {
        var st = STS.Game.state;
        if (!st) return;
        var healAmount = Math.floor(st.player.maxHp * 0.3);
        STS.Game.healPlayer(healAmount);
        STS.Game.log('Rested and healed ' + healAmount + ' HP.', 'rest');
        STS.Game.changeScreen(SCREEN.MAP);
    },

    /**
     * Smith at a campfire – upgrade a card.
     *
     * @param {number} cardIndex - Index in the player's deck.
     */
    smith: function (cardIndex) {
        var st = STS.Game.state;
        if (!st) return;
        if (cardIndex < 0 || cardIndex >= st.player.deck.length) return;
        STS.Game.upgradeCard(st.player.deck[cardIndex]);
        STS.Game.changeScreen(SCREEN.MAP);
    },

    /* ------------------------------------------------------------------
     *  SHOP
     * ------------------------------------------------------------------ */

    /**
     * Generate shop inventory.
     * @private
     */
    _generateShop: function () {
        var st = STS.Game.state;
        if (!st) return;

        var cards = _generateCardChoices(5);
        var potions = [];
        for (var i = 0; i < 3; i++) {
            var p = _generatePotion();
            if (p) potions.push(p);
        }

        st.shopData = {
            cards: cards.map(function (c) {
                return { card: c, price: _cardPrice(c), sold: false };
            }),
            potions: potions.map(function (p) {
                return { potion: p, price: STS.RNG.nextInt(40, 75), sold: false };
            }),
            relics: [],
            cardRemovePrice: 75 + ((st.cardRemovesUsed || 0) * 25) + (st.run.floorsClimbed * 2)
        };

        if (typeof STS.Shop !== 'undefined' && STS.Shop) {
            STS.Shop.currentShop = st.shopData;
        }

        STS.Game.log('Shop generated.', 'shop');
    },

    /**
     * Buy a card from the shop.
     *
     * @param {number} index - Shop card index.
     * @returns {boolean}
     */
    buyCard: function (index) {
        var st = STS.Game.state;
        if (!st || !st.shopData) return false;
        var item = st.shopData.cards[index];
        if (!item || item.sold) return false;
        if (!STS.Game.removeGold(item.price)) {
            STS.Game.log('Not enough gold.', 'shop');
            return false;
        }
        STS.Game.addCardToDeck(item.card);
        item.sold = true;
        return true;
    },

    /**
     * Buy a potion from the shop.
     *
     * @param {number} index
     * @returns {boolean}
     */
    buyPotion: function (index) {
        var st = STS.Game.state;
        if (!st || !st.shopData) return false;
        var item = st.shopData.potions[index];
        if (!item || item.sold) return false;
        if (!STS.Game.removeGold(item.price)) return false;
        STS.Game.addPotion(item.potion);
        item.sold = true;
        return true;
    },

    /**
     * Pay to remove a card from the deck at the shop.
     *
     * @param {number} cardIndex - Index in the player's deck.
     * @returns {boolean}
     */
    shopRemoveCard: function (cardIndex) {
        var st = STS.Game.state;
        if (!st || !st.shopData) return false;
        if (!Array.isArray(st.player.deck) || cardIndex < 0 || cardIndex >= st.player.deck.length) {
            return false;
        }
        var price = st.shopData.cardRemovePrice;
        if (!STS.Game.removeGold(price)) return false;
        var removed = STS.Game.removeCardFromDeck(cardIndex);
        if (!removed) {
            st.player.gold += price;
            STS.Events.emit('GOLD_CHANGED', { delta: price, total: st.player.gold });
            return false;
        }
        if (typeof st.cardRemovesUsed !== 'number') st.cardRemovesUsed = 0;
        st.cardRemovesUsed++;
        st.shopData.cardRemovePrice = 75 + (st.cardRemovesUsed * 25) + (st.run.floorsClimbed * 2);
        return true;
    },

    /* ------------------------------------------------------------------
     *  EVENTS
     * ------------------------------------------------------------------ */

    /**
     * Generate a random event.
     * @private
     */
    _generateEvent: function () {
        var st = STS.Game.state;
        if (!st) return;

        var events = [
            {
                id: 'BIG_FISH',
                name: 'Big Fish',
                description: 'A giant fish blocks your path.',
                imagePrompt: 'A colossal ancient fish blocking a narrow stone path in a dark Spire, bioluminescent eyes, wet scales, misty cavern, fantasy roguelike game illustration, dramatic lighting, detailed digital painting',
                choices: [
                    { text: 'Eat the fish. (Heal 5 HP)', effect: function () { STS.Game.healPlayer(5); } },
                    { text: 'Feed the fish. (Lose 5 Gold, gain Max HP)', effect: function () { STS.Game.removeGold(5); st.player.maxHp += 5; st.player.hp += 5; } },
                    { text: 'Ignore it.', effect: function () { } }
                ]
            },
            {
                id: 'GOLDEN_IDOL',
                name: 'Golden Idol',
                description: 'You see a golden idol on a pedestal.',
                imagePrompt: 'A cursed golden idol on a weathered stone pedestal in a dim temple, warm glow, dust motes, temptation and danger, dark fantasy roguelike art, cinematic, highly detailed',
                choices: [
                    { text: 'Take the idol. (Gain 200 Gold, lose 25% HP)', effect: function () { STS.Game.addGold(200); var dmg = Math.floor(st.player.maxHp * 0.25); st.player.hp = Math.max(1, st.player.hp - dmg); } },
                    { text: 'Leave it alone.', effect: function () { } }
                ]
            },
            {
                id: 'SCRAP_OOZE',
                name: 'Scrap Ooze',
                description: 'A pile of scrap metal coated in slime.',
                imagePrompt: 'A heap of rusted scrap metal and gears coated in viscous green slime, industrial dungeon, subtle steam, dark fantasy roguelike scene, moody lighting, detailed illustration',
                choices: [
                    { text: 'Dig through it. (Lose 3 HP, 50% chance of relic)', effect: function () {
                        st.player.hp = Math.max(1, st.player.hp - 3);
                        if (STS.RNG.next() < 0.5) {
                            var r = _generateRelic('NORMAL');
                            if (r) STS.Game.addRelic(r);
                        }
                    }},
                    { text: 'Walk away.', effect: function () { } }
                ]
            },
            {
                id: 'LIVING_WALL',
                name: 'Living Wall',
                description: 'A wall of flesh blocks your way. It offers a deal.',
                imagePrompt: 'A grotesque living wall of flesh and sinew in a Spire corridor, pulsing veins, half-open eye-like shapes, eerie offer, body horror light touch, dark fantasy roguelike, dramatic shadows',
                choices: [
                    { text: 'Forget. (Remove a card)', effect: function () {
                        if (st.player.deck.length > 0) {
                            var idx = STS.RNG.nextInt(0, st.player.deck.length - 1);
                            STS.Game.removeCardFromDeck(idx);
                        }
                    }},
                    { text: 'Grow. (Upgrade a random card)', effect: function () {
                        var upgradeable = [];
                        for (var i = 0; i < st.player.deck.length; i++) {
                            if (!st.player.deck[i].upgraded) upgradeable.push(i);
                        }
                        if (upgradeable.length > 0) {
                            var pick = STS.RNG.pick(upgradeable);
                            STS.Game.upgradeCard(st.player.deck[pick]);
                        }
                    }},
                    { text: 'Change. (Transform a random card)', effect: function () { } }
                ]
            },
            {
                id: 'BONFIRE_SPIRITS',
                name: 'Bonfire Spirits',
                description: 'Spirits dance around a bonfire and beckon you.',
                imagePrompt: 'Ethereal blue and white spirits dancing around a crackling bonfire in a dark stone chamber, embers, mysterious beckoning, dark fantasy roguelike rest event, warm and cold contrast, painterly detail',
                choices: [
                    { text: 'Offer a card. (Remove a card, heal to full)', effect: function () {
                        if (st.player.deck.length > 0) {
                            var idx = STS.RNG.nextInt(0, st.player.deck.length - 1);
                            STS.Game.removeCardFromDeck(idx);
                        }
                        STS.Game.healPlayer(st.player.maxHp);
                    }},
                    { text: 'Leave.', effect: function () { } }
                ]
            }
        ];

        st.eventData = STS.RNG.pick(events);
        STS.Game.log('Event: ' + st.eventData.name, 'event');
    },

    /**
     * Choose an option in the current event.
     *
     * @param {number} choiceIndex
     */
    chooseEventOption: function (choiceIndex) {
        var st = STS.Game.state;
        if (!st || !st.eventData) return;

        var choice = st.eventData.choices[choiceIndex];
        if (!choice) return;

        if (typeof choice.effect === 'function') {
            choice.effect();
        }

        STS.Game.log('Chose: ' + choice.text, 'event');
        st.eventData = null;
        STS.Game.changeScreen(SCREEN.MAP);
    },

    /* ------------------------------------------------------------------
     *  CARD DESCRIPTION
     * ------------------------------------------------------------------ */

    /**
     * Generate a dynamic card description accounting for Strength, Dexterity,
     * and other modifiers.
     *
     * @param {Object} card
     * @returns {string}
     */
    getCardDescription: function (card) {
        var st = STS.Game.state;
        if (!st) return card.description || '';

        var desc = card.description || '';

        // Calculate effective damage
        if (card.damage && card.damage > 0) {
            var str = STS.Effects ? STS.Effects.getAmount(st.player, 'STRENGTH') : 0;
            var vigor = STS.Effects ? STS.Effects.getAmount(st.player, 'VIGOR') : 0;
            var effectiveDmg = card.damage + str + vigor;

            var multiplier = 1;
            if (STS.Effects && STS.Effects.hasEffect(st.player, 'WEAKNESS')) {
                multiplier *= 0.75;
            }
            effectiveDmg = Math.floor(effectiveDmg * multiplier);
            if (effectiveDmg < 0) effectiveDmg = 0;

            desc = desc.replace(/Deal \d+ damage/i, 'Deal ' + effectiveDmg + ' damage');
        }

        // Calculate effective block
        if (card.block && card.block > 0) {
            var dex = STS.Effects ? STS.Effects.getAmount(st.player, 'DEXTERITY') : 0;
            var effectiveBlock = card.block + dex;

            var blockMult = 1;
            if (STS.Effects && STS.Effects.hasEffect(st.player, 'FRAIL')) {
                blockMult *= 0.75;
            }
            effectiveBlock = Math.floor(effectiveBlock * blockMult);
            if (effectiveBlock < 0) effectiveBlock = 0;

            desc = desc.replace(/Gain \d+ Block/i, 'Gain ' + effectiveBlock + ' Block');
        }

        return desc;
    },

    /* ------------------------------------------------------------------
     *  UTILITY
     * ------------------------------------------------------------------ */

    /**
     * Fisher–Yates shuffle using the seeded PRNG.
     *
     * @param {Array} arr - Mutated in place.
     * @returns {Array}
     */
    shuffleArray: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(STS.RNG.next() * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    },

    /**
     * Convenience wrapper for a seeded random float in [0, 1).
     * @returns {number}
     */
    seededRandom: function () {
        return STS.RNG.next();
    },

    /**
     * Append a message to the combat log.
     *
     * @param {string} message
     * @param {string} [type='info'] - Category: system, combat, effect, relic, etc.
     */
    log: function (message, type) {
        if (STS.Game.state) {
            STS.Game.state.log.push({
                message: message,
                type: type || 'info',
                timestamp: Date.now()
            });
            // Keep log from growing unbounded
            if (STS.Game.state.log.length > 500) {
                STS.Game.state.log = STS.Game.state.log.slice(-300);
            }
        }
        console.log('[STS.' + (type || 'info') + '] ' + message);
    },

    /* ------------------------------------------------------------------
     *  SETTINGS PERSISTENCE
     * ------------------------------------------------------------------ */

    /**
     * Save current settings to localStorage.
     */
    saveSettings: function () {
        try {
            var settings = STS.Game.state ? STS.Game.state.settings : {
                musicVolume: 0.5,
                sfxVolume: 0.7,
                screenShake: true,
                fastMode: false,
                showDamageNumbers: true
            };
            localStorage.setItem('sts_settings', JSON.stringify(settings));
        } catch (e) {
            console.warn('[Settings] Could not save to localStorage:', e);
        }
    },

    /**
     * Load settings from localStorage, merging with defaults.
     */
    loadSettings: function () {
        var defaults = {
            musicVolume: 0.5,
            sfxVolume: 0.7,
            screenShake: true,
            fastMode: false,
            showDamageNumbers: true
        };

        try {
            var raw = localStorage.getItem('sts_settings');
            if (raw) {
                var saved = JSON.parse(raw);
                for (var key in defaults) {
                    if (defaults.hasOwnProperty(key) && saved[key] !== undefined) {
                        defaults[key] = saved[key];
                    }
                }
            }
        } catch (e) {
            console.warn('[Settings] Could not load from localStorage:', e);
        }

        if (STS.Game.state) {
            STS.Game.state.settings = defaults;
        } else {
            // Store temporarily until state is created
            STS.Game._pendingSettings = defaults;
        }
    },

    /**
     * Update a single setting and persist.
     *
     * @param {string} key
     * @param {*}      value
     */
    setSetting: function (key, value) {
        if (STS.Game.state && STS.Game.state.settings) {
            STS.Game.state.settings[key] = value;
            STS.Game.saveSettings();
        }
    },

    /* ------------------------------------------------------------------
     *  REWARD CLAIMING
     * ------------------------------------------------------------------ */

    /**
     * Claim a reward by index and proceed.
     *
     * @param {number} rewardIndex
     * @param {*}      [choice] - For CARD_CHOICE, the index of the chosen card.
     * @returns {boolean}
     */
    claimReward: function (rewardIndex, choice) {
        var st = STS.Game.state;
        if (!st) return false;

        var reward = st.rewards[rewardIndex];
        if (!reward) return false;

        switch (reward.type) {
            case 'GOLD':
                STS.Game.addGold(reward.amount);
                break;

            case 'CARD_CHOICE':
                if (choice !== undefined && reward.cards[choice]) {
                    STS.Game.addCardToDeck(reward.cards[choice]);
                }
                break;

            case 'POTION':
                STS.Game.addPotion(reward.potion);
                break;

            case 'RELIC':
                STS.Game.addRelic(reward.relic);
                break;
        }

        // Remove claimed reward
        st.rewards.splice(rewardIndex, 1);

        // If no rewards left, check for boss advancement or return to map
        if (st.rewards.length === 0) {
            STS.Game.proceedFromRewards();
        }

        return true;
    },

    /**
     * Skip remaining rewards and proceed.
     */
    skipRewards: function () {
        var st = STS.Game.state;
        if (!st) return;
        st.rewards = [];
        STS.Game.proceedFromRewards();
    },

    /**
     * After rewards are done, advance the game.
     */
    proceedFromRewards: function () {
        var st = STS.Game.state;
        if (!st) return;

        var node = _getCurrentNode();
        if (node && node.type === 'BOSS') {
            STS.Game.advanceAct();
        } else {
            STS.Game.changeScreen(SCREEN.MAP);
        }
    },

    /* ------------------------------------------------------------------
     *  DECK VIEWING
     * ------------------------------------------------------------------ */

    /**
     * Open the deck viewer.
     */
    openDeckView: function () {
        STS.Game.changeScreen(SCREEN.DECK_VIEW);
    },

    /**
     * Close deck viewer and return to previous screen.
     *
     * @param {string} [returnTo] - Screen to return to. Defaults to MAP.
     */
    closeDeckView: function (returnTo) {
        STS.Game.changeScreen(returnTo || SCREEN.MAP);
    },

    /* ------------------------------------------------------------------
     *  SETTINGS SCREEN
     * ------------------------------------------------------------------ */

    /**
     * Open the settings screen.
     */
    openSettings: function () {
        STS.Game.changeScreen(SCREEN.SETTINGS);
    },

    /**
     * Close settings and return to previous context.
     *
     * @param {string} [returnTo]
     */
    closeSettings: function (returnTo) {
        STS.Game.saveSettings();
        STS.Game.changeScreen(returnTo || SCREEN.TITLE);
    }
};

/* ======================================================================
 *  PRIVATE HELPERS
 * ====================================================================== */

/**
 * Check if a given entity is the player.
 * @param {Object} entity
 * @returns {boolean}
 */
function _isPlayer(entity) {
    if (!entity) return false;
    return entity === (STS.Game.state && STS.Game.state.player);
}

/**
 * Find a map node by id.
 * @param {number} nodeId
 * @returns {Object|null}
 */
function _findNode(nodeId) {
    var nodes = STS.Game.state ? STS.Game.state.map.nodes : [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) return nodes[i];
    }
    return null;
}

/**
 * Return the node the player is currently on.
 * @returns {Object|null}
 */
function _getCurrentNode() {
    if (!STS.Game.state || STS.Game.state.map.currentNodeId === null) return null;
    return _findNode(STS.Game.state.map.currentNodeId);
}

/**
 * After visiting a node, mark reachable next nodes as available.
 */
function _updateNodeAvailability() {
    var st = STS.Game.state;
    if (!st) return;

    // Mark all as unavailable first
    for (var i = 0; i < st.map.nodes.length; i++) {
        st.map.nodes[i].available = false;
    }

    // Mark nodes connected from current node
    for (var i = 0; i < st.map.paths.length; i++) {
        if (st.map.paths[i].from === st.map.currentNodeId) {
            var target = _findNode(st.map.paths[i].to);
            if (target && !target.visited) {
                target.available = true;
            }
        }
    }
}

/**
 * Check whether all enemies in combat are dead.
 * @returns {boolean}
 */
function _allEnemiesDead() {
    var enemies = STS.Game.state ? STS.Game.state.combat.enemies : [];
    for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].alive) return false;
    }
    return enemies.length > 0;
}

/**
 * Check for and handle enemy deaths after damage.
 */
function _checkEnemyDeaths() {
    var st = STS.Game.state;
    if (!st) return;
    for (var i = 0; i < st.combat.enemies.length; i++) {
        var e = st.combat.enemies[i];
        if (e.alive && e.hp <= 0) {
            STS.Game.enemyDied(i);
        }
    }
}

/**
 * Choose the next intent for an enemy, cycling through its intent list.
 * @param {Object} enemy
 */
function _chooseNextIntent(enemy) {
    // enemies.js format: has moveset + ai function
    if (enemy.moveset && enemy.moveset.length > 0) {
        var moveIdx = 0;
        if (typeof enemy.ai === 'function') {
            try {
                moveIdx = enemy.ai(enemy, STS.Game.state);
            } catch (e) {
                console.warn('[Game] Enemy AI error:', e);
                moveIdx = Math.floor(Math.random() * enemy.moveset.length);
            }
        } else {
            moveIdx = Math.floor(Math.random() * enemy.moveset.length);
        }
        if (moveIdx === undefined || moveIdx === null || moveIdx < 0 || moveIdx >= enemy.moveset.length) {
            moveIdx = 0;
        }
        var move = enemy.moveset[moveIdx];
        enemy.intent = moveIdx;
        enemy.moveHistory.push(moveIdx);
        if (enemy.moveHistory.length > 5) enemy.moveHistory.shift();
        enemy.currentIntent = {
            name: move.name || move.id,
            type: move.type || 'ATTACK',
            damage: move.damage || 0,
            times: move.hits || 1,
            block: move.block || 0,
            effects: move.effects || [],
            buff: null,
            debuff: null
        };
        // Map effects to buff/debuff for execution
        if (move.effects) {
            for (var e = 0; e < move.effects.length; e++) {
                var fx = move.effects[e];
                if (fx.target === 'SELF' || fx.target === 'self') {
                    enemy.currentIntent.buff = { id: fx.effectId, amount: fx.amount };
                } else {
                    enemy.currentIntent.debuff = { id: fx.effectId, amount: fx.amount };
                }
            }
        }
        return;
    }

    // game.js built-in format: has intents array
    if (!enemy.intents || enemy.intents.length === 0) return;

    if (enemy.turnsTaken === 0) {
        for (var i = 0; i < enemy.intents.length; i++) {
            if (enemy.intents[i].firstOnly) {
                enemy.currentIntent = enemy.intents[i];
                enemy.intentIndex = i + 1;
                return;
            }
        }
    }

    var tries = 0;
    while (tries < enemy.intents.length) {
        var idx = enemy.intentIndex % enemy.intents.length;
        var intent = enemy.intents[idx];
        enemy.intentIndex++;
        if (!intent.firstOnly || enemy.turnsTaken === 0) {
            enemy.currentIntent = intent;
            return;
        }
        tries++;
    }

    enemy.currentIntent = enemy.intents[0];
}

/**
 * Execute an enemy's current intent against the player.
 * @param {Object} enemy
 * @param {number} enemyIndex
 */
function _executeEnemyIntent(enemy, enemyIndex) {
    var st = STS.Game.state;
    if (!st || !enemy.currentIntent) return;

    var intent = enemy.currentIntent;

    STS.Game.log(enemy.name + ' uses ' + intent.name + '.', 'combat');

    switch (intent.type) {
        case 'ATTACK': {
            var dmg = Array.isArray(intent.damage)
                ? STS.RNG.nextInt(intent.damage[0], intent.damage[1])
                : intent.damage;
            var hits = intent.times || 1;
            STS.Game.dealDamage(enemy, st.player, dmg, hits);
            break;
        }

        case 'ATTACK_BUFF': {
            var dmg = Array.isArray(intent.damage)
                ? STS.RNG.nextInt(intent.damage[0], intent.damage[1])
                : intent.damage;
            STS.Game.dealDamage(enemy, st.player, dmg, 1);
            if (intent.buff) {
                STS.Game.addStatusEffect(enemy, intent.buff.id, intent.buff.amount);
            }
            break;
        }

        case 'ATTACK_DEBUFF': {
            var dmg = Array.isArray(intent.damage)
                ? STS.RNG.nextInt(intent.damage[0], intent.damage[1])
                : intent.damage;
            var hits = intent.times || 1;
            STS.Game.dealDamage(enemy, st.player, dmg, hits);
            if (intent.debuff) {
                STS.Game.addStatusEffect(st.player, intent.debuff.id, intent.debuff.amount);
            }
            break;
        }

        case 'DEFEND': {
            STS.Game.gainBlock(enemy, intent.block || 0);
            break;
        }

        case 'BUFF': {
            if (intent.buff) {
                STS.Game.addStatusEffect(enemy, intent.buff.id, intent.buff.amount);
            }
            break;
        }

        case 'DEBUFF': {
            if (intent.debuff) {
                STS.Game.addStatusEffect(st.player, intent.debuff.id, intent.debuff.amount);
            }
            break;
        }

        case 'DEBUFF_MULTI': {
            if (intent.debuffs) {
                for (var d = 0; d < intent.debuffs.length; d++) {
                    var db = intent.debuffs[d];
                    STS.Game.addStatusEffect(st.player, db.id, db.amount);
                }
            }
            break;
        }

        default:
            STS.Game.log('Unknown intent type: ' + intent.type, 'error');
    }
}

/**
 * Apply a card's mechanical effects (damage, block, status effects).
 * @param {Object} card
 * @param {Object|null} target
 * @param {number} targetIndex
 */
function _applyCardEffects(card, target, targetIndex) {
    var st = STS.Game.state;
    if (!st) return;

    // If the card has a custom effect function (from cards.js), call it
    if (typeof card.effect === 'function') {
        try {
            card.effect(st, targetIndex, card);
        } catch (err) {
            console.error('[Game] Error in card effect for ' + card.name + ':', err);
        }
        return;
    }

    // Deal damage
    if (card.damage && card.damage > 0 && card.type === 'ATTACK') {
        if (card.target === 'ALL_ENEMIES' || card.target === 'ALL') {
            for (var i = 0; i < st.combat.enemies.length; i++) {
                if (st.combat.enemies[i].alive) {
                    STS.Game.dealDamage(st.player, st.combat.enemies[i], card.damage, card.times || 1);
                }
            }
        } else if (target) {
            STS.Game.dealDamage(st.player, target, card.damage, card.times || 1);
        }
    }

    // Gain block
    if (card.block && card.block > 0) {
        STS.Game.gainBlock(st.player, card.block);
    }

    // Apply card effects (status effects, etc.)
    if (card.effects && card.effects.length > 0) {
        for (var i = 0; i < card.effects.length; i++) {
            var fx = card.effects[i];
            switch (fx.type) {
                case 'STATUS': {
                    var fxTarget = fx.target === 'ENEMY' ? target :
                                   fx.target === 'ALL_ENEMIES' ? null :
                                   st.player;

                    if (fx.target === 'ALL_ENEMIES') {
                        for (var e = 0; e < st.combat.enemies.length; e++) {
                            if (st.combat.enemies[e].alive) {
                                STS.Game.addStatusEffect(st.combat.enemies[e], fx.effectId, fx.amount);
                            }
                        }
                    } else if (fxTarget) {
                        STS.Game.addStatusEffect(fxTarget, fx.effectId, fx.amount);
                    }
                    break;
                }

                case 'DRAW':
                    STS.Game.drawCards(fx.amount);
                    break;

                case 'ENERGY':
                    st.player.energy += fx.amount;
                    break;

                case 'HEAL':
                    STS.Game.healPlayer(fx.amount);
                    break;

                case 'GOLD':
                    STS.Game.addGold(fx.amount);
                    break;

                default:
                    STS.Game.log('Unknown card effect type: ' + fx.type, 'error');
            }
        }
    }
}

/* ======================================================================
 *  REWARD GENERATION HELPERS
 * ====================================================================== */

/**
 * Additional card pool for rewards.  In a full implementation this would
 * come from cards.js; these cover common Ironclad cards.
 */
var REWARD_CARD_POOL = [
    {
        id: 'CLEAVE', name: 'Cleave', type: 'ATTACK', rarity: 'COMMON', energy: 1,
        damage: 8, block: 0, target: 'ALL_ENEMIES',
        description: 'Deal 8 damage to ALL enemies.',
        descriptionUpgraded: 'Deal 11 damage to ALL enemies.',
        exhaust: false, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Cleave+'; this.damage = 11; this.baseDamage = 11; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'IRON_WAVE', name: 'Iron Wave', type: 'ATTACK', rarity: 'COMMON', energy: 1,
        damage: 5, block: 5, target: 'SINGLE_ENEMY',
        description: 'Gain 5 Block. Deal 5 damage.',
        descriptionUpgraded: 'Gain 7 Block. Deal 7 damage.',
        exhaust: false, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Iron Wave+'; this.damage = 7; this.baseDamage = 7; this.block = 7; this.baseBlock = 7; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'POMMEL_STRIKE', name: 'Pommel Strike', type: 'ATTACK', rarity: 'COMMON', energy: 1,
        damage: 9, block: 0, target: 'SINGLE_ENEMY',
        description: 'Deal 9 damage. Draw 1 card.',
        descriptionUpgraded: 'Deal 10 damage. Draw 2 cards.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'DRAW', amount: 1 }],
        upgrade: function () { this.upgraded = true; this.name = 'Pommel Strike+'; this.damage = 10; this.baseDamage = 10; this.effects = [{ type: 'DRAW', amount: 2 }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'SHRUG_IT_OFF', name: 'Shrug It Off', type: 'SKILL', rarity: 'COMMON', energy: 1,
        damage: 0, block: 8, target: 'SELF',
        description: 'Gain 8 Block. Draw 1 card.',
        descriptionUpgraded: 'Gain 11 Block. Draw 1 card.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'DRAW', amount: 1 }],
        upgrade: function () { this.upgraded = true; this.name = 'Shrug It Off+'; this.block = 11; this.baseBlock = 11; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'ANGER', name: 'Anger', type: 'ATTACK', rarity: 'COMMON', energy: 0,
        damage: 6, block: 0, target: 'SINGLE_ENEMY',
        description: 'Deal 6 damage. Add a copy to discard pile.',
        descriptionUpgraded: 'Deal 8 damage. Add a copy to discard pile.',
        exhaust: false, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Anger+'; this.damage = 8; this.baseDamage = 8; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'CLOTHESLINE', name: 'Clothesline', type: 'ATTACK', rarity: 'COMMON', energy: 2,
        damage: 12, block: 0, target: 'SINGLE_ENEMY',
        description: 'Deal 12 damage. Apply 2 Weakness.',
        descriptionUpgraded: 'Deal 14 damage. Apply 3 Weakness.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'WEAKNESS', amount: 2, target: 'ENEMY' }],
        upgrade: function () { this.upgraded = true; this.name = 'Clothesline+'; this.damage = 14; this.baseDamage = 14; this.effects = [{ type: 'STATUS', effectId: 'WEAKNESS', amount: 3, target: 'ENEMY' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'TWIN_STRIKE', name: 'Twin Strike', type: 'ATTACK', rarity: 'COMMON', energy: 1,
        damage: 5, block: 0, target: 'SINGLE_ENEMY', times: 2,
        description: 'Deal 5 damage twice.',
        descriptionUpgraded: 'Deal 7 damage twice.',
        exhaust: false, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Twin Strike+'; this.damage = 7; this.baseDamage = 7; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'BODY_SLAM', name: 'Body Slam', type: 'ATTACK', rarity: 'COMMON', energy: 1,
        damage: 0, block: 0, target: 'SINGLE_ENEMY',
        description: 'Deal damage equal to your current Block.',
        descriptionUpgraded: 'Costs 0. Deal damage equal to your current Block.',
        exhaust: false, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Body Slam+'; this.energy = 0; this.baseCost = 0; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'ARMAMENTS', name: 'Armaments', type: 'SKILL', rarity: 'COMMON', energy: 1,
        damage: 0, block: 5, target: 'SELF',
        description: 'Gain 5 Block. Upgrade a card in hand for the rest of combat.',
        descriptionUpgraded: 'Gain 5 Block. Upgrade ALL cards in hand for the rest of combat.',
        exhaust: false, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Armaments+'; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'FLEX', name: 'Flex', type: 'SKILL', rarity: 'COMMON', energy: 0,
        damage: 0, block: 0, target: 'SELF',
        description: 'Gain 2 Strength. At end of turn, lose 2 Strength.',
        descriptionUpgraded: 'Gain 4 Strength. At end of turn, lose 4 Strength.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'STRENGTH', amount: 2, target: 'SELF' }],
        upgrade: function () { this.upgraded = true; this.name = 'Flex+'; this.effects = [{ type: 'STATUS', effectId: 'STRENGTH', amount: 4, target: 'SELF' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'INFLAME', name: 'Inflame', type: 'POWER', rarity: 'UNCOMMON', energy: 1,
        damage: 0, block: 0, target: 'SELF',
        description: 'Gain 2 Strength.',
        descriptionUpgraded: 'Gain 3 Strength.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'STRENGTH', amount: 2, target: 'SELF' }],
        upgrade: function () { this.upgraded = true; this.name = 'Inflame+'; this.effects = [{ type: 'STATUS', effectId: 'STRENGTH', amount: 3, target: 'SELF' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'METALLICIZE', name: 'Metallicize', type: 'POWER', rarity: 'UNCOMMON', energy: 1,
        damage: 0, block: 0, target: 'SELF',
        description: 'At the end of your turn, gain 3 Block.',
        descriptionUpgraded: 'At the end of your turn, gain 4 Block.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'METALLICIZE', amount: 3, target: 'SELF' }],
        upgrade: function () { this.upgraded = true; this.name = 'Metallicize+'; this.effects = [{ type: 'STATUS', effectId: 'METALLICIZE', amount: 4, target: 'SELF' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'BATTLE_TRANCE', name: 'Battle Trance', type: 'SKILL', rarity: 'UNCOMMON', energy: 0,
        damage: 0, block: 0, target: 'SELF',
        description: 'Draw 3 cards. You cannot draw additional cards this turn.',
        descriptionUpgraded: 'Draw 4 cards. You cannot draw additional cards this turn.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [
            { type: 'DRAW', amount: 3 },
            { type: 'STATUS', effectId: 'NO_DRAW', amount: 1, target: 'SELF' }
        ],
        upgrade: function () { this.upgraded = true; this.name = 'Battle Trance+'; this.effects = [{ type: 'DRAW', amount: 4 }, { type: 'STATUS', effectId: 'NO_DRAW', amount: 1, target: 'SELF' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'CARNAGE', name: 'Carnage', type: 'ATTACK', rarity: 'UNCOMMON', energy: 2,
        damage: 20, block: 0, target: 'SINGLE_ENEMY',
        description: 'Ethereal. Deal 20 damage.',
        descriptionUpgraded: 'Ethereal. Deal 28 damage.',
        exhaust: false, ethereal: true, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Carnage+'; this.damage = 28; this.baseDamage = 28; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'UPPERCUT', name: 'Uppercut', type: 'ATTACK', rarity: 'UNCOMMON', energy: 2,
        damage: 13, block: 0, target: 'SINGLE_ENEMY',
        description: 'Deal 13 damage. Apply 1 Weak. Apply 1 Vulnerable.',
        descriptionUpgraded: 'Deal 13 damage. Apply 2 Weak. Apply 2 Vulnerable.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [
            { type: 'STATUS', effectId: 'WEAKNESS', amount: 1, target: 'ENEMY' },
            { type: 'STATUS', effectId: 'VULNERABLE', amount: 1, target: 'ENEMY' }
        ],
        upgrade: function () { this.upgraded = true; this.name = 'Uppercut+'; this.effects = [{ type: 'STATUS', effectId: 'WEAKNESS', amount: 2, target: 'ENEMY' }, { type: 'STATUS', effectId: 'VULNERABLE', amount: 2, target: 'ENEMY' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'BLOODLETTING', name: 'Bloodletting', type: 'SKILL', rarity: 'UNCOMMON', energy: 0,
        damage: 0, block: 0, target: 'SELF',
        description: 'Lose 3 HP. Gain 2 Energy.',
        descriptionUpgraded: 'Lose 3 HP. Gain 3 Energy.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'ENERGY', amount: 2 }],
        upgrade: function () { this.upgraded = true; this.name = 'Bloodletting+'; this.effects = [{ type: 'ENERGY', amount: 3 }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'DISARM', name: 'Disarm', type: 'SKILL', rarity: 'UNCOMMON', energy: 1,
        damage: 0, block: 0, target: 'SINGLE_ENEMY',
        description: 'Enemy loses 2 Strength. Exhaust.',
        descriptionUpgraded: 'Enemy loses 3 Strength. Exhaust.',
        exhaust: true, ethereal: false, unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'STRENGTH', amount: -2, target: 'ENEMY' }],
        upgrade: function () { this.upgraded = true; this.name = 'Disarm+'; this.effects = [{ type: 'STATUS', effectId: 'STRENGTH', amount: -3, target: 'ENEMY' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'FEED', name: 'Feed', type: 'ATTACK', rarity: 'RARE', energy: 1,
        damage: 10, block: 0, target: 'SINGLE_ENEMY',
        description: 'Deal 10 damage. If this kills, gain 3 max HP. Exhaust.',
        descriptionUpgraded: 'Deal 12 damage. If this kills, gain 4 max HP. Exhaust.',
        exhaust: true, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Feed+'; this.damage = 12; this.baseDamage = 12; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'DEMON_FORM', name: 'Demon Form', type: 'POWER', rarity: 'RARE', energy: 3,
        damage: 0, block: 0, target: 'SELF',
        description: 'At the start of each turn, gain 2 Strength.',
        descriptionUpgraded: 'At the start of each turn, gain 3 Strength.',
        exhaust: false, ethereal: false, unplayable: false,
        effects: [{ type: 'STATUS', effectId: 'RITUAL', amount: 2, target: 'SELF' }],
        upgrade: function () { this.upgraded = true; this.name = 'Demon Form+'; this.effects = [{ type: 'STATUS', effectId: 'RITUAL', amount: 3, target: 'SELF' }]; this.description = this.descriptionUpgraded; }
    },
    {
        id: 'IMPERVIOUS', name: 'Impervious', type: 'SKILL', rarity: 'RARE', energy: 2,
        damage: 0, block: 30, target: 'SELF',
        description: 'Gain 30 Block. Exhaust.',
        descriptionUpgraded: 'Gain 40 Block. Exhaust.',
        exhaust: true, ethereal: false, unplayable: false, effects: [],
        upgrade: function () { this.upgraded = true; this.name = 'Impervious+'; this.block = 40; this.baseBlock = 40; this.description = this.descriptionUpgraded; }
    }
];

/**
 * Generate N random card choices for rewards or shops.
 * @param {number} count
 * @returns {Object[]} Array of card instances.
 */
function _generateCardChoices(count) {
    // Prefer cards.js module if available
    if (STS.Cards && typeof STS.Cards.getRandomCards === 'function') {
        try {
            return STS.Cards.getRandomCards(count);
        } catch (e) {
            console.warn('[Game] Failed to use STS.Cards.getRandomCards, falling back:', e);
        }
    }

    var pool = REWARD_CARD_POOL.slice();
    STS.Game.shuffleArray(pool);

    var choices = [];
    for (var i = 0; i < Math.min(count, pool.length); i++) {
        choices.push(STS.Game.createCardInstance(pool[i]));
    }
    return choices;
}

/**
 * Calculate a price for a card in the shop.
 * @param {Object} card
 * @returns {number}
 */
function _cardPrice(card) {
    var base = 50;
    switch (card.rarity) {
        case 'COMMON': base = STS.RNG.nextInt(45, 55); break;
        case 'UNCOMMON': base = STS.RNG.nextInt(68, 82); break;
        case 'RARE': base = STS.RNG.nextInt(135, 165); break;
        default: base = STS.RNG.nextInt(45, 55);
    }
    return base;
}

/**
 * @typedef {Object} Potion
 * @property {string} id
 * @property {string} name
 * @property {string} rarity
 * @property {string} description
 * @property {string} icon
 * @property {boolean} targetRequired
 * @property {function} use
 */

/** Pool of potions that can drop. */
var POTION_POOL = [
    {
        id: 'FIRE_POTION',
        name: 'Fire Potion',
        rarity: 'COMMON',
        description: 'Deal 20 damage to target enemy.',
        icon: '🔥',
        targetRequired: true,
        use: function (target) {
            if (target) STS.Game.dealDamage(null, target, 20, 1);
        }
    },
    {
        id: 'BLOCK_POTION',
        name: 'Block Potion',
        rarity: 'COMMON',
        description: 'Gain 12 Block.',
        icon: '🛡️',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) STS.Game.gainBlock(STS.Game.state.player, 12);
        }
    },
    {
        id: 'ENERGY_POTION',
        name: 'Energy Potion',
        rarity: 'COMMON',
        description: 'Gain 2 Energy.',
        icon: '⚡',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) STS.Game.state.player.energy += 2;
        }
    },
    {
        id: 'STRENGTH_POTION',
        name: 'Strength Potion',
        rarity: 'COMMON',
        description: 'Gain 2 Strength.',
        icon: '💪',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) STS.Game.addStatusEffect(STS.Game.state.player, 'STRENGTH', 2);
        }
    },
    {
        id: 'DEX_POTION',
        name: 'Dexterity Potion',
        rarity: 'COMMON',
        description: 'Gain 2 Dexterity.',
        icon: '🦊',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) STS.Game.addStatusEffect(STS.Game.state.player, 'DEXTERITY', 2);
        }
    },
    {
        id: 'POISON_POTION',
        name: 'Poison Potion',
        rarity: 'COMMON',
        description: 'Apply 6 Poison to target enemy.',
        icon: '☠️',
        targetRequired: true,
        use: function (target) {
            if (target) STS.Game.addStatusEffect(target, 'POISON', 6);
        }
    },
    {
        id: 'REGEN_POTION',
        name: 'Regen Potion',
        rarity: 'UNCOMMON',
        description: 'Gain 5 Regeneration.',
        icon: '💚',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) STS.Game.addStatusEffect(STS.Game.state.player, 'REGENERATION', 5);
        }
    },
    {
        id: 'ANCIENT_POTION',
        name: 'Ancient Potion',
        rarity: 'UNCOMMON',
        description: 'Gain 1 Artifact.',
        icon: '💎',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) STS.Game.addStatusEffect(STS.Game.state.player, 'ARTIFACT', 1);
        }
    },
    {
        id: 'WEAK_POTION',
        name: 'Weak Potion',
        rarity: 'COMMON',
        description: 'Apply 3 Weakness to target enemy.',
        icon: '🗡️',
        targetRequired: true,
        use: function (target) {
            if (target) STS.Game.addStatusEffect(target, 'WEAKNESS', 3);
        }
    },
    {
        id: 'FEAR_POTION',
        name: 'Fear Potion',
        rarity: 'COMMON',
        description: 'Apply 3 Vulnerable to target enemy.',
        icon: '😨',
        targetRequired: true,
        use: function (target) {
            if (target) STS.Game.addStatusEffect(target, 'VULNERABLE', 3);
        }
    },
    {
        id: 'FAIRY_BOTTLE',
        name: 'Fairy in a Bottle',
        rarity: 'RARE',
        description: 'When you would die, heal to 30% of max HP instead.',
        icon: '🧚',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) {
                var heal = Math.floor(STS.Game.state.player.maxHp * 0.3);
                STS.Game.healPlayer(heal);
            }
        }
    },
    {
        id: 'FRUIT_JUICE',
        name: 'Fruit Juice',
        rarity: 'RARE',
        description: 'Gain 5 Max HP.',
        icon: '🧃',
        targetRequired: false,
        use: function () {
            if (STS.Game.state) {
                STS.Game.state.player.maxHp += 5;
                STS.Game.state.player.hp += 5;
            }
        }
    }
];

/**
 * Generate a random potion.
 * @returns {Object}
 */
function _generatePotion() {
    return JSON.parse(JSON.stringify(STS.RNG.pick(POTION_POOL)));
}

/** Pool of relics that can be awarded. */
var RELIC_POOL = [
    {
        id: 'VAJRA',
        name: 'Vajra',
        description: 'At the start of combat, gain 1 Strength.',
        rarity: 'COMMON',
        icon: '⚡',
        onPickup: null,
        onCombatStart: function () {
            STS.Game.addStatusEffect(STS.Game.state.player, 'STRENGTH', 1);
        },
        onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'ANCHOR',
        name: 'Anchor',
        description: 'At the start of combat, gain 10 Block.',
        rarity: 'COMMON',
        icon: '⚓',
        onPickup: null,
        onCombatStart: function () {
            STS.Game.gainBlock(STS.Game.state.player, 10);
        },
        onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'BAG_OF_MARBLES',
        name: 'Bag of Marbles',
        description: 'At the start of combat, apply 1 Vulnerable to ALL enemies.',
        rarity: 'COMMON',
        icon: '🔮',
        onPickup: null,
        onCombatStart: function () {
            var enemies = STS.Game.state.combat.enemies;
            for (var i = 0; i < enemies.length; i++) {
                if (enemies[i].alive) {
                    STS.Game.addStatusEffect(enemies[i], 'VULNERABLE', 1);
                }
            }
        },
        onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'ODDLY_SMOOTH_STONE',
        name: 'Oddly Smooth Stone',
        description: 'At the start of combat, gain 1 Dexterity.',
        rarity: 'COMMON',
        icon: '🪨',
        onPickup: null,
        onCombatStart: function () {
            STS.Game.addStatusEffect(STS.Game.state.player, 'DEXTERITY', 1);
        },
        onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'BLOOD_VIAL',
        name: 'Blood Vial',
        description: 'At the start of combat, heal 2 HP.',
        rarity: 'COMMON',
        icon: '🩸',
        onPickup: null,
        onCombatStart: function () {
            STS.Game.healPlayer(2);
        },
        onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'HORN_CLEAT',
        name: 'Horn Cleat',
        description: 'At the start of your 2nd turn, gain 14 Block.',
        rarity: 'UNCOMMON',
        icon: '📯',
        counter: 0,
        onPickup: null, onCombatStart: function () { this.counter = 0; },
        onCombatEnd: null,
        onTurnStart: function () {
            this.counter++;
            if (this.counter === 2) {
                STS.Game.gainBlock(STS.Game.state.player, 14);
            }
        },
        onTurnEnd: null, onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'ORNAMENTAL_FAN',
        name: 'Ornamental Fan',
        description: 'Every time you play 3 attacks in a turn, gain 4 Block.',
        rarity: 'UNCOMMON',
        icon: '🪭',
        onPickup: null, onCombatStart: null, onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: function (data) {
            if (data.card && data.card.type === 'ATTACK') {
                if (STS.Game.state.combat.attacksPlayedThisTurn % 3 === 0 &&
                    STS.Game.state.combat.attacksPlayedThisTurn > 0) {
                    STS.Game.gainBlock(STS.Game.state.player, 4);
                }
            }
        },
        onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'LANTERN',
        name: 'Lantern',
        description: 'Gain 1 Energy on the first turn of each combat.',
        rarity: 'UNCOMMON',
        icon: '🏮',
        onPickup: null,
        onCombatStart: function () {
            STS.Game.state.player.energy += 1;
        },
        onCombatEnd: null, onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'MEAT_ON_THE_BONE',
        name: 'Meat on the Bone',
        description: 'If HP is at 50% or less at end of combat, heal 12 HP.',
        rarity: 'UNCOMMON',
        icon: '🍖',
        onPickup: null, onCombatStart: null,
        onCombatEnd: function () {
            var p = STS.Game.state.player;
            if (p.hp <= Math.floor(p.maxHp * 0.5)) {
                STS.Game.healPlayer(12);
            }
        },
        onTurnStart: null, onTurnEnd: null,
        onCardPlayed: null, onDamageDealt: null, onDamageTaken: null
    },
    {
        id: 'TUNGSTEN_ROD',
        name: 'Tungsten Rod',
        description: 'Whenever you lose HP, lose 1 less.',
        rarity: 'RARE',
        icon: '🔗',
        onPickup: null, onCombatStart: null, onCombatEnd: null,
        onTurnStart: null, onTurnEnd: null, onCardPlayed: null,
        onDamageDealt: null,
        onDamageTaken: function (data) {
            if (data.hpDamage > 0) {
                STS.Game.state.player.hp = Math.min(
                    STS.Game.state.player.maxHp,
                    STS.Game.state.player.hp + 1
                );
            }
        }
    }
];

/**
 * Generate a random relic, excluding already-owned ones.
 * @param {'NORMAL'|'ELITE'|'BOSS'} type
 * @returns {Object|null}
 */
function _generateRelic(type) {
    var st = STS.Game.state;
    if (!st) return null;

    var owned = {};
    for (var i = 0; i < st.player.relics.length; i++) {
        owned[st.player.relics[i].id] = true;
    }

    var available = [];
    for (var i = 0; i < RELIC_POOL.length; i++) {
        if (!owned[RELIC_POOL[i].id]) {
            available.push(RELIC_POOL[i]);
        }
    }

    if (available.length === 0) return null;

    var template = STS.RNG.pick(available);
    return JSON.parse(JSON.stringify(template));
}

/**
 * Calculate a final score for the run.
 * @returns {number}
 */
function _calculateScore() {
    var st = STS.Game.state;
    if (!st) return 0;

    var score = 0;
    score += st.run.floorsClimbed * 5;
    score += st.run.monstersKilled * 2;
    score += st.run.elitesKilled * 10;
    score += st.run.bossesKilled * 50;
    score += Math.floor(st.run.goldEarned / 10);

    // Bonus for player surviving
    if (st.player.hp > 0) {
        score += 200; // victory bonus
        score += st.player.hp; // HP bonus
    }

    return score;
}

/* ======================================================================
 *  BOOT
 * ====================================================================== */

// Apply pending settings if state was created before loadSettings
if (STS.Game._pendingSettings) {
    if (!STS.Game.state) {
        STS.Game.state = { settings: STS.Game._pendingSettings, log: [] };
    }
    delete STS.Game._pendingSettings;
}

console.log('[STS] game.js loaded – engine ready');
