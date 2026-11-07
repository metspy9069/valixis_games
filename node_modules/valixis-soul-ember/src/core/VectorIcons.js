/**
 * VALIXIS GAMES STUDIO - VECTOR ICONOGRAPHY ENGINE
 * 100% Procedural SVG & Vector Graphics.
 * ZERO EMOJIS. ZERO EXTERNAL RASTER IMAGES.
 */

export const ICONS = {
  // --- HUD & CONTROLS ---
  heart: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${c}"/>
    <path d="M12 6.5c-1-1.5-2.5-2-4.5-2-2.5 0-4 1.8-4 4 0 2.8 2.5 5.2 6.5 8.9L12 19l2-1.6C18 13.7 20.5 11.3 20.5 8.5c0-2.2-1.5-4-4-4-2 0-3.5.5-4.5 2z" fill="#ffffff" fill-opacity="0.28"/>
  </svg>`,

  spark: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M13 2L3 14h9l-2 8 11-13h-8l3-7z" fill="${c}"/>
    <path d="M12 4L5 13h7l-1 6 8-10h-7l2-5z" fill="#ffffff" fill-opacity="0.35"/>
  </svg>`,

  skull: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M12 2C7.58 2 4 5.58 4 10c0 2.65 1.29 5 3.29 6.46V19c0 .55.45 1 1 1h7.42c.55 0 1-.45 1-1v-2.54C18.71 15 20 12.65 20 10c0-4.42-3.58-8-8-8z" fill="${c}"/>
    <circle cx="8.5" cy="11.5" r="2" fill="#0d0a14"/>
    <circle cx="15.5" cy="11.5" r="2" fill="#0d0a14"/>
    <path d="M11 16h2v3h-2zm-3-1h2v3H8zm6 0h2v3h-2z" fill="#0d0a14"/>
  </svg>`,

  coin: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <circle cx="12" cy="12" r="10" stroke="${c}" stroke-width="2" fill="#1b120c"/>
    <circle cx="12" cy="12" r="7.5" stroke="${c}" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
    <path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.6.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.6 3.6-.5z" fill="${c}"/>
  </svg>`,

  timer: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <circle cx="12" cy="13" r="8" stroke="${c}" stroke-width="2" fill="#0d0a14"/>
    <path d="M12 5V2m-3 0h6m-3 8v3l2.5 1.5" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="13" r="1.5" fill="${c}"/>
  </svg>`,

  castle: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M3 21h18V9l-3-3v3h-2V6l-3-3-3 3v3H8V6L5 9v12z" stroke="${c}" stroke-width="1.8" fill="#120d1f"/>
    <path d="M10 21v-4a2 2 0 014 0v4H10z" fill="${c}"/>
    <path d="M6 12h2v3H6zm10 0h2v3h-2z" fill="${c}"/>
  </svg>`,

  pause: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <rect x="6" y="4" width="4" height="16" rx="1.5" fill="${c}"/>
    <rect x="14" y="4" width="4" height="16" rx="1.5" fill="${c}"/>
  </svg>`,

  play: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M7 4.5v15l12-7.5-12-7.5z" fill="${c}"/>
  </svg>`,

  audio: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M4 9v6h4l5 5V4L8 9H4z" fill="${c}"/>
    <path d="M16.5 7.5a5.5 5.5 0 010 9m2.5-11.5a9 9 0 010 14" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  audio_muted: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M4 9v6h4l5 5V4L8 9H4z" fill="${c}"/>
    <path d="M17 9l6 6m0-6l-6 6" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  fullscreen: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  arcade: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M5 3h14l-2 18H7L5 3z" stroke="${c}" stroke-width="1.8" fill="#130b1c"/>
    <rect x="7" y="6" width="10" height="6" rx="1" fill="#050308" stroke="${c}" stroke-width="1"/>
    <circle cx="10" cy="16" r="1.5" fill="${c}"/>
    <path d="M14 15.5h3m-3 2h2" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  valixis_gem: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M12 2l8 5-8 15L4 7l8-5z" stroke="${c}" stroke-width="1.8" fill="#180c26"/>
    <path d="M4 7h16M12 2v20M8 7l4 15M16 7l-4 15" stroke="${c}" stroke-width="1" stroke-opacity="0.7"/>
  </svg>`,

  crown: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M3 18l2-11 5 4 4-6 4 6 5-4 2 11H3z" stroke="${c}" stroke-width="1.8" fill="#201505"/>
    <circle cx="5" cy="7" r="1" fill="${c}"/>
    <circle cx="10" cy="11" r="1" fill="${c}"/>
    <circle cx="14" cy="5" r="1" fill="${c}"/>
    <circle cx="19" cy="7" r="1" fill="${c}"/>
    <path d="M4 19h16v2H4z" fill="${c}"/>
  </svg>`,

  hazard: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M12 2.5L1.5 21h21L12 2.5z" stroke="${c}" stroke-width="2" fill="#240c0c"/>
    <path d="M12 9v5m0 3h.01" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  flame: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M12 2c0 3-4 6-4 11a6 6 0 0012 0c0-6-8-9-8-11z" fill="${c}"/>
    <path d="M12 9c0 2-2 4-2 6.5a4 4 0 008 0c0-3.5-6-5-6-6.5z" fill="#ffd700"/>
  </svg>`,

  combo: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M6 4l12 16M18 4L6 20" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="3" fill="#ff0055"/>
  </svg>`,

  trophy: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-icon">
    <path d="M7 4h10v6c0 3-2 5.5-5 5.5S7 13 7 10V4z" fill="${c}"/>
    <path d="M4 6h3v3c0 2-1 3-3 3V6zm16 0h-3v3c0 2 1 3 3 3V6zm-8 9.5V19m-4 2h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // --- HERO CLASS CRESTS (8 HEROES) ---
  crest_pyro: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M16 2C16 2 8 10 8 18a8 8 0 0016 0c0-8-8-16-8-16z" fill="${c}"/>
    <path d="M16 11c0 0-4 4-4 8a4 4 0 008 0c0-4-4-8-4-8z" fill="#ffd700"/>
    <circle cx="16" cy="22" r="2" fill="#ffffff"/>
  </svg>`,

  crest_cryo: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M16 3v26M3 16h26M7 7l18 18M7 25L25 7" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="3.5" fill="${c}"/>
    <path d="M13 5l3-2 3 2M13 27l3 2 3-2M5 13l-2 3 2 3M27 13l2 3-2 3" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  crest_rogue: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M6 6l11 11-3 3-11-11 3-3zM26 6L15 17l3 3 11-11-3-3z" fill="${c}"/>
    <path d="M16 3l3 7-7-3 4-4zm0 26l-3-7 7 3-4 4z" fill="${c}"/>
    <circle cx="16" cy="16" r="2.5" fill="#ffffff"/>
  </svg>`,

  crest_necro: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M6 28L24 6c3 3 4 8 2 12l-2-2c1-3 0-6-2-8L8 28H6z" fill="${c}"/>
    <circle cx="10" cy="10" r="2.2" fill="#00ff88"/>
    <circle cx="22" cy="20" r="2.5" fill="#00ff88"/>
    <circle cx="18" cy="24" r="1.5" fill="#00ff88"/>
  </svg>`,

  crest_paladin: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M16 3L6 7v10c0 7 10 12 10 12s10-5 10-12V7l-10-4z" stroke="${c}" stroke-width="2" fill="#1b1605"/>
    <path d="M16 8v14M11 13h10" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  crest_ranger: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M8 5c6 7 6 15 0 22M8 5l16 11L8 27" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 16h22M22 13l4 3-4 3" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  crest_warlock: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M4 16c4-7 20-7 24 0-4 7-20 7-24 0z" stroke="${c}" stroke-width="2" fill="#17041a"/>
    <circle cx="16" cy="16" r="4.5" fill="${c}"/>
    <circle cx="16" cy="16" r="2" fill="#000"/>
    <path d="M16 4v4m0 16v4M4 8l3 3m18-3l-3 3M4 24l3-3m18 3l-3-3" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  crest_bard: (c, s) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-crest">
    <path d="M9 7c0 10 3 17 7 17s7-7 7-17" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 6h18M13 7v17M16 7v17M19 7v17" stroke="${c}" stroke-width="1.8"/>
    <circle cx="16" cy="27" r="2.5" fill="${c}"/>
  </svg>`,

  // --- UPGRADES & BLESSINGS ---
  multishot: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M12 2l3 6h-6l3-6zM4 8l6 3-2 5-6-4 2-4zM20 8l-6 3 2 5 6-4-2-4z" fill="${c}"/>
    <circle cx="12" cy="17" r="2.5" fill="${c}"/>
  </svg>`,

  lightning: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M13 2L4 13h7l-2 9 11-12h-8l3-8z" fill="${c}"/>
  </svg>`,

  frostnova: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <circle cx="12" cy="12" r="3" fill="${c}"/>
    <path d="M12 2v6m0 8v6M2 12h6m8 0h6M5 5l4 4m6 6l4 4M5 19l4-4m6-6l4-4" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  puddle: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M10 3h4v4h-4zM6 19c0-4 6-10 6-10s6 6 6 10a6 6 0 01-12 0z" fill="${c}"/>
    <circle cx="11" cy="17" r="1.5" fill="#fff" fill-opacity="0.4"/>
  </svg>`,

  shield: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M12 3L4 7v6c0 5.5 8 8 8 8s8-2.5 8-8V7l-8-4z" stroke="${c}" stroke-width="2" fill="#131620"/>
    <circle cx="12" cy="11" r="3" fill="${c}"/>
  </svg>`,

  speed: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M3 14h6l4-7 5 3-3 4h4c1 0 2 1 1.5 2.5L18 20H8l-5-6z" fill="${c}"/>
    <path d="M2 9h5M1 12h4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  firerate: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <circle cx="12" cy="12" r="7" stroke="${c}" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M12 8v4l3 2" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 4l2 3M5 4L3 7" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  vitality: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${c}"/>
    <path d="M12 8v6M9 11h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  poison: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M9 3h6v3H9zM7 8h10l3 12H4L7 8z" stroke="${c}" stroke-width="2" fill="#0b1c0e"/>
    <circle cx="10" cy="15" r="1.5" fill="${c}"/>
    <circle cx="14" cy="13" r="2" fill="${c}"/>
  </svg>`,

  crit: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M19 5l-10 10-3-1-2 4 4-2-1-3L17 3l2 2z" fill="${c}"/>
    <path d="M16 11l4-2-1 4 3 2-4 1-1 4-2-4z" fill="#fff"/>
  </svg>`,

  magnet: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M4 5v7a8 8 0 0016 0V5h-4v7a4 4 0 01-8 0V5H4z" fill="${c}"/>
    <path d="M4 5h4v3H4zM16 5h4v3h-4z" fill="#fff"/>
  </svg>`,

  drain: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M6 4h12v5c0 4-3 7-6 7s-6-3-6-7V4zm6 12v5m-4 0h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 7c-2 2-3 3-3 4.5a3 3 0 006 0c0-1.5-1-2.5-3-4.5z" fill="#ff0044"/>
  </svg>`,

  dragon: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M4 18l5-6 6 1 5-8-2 10-4 1-3 5-7-3z" fill="${c}"/>
    <circle cx="10" cy="11" r="1" fill="#fff"/>
    <path d="M18 14c2 0 4 2 4 4s-3 3-5 3" stroke="#ff3b00" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  nova: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <circle cx="12" cy="12" r="4" fill="${c}"/>
    <path d="M12 2l2 4 4-2-1 4 4 1-3 3 3 3-4 1 1 4-4-2-2 4-2-4-4 2 1-4-4-1 3-3-3-3 4-1-1-4 4 2z" stroke="${c}" stroke-width="1.5" fill="none"/>
  </svg>`,

  pierce: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M3 12h18m-4-4l4 4-4 4" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M10 6v12M14 6v12" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 2"/>
  </svg>`,

  explosion: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <circle cx="11" cy="13" r="7" fill="${c}"/>
    <path d="M15 8l3-3m-1 0l3 1" stroke="#ff8800" stroke-width="2" stroke-linecap="round"/>
    <circle cx="20" cy="5" r="1.5" fill="#fff"/>
  </svg>`,

  parry: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M5 5l14 14M19 5L5 19" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="5" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 2"/>
  </svg>`,

  blizzard: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M12 3a9 9 0 018 5m-16 0a9 9 0 0113-3M5 14a8 8 0 0013 4m-15-5a8 8 0 0010 6" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2.5" fill="${c}"/>
  </svg>`,

  thorns: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M3 12h18M6 8l3 4-3 4M18 8l-3 4 3 4M12 5l-2 7 2 7" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  berserk: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M4 8l4-4 4 3 4-3 4 4-2 10-6 3-6-3L4 8z" stroke="${c}" stroke-width="2" fill="#2d0505"/>
    <path d="M9 11l2 2m4-2l-2 2m-3 3h4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  gold_rush: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M4 9h16v10H4z" stroke="${c}" stroke-width="2" fill="#241a06"/>
    <path d="M4 9l8-5 8 5" stroke="${c}" stroke-width="2"/>
    <circle cx="12" cy="14" r="2.5" fill="${c}"/>
  </svg>`,

  ultimate_cooldown: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M21 12a9 9 0 11-2.6-6.4L21 8m0-5v5h-5" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  banish: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <circle cx="12" cy="12" r="9" stroke="${c}" stroke-width="2"/>
    <path d="M6 6l12 12" stroke="${c}" stroke-width="2.2"/>
  </svg>`,

  relic_dice: (c, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" xmlns="http://www.w3.org/2000/svg" class="v-upg">
    <path d="M12 2l8 5v10l-8 5-8-5V7l8-5z" stroke="${c}" stroke-width="1.8" fill="#1b1226"/>
    <path d="M12 2v20M4 7l8 5 8-5M4 17l8-5 8 5" stroke="${c}" stroke-width="1.2"/>
  </svg>`
};

export const VectorIcons = {
  getSvg(name, color = '#ffd700', size = 24) {
    if (ICONS[name]) {
      return ICONS[name](color, size);
    }
    // Fallback vector rune
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="${color}" stroke-width="2"/><path d="M12 7v10M7 12h10" stroke="${color}" stroke-width="2"/></svg>`;
  },

  inject(element, name, color, size) {
    if (element) {
      element.innerHTML = this.getSvg(name, color, size);
    }
  }
};
