/**
 * Generates bundled SVG assets for local offline play (no external image APIs).
 * Run: node scripts/build-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const CARD_TYPES = {
  STRIKE: 'ATTACK', DEFEND: 'SKILL', BASH: 'ATTACK', CLEAVE: 'ATTACK', IRON_WAVE: 'ATTACK',
  POMMEL_STRIKE: 'ATTACK', TWIN_STRIKE: 'ATTACK', ANGER: 'ATTACK', BODY_SLAM: 'ATTACK', CLASH: 'ATTACK',
  SHRUG_IT_OFF: 'SKILL', TRUE_GRIT: 'SKILL', ARMAMENTS: 'SKILL', HAVOC: 'SKILL', CARNAGE: 'ATTACK',
  UPPERCUT: 'ATTACK', RAMPAGE: 'ATTACK', HEMOKINESIS: 'ATTACK', WHIRLWIND: 'ATTACK', SEARING_BLOW: 'ATTACK',
  BATTLE_TRANCE: 'SKILL', BLOODLETTING: 'SKILL', BURNING_PACT: 'SKILL', DISARM: 'SKILL', INTIMIDATE: 'SKILL',
  SENTINEL: 'SKILL', SHOCKWAVE: 'SKILL', INFLAME: 'POWER', METALLICIZE: 'POWER', COMBUST: 'POWER',
  BLUDGEON: 'ATTACK', IMMOLATE: 'ATTACK', REAPER: 'ATTACK', IMPERVIOUS: 'SKILL', OFFERING: 'SKILL',
  EXHUME: 'SKILL', DEMON_FORM: 'POWER', BARRICADE: 'POWER', JUGGERNAUT: 'POWER', WOUND: 'STATUS',
  DAZED: 'STATUS', BURN: 'STATUS', SLIMED: 'STATUS', PARASITE: 'CURSE', REGRET: 'CURSE', DOUBT: 'CURSE',
};

function cardMotif(type, h) {
  const tilt = (h % 21) - 10;
  const accent =
    type === 'ATTACK' ? '#ff5c5c' : type === 'SKILL' ? '#5ec8ff' : type === 'POWER' ? '#ffb347' :
    type === 'CURSE' ? '#c56bff' : '#9ca3c4';
  if (type === 'ATTACK') {
    return `<g fill="none" stroke="rgba(255,240,220,0.55)" stroke-width="2.2" stroke-linecap="round">
      <path d="M72 124 L118 36 L128 40 L84 130 Z" fill="rgba(40,12,12,0.5)"/>
      <path d="M118 36 L154 28 L132 48 Z" fill="rgba(255,200,180,0.25)"/>
      <path d="M76 118 Q100 108 122 98" opacity="0.7"/>
      <path d="M56 132 L144 120" stroke="${accent}" stroke-opacity="0.35" stroke-width="3"/>
    </g>
    <ellipse cx="138" cy="118" rx="28" ry="14" transform="rotate(${tilt} 138 118)" fill="rgba(0,0,0,0.35)" opacity="0.5"/>`;
  }
  if (type === 'SKILL') {
    return `<path d="M100 38 C132 38 152 62 152 92 C152 124 128 142 100 142 C72 142 48 124 48 92 C48 62 68 38 100 38 Z" fill="rgba(20,40,72,0.55)" stroke="rgba(180,220,255,0.45)" stroke-width="2"/>
      <path d="M100 56 L100 108 M76 82 L124 82" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="100" cy="82" r="22" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2.5"/>`;
  }
  if (type === 'POWER') {
    return `<path d="M100 28 Q132 68 100 118 Q68 68 100 28 Z" fill="rgba(80,50,10,0.45)" stroke="rgba(255,200,120,0.5)" stroke-width="2"/>
      <path d="M100 44 L100 104 M72 74 L128 74" stroke="${accent}" stroke-opacity="0.4" stroke-width="2"/>
      <circle cx="100" cy="74" r="36" fill="none" stroke="rgba(255,180,80,0.2)" stroke-width="1.5"/>
      <circle cx="100" cy="74" r="8" fill="${accent}" fill-opacity="0.5"/>`;
  }
  if (type === 'CURSE') {
    return `<path d="M52 48 Q100 20 148 48 L138 120 Q100 100 62 120 Z" fill="rgba(40,10,48,0.55)" stroke="rgba(200,120,255,0.4)" stroke-width="2"/>
      <path d="M76 72 L124 96 M124 72 L76 96" stroke="${accent}" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return `<rect x="56" y="48" width="88" height="72" rx="10" fill="rgba(36,36,44,0.6)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <path d="M72 68 L128 68 M72 88 L128 88 M72 108 L108 108" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/>`;
}

function buildCardSvg(id) {
  const type = CARD_TYPES[id] || 'ATTACK';
  const h = hashCode(id);
  const hue = h % 360;
  const hue2 = (hue + 42) % 360;
  const hue3 = (hue + 96) % 360;
  const accent =
    type === 'ATTACK' ? '#ff5c5c' : type === 'SKILL' ? '#5ec8ff' : type === 'POWER' ? '#ffb347' :
    type === 'CURSE' ? '#c56bff' : '#9ca3c4';
  const motif = cardMotif(type, h);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="168" viewBox="0 0 200 168">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},52%,22%)"/>
      <stop offset="0.45" stop-color="hsl(${hue2},45%,14%)"/>
      <stop offset="1" stop-color="hsl(${hue3},38%,9%)"/>
    </linearGradient>
    <radialGradient id="br-${id}" cx="50%" cy="42%" r="68%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.38"/>
      <stop offset="0.5" stop-color="${accent}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vg-${id}" cx="50%" cy="50%" r="75%">
      <stop offset="0.55" stop-color="rgba(0,0,0,0)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0.55)"/>
    </radialGradient>
  </defs>
  <rect width="200" height="168" fill="url(#bg-${id})"/>
  <rect width="200" height="168" fill="url(#br-${id})"/>
  <g opacity="0.85">${motif}</g>
  <g opacity="0.12" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="0.8">
    <path d="M24 40 Q100 12 176 40"/><path d="M32 128 Q100 154 168 128"/>
  </g>
  <rect width="200" height="168" fill="url(#vg-${id})"/>
  <rect x="3" y="3" width="194" height="162" rx="4" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
</svg>`;
}

const ENEMY_SHAPES = {
  jaw_worm: `<path d="M100 20 C140 40 160 90 150 140 C130 165 70 165 50 140 C40 90 60 40 100 20 Z" fill="rgba(120,40,160,0.85)" stroke="rgba(200,150,255,0.6)" stroke-width="2"/>
    <ellipse cx="85" cy="85" rx="12" ry="18" fill="#300"/><ellipse cx="115" cy="85" rx="12" ry="18" fill="#300"/>
    <path d="M75 115 Q100 135 125 115" fill="none" stroke="#400" stroke-width="4" stroke-linecap="round"/>`,
  cultist: `<ellipse cx="100" cy="90" rx="45" ry="70" fill="rgba(60,20,80,0.9)" stroke="rgba(180,80,200,0.5)" stroke-width="2"/>
    <circle cx="100" cy="55" r="28" fill="rgba(40,10,50,0.95)" stroke="rgba(200,100,220,0.4)" stroke-width="2"/>`,
  red_louse: `<ellipse cx="100" cy="100" rx="55" ry="40" fill="rgba(180,40,40,0.9)" stroke="rgba(255,120,100,0.6)" stroke-width="2"/>
    <path d="M50 100 L30 85 M50 110 L25 110 M150 100 L170 85 M150 110 L175 110" stroke="rgba(100,20,20,0.8)" stroke-width="3" stroke-linecap="round"/>`,
  slime_boss: `<path d="M40 130 Q100 40 160 130 Z" fill="rgba(50,200,120,0.75)" stroke="rgba(150,255,200,0.7)" stroke-width="3"/>
    <circle cx="85" cy="95" r="10" fill="rgba(0,40,20,0.6)"/><circle cx="115" cy="95" r="10" fill="rgba(0,40,20,0.6)"/>`,
  gremlin: `<rect x="65" y="50" width="70" height="90" rx="20" fill="rgba(90,140,60,0.9)" stroke="rgba(180,220,100,0.5)" stroke-width="2"/>
    <polygon points="100,35 85,55 115,55" fill="rgba(200,80,80,0.9)"/>`,
  guardian: `<rect x="55" y="45" width="90" height="100" rx="8" fill="rgba(70,75,95,0.95)" stroke="rgba(200,200,220,0.5)" stroke-width="3"/>
    <rect x="70" y="60" width="60" height="45" fill="rgba(40,45,60,0.9)"/>`,
  sentry: `<rect x="60" y="40" width="80" height="110" rx="6" fill="rgba(100,100,120,0.95)" stroke="rgba(220,220,255,0.4)" stroke-width="2"/>
    <circle cx="100" cy="75" r="18" fill="rgba(255,80,80,0.8)"/>`,
  hexaghost: `<path d="M100 25 L145 50 L145 100 L100 125 L55 100 L55 50 Z" fill="rgba(80,40,120,0.85)" stroke="rgba(200,120,255,0.7)" stroke-width="2"/>
    <circle cx="100" cy="75" r="22" fill="rgba(255,200,100,0.35)"/>`,
  chosen: `<path d="M100 30 L130 80 L115 130 L85 130 L70 80 Z" fill="rgba(40,50,90,0.9)" stroke="rgba(255,215,0,0.6)" stroke-width="2"/>`,
  byrd: `<ellipse cx="100" cy="95" rx="50" ry="35" fill="rgba(180,140,80,0.9)" stroke="rgba(255,220,150,0.5)" stroke-width="2"/>
    <polygon points="100,45 75,75 125,75" fill="rgba(200,100,60,0.9)"/>`,
  shelled_parasite: `<ellipse cx="100" cy="100" rx="60" ry="45" fill="rgba(100,80,60,0.9)" stroke="rgba(180,160,120,0.6)" stroke-width="2"/>
    <ellipse cx="100" cy="100" rx="35" ry="28" fill="rgba(60,45,35,0.95)"/>`,
  book_of_stabbing: `<rect x="55" y="40" width="90" height="100" rx="4" fill="rgba(120,40,40,0.9)" stroke="rgba(255,180,100,0.5)" stroke-width="2"/>
    <line x1="70" y1="60" x2="130" y2="60" stroke="rgba(255,240,220,0.4)" stroke-width="2"/>`,
  the_champ: `<ellipse cx="100" cy="85" rx="48" ry="65" fill="rgba(180,50,50,0.9)" stroke="rgba(255,200,80,0.7)" stroke-width="3"/>
    <rect x="75" y="35" width="50" height="25" rx="4" fill="rgba(220,180,60,0.9)"/>`,
  default: `<circle cx="100" cy="100" r="55" fill="rgba(80,30,80,0.85)" stroke="rgba(255,100,200,0.5)" stroke-width="2"/>
    <circle cx="85" cy="90" r="8" fill="#200"/><circle cx="115" cy="90" r="8" fill="#200"/>`,
};

function buildEnemySvg(basename) {
  const h = hashCode(basename);
  const hue = h % 360;
  const inner = ENEMY_SHAPES[basename] || ENEMY_SHAPES.default;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="e-${basename}" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="hsl(${hue},35%,35%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},30%,8%)"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" fill="url(#e-${basename})"/>
  <g transform="translate(0,5)">${inner}</g>
</svg>`;
}

function buildEventSvg(slug) {
  const h = hashCode(slug);
  const hue = h % 360;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="ev-${slug}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},40%,18%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 50) % 360},35%,10%)"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#ev-${slug})"/>
  <circle cx="320" cy="200" r="120" fill="rgba(255,215,0,0.08)"/>
  <path d="M80 280 Q320 120 560 280" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
  <rect x="8" y="8" width="624" height="384" rx="16" fill="none" stroke="rgba(255,215,0,0.25)" stroke-width="2"/>
</svg>`;
}

function buildRelicSvg(slug) {
  const h = hashCode(slug);
  const hue = h % 360;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="r-${slug}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,42%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},40%,18%)"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="10" fill="url(#r-${slug})" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
  <circle cx="32" cy="32" r="14" fill="rgba(0,0,0,0.25)" stroke="rgba(255,215,0,0.35)" stroke-width="2"/>
  <path d="M32 22 L32 42 M22 32 L42 32" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
</svg>`;
}

function buildPotionSvg(slug) {
  const h = hashCode(slug);
  const hue = (h % 80) + 340;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="p-${slug}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="hsl(${hue},70%,25%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 30) % 360},60%,55%)"/>
    </linearGradient>
  </defs>
  <rect x="18" y="8" width="12" height="8" rx="2" fill="rgba(180,180,200,0.5)"/>
  <path d="M14 18 H34 V38 Q34 44 24 44 Q14 44 14 38 Z" fill="url(#p-${slug})" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
</svg>`;
}

function buildHeroSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a1515"/><stop offset="1" stop-color="#1a0808"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#hg)"/>
  <path d="M128 40 L175 95 L155 210 L101 210 L81 95 Z" fill="rgba(180,40,40,0.85)" stroke="rgba(255,200,100,0.5)" stroke-width="3"/>
  <circle cx="128" cy="72" r="28" fill="rgba(220,180,150,0.9)" stroke="rgba(80,20,20,0.6)" stroke-width="2"/>
</svg>`;
}

function buildBgSvg(name, hue1, hue2) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bg-${name}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue1},25%,12%)"/>
      <stop offset="0.5" stop-color="hsl(${hue2},20%,8%)"/>
      <stop offset="1" stop-color="hsl(${hue1},30%,5%)"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg-${name})"/>
  <g opacity="0.06" stroke="rgba(255,255,255,0.5)" fill="none">
    ${Array.from({ length: 24 }, (_, i) => `<path d="M${i * 80} 0 L${i * 80 + 400} 1080"/>`).join('')}
  </g>
</svg>`;
}

const CARD_IDS = Object.keys(CARD_TYPES);
const ENEMY_BASES = ['jaw_worm', 'cultist', 'red_louse', 'slime_boss', 'gremlin', 'guardian', 'sentry', 'hexaghost', 'chosen', 'byrd', 'shelled_parasite', 'book_of_stabbing', 'the_champ', 'default'];
const EVENT_SLUGS = ['event-fish', 'event-cleric', 'event-shrine', 'event-wall', 'event-ooze', 'event-goop', 'event-bonfire', 'event-library', 'event-dealer', 'event-altar', 'event-sphere', 'event-vampires'];
const RELIC_SLUGS = ['burning-blood', 'anchor', 'bag-of-marbles', 'blood-vial', 'bronze-scales', 'orichalcum', 'vajra', 'oddly-smooth-stone', 'horn-cleat', 'nunchaku', 'pen-nib', 'shuriken', 'kunai', 'meat-on-the-bone', 'dead-branch', 'tungsten-rod', 'torii', 'centennial-puzzle', 'black-star', 'cursed-key', 'membership-card', 'lees-waffle'];
const POTION_SLUGS = ['potion-fire', 'potion-block', 'potion-strength', 'potion-dexterity', 'potion-energy', 'potion-swift', 'potion-poison', 'potion-regen'];

function main() {
  const dirs = ['assets/cards', 'assets/enemies', 'assets/events', 'assets/relics', 'assets/potions', 'assets/backgrounds'];
  for (const d of dirs) ensureDir(path.join(ROOT, d));

  for (const id of CARD_IDS) {
    fs.writeFileSync(path.join(ROOT, 'assets/cards', `${id}.svg`), buildCardSvg(id));
  }
  for (const b of ENEMY_BASES) {
    fs.writeFileSync(path.join(ROOT, 'assets/enemies', `${b}.svg`), buildEnemySvg(b));
  }
  for (const s of EVENT_SLUGS) {
    fs.writeFileSync(path.join(ROOT, 'assets/events', `${s}.svg`), buildEventSvg(s));
  }
  for (const s of RELIC_SLUGS) {
    fs.writeFileSync(path.join(ROOT, 'assets/relics', `${s}.svg`), buildRelicSvg(s));
  }
  for (const s of POTION_SLUGS) {
    fs.writeFileSync(path.join(ROOT, 'assets/potions', `${s}.svg`), buildPotionSvg(s));
  }
  fs.writeFileSync(path.join(ROOT, 'assets', 'hero.svg'), buildHeroSvg());
  fs.writeFileSync(path.join(ROOT, 'assets/backgrounds', 'title_bg.svg'), buildBgSvg('title', 260, 220));
  fs.writeFileSync(path.join(ROOT, 'assets/backgrounds', 'combat_bg.svg'), buildBgSvg('combat', 235, 200));
  fs.writeFileSync(path.join(ROOT, 'assets/backgrounds', 'map_bg.svg'), buildBgSvg('map', 30, 15));

  console.log('Wrote SVG assets to assets/ (cards:', CARD_IDS.length, 'enemies:', ENEMY_BASES.length, 'events:', EVENT_SLUGS.length, 'relics:', RELIC_SLUGS.length, 'potions:', POTION_SLUGS.length, ')');
}

main();
