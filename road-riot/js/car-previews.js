// High-Definition Vector Showroom Previews for VALIXIS Supercars
// Used in Forza-style Showroom Carousel and Menu Specifications

export const CAR_PREVIEWS = {
  apex: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="apex-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff2a3b"/>
          <stop offset="50%" stop-color="#d71920"/>
          <stop offset="100%" stop-color="#7a080d"/>
        </linearGradient>
        <linearGradient id="apex-roof" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1a1c22"/>
          <stop offset="50%" stop-color="#2d313b"/>
          <stop offset="100%" stop-color="#121316"/>
        </linearGradient>
        <linearGradient id="apex-glass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#00d9ff" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#061220" stop-opacity="0.95"/>
        </linearGradient>
        <radialGradient id="apex-wheel" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="35%" stop-color="#94a3b8"/>
          <stop offset="70%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </radialGradient>
        <filter id="apex-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <!-- Ground Shadow -->
      <ellipse cx="140" cy="104" rx="122" ry="10" fill="#000000" opacity="0.75" filter="blur(4px)"/>
      <ellipse cx="68" cy="103" rx="22" ry="4" fill="#000000" opacity="0.9"/>
      <ellipse cx="214" cy="103" rx="22" ry="4" fill="#000000" opacity="0.9"/>
      <!-- Rear Wing -->
      <path d="M 230 46 L 260 44 L 262 50 L 232 52 Z" fill="#181a20"/>
      <path d="M 240 52 L 244 68 L 240 68 Z" fill="#0f172a"/>
      <!-- Body Aerodynamics -->
      <path d="M 18 84 C 28 80 44 76 68 76 C 88 76 102 62 120 48 C 142 34 186 35 218 52 C 242 64 256 70 264 78 C 266 82 264 90 256 92 L 242 92 C 238 82 228 75 214 75 C 200 75 190 82 186 92 L 96 92 C 92 82 82 75 68 75 C 54 75 44 82 40 92 L 14 92 C 10 92 10 86 18 84 Z" fill="url(#apex-body)"/>
      <!-- Front Splitter & Side Skirt -->
      <path d="M 10 90 L 38 90 L 42 94 L 8 94 Z" fill="#090d16"/>
      <path d="M 94 92 L 188 92 L 186 95 L 96 95 Z" fill="#090d16"/>
      <!-- Cockpit Glass -->
      <path d="M 116 52 C 130 40 162 40 188 48 C 206 54 216 62 216 65 L 126 65 Z" fill="url(#apex-glass)"/>
      <!-- Race Number Livery #64 -->
      <circle cx="152" cy="74" r="12" fill="#ffffff" stroke="#000" stroke-width="1.2"/>
      <text x="152" y="78" font-family="'Rajdhani', sans-serif" font-size="11" font-weight="900" fill="#000000" text-anchor="middle">64</text>
      <!-- Headlight Laser Beam -->
      <polygon points="16,84 32,80 34,83 18,87" fill="#00f0ff" filter="url(#apex-glow)"/>
      <polygon points="258,78 264,80 263,84 257,82" fill="#ff2a3b"/>
      <!-- Front Wheel -->
      <circle cx="68" cy="91" r="17" fill="#0f172a"/>
      <circle cx="68" cy="91" r="13" fill="url(#apex-wheel)"/>
      <circle cx="68" cy="91" r="5" fill="#d71920"/>
      <!-- Rear Wheel -->
      <circle cx="214" cy="91" r="17" fill="#0f172a"/>
      <circle cx="214" cy="91" r="13" fill="url(#apex-wheel)"/>
      <circle cx="214" cy="91" r="5" fill="#d71920"/>
    </svg>
  `,

  venom: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="venom-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c77dff"/>
          <stop offset="50%" stop-color="#9d4edd"/>
          <stop offset="100%" stop-color="#3c096c"/>
        </linearGradient>
        <linearGradient id="venom-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffe6a7"/>
          <stop offset="50%" stop-color="#d4af37"/>
          <stop offset="100%" stop-color="#6f4e17"/>
        </linearGradient>
      </defs>
      <!-- Ground Shadow & Magenta Underglow -->
      <ellipse cx="140" cy="104" rx="120" ry="10" fill="#000000" opacity="0.75" filter="blur(4px)"/>
      <ellipse cx="140" cy="102" rx="90" ry="6" fill="#ff2a85" opacity="0.5" filter="blur(6px)"/>
      <!-- Ducktail Spoiler -->
      <path d="M 238 52 C 248 46 258 42 266 38 L 268 44 C 260 48 252 54 242 58 Z" fill="#240046"/>
      <!-- Main Tuner Body Silhouette -->
      <path d="M 20 86 C 30 82 48 76 70 76 C 92 76 106 62 124 50 C 146 36 190 38 220 54 C 242 66 254 72 262 80 C 265 84 262 92 254 92 L 240 92 C 236 82 226 75 212 75 C 198 75 188 82 184 92 L 98 92 C 94 82 84 75 70 75 C 56 75 46 82 42 92 L 16 92 C 12 92 12 88 20 86 Z" fill="url(#venom-body)"/>
      <!-- Intercooler & Front Lip -->
      <rect x="22" y="86" width="14" height="6" fill="#00d9ff" opacity="0.9"/>
      <!-- Smoked Canopy -->
      <path d="M 120 54 C 134 42 168 42 192 50 C 208 56 216 64 216 66 L 128 66 Z" fill="#10002b" stroke="#7b2cbf" stroke-width="0.8"/>
      <!-- Drift Livery Slits -->
      <polygon points="135,74 165,70 175,72 145,76" fill="#ff2a85"/>
      <polygon points="150,80 185,76 192,78 158,82" fill="#00f0ff"/>
      <!-- Wheels (Bronze Deep Dish) -->
      <circle cx="70" cy="91" r="17" fill="#10002b"/>
      <circle cx="70" cy="91" r="13" fill="url(#venom-bronze)"/>
      <circle cx="70" cy="91" r="4" fill="#000000"/>
      <circle cx="212" cy="91" r="17" fill="#10002b"/>
      <circle cx="212" cy="91" r="13" fill="url(#venom-bronze)"/>
      <circle cx="212" cy="91" r="4" fill="#000000"/>
    </svg>
  `,

  phantom: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="phantom-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffe169"/>
          <stop offset="50%" stop-color="#ffb800"/>
          <stop offset="100%" stop-color="#996500"/>
        </linearGradient>
        <linearGradient id="phantom-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#475569"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
      </defs>
      <!-- Ground Shadow & Gold Underglow -->
      <ellipse cx="140" cy="104" rx="124" ry="10" fill="#000000" opacity="0.75" filter="blur(4px)"/>
      <ellipse cx="140" cy="102" rx="90" ry="6" fill="#ffb800" opacity="0.4" filter="blur(6px)"/>
      <!-- Luxury Executive Body -->
      <path d="M 16 86 C 24 82 46 78 68 78 C 88 78 104 66 126 50 C 146 36 200 36 230 52 C 248 64 260 70 268 76 C 272 80 270 90 260 92 L 244 92 C 240 82 230 75 216 75 C 202 75 192 82 188 92 L 96 92 C 92 82 82 75 68 75 C 54 75 44 82 40 92 L 14 92 C 10 92 10 88 16 86 Z" fill="url(#phantom-gold)"/>
      <!-- Sleek Window Frame & Smoked Glass -->
      <path d="M 120 52 C 136 40 178 40 206 48 C 222 54 226 64 226 66 L 128 66 Z" fill="#0f172a" stroke="#ffb800" stroke-width="1"/>
      <line x1="172" y1="44" x2="172" y2="66" stroke="#ffb800" stroke-width="1.2"/>
      <!-- Quad LED Headlights -->
      <rect x="22" y="82" width="12" height="3" fill="#ffffff" rx="1.5"/>
      <!-- Wheels (Gloss Black Luxury Rims) -->
      <circle cx="68" cy="91" r="17" fill="#020617"/>
      <circle cx="68" cy="91" r="13" fill="url(#phantom-rim)"/>
      <circle cx="68" cy="91" r="4" fill="#ffb800"/>
      <circle cx="216" cy="91" r="17" fill="#020617"/>
      <circle cx="216" cy="91" r="13" fill="url(#phantom-rim)"/>
      <circle cx="216" cy="91" r="4" fill="#ffb800"/>
    </svg>
  `,

  interceptor: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="inter-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
      </defs>
      <!-- Ground Shadow & Cyan Pursuit Light -->
      <ellipse cx="140" cy="104" rx="122" ry="10" fill="#000000" opacity="0.8" filter="blur(4px)"/>
      <ellipse cx="140" cy="102" rx="90" ry="6" fill="#00d9ff" opacity="0.45" filter="blur(6px)"/>
      <!-- Tactical Front Push-Bar -->
      <rect x="8" y="78" width="8" height="16" fill="#475569" rx="1"/>
      <line x1="12" y1="80" x2="24" y2="84" stroke="#475569" stroke-width="2"/>
      <line x1="12" y1="92" x2="24" y2="90" stroke="#475569" stroke-width="2"/>
      <!-- Pursuit Body -->
      <path d="M 18 86 C 28 82 46 76 68 76 C 88 76 102 62 122 48 C 144 34 188 35 218 52 C 242 64 256 70 264 78 C 266 82 264 90 256 92 L 242 92 C 238 82 228 75 214 75 C 200 75 190 82 186 92 L 96 92 C 92 82 82 75 68 75 C 54 75 44 82 40 92 L 14 92 C 10 92 10 88 18 86 Z" fill="url(#inter-body)"/>
      <!-- Police White Door Panel & Star -->
      <path d="M 118 72 L 178 72 L 174 90 L 114 90 Z" fill="#f8fafc"/>
      <polygon points="146,76 148,81 153,81 149,84 151,89 146,86 141,89 143,84 139,81 144,81" fill="#0f172a"/>
      <!-- Low-Profile Emergency Roof Lightbar -->
      <rect x="156" y="36" width="16" height="4" fill="#00f0ff" rx="1" filter="drop-shadow(0 0 3px #00f0ff)"/>
      <rect x="172" y="36" width="16" height="4" fill="#ff2a3b" rx="1" filter="drop-shadow(0 0 3px #ff2a3b)"/>
      <!-- High-Intensity Headlight Strobes -->
      <circle cx="24" cy="84" r="3" fill="#00f0ff"/>
      <!-- Wheels (Pursuit Steelies) -->
      <circle cx="68" cy="91" r="17" fill="#020617"/>
      <circle cx="68" cy="91" r="13" fill="#334155"/>
      <circle cx="68" cy="91" r="6" fill="#94a3b8"/>
      <circle cx="214" cy="91" r="17" fill="#020617"/>
      <circle cx="214" cy="91" r="13" fill="#334155"/>
      <circle cx="214" cy="91" r="6" fill="#94a3b8"/>
    </svg>
  `,

  titan: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="titan-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#475569"/>
          <stop offset="50%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <!-- Heavy Ground Shadow -->
      <ellipse cx="140" cy="106" rx="126" ry="11" fill="#000000" opacity="0.85" filter="blur(4px)"/>
      <ellipse cx="140" cy="103" rx="90" ry="6" fill="#00ff88" opacity="0.35" filter="blur(6px)"/>
      <!-- Armored Roof Expedition Rack -->
      <rect x="96" y="32" width="124" height="4" fill="#0f172a"/>
      <circle cx="106" cy="30" r="2.5" fill="#ffb800"/>
      <circle cx="116" cy="30" r="2.5" fill="#ffb800"/>
      <circle cx="126" cy="30" r="2.5" fill="#ffb800"/>
      <!-- Heavy High-Stance Body Silhouette -->
      <path d="M 18 82 L 32 68 L 68 68 L 96 42 L 222 42 L 254 58 L 262 82 L 252 88 L 238 88 C 234 76 222 68 208 68 C 194 68 182 76 178 88 L 102 88 C 98 76 86 68 72 68 C 58 68 46 76 42 88 L 16 88 Z" fill="url(#titan-body)"/>
      <!-- Heavy Steel Bull Bar -->
      <rect x="10" y="74" width="8" height="18" fill="#1e293b" rx="2"/>
      <!-- Armored Windows -->
      <path d="M 102 46 L 152 46 L 152 64 L 76 64 Z" fill="#020617" stroke="#64748b" stroke-width="1"/>
      <path d="M 158 46 L 216 46 L 226 64 L 158 64 Z" fill="#020617" stroke="#64748b" stroke-width="1"/>
      <!-- Massive Beadlock Wheels -->
      <circle cx="72" cy="88" r="20" fill="#020617"/>
      <circle cx="72" cy="88" r="14" fill="#334155"/>
      <circle cx="72" cy="88" r="6" fill="#00ff88"/>
      <circle cx="208" cy="88" r="20" fill="#020617"/>
      <circle cx="208" cy="88" r="14" fill="#334155"/>
      <circle cx="208" cy="88" r="6" fill="#00ff88"/>
    </svg>
  `,

  hyperion: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="hyp-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#032b43"/>
        </linearGradient>
        <radialGradient id="hyp-turbine" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00f0ff"/>
          <stop offset="40%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
      </defs>
      <!-- Ground Shadow & Cyber Cyan Underglow -->
      <ellipse cx="140" cy="104" rx="126" ry="10" fill="#000000" opacity="0.8" filter="blur(4px)"/>
      <ellipse cx="140" cy="102" rx="100" ry="7" fill="#00f0ff" opacity="0.6" filter="blur(8px)"/>
      <!-- Extreme Low-Slung Hypercar Cockpit & Body -->
      <path d="M 14 86 C 26 80 46 74 68 74 C 90 74 108 58 132 44 C 158 30 196 32 222 48 C 246 60 258 68 268 76 C 272 80 268 88 258 90 L 244 90 C 240 78 228 72 214 72 C 200 72 188 78 184 90 L 96 90 C 92 78 80 72 66 72 C 52 72 40 78 36 90 L 12 90 C 8 90 8 86 14 86 Z" fill="url(#hyp-body)"/>
      <!-- Cab-Forward Jet Fighter Canopy -->
      <path d="M 124 48 C 142 34 182 34 204 44 C 218 50 224 58 224 62 L 132 62 Z" fill="#030712" stroke="#00f0ff" stroke-width="0.9"/>
      <!-- Y-Laser Headlights -->
      <polyline points="18,84 28,82 32,78" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
      <polyline points="28,82 32,86" fill="none" stroke="#00f0ff" stroke-width="2" stroke-linecap="round"/>
      <!-- Aero Diffuser Fins -->
      <polygon points="256,80 266,74 268,82" fill="#00f0ff"/>
      <!-- Aero Turbine Wheels with Glowing Rotors -->
      <circle cx="66" cy="89" r="18" fill="#020617"/>
      <circle cx="66" cy="89" r="14" fill="url(#hyp-turbine)"/>
      <circle cx="66" cy="89" r="5" fill="#00f0ff"/>
      <circle cx="214" cy="89" r="18" fill="#020617"/>
      <circle cx="214" cy="89" r="14" fill="url(#hyp-turbine)"/>
      <circle cx="214" cy="89" r="5" fill="#00f0ff"/>
    </svg>
  `,

  valkyrie: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="valk-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff4757"/>
          <stop offset="45%" stop-color="#ff1744"/>
          <stop offset="100%" stop-color="#570014"/>
        </linearGradient>
        <linearGradient id="valk-wing" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2d3436"/>
          <stop offset="100%" stop-color="#090a0c"/>
        </linearGradient>
        <radialGradient id="valk-wheel" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffea00"/>
          <stop offset="40%" stop-color="#d63031"/>
          <stop offset="100%" stop-color="#1e272e"/>
        </radialGradient>
      </defs>
      <!-- Ground Shadow & Gold Underglow -->
      <ellipse cx="140" cy="105" rx="124" ry="10" fill="#000000" opacity="0.8" filter="blur(4px)"/>
      <ellipse cx="140" cy="103" rx="95" ry="6" fill="#ffea00" opacity="0.5" filter="blur(7px)"/>
      <!-- Giant Carbon Swan-Neck Rear Wing -->
      <path d="M 232 40 L 268 38 L 270 46 L 234 48 Z" fill="url(#valk-wing)"/>
      <path d="M 242 48 L 246 66 L 240 66 Z" fill="#090a0c"/>
      <!-- Low Wedge V12 Track Body -->
      <path d="M 16 86 C 26 80 44 74 68 74 C 92 74 110 56 130 42 C 154 28 190 30 216 46 C 238 56 254 66 262 76 C 266 80 264 88 254 90 L 240 90 C 236 78 226 72 212 72 C 198 72 188 78 184 90 L 96 90 C 92 78 82 72 68 72 C 54 72 44 78 40 90 L 14 90 C 10 90 10 86 16 86 Z" fill="url(#valk-body)"/>
      <!-- Dark Tint Glass -->
      <path d="M 124 46 C 142 32 178 32 200 42 C 214 48 220 56 220 60 L 130 60 Z" fill="#1e272e" stroke="#ffea00" stroke-width="0.8"/>
      <!-- Racing Livery V12 Striping -->
      <path d="M 50 78 L 220 78" stroke="#ffea00" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Front Aero Canards & Splitter -->
      <polygon points="12,88 38,88 36,92 8,92" fill="#090a0c"/>
      <!-- Front Wheel -->
      <circle cx="68" cy="90" r="18" fill="#090a0c"/>
      <circle cx="68" cy="90" r="14" fill="url(#valk-wheel)"/>
      <circle cx="68" cy="90" r="5" fill="#ffea00"/>
      <!-- Rear Wheel -->
      <circle cx="212" cy="90" r="18" fill="#090a0c"/>
      <circle cx="212" cy="90" r="14" fill="url(#valk-wheel)"/>
      <circle cx="212" cy="90" r="5" fill="#ffea00"/>
    </svg>
  `,

  spectre: `
    <svg viewBox="0 0 280 120" xmlns="http://www.w3.org/2000/svg" class="car-preview-svg">
      <defs>
        <linearGradient id="spec-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#55efc4"/>
          <stop offset="45%" stop-color="#00b894"/>
          <stop offset="100%" stop-color="#004d40"/>
        </linearGradient>
        <radialGradient id="spec-neon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#55efc4"/>
          <stop offset="50%" stop-color="#00b894"/>
          <stop offset="100%" stop-color="#001e17"/>
        </radialGradient>
      </defs>
      <!-- Ground Shadow & Cyber Emerald Underglow -->
      <ellipse cx="140" cy="105" rx="126" ry="10" fill="#000000" opacity="0.8" filter="blur(4px)"/>
      <ellipse cx="140" cy="103" rx="100" ry="7" fill="#00ffaa" opacity="0.65" filter="blur(8px)"/>
      <!-- Cyber Aeroblade Body -->
      <path d="M 14 86 C 26 80 46 72 70 72 C 94 72 112 54 134 40 C 160 26 198 28 224 44 C 248 56 260 66 268 76 C 272 80 268 88 258 90 L 244 90 C 240 78 228 72 214 72 C 200 72 188 78 184 90 L 96 90 C 92 78 80 72 66 72 C 52 72 40 78 36 90 L 12 90 C 8 90 8 86 14 86 Z" fill="url(#spec-body)"/>
      <!-- Floating Glass Jet Canopy -->
      <path d="M 126 44 C 146 30 186 30 208 40 C 220 46 226 54 226 58 L 134 58 Z" fill="#001e17" stroke="#00ffaa" stroke-width="1.2"/>
      <!-- Active Laser Blade Headlight -->
      <polygon points="16,84 34,80 36,83 18,87" fill="#00ffaa"/>
      <path d="M 260 76 L 270 76 L 268 82" stroke="#00ffaa" stroke-width="2" fill="none"/>
      <!-- Front Aero Rotor Wheel -->
      <circle cx="66" cy="89" r="18" fill="#001e17"/>
      <circle cx="66" cy="89" r="14" fill="url(#spec-neon)"/>
      <circle cx="66" cy="89" r="5" fill="#55efc4"/>
      <!-- Rear Aero Rotor Wheel -->
      <circle cx="214" cy="89" r="18" fill="#001e17"/>
      <circle cx="214" cy="89" r="14" fill="url(#spec-neon)"/>
      <circle cx="214" cy="89" r="5" fill="#55efc4"/>
    </svg>
  `
};

export function getCarPreviewSvg(carId) {
  return CAR_PREVIEWS[carId] || CAR_PREVIEWS.apex;
}
