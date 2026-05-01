window.STS = window.STS || {};

STS.Enemies = (function () {

    // ── helpers ──────────────────────────────────────────────────────────
    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function weightedPick(moves, excluded) {
        const pool = moves.filter(function (_, i) { return excluded.indexOf(i) === -1; });
        if (pool.length === 0) return moves[0];
        var total = pool.reduce(function (s, m) { return s + (m.weight || 1); }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < pool.length; i++) {
            r -= (pool[i].weight || 1);
            if (r <= 0) return pool[i];
        }
        return pool[pool.length - 1];
    }

    function lastNSame(history, n) {
        if (history.length < n) return false;
        var last = history[history.length - 1];
        for (var i = 2; i <= n; i++) {
            if (history[history.length - i] !== last) return false;
        }
        return true;
    }

    function moveIndexById(moveset, id) {
        for (var i = 0; i < moveset.length; i++) {
            if (moveset[i].id === id) return i;
        }
        return 0;
    }

    function nextInstanceId() {
        if (window.STS && STS.Game && typeof STS.Game.nextInstanceId === 'number') {
            return STS.Game.nextInstanceId++;
        }
        return Math.floor(Math.random() * 1e9);
    }

    // ── intent icons ─────────────────────────────────────────────────────
    var INTENT_ICONS = {
        ATTACK:         'sword',
        DEFEND:         'shield',
        BUFF:           'buff_up',
        DEBUFF:         'debuff_down',
        ATTACK_DEBUFF:  'sword_debuff',
        ATTACK_DEFEND:  'sword_shield',
        UNKNOWN:        'question',
        SLEEP:          'zzz'
    };

    // ── enemy definitions ────────────────────────────────────────────────
    var definitions = {};

    // ------------------------------------------------------------------
    // 1  JAW WORM
    // ------------------------------------------------------------------
    definitions.JAW_WORM = {
        id: 'JAW_WORM',
        name: 'Jaw Worm',
        hpRange: [40, 44],
        image: 'assets/enemies/jaw_worm.png',
        type: 'NORMAL',
        act: 1,
        moveset: [
            { id: 'chomp',  name: 'Chomp',  type: 'ATTACK',        damage: 11, block: 0, hits: 1, effects: [],                                      weight: 0.45, animation: 'bite'  },
            { id: 'bellow', name: 'Bellow', type: 'BUFF',          damage: 0,  block: 6, hits: 0, effects: [{ effectId: 'strength', amount: 3, target: 'self' }], weight: 0.30, animation: 'roar'  },
            { id: 'thrash', name: 'Thrash', type: 'ATTACK_DEFEND', damage: 7,  block: 5, hits: 1, effects: [],                                      weight: 0.25, animation: 'slam'  }
        ],
        ai: function (enemy) {
            var excluded = [];
            if (lastNSame(enemy.moveHistory, 2)) {
                excluded.push(enemy.moveHistory[enemy.moveHistory.length - 1]);
            }
            var m = weightedPick(enemy.moveset, excluded);
            return moveIndexById(enemy.moveset, m.id);
        }
    };

    // ------------------------------------------------------------------
    // 2  CULTIST
    // ------------------------------------------------------------------
    definitions.CULTIST = {
        id: 'CULTIST',
        name: 'Cultist',
        hpRange: [48, 54],
        image: 'assets/enemies/cultist.png',
        type: 'NORMAL',
        act: 1,
        moveset: [
            { id: 'incantation', name: 'Incantation', type: 'BUFF',   damage: 0, block: 0, hits: 0, effects: [{ effectId: 'ritual', amount: 3, target: 'self' }], weight: 1, animation: 'chant' },
            { id: 'dark_strike', name: 'Dark Strike', type: 'ATTACK', damage: 6, block: 0, hits: 1, effects: [],                                               weight: 1, animation: 'slash' }
        ],
        ai: function (enemy) {
            if (enemy.moveHistory.length === 0) return 0;
            return 1;
        }
    };

    // ------------------------------------------------------------------
    // 3  RED LOUSE
    // ------------------------------------------------------------------
    definitions.RED_LOUSE = {
        id: 'RED_LOUSE',
        name: 'Red Louse',
        hpRange: [10, 15],
        image: 'assets/enemies/red_louse.png',
        type: 'NORMAL',
        act: 1,
        initPowers: function () { return { curlUp: randInt(3, 7) }; },
        moveset: [
            { id: 'bite', name: 'Bite', type: 'ATTACK', damage: 0, block: 0, hits: 1, effects: [],                                      weight: 0.75, animation: 'bite' },
            { id: 'grow', name: 'Grow', type: 'BUFF',   damage: 0, block: 0, hits: 0, effects: [{ effectId: 'strength', amount: 3, target: 'self' }], weight: 0.25, animation: 'grow' }
        ],
        onCreate: function (inst) {
            inst.biteDamage = randInt(5, 7);
            inst.moveset = JSON.parse(JSON.stringify(inst.moveset));
            inst.moveset[0].damage = inst.biteDamage;
        },
        ai: function (enemy) {
            var excluded = [];
            if (enemy.moveHistory.length > 0 && enemy.moveHistory[enemy.moveHistory.length - 1] === 1) {
                excluded.push(1);
            }
            var m = weightedPick(enemy.moveset, excluded);
            return moveIndexById(enemy.moveset, m.id);
        }
    };

    // ------------------------------------------------------------------
    // 4  GREEN LOUSE
    // ------------------------------------------------------------------
    definitions.GREEN_LOUSE = {
        id: 'GREEN_LOUSE',
        name: 'Green Louse',
        hpRange: [11, 17],
        image: 'assets/enemies/red_louse.png',
        type: 'NORMAL',
        act: 1,
        initPowers: function () { return { curlUp: randInt(3, 7) }; },
        moveset: [
            { id: 'bite',     name: 'Bite',     type: 'ATTACK', damage: 0, block: 0, hits: 1, effects: [],                                          weight: 0.75, animation: 'bite' },
            { id: 'spit_web', name: 'Spit Web', type: 'DEBUFF', damage: 0, block: 0, hits: 0, effects: [{ effectId: 'weakness', amount: 2, target: 'player' }], weight: 0.25, animation: 'spit' }
        ],
        onCreate: function (inst) {
            inst.biteDamage = randInt(5, 7);
            inst.moveset = JSON.parse(JSON.stringify(inst.moveset));
            inst.moveset[0].damage = inst.biteDamage;
        },
        ai: function (enemy) {
            var excluded = [];
            if (enemy.moveHistory.length > 0 && enemy.moveHistory[enemy.moveHistory.length - 1] === 1) {
                excluded.push(1);
            }
            var m = weightedPick(enemy.moveset, excluded);
            return moveIndexById(enemy.moveset, m.id);
        }
    };

    // ------------------------------------------------------------------
    // 5  ACID SLIME (MEDIUM)
    // ------------------------------------------------------------------
    definitions.ACID_SLIME_M = {
        id: 'ACID_SLIME_M',
        name: 'Acid Slime (M)',
        hpRange: [28, 32],
        image: 'assets/enemies/slime_boss.png',
        type: 'NORMAL',
        act: 1,
        moveset: [
            { id: 'tackle',         name: 'Tackle',         type: 'ATTACK',        damage: 10, block: 0, hits: 1, effects: [],                                                                  weight: 0.40, animation: 'slam' },
            { id: 'corrosive_spit', name: 'Corrosive Spit', type: 'ATTACK_DEBUFF', damage: 7,  block: 0, hits: 1, effects: [{ effectId: 'slimed', amount: 1, target: 'player_discard' }],        weight: 0.30, animation: 'spit' },
            { id: 'lick',           name: 'Lick',           type: 'DEBUFF',        damage: 0,  block: 0, hits: 0, effects: [{ effectId: 'weakness', amount: 1, target: 'player' }],               weight: 0.30, animation: 'lick' }
        ],
        ai: function (enemy) {
            var excluded = [];
            if (lastNSame(enemy.moveHistory, 2)) {
                excluded.push(enemy.moveHistory[enemy.moveHistory.length - 1]);
            }
            var m = weightedPick(enemy.moveset, excluded);
            return moveIndexById(enemy.moveset, m.id);
        }
    };

    // ------------------------------------------------------------------
    // 6  SPIKE SLIME (MEDIUM)
    // ------------------------------------------------------------------
    definitions.SPIKE_SLIME_M = {
        id: 'SPIKE_SLIME_M',
        name: 'Spike Slime (M)',
        hpRange: [28, 32],
        image: 'assets/enemies/slime_boss.png',
        type: 'NORMAL',
        act: 1,
        moveset: [
            { id: 'flame_tackle', name: 'Flame Tackle', type: 'ATTACK_DEBUFF', damage: 8, block: 0, hits: 1, effects: [{ effectId: 'slimed', amount: 1, target: 'player_discard' }], weight: 0.50, animation: 'slam' },
            { id: 'lick',         name: 'Lick',         type: 'DEBUFF',        damage: 0, block: 0, hits: 0, effects: [{ effectId: 'frail', amount: 1, target: 'player' }],          weight: 0.50, animation: 'lick' }
        ],
        ai: function (enemy) {
            if (enemy.moveHistory.length === 0) return 0;
            return enemy.moveHistory[enemy.moveHistory.length - 1] === 0 ? 1 : 0;
        }
    };

    // ------------------------------------------------------------------
    // 7  SMALL ACID SLIME
    // ------------------------------------------------------------------
    definitions.SMALL_ACID_SLIME = {
        id: 'SMALL_ACID_SLIME',
        name: 'Acid Slime (S)',
        hpRange: [8, 12],
        image: 'assets/enemies/slime_boss.png',
        type: 'NORMAL',
        act: 1,
        moveset: [
            { id: 'tackle', name: 'Tackle', type: 'ATTACK', damage: 3, block: 0, hits: 1, effects: [],                                            weight: 0.50, animation: 'slam' },
            { id: 'lick',   name: 'Lick',   type: 'DEBUFF', damage: 0, block: 0, hits: 0, effects: [{ effectId: 'weakness', amount: 1, target: 'player' }], weight: 0.50, animation: 'lick' }
        ],
        ai: function (enemy) {
            return Math.random() < 0.5 ? 0 : 1;
        }
    };

    // ------------------------------------------------------------------
    // 8  SMALL SPIKE SLIME
    // ------------------------------------------------------------------
    definitions.SMALL_SPIKE_SLIME = {
        id: 'SMALL_SPIKE_SLIME',
        name: 'Spike Slime (S)',
        hpRange: [10, 14],
        image: 'assets/enemies/slime_boss.png',
        type: 'NORMAL',
        act: 1,
        moveset: [
            { id: 'tackle', name: 'Tackle', type: 'ATTACK', damage: 5, block: 0, hits: 1, effects: [], weight: 1, animation: 'slam' }
        ],
        ai: function () { return 0; }
    };

    // ------------------------------------------------------------------
    // 9  GREMLIN NOB  (ACT 1 ELITE)
    // ------------------------------------------------------------------
    definitions.GREMLIN_NOB = {
        id: 'GREMLIN_NOB',
        name: 'Gremlin Nob',
        hpRange: [82, 86],
        image: 'assets/enemies/gremlin.png',
        type: 'ELITE',
        act: 1,
        moveset: [
            { id: 'bellow',     name: 'Bellow',     type: 'BUFF',   damage: 0,  block: 0, hits: 0, effects: [{ effectId: 'strength', amount: 2, target: 'self' }], weight: 0.33, animation: 'roar'  },
            { id: 'rush',       name: 'Rush',        type: 'ATTACK', damage: 14, block: 0, hits: 1, effects: [],                                                  weight: 0.33, animation: 'rush'  },
            { id: 'skull_bash', name: 'Skull Bash',  type: 'ATTACK_DEBUFF', damage: 6, block: 0, hits: 1, effects: [{ effectId: 'vulnerable', amount: 2, target: 'player' }], weight: 0.33, animation: 'bash' }
        ],
        initPowers: function () { return { enrage: 2 }; },
        ai: function (enemy) {
            if (enemy.moveHistory.length === 0) return 0; // always Bellow first
            var excluded = [];
            excluded.push(0); // no more Bellow after first turn (per spec 33% but simplified)
            if (lastNSame(enemy.moveHistory, 2)) {
                excluded.push(enemy.moveHistory[enemy.moveHistory.length - 1]);
            }
            var m = weightedPick(enemy.moveset, excluded);
            return moveIndexById(enemy.moveset, m.id);
        }
    };

    // ------------------------------------------------------------------
    // 10  LAGAVULIN  (ACT 1 ELITE)
    // ------------------------------------------------------------------
    definitions.LAGAVULIN = {
        id: 'LAGAVULIN',
        name: 'Lagavulin',
        hpRange: [108, 112],
        image: 'assets/enemies/guardian.png',
        type: 'ELITE',
        act: 1,
        moveset: [
            { id: 'sleep',       name: 'Sleep',       type: 'SLEEP',  damage: 0,  block: 0, hits: 0, effects: [],                                                                                                     weight: 1, animation: 'idle'   },
            { id: 'attack',      name: 'Attack',      type: 'ATTACK', damage: 18, block: 0, hits: 1, effects: [],                                                                                                     weight: 1, animation: 'attack' },
            { id: 'siphon_soul', name: 'Siphon Soul', type: 'DEBUFF', damage: 0,  block: 0, hits: 0, effects: [{ effectId: 'strength', amount: -1, target: 'player' }, { effectId: 'dexterity', amount: -1, target: 'player' }], weight: 1, animation: 'drain' }
        ],
        initPowers: function () { return { metallicize: 8 }; },
        onCreate: function (inst) {
            inst.asleep = true;
            inst.sleepTurns = 0;
        },
        ai: function (enemy) {
            if (enemy.asleep) {
                enemy.sleepTurns = (enemy.sleepTurns || 0) + 1;
                if (enemy.sleepTurns >= 3) {
                    enemy.asleep = false;
                    return 1; // attack on wake
                }
                return 0; // sleep
            }
            // awake: alternate attack and siphon
            var last = enemy.moveHistory[enemy.moveHistory.length - 1];
            return last === 1 ? 2 : 1;
        }
    };

    // ------------------------------------------------------------------
    // 11  SENTRY  (ACT 1 ELITE - spawned 3x)
    // ------------------------------------------------------------------
    definitions.SENTRY = {
        id: 'SENTRY',
        name: 'Sentry',
        hpRange: [38, 42],
        image: 'assets/enemies/sentry.png',
        type: 'ELITE',
        act: 1,
        moveset: [
            { id: 'bolt', name: 'Bolt', type: 'ATTACK',  damage: 9, block: 0, hits: 1, effects: [],                                                        weight: 1, animation: 'bolt' },
            { id: 'beam', name: 'Beam', type: 'DEBUFF',  damage: 0, block: 0, hits: 0, effects: [{ effectId: 'dazed', amount: 2, target: 'player_discard' }], weight: 1, animation: 'beam' }
        ],
        onCreate: function (inst) {
            inst.sentrySlot = -1; // set by encounter generator
        },
        ai: function (enemy) {
            // Slot-based alternation: even slots start Bolt, odd start Beam
            var turn = enemy.moveHistory.length;
            var offset = (enemy.sentrySlot || 0) % 2;
            return (turn + offset) % 2;
        }
    };

    // ------------------------------------------------------------------
    // 12  THE GUARDIAN  (ACT 1 BOSS)
    // ------------------------------------------------------------------
    definitions.THE_GUARDIAN = {
        id: 'THE_GUARDIAN',
        name: 'The Guardian',
        hpRange: [240, 240],
        image: 'assets/enemies/guardian.png',
        type: 'BOSS',
        act: 1,
        moveset: [
            { id: 'fierce_bash',  name: 'Fierce Bash',  type: 'ATTACK',  damage: 32, block: 0,  hits: 1, effects: [],                                                       weight: 1, animation: 'bash'  },
            { id: 'twin_slam',    name: 'Twin Slam',    type: 'ATTACK',  damage: 8,  block: 0,  hits: 2, effects: [],                                                       weight: 1, animation: 'slam'  },
            { id: 'whirlwind',    name: 'Whirlwind',    type: 'ATTACK',  damage: 5,  block: 0,  hits: 4, effects: [],                                                       weight: 1, animation: 'spin'  },
            { id: 'roll_attack',  name: 'Roll Attack',  type: 'ATTACK',  damage: 9,  block: 0,  hits: 1, effects: [],                                                       weight: 1, animation: 'roll'  },
            { id: 'close_up',     name: 'Close Up',     type: 'DEFEND',  damage: 0,  block: 9,  hits: 0, effects: [{ effectId: 'thorns', amount: 3, target: 'self' }],       weight: 1, animation: 'close' }
        ],
        onCreate: function (inst) {
            inst.mode = 'OFFENSIVE';
            inst.offensiveMoveCounter = 0;
            inst.defensiveTurns = 0;
            inst.damageTakenInMode = 0;
            inst.offensiveSequence = ['fierce_bash', 'twin_slam', 'whirlwind', 'roll_attack'];
            inst.offensiveIdx = 0;
        },
        ai: function (enemy) {
            if (enemy.mode === 'DEFENSIVE') {
                enemy.defensiveTurns++;
                if (enemy.defensiveTurns >= 3) {
                    enemy.mode = 'OFFENSIVE';
                    enemy.damageTakenInMode = 0;
                    enemy.defensiveTurns = 0;
                    enemy.offensiveIdx = 0;
                    // remove Sharp Hide when returning
                    if (enemy.powers) delete enemy.powers.thorns;
                }
                return moveIndexById(enemy.moveset, 'close_up');
            }
            // OFFENSIVE
            var moveId = enemy.offensiveSequence[enemy.offensiveIdx % enemy.offensiveSequence.length];
            enemy.offensiveIdx++;
            return moveIndexById(enemy.moveset, moveId);
        },
        onDamage: function (enemy, amount) {
            if (enemy.mode === 'OFFENSIVE') {
                enemy.damageTakenInMode += amount;
                if (enemy.damageTakenInMode >= 30) {
                    enemy.mode = 'DEFENSIVE';
                    enemy.defensiveTurns = 0;
                    enemy.damageTakenInMode = 0;
                }
            }
        }
    };

    // ------------------------------------------------------------------
    // 13  HEXAGHOST  (ACT 1 BOSS)
    // ------------------------------------------------------------------
    definitions.HEXAGHOST = {
        id: 'HEXAGHOST',
        name: 'Hexaghost',
        hpRange: [250, 250],
        image: 'assets/enemies/hexaghost.png',
        type: 'BOSS',
        act: 1,
        moveset: [
            { id: 'activate', name: 'Activate', type: 'UNKNOWN', damage: 0, block: 0, hits: 0, effects: [],                                                                  weight: 1, animation: 'glow'   },
            { id: 'divider',  name: 'Divider',  type: 'ATTACK',  damage: 6, block: 0, hits: 6, effects: [],                                                                  weight: 1, animation: 'multi'  },
            { id: 'inferno',  name: 'Inferno',  type: 'ATTACK_DEBUFF', damage: 2, block: 0, hits: 6, effects: [{ effectId: 'burn', amount: 3, target: 'player_discard' }],    weight: 1, animation: 'fire'   },
            { id: 'sear',     name: 'Sear',     type: 'ATTACK_DEBUFF', damage: 6, block: 0, hits: 1, effects: [{ effectId: 'burn', amount: 1, target: 'player_discard' }],    weight: 1, animation: 'sear'   },
            { id: 'tackle',   name: 'Tackle',   type: 'ATTACK',  damage: 5, block: 0, hits: 2, effects: [],                                                                  weight: 1, animation: 'tackle' }
        ],
        onCreate: function (inst) {
            inst.cycleIndex = 0;
            inst.cycle = ['sear', 'tackle', 'sear', 'inferno', 'sear', 'tackle'];
        },
        ai: function (enemy) {
            var turn = enemy.moveHistory.length;
            if (turn === 0) return moveIndexById(enemy.moveset, 'activate');
            if (turn === 1) return moveIndexById(enemy.moveset, 'divider');
            var moveId = enemy.cycle[enemy.cycleIndex % enemy.cycle.length];
            enemy.cycleIndex++;
            return moveIndexById(enemy.moveset, moveId);
        }
    };

    // ------------------------------------------------------------------
    // 14  SLIME BOSS  (ACT 1 BOSS)
    // ------------------------------------------------------------------
    definitions.SLIME_BOSS = {
        id: 'SLIME_BOSS',
        name: 'Slime Boss',
        hpRange: [140, 140],
        image: 'assets/enemies/slime_boss.png',
        type: 'BOSS',
        act: 1,
        moveset: [
            { id: 'goop_spray', name: 'Goop Spray', type: 'ATTACK',  damage: 28, block: 0, hits: 1, effects: [],  weight: 1, animation: 'spray' },
            { id: 'preparing',  name: 'Preparing',  type: 'UNKNOWN', damage: 0,  block: 0, hits: 0, effects: [],  weight: 1, animation: 'charge' },
            { id: 'slam',       name: 'Slam',       type: 'ATTACK',  damage: 35, block: 0, hits: 1, effects: [],  weight: 1, animation: 'slam' },
            { id: 'split',      name: 'Split',      type: 'UNKNOWN', damage: 0,  block: 0, hits: 0, effects: [],  weight: 1, animation: 'split' }
        ],
        onCreate: function (inst) {
            inst.slamPrepped = false;
            inst.hasSplit = false;
        },
        ai: function (enemy) {
            if (!enemy.hasSplit && enemy.hp <= 70) {
                enemy.hasSplit = true;
                return moveIndexById(enemy.moveset, 'split');
            }
            if (enemy.slamPrepped) {
                enemy.slamPrepped = false;
                return moveIndexById(enemy.moveset, 'slam');
            }
            var last = enemy.moveHistory.length > 0
                ? enemy.moveset[enemy.moveHistory[enemy.moveHistory.length - 1]]
                : null;
            if (last && last.id === 'goop_spray') {
                enemy.slamPrepped = true;
                return moveIndexById(enemy.moveset, 'preparing');
            }
            return moveIndexById(enemy.moveset, 'goop_spray');
        }
    };

    // ------------------------------------------------------------------
    // 15  CHOSEN  (ACT 2 NORMAL)
    // ------------------------------------------------------------------
    definitions.CHOSEN = {
        id: 'CHOSEN',
        name: 'Chosen',
        hpRange: [95, 99],
        image: 'assets/enemies/chosen.png',
        type: 'NORMAL',
        act: 2,
        moveset: [
            { id: 'poke',       name: 'Poke',       type: 'ATTACK',        damage: 5,  block: 0, hits: 2, effects: [],                                                   weight: 0.50, animation: 'poke'  },
            { id: 'zap',        name: 'Zap',         type: 'ATTACK',        damage: 18, block: 0, hits: 1, effects: [],                                                   weight: 0.50, animation: 'zap'   },
            { id: 'hex',        name: 'Hex',          type: 'DEBUFF',        damage: 0,  block: 0, hits: 0, effects: [{ effectId: 'hex', amount: 1, target: 'player' }],   weight: 0.50, animation: 'hex'   },
            { id: 'debilitate', name: 'Debilitate',  type: 'DEBUFF',        damage: 0,  block: 0, hits: 0, effects: [{ effectId: 'vulnerable', amount: 3, target: 'player' }], weight: 0.50, animation: 'debil' }
        ],
        ai: function (enemy) {
            if (enemy.moveHistory.length === 0) {
                return Math.random() < 0.5 ? 2 : 3; // Hex or Debilitate first
            }
            var last = enemy.moveHistory[enemy.moveHistory.length - 1];
            return last === 0 ? 1 : 0; // alternate Poke and Zap
        }
    };

    // ------------------------------------------------------------------
    // 16  BYRD  (ACT 2 NORMAL)
    // ------------------------------------------------------------------
    definitions.BYRD = {
        id: 'BYRD',
        name: 'Byrd',
        hpRange: [25, 31],
        image: 'assets/enemies/byrd.png',
        type: 'NORMAL',
        act: 2,
        moveset: [
            { id: 'peck',  name: 'Peck',  type: 'ATTACK', damage: 1,  block: 0, hits: 5, effects: [],                                       weight: 1, animation: 'peck'  },
            { id: 'fly',   name: 'Fly',   type: 'BUFF',   damage: 0,  block: 0, hits: 0, effects: [{ effectId: 'strength', amount: 3, target: 'self' }], weight: 1, animation: 'fly'   },
            { id: 'swoop', name: 'Swoop', type: 'ATTACK', damage: 12, block: 0, hits: 1, effects: [],                                       weight: 1, animation: 'swoop' }
        ],
        onCreate: function (inst) {
            inst.flying = true;
            inst.flyTurns = 0;
        },
        ai: function (enemy) {
            if (enemy.flying) {
                enemy.flyTurns = (enemy.flyTurns || 0) + 1;
                if (enemy.flyTurns <= 2) return 0; // Peck while flying
                enemy.flying = false;
                enemy.flyTurns = 0;
                return 2; // Swoop to dive
            }
            // grounded: peck once then fly
            if (enemy.moveHistory.length > 0 && enemy.moveset[enemy.moveHistory[enemy.moveHistory.length - 1]].id === 'peck') {
                enemy.flying = true;
                enemy.flyTurns = 0;
                return 1; // Fly
            }
            return 0; // Peck when grounded
        }
    };

    // ------------------------------------------------------------------
    // 17  SHELLED PARASITE  (ACT 2 NORMAL)
    // ------------------------------------------------------------------
    definitions.SHELLED_PARASITE = {
        id: 'SHELLED_PARASITE',
        name: 'Shelled Parasite',
        hpRange: [68, 72],
        image: 'assets/enemies/shelled_parasite.png',
        type: 'NORMAL',
        act: 2,
        moveset: [
            { id: 'double_strike', name: 'Double Strike', type: 'ATTACK',        damage: 6,  block: 0, hits: 2, effects: [],                                                                                          weight: 0.50, animation: 'slash' },
            { id: 'fell',          name: 'Fell',          type: 'ATTACK_DEBUFF', damage: 18, block: 0, hits: 1, effects: [{ effectId: 'frail', amount: 2, target: 'player' }],                                        weight: 0.50, animation: 'smash' },
            { id: 'stunned',       name: 'Stunned',       type: 'UNKNOWN',       damage: 0,  block: 0, hits: 0, effects: [],                                                                                          weight: 0,    animation: 'stun'  }
        ],
        initPowers: function () { return { platedArmor: 14 }; },
        onCreate: function (inst) {
            inst.attackHitsTaken = 0;
        },
        onDamage: function (enemy) {
            enemy.attackHitsTaken = (enemy.attackHitsTaken || 0) + 1;
        },
        ai: function (enemy) {
            if (enemy.attackHitsTaken >= 5) {
                enemy.attackHitsTaken = 0;
                if (enemy.powers) delete enemy.powers.platedArmor;
                return 2; // stunned
            }
            var last = enemy.moveHistory.length > 0 ? enemy.moveHistory[enemy.moveHistory.length - 1] : -1;
            return last === 0 ? 1 : 0;
        }
    };

    // ------------------------------------------------------------------
    // 18  BOOK OF STABBING  (ACT 2 ELITE)
    // ------------------------------------------------------------------
    definitions.BOOK_OF_STABBING = {
        id: 'BOOK_OF_STABBING',
        name: 'Book of Stabbing',
        hpRange: [160, 164],
        image: 'assets/enemies/book_of_stabbing.png',
        type: 'ELITE',
        act: 2,
        moveset: [
            { id: 'multi_stab',  name: 'Multi Stab',  type: 'ATTACK', damage: 6,  block: 0, hits: 2, effects: [], weight: 0.50, animation: 'multi_stab' },
            { id: 'single_stab', name: 'Single Stab', type: 'ATTACK', damage: 21, block: 0, hits: 1, effects: [], weight: 0.50, animation: 'stab' }
        ],
        onCreate: function (inst) {
            inst.multiStabCount = 2;
            inst.moveset = JSON.parse(JSON.stringify(inst.moveset));
        },
        ai: function (enemy) {
            var last = enemy.moveHistory.length > 0 ? enemy.moveHistory[enemy.moveHistory.length - 1] : -1;
            if (last === 1 || last === -1) {
                enemy.moveset[0].hits = enemy.multiStabCount;
                enemy.multiStabCount++;
                return 0;
            }
            return 1;
        }
    };

    // ------------------------------------------------------------------
    // 19  GREMLIN LEADER  (ACT 2 ELITE)
    // ------------------------------------------------------------------
    definitions.GREMLIN_LEADER = {
        id: 'GREMLIN_LEADER',
        name: 'Gremlin Leader',
        hpRange: [140, 148],
        image: 'assets/enemies/gremlin.png',
        type: 'ELITE',
        act: 2,
        moveset: [
            { id: 'rally',     name: 'Rally',     type: 'BUFF',   damage: 0, block: 0, hits: 0, effects: [{ effectId: 'summon_gremlins', amount: 2, target: 'self' }], weight: 0.33, animation: 'rally' },
            { id: 'encourage', name: 'Encourage', type: 'BUFF',   damage: 0, block: 6, hits: 0, effects: [{ effectId: 'strength', amount: 3, target: 'all_minions' }], weight: 0.33, animation: 'buff' },
            { id: 'stab',      name: 'Stab',      type: 'ATTACK', damage: 6, block: 0, hits: 3, effects: [], weight: 0.33, animation: 'stab' }
        ],
        onCreate: function (inst) {
            inst.minions = [];
        },
        ai: function (enemy) {
            var aliveMinions = (enemy.minions || []).filter(function (m) { return m && m.alive; }).length;
            if (aliveMinions < 2) return 0; // Rally
            var last = enemy.moveHistory.length > 0 ? enemy.moveHistory[enemy.moveHistory.length - 1] : -1;
            return last === 1 ? 2 : 1; // alternate Encourage and Stab
        }
    };

    // Gremlin minion types for Gremlin Leader
    definitions.MAD_GREMLIN = {
        id: 'MAD_GREMLIN',
        name: 'Mad Gremlin',
        hpRange: [20, 20],
        image: 'assets/enemies/gremlin.png',
        type: 'MINION',
        act: 2,
        moveset: [
            { id: 'scratch', name: 'Scratch', type: 'ATTACK', damage: 4, block: 0, hits: 1, effects: [], weight: 1, animation: 'scratch' }
        ],
        ai: function () { return 0; }
    };

    definitions.SNEAKY_GREMLIN = {
        id: 'SNEAKY_GREMLIN',
        name: 'Sneaky Gremlin',
        hpRange: [10, 10],
        image: 'assets/enemies/gremlin.png',
        type: 'MINION',
        act: 2,
        moveset: [
            { id: 'puncture', name: 'Puncture', type: 'ATTACK', damage: 9, block: 0, hits: 1, effects: [], weight: 1, animation: 'stab' }
        ],
        ai: function () { return 0; }
    };

    definitions.FAT_GREMLIN = {
        id: 'FAT_GREMLIN',
        name: 'Fat Gremlin',
        hpRange: [13, 13],
        image: 'assets/enemies/gremlin.png',
        type: 'MINION',
        act: 2,
        moveset: [
            { id: 'smash', name: 'Smash', type: 'DEBUFF', damage: 0, block: 0, hits: 0, effects: [{ effectId: 'frail', amount: 1, target: 'player' }, { effectId: 'weakness', amount: 1, target: 'player' }], weight: 1, animation: 'smash' }
        ],
        ai: function () { return 0; }
    };

    definitions.SHIELD_GREMLIN = {
        id: 'SHIELD_GREMLIN',
        name: 'Shield Gremlin',
        hpRange: [12, 12],
        image: 'assets/enemies/gremlin.png',
        type: 'MINION',
        act: 2,
        moveset: [
            { id: 'protect', name: 'Protect', type: 'DEFEND', damage: 0, block: 7, hits: 0, effects: [{ effectId: 'block_ally', amount: 7, target: 'random_ally' }], weight: 1, animation: 'shield' }
        ],
        ai: function () { return 0; }
    };

    // ------------------------------------------------------------------
    // 20  THE CHAMP  (ACT 2 BOSS)
    // ------------------------------------------------------------------
    definitions.THE_CHAMP = {
        id: 'THE_CHAMP',
        name: 'The Champ',
        hpRange: [420, 420],
        image: 'assets/enemies/the_champ.png',
        type: 'BOSS',
        act: 2,
        moveset: [
            // Phase 1
            { id: 'face_slap',       name: 'Face Slap',       type: 'ATTACK_DEBUFF',  damage: 12, block: 0,  hits: 1, effects: [{ effectId: 'frail', amount: 2, target: 'player' }],                     weight: 0.25, animation: 'slap'   },
            { id: 'heavy_slam',      name: 'Heavy Slam',      type: 'ATTACK',         damage: 18, block: 0,  hits: 1, effects: [],                                                                       weight: 0.25, animation: 'slam'   },
            { id: 'gust',            name: 'Gust',            type: 'ATTACK_DEBUFF',  damage: 16, block: 0,  hits: 1, effects: [{ effectId: 'weakness', amount: 2, target: 'player' }],                   weight: 0.20, animation: 'gust'   },
            { id: 'taunt',           name: 'Taunt',           type: 'DEBUFF',         damage: 0,  block: 0,  hits: 0, effects: [{ effectId: 'vulnerable', amount: 2, target: 'player' }, { effectId: 'weakness', amount: 2, target: 'player' }], weight: 0.15, animation: 'taunt' },
            { id: 'defensive_stance',name: 'Defensive Stance',type: 'DEFEND',         damage: 0,  block: 15, hits: 0, effects: [{ effectId: 'metallicize', amount: 2, target: 'self' }],                  weight: 0.15, animation: 'block'  },
            // Phase 2
            { id: 'limit_break',     name: 'Limit Break',     type: 'BUFF',           damage: 0,  block: 0,  hits: 0, effects: [{ effectId: 'strength', amount: 6, target: 'self' }, { effectId: 'clear_debuffs', amount: 1, target: 'self' }], weight: 0, animation: 'rage' },
            { id: 'execute',         name: 'Execute',         type: 'ATTACK',         damage: 10, block: 0,  hits: 2, effects: [],                                                                       weight: 0.50, animation: 'exec'   },
            { id: 'anger',           name: 'Anger',           type: 'BUFF',           damage: 0,  block: 25, hits: 0, effects: [{ effectId: 'strength', amount: 9, target: 'self' }],                     weight: 0.50, animation: 'anger'  }
        ],
        onCreate: function (inst) {
            inst.phase = 1;
            inst.hasLimitBroken = false;
            inst.thresholdChecked = false;
        },
        ai: function (enemy) {
            if (enemy.phase === 1) {
                if (enemy.hp <= enemy.maxHp * 0.5 && !enemy.hasLimitBroken) {
                    enemy.phase = 2;
                    enemy.hasLimitBroken = true;
                    return 5; // Limit Break
                }
                var excluded = [];
                // exclude Phase 2 moves
                excluded.push(5, 6, 7);
                if (lastNSame(enemy.moveHistory, 2)) {
                    excluded.push(enemy.moveHistory[enemy.moveHistory.length - 1]);
                }
                var m = weightedPick(enemy.moveset, excluded);
                return moveIndexById(enemy.moveset, m.id);
            }
            // Phase 2
            if (!enemy.thresholdChecked) {
                enemy.thresholdChecked = true;
                // Limit Break already returned above, now do phase2 moves
            }
            var last = enemy.moveHistory.length > 0 ? enemy.moveHistory[enemy.moveHistory.length - 1] : -1;
            return last === 6 ? 7 : 6; // alternate Execute and Anger
        }
    };

    // ── encounter pools ──────────────────────────────────────────────────

    var encounterPools = {
        1: {
            NORMAL: [
                ['JAW_WORM'],
                ['CULTIST'],
                ['RED_LOUSE', 'RED_LOUSE'],
                ['RED_LOUSE', 'GREEN_LOUSE'],
                ['ACID_SLIME_M'],
                ['SPIKE_SLIME_M'],
                ['SMALL_ACID_SLIME', 'SMALL_ACID_SLIME', 'SMALL_SPIKE_SLIME'],
                ['JAW_WORM', 'RED_LOUSE']
            ],
            ELITE: [
                ['GREMLIN_NOB'],
                ['LAGAVULIN'],
                ['SENTRY', 'SENTRY', 'SENTRY']
            ],
            BOSS: [
                ['THE_GUARDIAN'],
                ['HEXAGHOST'],
                ['SLIME_BOSS']
            ]
        },
        2: {
            NORMAL: [
                ['CHOSEN'],
                ['BYRD', 'BYRD'],
                ['SHELLED_PARASITE'],
                ['CHOSEN', 'BYRD'],
                ['BYRD', 'BYRD', 'BYRD'],
                ['SHELLED_PARASITE', 'BYRD']
            ],
            ELITE: [
                ['BOOK_OF_STABBING'],
                ['GREMLIN_LEADER']
            ],
            BOSS: [
                ['THE_CHAMP']
            ]
        }
    };

    // ── public API ───────────────────────────────────────────────────────

    function createInstance(enemyId, eliteModifier) {
        var def = definitions[enemyId];
        if (!def) {
            console.error('[STS.Enemies] Unknown enemy id:', enemyId);
            return null;
        }

        var hp = randInt(def.hpRange[0], def.hpRange[1]);
        var inst = {
            id:            def.id,
            name:          def.name,
            hp:            hp,
            maxHp:         hp,
            hpRange:       def.hpRange,
            block:         0,
            statusEffects: {},
            intent:        null,
            image:         def.image,
            type:          def.type,
            act:           def.act,
            powers:        def.initPowers ? def.initPowers() : {},
            moveHistory:   [],
            moveIndex:     0,
            moveset:       JSON.parse(JSON.stringify(def.moveset)),
            ai:            def.ai,
            onDamage:      def.onDamage || null,
            instanceId:    nextInstanceId(),
            alive:         true
        };

        if (def.onCreate) def.onCreate(inst);

        if (eliteModifier) {
            applyEliteModifier(inst, eliteModifier);
        }

        return inst;
    }

    function isAlive(enemy) {
        return enemy && enemy.hp > 0 && enemy.alive;
    }

    function getIntent(enemy) {
        if (enemy.intent === null || enemy.intent === undefined) return null;
        var move = enemy.moveset[enemy.intent];
        if (!move) return null;
        return move;
    }

    function getIntentDisplay(enemy) {
        var move = getIntent(enemy);
        if (!move) {
            return { icon: INTENT_ICONS.UNKNOWN, text: '?', damage: 0, block: 0 };
        }

        var str = (enemy.powers && enemy.powers.strength) || 0;
        var baseDmg = move.damage + str;
        if (baseDmg < 0) baseDmg = 0;
        var totalDmg = baseDmg * (move.hits || 1);

        var icon = INTENT_ICONS[move.type] || INTENT_ICONS.UNKNOWN;
        var text = move.name;

        if (move.type === 'ATTACK' || move.type === 'ATTACK_DEBUFF' || move.type === 'ATTACK_DEFEND') {
            if (move.hits > 1) {
                text = baseDmg + 'x' + move.hits;
            } else {
                text = String(baseDmg);
            }
        } else if (move.type === 'DEFEND') {
            text = String(move.block);
        }

        return {
            icon:   icon,
            text:   text,
            damage: totalDmg,
            block:  move.block,
            name:   move.name,
            type:   move.type,
            hits:   move.hits || 1
        };
    }

    function chooseNextMove(enemy) {
        if (!enemy.ai) return 0;
        var idx = enemy.ai(enemy);
        return idx;
    }

    function updateIntent(enemy, state) {
        var idx = chooseNextMove(enemy);
        enemy.intent = idx;
        return idx;
    }

    function applyIntentEffects(enemy, state) {
        var move = getIntent(enemy);
        if (!move) return null;

        var str = (enemy.powers && enemy.powers.strength) || 0;
        var baseDmg = move.damage + str;
        if (baseDmg < 0) baseDmg = 0;

        var result = {
            moveId:     move.id,
            moveName:   move.name,
            moveType:   move.type,
            damage:     baseDmg,
            hits:       move.hits || 1,
            totalDamage: baseDmg * (move.hits || 1),
            block:      move.block,
            effects:    move.effects ? move.effects.slice() : [],
            animation:  move.animation
        };

        // Apply block to enemy
        if (move.block > 0) {
            enemy.block += move.block;
        }

        // Apply self-targeted effects
        for (var i = 0; i < result.effects.length; i++) {
            var eff = result.effects[i];
            if (eff.target === 'self') {
                if (!enemy.powers) enemy.powers = {};
                enemy.powers[eff.effectId] = (enemy.powers[eff.effectId] || 0) + eff.amount;
            }
        }

        // Record in move history
        enemy.moveHistory.push(enemy.intent);
        if (enemy.moveHistory.length > 5) {
            enemy.moveHistory.shift();
        }

        return result;
    }

    function executeIntent(enemy, state) {
        if (!isAlive(enemy)) return null;
        var result = applyIntentEffects(enemy, state);
        // Ritual: gain strength at end of turn
        if (enemy.powers && enemy.powers.ritual) {
            enemy.powers.strength = (enemy.powers.strength || 0) + enemy.powers.ritual;
        }
        // Metallicize: gain block at end of turn
        if (enemy.powers && enemy.powers.metallicize) {
            enemy.block += enemy.powers.metallicize;
        }
        // Plated Armor: gain block at end of turn
        if (enemy.powers && enemy.powers.platedArmor) {
            enemy.block += enemy.powers.platedArmor;
        }
        return result;
    }

    function getRandomEncounter(act, type) {
        var pool = encounterPools[act];
        if (!pool) {
            console.warn('[STS.Enemies] No encounters for act', act);
            pool = encounterPools[1];
        }
        var encounters = pool[type];
        if (!encounters || encounters.length === 0) {
            console.warn('[STS.Enemies] No encounters for type', type, 'in act', act);
            encounters = pool.NORMAL;
        }

        var template = pick(encounters);
        var instances = [];

        for (var i = 0; i < template.length; i++) {
            var inst = createInstance(template[i]);
            if (inst) {
                // Assign sentry slots for sentry encounters
                if (inst.id === 'SENTRY') {
                    inst.sentrySlot = i;
                }
                instances.push(inst);
            }
        }

        return instances;
    }

    function getMultiEncounter(act) {
        var multiPools = {
            1: [
                ['RED_LOUSE', 'RED_LOUSE'],
                ['RED_LOUSE', 'GREEN_LOUSE'],
                ['CULTIST', 'CULTIST'],
                ['JAW_WORM', 'RED_LOUSE'],
                ['SMALL_ACID_SLIME', 'SMALL_ACID_SLIME', 'SMALL_SPIKE_SLIME'],
                ['SMALL_SPIKE_SLIME', 'SMALL_ACID_SLIME', 'SMALL_SPIKE_SLIME'],
                ['JAW_WORM', 'GREEN_LOUSE'],
                ['GREEN_LOUSE', 'GREEN_LOUSE']
            ],
            2: [
                ['CHOSEN', 'BYRD'],
                ['BYRD', 'BYRD', 'BYRD'],
                ['SHELLED_PARASITE', 'BYRD'],
                ['CHOSEN', 'CHOSEN'],
                ['BYRD', 'BYRD'],
                ['SHELLED_PARASITE', 'CHOSEN']
            ]
        };

        var pool = multiPools[act] || multiPools[1];
        var template = pick(pool);
        var instances = [];

        for (var i = 0; i < template.length; i++) {
            var inst = createInstance(template[i]);
            if (inst) instances.push(inst);
        }
        return instances;
    }

    function applyEliteModifier(enemy, modifier) {
        switch (modifier) {
            case 'HP_UP':
                var bonus = Math.floor(enemy.maxHp * 0.25);
                enemy.maxHp += bonus;
                enemy.hp += bonus;
                break;
            case 'STR_UP':
                if (!enemy.powers) enemy.powers = {};
                enemy.powers.strength = (enemy.powers.strength || 0) + 2;
                break;
            case 'METAL':
                if (!enemy.powers) enemy.powers = {};
                enemy.powers.metallicize = (enemy.powers.metallicize || 0) + 4;
                break;
            case 'REGEN':
                if (!enemy.powers) enemy.powers = {};
                enemy.powers.regenerate = (enemy.powers.regenerate || 0) + 3;
                break;
            case 'THORNS':
                if (!enemy.powers) enemy.powers = {};
                enemy.powers.thorns = (enemy.powers.thorns || 0) + 3;
                break;
            case 'FAST':
                for (var i = 0; i < enemy.moveset.length; i++) {
                    if (enemy.moveset[i].damage > 0) {
                        enemy.moveset[i].damage += 2;
                    }
                }
                break;
            default:
                break;
        }
    }

    // ── damage / death helpers ───────────────────────────────────────────

    function dealDamageToEnemy(enemy, amount) {
        if (!isAlive(enemy)) return { blocked: 0, hpLost: 0, died: false };

        var blocked = Math.min(enemy.block, amount);
        var remaining = amount - blocked;
        enemy.block -= blocked;

        if (remaining > 0) {
            // Curl Up: first time attacked, gain block
            if (enemy.powers && enemy.powers.curlUp && enemy.powers.curlUp > 0) {
                var curlBlock = enemy.powers.curlUp;
                enemy.powers.curlUp = 0;
                enemy.block += curlBlock;
                var curlBlocked = Math.min(enemy.block, remaining);
                remaining -= curlBlocked;
                enemy.block -= curlBlocked;
                blocked += curlBlocked;
            }

            enemy.hp -= remaining;
            if (enemy.hp <= 0) {
                enemy.hp = 0;
                enemy.alive = false;
            }
        }

        if (enemy.onDamage && remaining > 0) {
            enemy.onDamage(enemy, remaining);
        }

        // Lagavulin wake-up
        if (enemy.asleep && remaining > 0) {
            enemy.asleep = false;
            enemy.sleepTurns = 999; // force wake on next AI call
        }

        return {
            blocked: blocked,
            hpLost:  remaining > 0 ? remaining : 0,
            died:    !enemy.alive
        };
    }

    function startTurn(enemy) {
        enemy.block = 0;
    }

    function endTurn(enemy) {
        if (!isAlive(enemy)) return;

        if (enemy.powers) {
            // Regenerate
            if (enemy.powers.regenerate && enemy.powers.regenerate > 0) {
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.powers.regenerate);
            }
        }
    }

    // ── Slime Boss split logic ───────────────────────────────────────────

    function handleSlimeBossSplit(boss) {
        if (boss.id !== 'SLIME_BOSS') return [];
        var splitHp = boss.hp;
        boss.alive = false;
        boss.hp = 0;

        var slime1 = createInstance('ACID_SLIME_M');
        var slime2 = createInstance('SPIKE_SLIME_M');

        if (slime1) {
            slime1.hp = splitHp;
            slime1.maxHp = splitHp;
        }
        if (slime2) {
            slime2.hp = splitHp;
            slime2.maxHp = splitHp;
        }

        return [slime1, slime2].filter(Boolean);
    }

    // ── Gremlin Leader summon logic ──────────────────────────────────────

    var GREMLIN_POOL = ['MAD_GREMLIN', 'SNEAKY_GREMLIN', 'FAT_GREMLIN', 'SHIELD_GREMLIN'];

    function summonGremlins(leader, count) {
        var summoned = [];
        for (var i = 0; i < count; i++) {
            var type = pick(GREMLIN_POOL);
            var gremlin = createInstance(type);
            if (gremlin) {
                summoned.push(gremlin);
                if (!leader.minions) leader.minions = [];
                leader.minions.push(gremlin);
            }
        }
        return summoned;
    }

    // ── comprehensive enemy info dump ────────────────────────────────────

    function getEnemyInfo(enemyId) {
        var def = definitions[enemyId];
        if (!def) return null;
        return {
            id:      def.id,
            name:    def.name,
            hpRange: def.hpRange,
            type:    def.type,
            act:     def.act,
            image:   def.image,
            moves:   def.moveset.map(function (m) {
                return {
                    id:     m.id,
                    name:   m.name,
                    type:   m.type,
                    damage: m.damage,
                    hits:   m.hits,
                    block:  m.block,
                    effects: m.effects
                };
            })
        };
    }

    function getAllEnemyIds() {
        return Object.keys(definitions);
    }

    function getEnemiesByAct(act) {
        return Object.keys(definitions).filter(function (k) {
            return definitions[k].act === act;
        });
    }

    function getEnemiesByType(type) {
        return Object.keys(definitions).filter(function (k) {
            return definitions[k].type === type;
        });
    }

    // ── return public interface ──────────────────────────────────────────

    return {
        definitions:        definitions,
        createInstance:      createInstance,
        getIntent:          getIntent,
        getIntentDisplay:   getIntentDisplay,
        chooseNextMove:     chooseNextMove,
        updateIntent:       updateIntent,
        applyIntentEffects: applyIntentEffects,
        executeIntent:      executeIntent,
        getRandomEncounter: getRandomEncounter,
        getMultiEncounter:  getMultiEncounter,
        applyEliteModifier: applyEliteModifier,
        isAlive:            isAlive,
        dealDamageToEnemy:  dealDamageToEnemy,
        startTurn:          startTurn,
        endTurn:            endTurn,
        handleSlimeBossSplit: handleSlimeBossSplit,
        summonGremlins:     summonGremlins,
        getEnemyInfo:       getEnemyInfo,
        getAllEnemyIds:     getAllEnemyIds,
        getEnemiesByAct:    getEnemiesByAct,
        getEnemiesByType:   getEnemiesByType,
        INTENT_ICONS:       INTENT_ICONS
    };

})();
