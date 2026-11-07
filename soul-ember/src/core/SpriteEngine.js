/**
 * VALIXIS GAMES STUDIO - PROCEDURAL SPRITE ENGINE
 * 100% Procedural Pixel & Vector Art Generated via Offscreen Canvases.
 * ZERO EXTERNAL IMAGES.
 */

export class SpriteEngine {
  constructor() {
    this.cache = {};
  }

  createCanvas(w, h) {
    if (typeof document === 'undefined') return { width: w, height: h };
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  drawPixels(ctx, map, palette, pixelSize = 2) {
    if (!ctx) return;
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const ch = map[r][c];
        if (ch !== '.' && palette[ch]) {
          ctx.fillStyle = palette[ch];
          ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
        }
      }
    }
  }

  init() {
    if (typeof document === 'undefined') return;
    this.bakeCharacters();
    this.bakeMonsters();
    this.bakePickups();
    this.bakeDungeonTiles();
    this.bakeProps();
  }

  bakeCharacters() {
    const animMap = [
      [
        "...hhhhh........",
        "..hhhhhhh.......",
        "..hSSShhh.......",
        "..hSEEEh........",
        "...SSBBBW.G.....",
        "...SBBBBWGF.....",
        "..rRRRRRW.......",
        ".rRRRRRRW.......",
        ".rRRRRRRW.......",
        "..rRRRR.W.......",
        "...RRRR.........",
        "...RR.RR........",
        "...h...h........",
        "..hh..hh........"
      ],
      [
        "...hhhhh........",
        "..hhhhhhh.......",
        "..hSSShhh.......",
        "..hSEEEh........",
        "...SSBBBW.G.....",
        "...SBBBBWFG.....",
        "..rRRRRRW.......",
        ".rRRRRRRW.......",
        ".rRRRRRRW.......",
        "..rRRRR.W.......",
        "...RRRR.........",
        "....RR..........",
        "...hh.hh........",
        "...h...h........"
      ]
    ];

    const heroPalettes = {
      pyro: { h: '#2a140e', S: '#e69c24', E: '#ffffff', B: '#c43c16', W: '#4a2d18', G: '#ff8a00', F: '#ffe600', r: '#821e07', R: '#c43c16' },
      cryo: { h: '#0d2238', S: '#62c1e5', E: '#ffffff', B: '#166ec4', W: '#183b4a', G: '#00f2fe', F: '#ffffff', r: '#093a6b', R: '#1b80db' },
      rogue: { h: '#1a0b26', S: '#9d5be3', E: '#ffffff', B: '#6016c4', W: '#28184a', G: '#c040ff', F: '#e0b0ff', r: '#3c0a82', R: '#761bc4' },
      necro: { h: '#062114', S: '#3de38f', E: '#00ff88', B: '#0a6336', W: '#103320', G: '#00ff88', F: '#b8ffd6', r: '#044222', R: '#0b7a42' },
      paladin: { h: '#292209', S: '#ffd700', E: '#ffffff', B: '#c49a16', W: '#4a3d18', G: '#ffeaa7', F: '#ffffff', r: '#826607', R: '#c49a16' },
      archer: { h: '#291d09', S: '#ffb700', E: '#ffffff', B: '#b5740b', W: '#452e0a', G: '#ffaa00', F: '#ffe299', r: '#734703', R: '#ad6e0c' },
      warlock: { h: '#260517', S: '#ff3366', E: '#ffffff', B: '#990033', W: '#420a22', G: '#ff0055', F: '#ffa3bf', r: '#630325', R: '#b00b46' },
      bard: { h: '#260526', S: '#ff77ff', E: '#ffffff', B: '#c416a4', W: '#4a1841', G: '#ff99ff', F: '#ffffff', r: '#7a0767', R: '#bf13a2' }
    };

    Object.keys(heroPalettes).forEach(heroKey => {
      const pal = heroPalettes[heroKey];
      this.cache[heroKey] = animMap.map(f => {
        const c = this.createCanvas(32, 32);
        this.drawPixels(c.getContext('2d'), f, pal, 2);
        return c;
      });
    });
  }

  bakeMonsters() {
    const mobPalettes = {
      skeleton: { S: '#e2d8ce', D: '#9c8e80', E: '#ff0055', W: '#5a4d41' },
      ghoul: { S: '#4a6b5d', D: '#2c4238', E: '#00ff88', W: '#1b2b24' },
      wraith: { S: '#3a506b', D: '#1c2541', E: '#00f2fe', W: '#0b132b' },
      bat: { S: '#4a154b', D: '#260826', E: '#ff0055', W: '#120212' },
      cultist: { S: '#5c1d3b', D: '#360d21', E: '#ffd700', W: '#1f0512' }
    };

    const mobMap = [
      "..SSSSSS........",
      ".SSSSSSSS.......",
      ".SSDEEDSS.......",
      ".SSSSSSSS.......",
      "..DDDDDD........",
      "..SWWWWS........",
      ".SSWWWWSS.......",
      ".SSWWWWSS.......",
      "..SWWWWS........",
      "...DDDD.........",
      "...S..S.........",
      "..SS..SS........"
    ];

    Object.keys(mobPalettes).forEach(key => {
      const pal = mobPalettes[key];
      const c = this.createCanvas(32, 32);
      this.drawPixels(c.getContext('2d'), mobMap, pal, 2);
      this.cache['mob_' + key] = c;
    });
  }

  bakePickups() {
    // XP Gem
    const gemC = this.createCanvas(16, 16);
    const gCtx = gemC.getContext('2d');
    gCtx.fillStyle = '#00f2fe';
    gCtx.beginPath();
    gCtx.moveTo(8, 2); gCtx.lineTo(14, 8); gCtx.lineTo(8, 14); gCtx.lineTo(2, 8);
    gCtx.closePath();
    gCtx.fill();
    gCtx.fillStyle = '#ffffff';
    gCtx.fillRect(7, 5, 2, 2);
    this.cache['gem_xp'] = gemC;

    // Gold Ember Coin
    const coinC = this.createCanvas(16, 16);
    const cCtx = coinC.getContext('2d');
    cCtx.fillStyle = '#ffd700';
    cCtx.beginPath();
    cCtx.arc(8, 8, 6, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.fillStyle = '#ff8800';
    cCtx.beginPath();
    cCtx.arc(8, 8, 3, 0, Math.PI * 2);
    cCtx.fill();
    this.cache['gem_gold'] = coinC;
  }

  bakeDungeonTiles() {
    const tileC = this.createCanvas(64, 64);
    const ctx = tileC.getContext('2d');
    ctx.fillStyle = '#120b1f';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#1e1333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 64, 64);
    ctx.fillStyle = '#180e29';
    ctx.fillRect(8, 8, 48, 48);
    this.cache['tile_dungeon'] = tileC;
  }

  bakeProps() {
    // Terracotta Urn
    const urnC = this.createCanvas(32, 32);
    const uCtx = urnC.getContext('2d');
    uCtx.fillStyle = '#b35422';
    uCtx.beginPath();
    uCtx.arc(16, 18, 9, 0, Math.PI * 2);
    uCtx.fill();
    uCtx.fillRect(12, 6, 8, 5);
    uCtx.fillStyle = '#e67332';
    uCtx.fillRect(14, 12, 4, 8);
    this.cache['prop_urn'] = urnC;
  }
}
