/**
 * VALIXIS Unified Game & Portal Telemetry Engine
 * Property: VALIXIS Games Arcade (games.valixis.tech)
 * GA4 Measurement ID: G-9SGCBYSRYB
 */
(function (global) {
  'use strict';

  const GA_MEASUREMENT_ID = 'G-9SGCBYSRYB';
  const STORAGE_KEY_SESSION = 'valixis_session_id';
  const STORAGE_KEY_REGISTRY = 'valixis_telemetry_registry_v1';
  const CHANNEL_NAME = 'valixis_telemetry_bus';

  // 1. Session & Device Fingerprint (Privacy-friendly, anonymous)
  function getSessionId() {
    try {
      let sid = sessionStorage.getItem(STORAGE_KEY_SESSION);
      if (!sid) {
        sid = 'vx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(STORAGE_KEY_SESSION, sid);
      }
      return sid;
    } catch (e) {
      return 'vx_guest_' + Date.now();
    }
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
    if (/mobile|iphone|ipod|android|blackberry|iemobile/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  const SESSION_ID = getSessionId();
  const DEVICE_TYPE = getDeviceType();
  const SCREEN_RES = `${window.innerWidth}x${window.innerHeight}`;

  // 2. Google Analytics 4 Script Loader
  function initGA4() {
    if (window.dataLayer && window.gtag) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });

    // Check if gtag script is already on page
    const existing = document.querySelector(`script[src*="${GA_MEASUREMENT_ID}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }
  }

  // 3. Local & Cross-Tab Realtime Bus
  let bus = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bus = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) {}

  function broadcastEvent(type, data) {
    const payload = {
      type,
      sessionId: SESSION_ID,
      device: DEVICE_TYPE,
      screen: SCREEN_RES,
      timestamp: Date.now(),
      data
    };

    // Broadcast channel for real-time local listening (e.g. ops dashboard)
    if (bus) {
      try { bus.postMessage(payload); } catch (e) {}
    }

    // Persist latest state in localStorage for presence reconciliation
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
      const registry = raw ? JSON.parse(raw) : { sessions: {}, events: [] };

      // Update session record
      registry.sessions = registry.sessions || {};
      registry.sessions[SESSION_ID] = {
        sessionId: SESSION_ID,
        device: DEVICE_TYPE,
        location: data.gameId || 'portal',
        locationName: data.gameName || 'Arcade Portal',
        status: type,
        lastPing: Date.now(),
        startedAt: registry.sessions[SESSION_ID]?.startedAt || Date.now(),
        score: data.score || 0,
        wave: data.wave || 0
      };

      // Clean sessions inactive for > 70 seconds
      const now = Date.now();
      for (const [id, s] of Object.entries(registry.sessions)) {
        if (now - s.lastPing > 70000) {
          delete registry.sessions[id];
        }
      }

      // Keep recent 30 events for the live log
      registry.events = registry.events || [];
      registry.events.unshift({
        time: new Date().toLocaleTimeString(),
        type,
        game: data.gameName || data.gameId || 'Portal',
        device: DEVICE_TYPE,
        details: data.details || ''
      });
      if (registry.events.length > 40) registry.events.length = 40;

      localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(registry));
    } catch (e) {}
  }

  // 4. Core Telemetry Public API
  const ValixisTelemetry = {
    sessionId: SESSION_ID,
    device: DEVICE_TYPE,

    init(options = {}) {
      initGA4();

      const gameId = options.gameId || 'portal';
      const gameName = options.gameName || (gameId === 'portal' ? 'VALIXIS Games Arcade' : gameId);

      // Log initial presence
      this.trackPresence(gameId, gameName);

      // Start automatic heartbeat every 20 seconds while page is visible
      setInterval(() => {
        if (!document.hidden) {
          this.heartbeat(gameId, { gameName });
        }
      }, 20000);

      // Handle page exit
      window.addEventListener('beforeunload', () => {
        this.trackExit(gameId);
      });

      console.log(`[VALIXIS Telemetry] Ready — Session: ${SESSION_ID} | Device: ${DEVICE_TYPE} | Target: ${gameName}`);
    },

    trackPresence(gameId, gameName) {
      if (window.gtag) {
        window.gtag('event', 'screen_view', {
          app_name: 'VALIXIS Games',
          screen_name: gameName,
          device_type: DEVICE_TYPE
        });
      }
      broadcastEvent('presence_active', { gameId, gameName, details: `Connected to ${gameName}` });
    },

    startGame(gameId, gameName, metadata = {}) {
      if (window.gtag) {
        window.gtag('event', 'game_start', {
          game_id: gameId,
          game_title: gameName,
          device_type: DEVICE_TYPE,
          ...metadata
        });
      }
      broadcastEvent('game_start', { gameId, gameName, details: `Player deployed into ${gameName}`, ...metadata });
    },

    heartbeat(gameId, metadata = {}) {
      if (window.gtag) {
        window.gtag('event', 'game_heartbeat', {
          game_id: gameId,
          device_type: DEVICE_TYPE,
          ...metadata
        });
      }
      broadcastEvent('heartbeat', { gameId, ...metadata });
    },

    milestone(gameId, milestoneName, value) {
      if (window.gtag) {
        window.gtag('event', 'game_milestone', {
          game_id: gameId,
          milestone: milestoneName,
          value: value
        });
      }
      broadcastEvent('milestone', { gameId, details: `${milestoneName}: ${value}` });
    },

    gameOver(gameId, gameName, stats = {}) {
      if (window.gtag) {
        window.gtag('event', 'game_over', {
          game_id: gameId,
          game_title: gameName,
          score: stats.score || 0,
          wave: stats.wave || 0,
          duration_sec: stats.duration || 0
        });
      }
      broadcastEvent('game_over', { gameId, gameName, details: `Game Over — Score: ${stats.score || 0}`, ...stats });
    },

    trackExit(gameId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
        if (raw) {
          const registry = JSON.parse(raw);
          if (registry.sessions && registry.sessions[SESSION_ID]) {
            delete registry.sessions[SESSION_ID];
            localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(registry));
          }
        }
      } catch (e) {}
      broadcastEvent('session_exit', { gameId, details: 'Player disconnected' });
    },

    // Read full registry (Used by Ops Dashboard)
    getRegistry() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
        return raw ? JSON.parse(raw) : { sessions: {}, events: [] };
      } catch (e) {
        return { sessions: {}, events: [] };
      }
    }
  };

  global.ValixisTelemetry = ValixisTelemetry;
})(typeof window !== 'undefined' ? window : this);
