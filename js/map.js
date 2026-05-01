/**
 * @file map.js
 * @description Procedural map generation and canvas rendering for Slay the Spire web app.
 * Generates branching node graphs, renders them on an HTML5 Canvas with animations,
 * and handles player navigation through the map.
 * Uses the global STS namespace pattern.
 */

window.STS = window.STS || {};

/* ======================================================================
 *  CONSTANTS
 * ====================================================================== */

var MAP_FLOORS = 15;
var BOSS_FLOOR = 15;
var TOTAL_FLOORS = 16;
var NODE_RADIUS = 22;
var NODE_HOVER_RADIUS = 28;
var FLOOR_HEIGHT = 110;
var MAP_PADDING_X = 80;
var MAP_PADDING_Y = 80;
var SCROLL_SPEED = 0.12;
var DASH_OFFSET_SPEED = 0.8;
var TOOLTIP_PADDING = 8;
var TOOLTIP_FONT = '14px "Segoe UI", Arial, sans-serif';
var LABEL_FONT = '12px "Segoe UI", Arial, sans-serif';
var ICON_FONT = '20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial';
var TITLE_FONT = 'bold 24px "Segoe UI", Arial, sans-serif';

var NODE_TYPES = {
    MONSTER:  { icon: '\u2694\uFE0F', color: '#ff4444', name: 'Monster',  weight: 0.45 },
    ELITE:    { icon: '\uD83D\uDD25', color: '#ff8800', name: 'Elite',    weight: 0.08 },
    REST:     { icon: '\uD83D\uDD25', color: '#00cc44', name: 'Rest Site',weight: 0.12 },
    SHOP:     { icon: '\uD83D\uDCB0', color: '#ffd700', name: 'Shop',     weight: 0.05 },
    EVENT:    { icon: '\u2753',        color: '#aa44ff', name: 'Event',    weight: 0.22 },
    TREASURE: { icon: '\uD83D\uDCE6', color: '#ffaa00', name: 'Treasure', weight: 0.08 },
    BOSS:     { icon: '\uD83D\uDC80', color: '#ff0000', name: 'Boss',     weight: 0 }
};

var ACT_NAMES = ['', 'Act I - Exordium', 'Act II - The City', 'Act III - The Beyond'];

/* ======================================================================
 *  SEEDED RNG (local to map module for generation)
 * ====================================================================== */

function MapRNG(seed) {
    this.state = seed >>> 0;
}

MapRNG.prototype.next = function () {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
};

MapRNG.prototype.nextInt = function (min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
};

MapRNG.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
};

/* ======================================================================
 *  LINE SEGMENT INTERSECTION
 * ====================================================================== */

function segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    var dax = ax2 - ax1;
    var day = ay2 - ay1;
    var dbx = bx2 - bx1;
    var dby = by2 - by1;
    var denom = dax * dby - day * dbx;

    if (Math.abs(denom) < 1e-10) return false;

    var t = ((bx1 - ax1) * dby - (by1 - ay1) * dbx) / denom;
    var u = ((bx1 - ax1) * day - (by1 - ay1) * dax) / denom;

    return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

/* ======================================================================
 *  MAP GENERATION
 * ====================================================================== */

/**
 * Generate a full map for one act.
 *
 * @param {number} act  - Act number (1-3).
 * @param {number} seed - RNG seed.
 * @returns {{ nodes: Object[], paths: Object[] }}
 */
function generateActMap(act, seed) {
    var rng = new MapRNG(seed);
    var floors = [];
    var allNodes = [];
    var allPaths = [];
    var nodeIndex = 0;

    /* ---- Step 1: decide how many nodes per floor ---- */
    var nodeCounts = [];
    for (var f = 0; f <= BOSS_FLOOR; f++) {
        if (f === BOSS_FLOOR) {
            nodeCounts.push(1);
        } else if (f === 0) {
            nodeCounts.push(rng.nextInt(3, 4));
        } else {
            nodeCounts.push(rng.nextInt(2, 4));
        }
    }

    /* ---- Step 2: create node positions ---- */
    for (var f = 0; f <= BOSS_FLOOR; f++) {
        var count = nodeCounts[f];
        var floorNodes = [];

        for (var c = 0; c < count; c++) {
            var node = {
                id: 'node_' + f + '_' + c,
                floor: f,
                column: c,
                x: 0,
                y: 0,
                type: 'MONSTER',
                connections: [],
                visited: false,
                reachable: false,
                revealed: true
            };
            floorNodes.push(node);
            allNodes.push(node);
            nodeIndex++;
        }
        floors.push(floorNodes);
    }

    /* ---- Step 3: assign pixel positions ---- */
    var canvasWidth = 600;
    var totalMapHeight = (BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2;
    for (var f = 0; f <= BOSS_FLOOR; f++) {
        var row = floors[f];
        var count = row.length;
        var usableWidth = canvasWidth - MAP_PADDING_X * 2;
        var spacing = count > 1 ? usableWidth / (count - 1) : 0;
        var startX = count > 1 ? MAP_PADDING_X : canvasWidth / 2;

        for (var c = 0; c < count; c++) {
            var jitterX = count > 1 ? (rng.next() - 0.5) * 30 : 0;
            var jitterY = (rng.next() - 0.5) * 16;
            row[c].x = startX + c * spacing + jitterX;
            row[c].y = totalMapHeight - MAP_PADDING_Y - f * FLOOR_HEIGHT + jitterY;
        }
    }

    /* ---- Step 4: connect nodes (bottom-up), prevent crossings ---- */
    for (var f = 0; f < BOSS_FLOOR; f++) {
        var currentRow = floors[f];
        var nextRow = floors[f + 1];

        for (var c = 0; c < currentRow.length; c++) {
            var src = currentRow[c];
            var bestIdx = findClosestColumn(src.column, currentRow.length, nextRow.length);

            if (!wouldCross(src, nextRow[bestIdx], allPaths, allNodes)) {
                addConnection(src, nextRow[bestIdx], allPaths);
            } else {
                var added = false;
                for (var tryIdx = 0; tryIdx < nextRow.length; tryIdx++) {
                    if (!wouldCross(src, nextRow[tryIdx], allPaths, allNodes)) {
                        addConnection(src, nextRow[tryIdx], allPaths);
                        added = true;
                        break;
                    }
                }
                if (!added) {
                    addConnection(src, nextRow[bestIdx], allPaths);
                }
            }

            if (rng.next() < 0.45 && nextRow.length > 1) {
                var altIdx = bestIdx + (rng.next() < 0.5 ? -1 : 1);
                altIdx = Math.max(0, Math.min(nextRow.length - 1, altIdx));
                if (altIdx !== bestIdx && !hasConnection(src, nextRow[altIdx])) {
                    if (!wouldCross(src, nextRow[altIdx], allPaths, allNodes)) {
                        addConnection(src, nextRow[altIdx], allPaths);
                    }
                }
            }
        }

        /* ensure every node in nextRow has at least one incoming connection */
        for (var n = 0; n < nextRow.length; n++) {
            if (!hasIncoming(nextRow[n], allPaths)) {
                var closestSrc = null;
                var closestDist = Infinity;
                for (var s = 0; s < currentRow.length; s++) {
                    var dist = Math.abs(currentRow[s].x - nextRow[n].x);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestSrc = currentRow[s];
                    }
                }
                if (closestSrc) {
                    addConnection(closestSrc, nextRow[n], allPaths);
                }
            }
        }
    }

    /* ---- Step 5: assign node types ---- */
    assignNodeTypes(floors, allNodes, allPaths, rng, act);

    /* ---- Step 6: mark floor-0 nodes as reachable ---- */
    for (var c = 0; c < floors[0].length; c++) {
        floors[0][c].reachable = true;
    }

    return { nodes: allNodes, paths: allPaths };
}

function findClosestColumn(srcCol, srcCount, dstCount) {
    var ratio = dstCount > 1 ? srcCol / Math.max(srcCount - 1, 1) : 0.5;
    return Math.round(ratio * (dstCount - 1));
}

function addConnection(src, dst, allPaths) {
    if (src.connections.indexOf(dst.id) === -1) {
        src.connections.push(dst.id);
        allPaths.push({ from: src.id, to: dst.id });
    }
}

function hasConnection(src, dst) {
    return src.connections.indexOf(dst.id) >= 0;
}

function hasIncoming(node, paths) {
    for (var i = 0; i < paths.length; i++) {
        if (paths[i].to === node.id) return true;
    }
    return false;
}

function wouldCross(src, dst, existingPaths, allNodes) {
    var nodeMap = {};
    for (var i = 0; i < allNodes.length; i++) {
        nodeMap[allNodes[i].id] = allNodes[i];
    }
    for (var i = 0; i < existingPaths.length; i++) {
        var p = existingPaths[i];
        var pSrc = nodeMap[p.from];
        var pDst = nodeMap[p.to];
        if (!pSrc || !pDst) continue;
        if (p.from === src.id || p.to === dst.id) continue;
        if (p.from === dst.id || p.to === src.id) continue;
        if (segmentsIntersect(src.x, src.y, dst.x, dst.y, pSrc.x, pSrc.y, pDst.x, pDst.y)) {
            return true;
        }
    }
    return false;
}

/* ======================================================================
 *  NODE TYPE ASSIGNMENT
 * ====================================================================== */

function assignNodeTypes(floors, allNodes, allPaths, rng, act) {
    var nodeMap = {};
    for (var i = 0; i < allNodes.length; i++) {
        nodeMap[allNodes[i].id] = allNodes[i];
    }

    var hasShop = false;
    var hasRest = false;

    for (var f = 0; f <= BOSS_FLOOR; f++) {
        var row = floors[f];

        for (var c = 0; c < row.length; c++) {
            var node = row[c];

            if (f === 0) {
                node.type = 'MONSTER';
                continue;
            }
            if (f === BOSS_FLOOR) {
                node.type = 'BOSS';
                continue;
            }

            /* guaranteed REST floor before boss */
            if (f === MAP_FLOORS - 1) {
                node.type = 'REST';
                hasRest = true;
                continue;
            }

            /* guaranteed TREASURE at mid-point */
            if (f === 8) {
                node.type = 'TREASURE';
                continue;
            }

            var type = pickWeightedType(rng);

            /* elites cannot appear before floor 5 */
            if (type === 'ELITE' && f < 5) {
                type = 'MONSTER';
            }

            /* no two consecutive REST sites on the same path */
            if (type === 'REST') {
                var prevNodes = getParentNodes(node, allPaths, nodeMap);
                var prevIsRest = false;
                for (var p = 0; p < prevNodes.length; p++) {
                    if (prevNodes[p].type === 'REST') {
                        prevIsRest = true;
                        break;
                    }
                }
                if (prevIsRest) type = 'EVENT';
            }

            node.type = type;

            if (type === 'SHOP') hasShop = true;
            if (type === 'REST') hasRest = true;
        }
    }

    /* guarantee at least 1 shop per act */
    if (!hasShop) {
        var candidates = [];
        for (var i = 0; i < allNodes.length; i++) {
            var n = allNodes[i];
            if (n.floor >= 3 && n.floor <= 12 && n.type === 'MONSTER') {
                candidates.push(n);
            }
        }
        if (candidates.length > 0) {
            rng.pick(candidates).type = 'SHOP';
        }
    }

    /* guarantee at least 1 rest per act (aside from floor 14) */
    if (!hasRest) {
        var candidates = [];
        for (var i = 0; i < allNodes.length; i++) {
            var n = allNodes[i];
            if (n.floor >= 5 && n.floor <= 11 && n.type === 'MONSTER') {
                candidates.push(n);
            }
        }
        if (candidates.length > 0) {
            rng.pick(candidates).type = 'REST';
        }
    }
}

function getParentNodes(node, paths, nodeMap) {
    var parents = [];
    for (var i = 0; i < paths.length; i++) {
        if (paths[i].to === node.id) {
            var parent = nodeMap[paths[i].from];
            if (parent) parents.push(parent);
        }
    }
    return parents;
}

function pickWeightedType(rng) {
    var roll = rng.next();
    var cumulative = 0;
    var types = ['MONSTER', 'EVENT', 'REST', 'ELITE', 'TREASURE', 'SHOP'];
    var weights = [0.45, 0.22, 0.12, 0.08, 0.08, 0.05];

    for (var i = 0; i < types.length; i++) {
        cumulative += weights[i];
        if (roll < cumulative) return types[i];
    }
    return 'MONSTER';
}

/* ======================================================================
 *  STS.Map – RENDERING & INTERACTION
 * ====================================================================== */

STS.Map = {
    canvas: null,
    ctx: null,
    nodes: [],
    paths: [],
    scrollY: 0,
    targetScrollY: 0,
    hoveredNode: null,
    currentAct: 1,
    animationId: null,
    dashOffset: 0,
    particlePool: [],
    mapHeight: 0,
    viewHeight: 0,
    isActive: false,
    nodeMap: {},
    lastTimestamp: 0,

    /* ------------------------------------------------------------------
     *  INITIALIZATION
     * ------------------------------------------------------------------ */

    init: function (canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('[STS.Map] Canvas element "' + canvasId + '" not found.');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.viewHeight = this.canvas.height;

        var self = this;

        this.canvas.addEventListener('click', function (e) {
            var rect = self.canvas.getBoundingClientRect();
            var scaleX = self.canvas.width / rect.width;
            var scaleY = self.canvas.height / rect.height;
            self.handleClick(
                (e.clientX - rect.left) * scaleX,
                (e.clientY - rect.top) * scaleY
            );
        });

        this.canvas.addEventListener('mousemove', function (e) {
            var rect = self.canvas.getBoundingClientRect();
            var scaleX = self.canvas.width / rect.width;
            var scaleY = self.canvas.height / rect.height;
            self.handleMouseMove(
                (e.clientX - rect.left) * scaleX,
                (e.clientY - rect.top) * scaleY
            );
        });

        this.canvas.addEventListener('mouseleave', function () {
            self.hoveredNode = null;
        });

        this.canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            self.handleScroll(e.deltaY);
        }, { passive: false });

        if (STS.Events) {
            STS.Events.on('SCREEN_CHANGED', function (data) {
                if (data.to === 'MAP') {
                    self.syncFromGameState();
                    self.scrollToCurrentFloor();
                    self.start();
                } else {
                    self.stop();
                }
            });
        }
    },

    /* ------------------------------------------------------------------
     *  MAP GENERATION
     * ------------------------------------------------------------------ */

    generate: function (act, seed) {
        this.currentAct = act || 1;
        var s = seed || (Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0));
        var result = generateActMap(this.currentAct, s);
        this.nodes = result.nodes;
        this.paths = result.paths;
        this.rebuildNodeMap();
        this.mapHeight = (BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2;
        this.scrollToCurrentFloor();
    },

    rebuildNodeMap: function () {
        this.nodeMap = {};
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodeMap[this.nodes[i].id] = this.nodes[i];
        }
    },

    /* ------------------------------------------------------------------
     *  SYNC WITH GAME STATE
     * ------------------------------------------------------------------ */

    syncFromGameState: function () {
        if (!STS.Game || !STS.Game.state) return;

        var gm = STS.Game.state.map;
        this.currentAct = gm.currentAct || 1;

        /* Map game.js nodes (flat, numeric id) to Map nodes (string id) */
        if (gm.nodes && gm.nodes.length > 0 && typeof gm.nodes[0].id === 'number') {
            this.syncFromNumericNodes(gm);
        } else if (gm.nodes && gm.nodes.length > 0) {
            this.nodes = gm.nodes;
            this.paths = gm.paths;
            this.rebuildNodeMap();
        }

        this.mapHeight = (BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2;
        this.updateReachability();
    },

    /**
     * Translate numeric-id nodes from game.js into the string-id format
     * used by this renderer, assigning pixel positions along the way.
     */
    syncFromNumericNodes: function (gm) {
        var idMap = {};
        var newNodes = [];
        var floorBuckets = {};

        for (var i = 0; i < gm.nodes.length; i++) {
            var gn = gm.nodes[i];
            var f = gn.floor;
            if (!floorBuckets[f]) floorBuckets[f] = [];
            var col = floorBuckets[f].length;
            var nodeId = 'node_' + f + '_' + col;
            idMap[gn.id] = nodeId;
            floorBuckets[f].push(nodeId);

            newNodes.push({
                id: nodeId,
                floor: f,
                column: col,
                x: 0,
                y: 0,
                type: gn.type,
                connections: [],
                visited: gn.visited || false,
                reachable: gn.available || false,
                revealed: true
            });
        }

        /* assign pixel positions */
        var canvasW = this.canvas ? this.canvas.width : 600;
        var totalH = (BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2;
        var bucketKeys = Object.keys(floorBuckets);
        for (var bi = 0; bi < bucketKeys.length; bi++) {
            var f = parseInt(bucketKeys[bi], 10);
            var ids = floorBuckets[f];
            var count = ids.length;
            var usable = canvasW - MAP_PADDING_X * 2;
            var spacing = count > 1 ? usable / (count - 1) : 0;
            var startX = count > 1 ? MAP_PADDING_X : canvasW / 2;
            for (var c = 0; c < count; c++) {
                var nd = null;
                for (var ni = 0; ni < newNodes.length; ni++) {
                    if (newNodes[ni].id === ids[c]) { nd = newNodes[ni]; break; }
                }
                if (nd) {
                    nd.x = startX + c * spacing;
                    nd.y = totalH - MAP_PADDING_Y - f * FLOOR_HEIGHT;
                }
            }
        }

        /* translate paths */
        var newPaths = [];
        for (var i = 0; i < gm.paths.length; i++) {
            var p = gm.paths[i];
            var fromId = idMap[p.from];
            var toId = idMap[p.to];
            if (fromId && toId) {
                newPaths.push({ from: fromId, to: toId });
                var srcNode = null;
                for (var ni = 0; ni < newNodes.length; ni++) {
                    if (newNodes[ni].id === fromId) { srcNode = newNodes[ni]; break; }
                }
                if (srcNode && srcNode.connections.indexOf(toId) === -1) {
                    srcNode.connections.push(toId);
                }
            }
        }

        /* mark current node and visited */
        if (gm.currentNodeId !== null && gm.currentNodeId !== undefined) {
            var curNewId = idMap[gm.currentNodeId];
            if (curNewId) {
                for (var ni = 0; ni < newNodes.length; ni++) {
                    if (newNodes[ni].id === curNewId) {
                        newNodes[ni].visited = true;
                        break;
                    }
                }
            }
        }
        if (gm.visitedNodes) {
            for (var vi = 0; vi < gm.visitedNodes.length; vi++) {
                var vid = idMap[gm.visitedNodes[vi]];
                if (vid) {
                    for (var ni = 0; ni < newNodes.length; ni++) {
                        if (newNodes[ni].id === vid) {
                            newNodes[ni].visited = true;
                            break;
                        }
                    }
                }
            }
        }

        this.nodes = newNodes;
        this.paths = newPaths;
        this.rebuildNodeMap();
    },

    /* ------------------------------------------------------------------
     *  REACHABILITY
     * ------------------------------------------------------------------ */

    getReachableNodes: function () {
        var result = [];
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].reachable && !this.nodes[i].visited) {
                result.push(this.nodes[i]);
            }
        }
        return result;
    },

    isNodeReachable: function (nodeId) {
        var node = this.nodeMap[nodeId];
        return node ? (node.reachable && !node.visited) : false;
    },

    updateReachability: function () {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].reachable = false;
        }

        var currentId = this.getCurrentNodeId();

        if (currentId === null) {
            /* no node visited yet: floor-0 nodes are reachable */
            for (var i = 0; i < this.nodes.length; i++) {
                if (this.nodes[i].floor === 0) {
                    this.nodes[i].reachable = true;
                }
            }
            return;
        }

        /* mark nodes connected from current node */
        for (var i = 0; i < this.paths.length; i++) {
            if (this.paths[i].from === currentId) {
                var target = this.nodeMap[this.paths[i].to];
                if (target && !target.visited) {
                    target.reachable = true;
                }
            }
        }
    },

    getCurrentNodeId: function () {
        /* find the most-recently visited node (highest floor) */
        var best = null;
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].visited) {
                if (!best || this.nodes[i].floor > best.floor) {
                    best = this.nodes[i];
                }
            }
        }
        return best ? best.id : null;
    },

    getCurrentFloor: function () {
        var id = this.getCurrentNodeId();
        return id ? this.nodeMap[id].floor : -1;
    },

    /* ------------------------------------------------------------------
     *  ADVANCE
     * ------------------------------------------------------------------ */

    advanceToNode: function (nodeId) {
        var node = this.nodeMap[nodeId];
        if (!node || node.visited || !node.reachable) return;

        node.visited = true;
        this.updateReachability();

        if (STS.Game && STS.Game.advanceToNode) {
            /* game.js uses numeric ids – look up the numeric id from state */
            var gm = STS.Game.state ? STS.Game.state.map : null;
            if (gm && gm.nodes) {
                var numericId = this.findNumericId(nodeId, gm);
                if (numericId !== null) {
                    STS.Game.advanceToNode(numericId);
                    return;
                }
            }
        }

        this.scrollToCurrentFloor();
    },

    findNumericId: function (stringId, gm) {
        var parts = stringId.split('_');
        var floor = parseInt(parts[1], 10);
        var col = parseInt(parts[2], 10);
        for (var i = 0; i < gm.nodes.length; i++) {
            if (gm.nodes[i].floor === floor && gm.nodes[i].col === col) {
                return gm.nodes[i].id;
            }
        }
        return null;
    },

    /* ------------------------------------------------------------------
     *  HIT TESTING
     * ------------------------------------------------------------------ */

    getNodeAt: function (x, y) {
        var closestNode = null;
        var closestDist = NODE_HOVER_RADIUS + 4;

        for (var i = 0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            var dx = x - n.x;
            var dy = y - n.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closestNode = n;
            }
        }
        return closestNode;
    },

    /* ------------------------------------------------------------------
     *  INPUT HANDLING
     * ------------------------------------------------------------------ */

    handleClick: function (x, y) {
        var adjustedY = y - this.scrollY;
        var node = this.getNodeAt(x, adjustedY);
        if (node && node.reachable && !node.visited) {
            this.advanceToNode(node.id);
        }
    },

    handleMouseMove: function (x, y) {
        var adjustedY = y - this.scrollY;
        var node = this.getNodeAt(x, adjustedY);

        if (node && node.reachable && !node.visited) {
            this.hoveredNode = node;
            this.canvas.style.cursor = 'pointer';
        } else {
            this.hoveredNode = null;
            this.canvas.style.cursor = 'default';
        }
    },

    handleScroll: function (deltaY) {
        var maxScroll = 0;
        var minScroll = -(this.mapHeight - this.viewHeight);
        this.targetScrollY = Math.max(minScroll, Math.min(maxScroll, this.targetScrollY - deltaY));
    },

    scrollToCurrentFloor: function () {
        var floor = this.getCurrentFloor();
        if (floor < 0) floor = 0;

        var totalH = this.mapHeight || ((BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2);
        var nodeY = totalH - MAP_PADDING_Y - floor * FLOOR_HEIGHT;
        this.targetScrollY = -(nodeY - this.viewHeight / 2);

        var maxScroll = 0;
        var minScroll = -(totalH - this.viewHeight);
        if (minScroll > maxScroll) minScroll = maxScroll;
        this.targetScrollY = Math.max(minScroll, Math.min(maxScroll, this.targetScrollY));
    },

    /* ------------------------------------------------------------------
     *  ANIMATION LOOP
     * ------------------------------------------------------------------ */

    start: function () {
        if (this.isActive) return;
        this.isActive = true;
        this.lastTimestamp = performance.now();
        var self = this;
        (function loop(ts) {
            if (!self.isActive) return;
            self.update(ts);
            self.render();
            self.animationId = requestAnimationFrame(loop);
        })(this.lastTimestamp);
    },

    stop: function () {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    update: function (timestamp) {
        var dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
        this.lastTimestamp = timestamp;

        this.animateScroll(dt);
        this.dashOffset += DASH_OFFSET_SPEED * dt * 60;
        this.updateParticles(dt);
    },

    animateScroll: function (dt) {
        var diff = this.targetScrollY - this.scrollY;
        if (Math.abs(diff) < 0.5) {
            this.scrollY = this.targetScrollY;
        } else {
            this.scrollY += diff * Math.min(SCROLL_SPEED * dt * 60, 1);
        }
    },

    /* ------------------------------------------------------------------
     *  BOSS PARTICLES
     * ------------------------------------------------------------------ */

    updateParticles: function (dt) {
        var bossNode = null;
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].type === 'BOSS') { bossNode = this.nodes[i]; break; }
        }
        if (!bossNode) return;

        /* spawn particles */
        if (this.particlePool.length < 30 && Math.random() < 0.3) {
            this.particlePool.push({
                x: bossNode.x + (Math.random() - 0.5) * 60,
                y: bossNode.y + (Math.random() - 0.5) * 60,
                vx: (Math.random() - 0.5) * 40,
                vy: -Math.random() * 50 - 20,
                life: 1.0,
                decay: 0.4 + Math.random() * 0.6,
                size: 2 + Math.random() * 3,
                color: Math.random() < 0.5 ? '#ff4400' : '#ff0000'
            });
        }

        for (var i = this.particlePool.length - 1; i >= 0; i--) {
            var p = this.particlePool[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.particlePool.splice(i, 1);
            }
        }
    },

    /* ------------------------------------------------------------------
     *  RENDERING
     * ------------------------------------------------------------------ */

    render: function () {
        var ctx = this.ctx;
        if (!ctx) return;
        var width = this.canvas.width;
        var height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        /* background */
        ctx.fillStyle = 'rgba(10, 10, 25, 0.85)';
        ctx.fillRect(0, 0, width, height);
        this.drawBackgroundMist(ctx, width, height);

        ctx.save();
        ctx.translate(0, this.scrollY);

        /* floor labels */
        this.drawFloorLabels(ctx);

        /* paths */
        for (var i = 0; i < this.paths.length; i++) {
            this.drawPath(this.paths[i]);
        }

        /* particles (behind nodes) */
        this.drawParticles(ctx);

        /* nodes */
        for (var i = 0; i < this.nodes.length; i++) {
            this.drawNode(this.nodes[i]);
        }

        ctx.restore();

        /* UI overlay */
        this.drawOverlay(ctx, width, height);

        /* tooltip */
        if (this.hoveredNode) {
            this.drawTooltip(ctx);
        }
    },

    /* ------------------------------------------------------------------
     *  BACKGROUND
     * ------------------------------------------------------------------ */

    drawBackgroundMist: function (ctx, width, height) {
        var time = Date.now() / 4000;

        /* top fog */
        var gradTop = ctx.createLinearGradient(0, 0, 0, 120);
        gradTop.addColorStop(0, 'rgba(20, 15, 40, 0.9)');
        gradTop.addColorStop(1, 'rgba(20, 15, 40, 0)');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, width, 120);

        /* bottom fog */
        var gradBot = ctx.createLinearGradient(0, height - 120, 0, height);
        gradBot.addColorStop(0, 'rgba(20, 15, 40, 0)');
        gradBot.addColorStop(1, 'rgba(20, 15, 40, 0.9)');
        ctx.fillStyle = gradBot;
        ctx.fillRect(0, height - 120, width, 120);

        /* subtle moving mist blobs */
        ctx.save();
        ctx.globalAlpha = 0.04;
        for (var i = 0; i < 5; i++) {
            var mx = width * 0.5 + Math.sin(time + i * 1.3) * width * 0.3;
            var my = height * (0.2 + i * 0.15) + Math.cos(time * 0.7 + i) * 40;
            var mr = 100 + i * 30;
            var grad = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
            grad.addColorStop(0, 'rgba(120, 100, 180, 1)');
            grad.addColorStop(1, 'rgba(120, 100, 180, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        }
        ctx.restore();
    },

    /* ------------------------------------------------------------------
     *  FLOOR LABELS
     * ------------------------------------------------------------------ */

    drawFloorLabels: function (ctx) {
        ctx.save();
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        var totalH = this.mapHeight || ((BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2);
        var currentFloor = this.getCurrentFloor();

        for (var f = 0; f <= BOSS_FLOOR; f++) {
            var y = totalH - MAP_PADDING_Y - f * FLOOR_HEIGHT;
            var label = f === BOSS_FLOOR ? 'BOSS' : '' + (f + 1);

            if (f === currentFloor) {
                ctx.fillStyle = '#ffdd55';
                ctx.font = 'bold ' + LABEL_FONT;
            } else {
                ctx.fillStyle = 'rgba(150, 150, 180, 0.5)';
                ctx.font = LABEL_FONT;
            }

            ctx.fillText(label, MAP_PADDING_X - 30, y);
        }
        ctx.restore();
    },

    /* ------------------------------------------------------------------
     *  PATH DRAWING
     * ------------------------------------------------------------------ */

    drawPath: function (path) {
        var ctx = this.ctx;
        var srcNode = this.nodeMap[path.from];
        var dstNode = this.nodeMap[path.to];
        if (!srcNode || !dstNode) return;

        var currentId = this.getCurrentNodeId();
        var isVisited = srcNode.visited && dstNode.visited;
        var isAvailable = srcNode.visited && dstNode.reachable && !dstNode.visited;
        var isHighlighted = this.hoveredNode && dstNode.id === this.hoveredNode.id && isAvailable;

        /* bezier control point */
        var midX = (srcNode.x + dstNode.x) / 2;
        var midY = (srcNode.y + dstNode.y) / 2;
        var cpx = midX + (srcNode.x - dstNode.x) * 0.1;
        var cpy = midY;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(srcNode.x, srcNode.y);
        ctx.quadraticCurveTo(cpx, cpy, dstNode.x, dstNode.y);

        if (isVisited) {
            ctx.strokeStyle = 'rgba(180, 180, 220, 0.7)';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
        } else if (isHighlighted) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.setLineDash([10, 6]);
            ctx.lineDashOffset = -this.dashOffset;
        } else if (isAvailable) {
            ctx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 6]);
            ctx.lineDashOffset = -this.dashOffset;
        } else {
            ctx.strokeStyle = 'rgba(80, 80, 110, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 8]);
        }

        ctx.stroke();
        ctx.restore();
    },

    /* ------------------------------------------------------------------
     *  NODE DRAWING
     * ------------------------------------------------------------------ */

    drawNode: function (node) {
        var ctx = this.ctx;
        var x = node.x;
        var y = node.y;
        var nodeType = NODE_TYPES[node.type] || NODE_TYPES.MONSTER;
        var isHovered = this.hoveredNode && this.hoveredNode.id === node.id;
        var radius = isHovered ? NODE_HOVER_RADIUS : NODE_RADIUS;

        ctx.save();

        /* glow effects */
        if (node.reachable && !node.visited) {
            var pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
            ctx.shadowColor = nodeType.color;
            ctx.shadowBlur = 15 * pulse;
        } else if (node.type === 'BOSS' && !node.visited) {
            var bossPulse = Math.sin(Date.now() / 300) * 0.4 + 0.6;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20 * bossPulse;
        }

        /* outer ring for current node */
        var currentId = this.getCurrentNodeId();
        if (node.visited && node.id === currentId) {
            ctx.beginPath();
            ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 150, 0.6)';
            ctx.lineWidth = 2;
            var pulse2 = Math.sin(Date.now() / 400) * 0.3 + 0.7;
            ctx.globalAlpha = pulse2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        /* main circle */
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (node.visited) {
            ctx.fillStyle = 'rgba(40, 40, 60, 0.8)';
            ctx.strokeStyle = 'rgba(100, 100, 130, 0.5)';
        } else if (node.reachable) {
            ctx.fillStyle = 'rgba(30, 30, 50, 0.9)';
            ctx.strokeStyle = nodeType.color;
        } else {
            ctx.fillStyle = 'rgba(20, 20, 35, 0.5)';
            ctx.strokeStyle = 'rgba(60, 60, 80, 0.3)';
        }

        ctx.lineWidth = node.reachable ? 3 : 1.5;
        ctx.fill();
        ctx.stroke();

        /* white border glow for reachable */
        if (node.reachable && !node.visited) {
            ctx.beginPath();
            ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
            var glowPulse = Math.sin(Date.now() / 600) * 0.3 + 0.4;
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + glowPulse + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        /* icon */
        ctx.font = isHovered ? '24px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial' : ICON_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (node.visited) {
            ctx.globalAlpha = 0.4;
        } else if (!node.reachable) {
            ctx.globalAlpha = 0.3;
        } else {
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = nodeType.color;

        /* for REST type, draw a campfire icon instead of reusing the fire emoji */
        if (node.type === 'REST') {
            this.drawRestIcon(ctx, x, y, node);
        } else {
            ctx.fillText(nodeType.icon, x, y + 1);
        }

        ctx.restore();
    },

    drawRestIcon: function (ctx, x, y, node) {
        ctx.save();
        var alpha = node.visited ? 0.4 : (node.reachable ? 1 : 0.3);
        ctx.globalAlpha = alpha;

        /* triangle base */
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 8);
        ctx.lineTo(x, y - 6);
        ctx.lineTo(x + 8, y + 8);
        ctx.closePath();
        ctx.fillStyle = '#ff6622';
        ctx.fill();

        /* inner flame */
        ctx.beginPath();
        ctx.moveTo(x - 4, y + 8);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 4, y + 8);
        ctx.closePath();
        ctx.fillStyle = '#ffcc00';
        ctx.fill();

        /* logs */
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 10, y + 10);
        ctx.lineTo(x + 6, y + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x - 6, y + 6);
        ctx.stroke();

        ctx.restore();
    },

    /* ------------------------------------------------------------------
     *  PARTICLES
     * ------------------------------------------------------------------ */

    drawParticles: function (ctx) {
        for (var i = 0; i < this.particlePool.length; i++) {
            var p = this.particlePool[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life) * 0.8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    /* ------------------------------------------------------------------
     *  OVERLAY (scroll indicators, act title)
     * ------------------------------------------------------------------ */

    drawOverlay: function (ctx, width, height) {
        /* act title */
        ctx.save();
        ctx.font = TITLE_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(220, 200, 160, 0.9)';
        var title = ACT_NAMES[this.currentAct] || ('Act ' + this.currentAct);
        ctx.fillText(title, width / 2, 16);
        ctx.restore();

        /* scroll indicators */
        var totalH = this.mapHeight || ((BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2);
        var minScroll = -(totalH - this.viewHeight);
        if (minScroll > 0) minScroll = 0;

        /* top arrow – can scroll up (scrollY can decrease) */
        if (this.scrollY > minScroll + 2) {
            this.drawScrollIndicator(ctx, width, 'up');
        }

        /* bottom arrow – can scroll down (scrollY can increase) */
        if (this.scrollY < -2) {
            this.drawScrollIndicator(ctx, width, 'down');
        }
    },

    drawScrollIndicator: function (ctx, width, direction) {
        var y = direction === 'up' ? this.viewHeight - 24 : 50;
        var pulse = Math.sin(Date.now() / 600) * 0.3 + 0.6;

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#aaaacc';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (direction === 'up') {
            ctx.fillText('\u25BC', width / 2, y);
        } else {
            ctx.fillText('\u25B2', width / 2, y);
        }
        ctx.restore();
    },

    /* ------------------------------------------------------------------
     *  TOOLTIP
     * ------------------------------------------------------------------ */

    drawTooltip: function (ctx) {
        var node = this.hoveredNode;
        if (!node) return;

        var nodeType = NODE_TYPES[node.type] || NODE_TYPES.MONSTER;
        var text = nodeType.name;
        var floorText = node.floor === BOSS_FLOOR ? 'Boss Floor' : 'Floor ' + (node.floor + 1);
        var fullText = text + ' - ' + floorText;

        ctx.save();
        ctx.font = TOOLTIP_FONT;
        var metrics = ctx.measureText(fullText);
        var tw = metrics.width + TOOLTIP_PADDING * 2;
        var th = 26;

        var tx = node.x + this.scrollY * 0 + 0; // tooltip x follows node x
        var ty = node.y + this.scrollY - NODE_HOVER_RADIUS - th - 8;

        /* clamp to canvas */
        tx = Math.max(tw / 2 + 4, Math.min(this.canvas.width - tw / 2 - 4, tx));
        ty = Math.max(4, ty);

        /* background */
        ctx.fillStyle = 'rgba(15, 15, 30, 0.92)';
        ctx.strokeStyle = nodeType.color;
        ctx.lineWidth = 1.5;

        var rx = tx - tw / 2;
        var ry = ty;
        var cornerRadius = 6;

        ctx.beginPath();
        ctx.moveTo(rx + cornerRadius, ry);
        ctx.lineTo(rx + tw - cornerRadius, ry);
        ctx.arcTo(rx + tw, ry, rx + tw, ry + cornerRadius, cornerRadius);
        ctx.lineTo(rx + tw, ry + th - cornerRadius);
        ctx.arcTo(rx + tw, ry + th, rx + tw - cornerRadius, ry + th, cornerRadius);
        ctx.lineTo(rx + cornerRadius, ry + th);
        ctx.arcTo(rx, ry + th, rx, ry + th - cornerRadius, cornerRadius);
        ctx.lineTo(rx, ry + cornerRadius);
        ctx.arcTo(rx, ry, rx + cornerRadius, ry, cornerRadius);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* text */
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fullText, tx, ry + th / 2);

        ctx.restore();
    },

    /* ------------------------------------------------------------------
     *  PATH HIGHLIGHT (from current node to hovered node)
     * ------------------------------------------------------------------ */

    getPathToNode: function (targetId) {
        var currentId = this.getCurrentNodeId();
        if (!currentId) return [];

        var visited = {};
        var queue = [{ id: currentId, path: [] }];
        visited[currentId] = true;

        while (queue.length > 0) {
            var item = queue.shift();
            if (item.id === targetId) return item.path;

            for (var i = 0; i < this.paths.length; i++) {
                var p = this.paths[i];
                if (p.from === item.id && !visited[p.to]) {
                    visited[p.to] = true;
                    queue.push({
                        id: p.to,
                        path: item.path.concat([{ from: p.from, to: p.to }])
                    });
                }
            }
        }
        return [];
    },

    /* ------------------------------------------------------------------
     *  UTILITY: Full standalone render (no animation loop)
     * ------------------------------------------------------------------ */

    renderOnce: function () {
        if (this.ctx) {
            this.render();
        }
    },

    /* ------------------------------------------------------------------
     *  SERIALIZATION (for save/load)
     * ------------------------------------------------------------------ */

    serialize: function () {
        return {
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            paths: JSON.parse(JSON.stringify(this.paths)),
            currentAct: this.currentAct,
            scrollY: this.scrollY,
            targetScrollY: this.targetScrollY
        };
    },

    deserialize: function (data) {
        if (!data) return;
        this.nodes = data.nodes || [];
        this.paths = data.paths || [];
        this.currentAct = data.currentAct || 1;
        this.scrollY = data.scrollY || 0;
        this.targetScrollY = data.targetScrollY || 0;
        this.rebuildNodeMap();
        this.mapHeight = (BOSS_FLOOR + 1) * FLOOR_HEIGHT + MAP_PADDING_Y * 2;
        this.updateReachability();
    },

    /* ------------------------------------------------------------------
     *  DEBUG: print map structure to console
     * ------------------------------------------------------------------ */

    debugPrint: function () {
        console.group('[STS.Map] Debug');
        console.log('Act:', this.currentAct);
        console.log('Nodes:', this.nodes.length);
        console.log('Paths:', this.paths.length);
        console.log('Current Node:', this.getCurrentNodeId());
        console.log('Current Floor:', this.getCurrentFloor());
        console.log('Reachable:', this.getReachableNodes().map(function (n) { return n.id; }));

        for (var f = BOSS_FLOOR; f >= 0; f--) {
            var row = [];
            for (var i = 0; i < this.nodes.length; i++) {
                if (this.nodes[i].floor === f) {
                    var n = this.nodes[i];
                    var marker = n.visited ? '*' : (n.reachable ? '>' : ' ');
                    row.push(marker + n.type.substring(0, 4) + '(' + n.id + ')');
                }
            }
            console.log('F' + (f < 10 ? ' ' : '') + f + ': ' + row.join('  '));
        }
        console.groupEnd();
    }
};
