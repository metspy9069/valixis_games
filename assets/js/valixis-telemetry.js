/**
 * VALIXIS Proprietary Game & Portal Telemetry Engine (v2.0)
 * 100% Self-Hosted & Owned by VALIXIS Technologies
 * Zero Third-Party Trackers &bull; Zero External Ad Networks
 */
(function (global) {
  'use strict';

  const STORAGE_KEY_SESSION = 'valixis_session_id';
  const STORAGE_KEY_REGISTRY = 'valixis_telemetry_registry_v2';
  const STORAGE_KEY_CONFIG = 'valixis_telemetry_config';
  const CHANNEL_NAME = 'valixis_telemetry_bus';

  // Default VALIXIS Telemetry Endpoint (Can be overridden in ops settings or window)
  const DEFAULT_ENDPOINT = window.VALIXIS_TELEMETRY_ENDPOINT || '';

  // 1. Session & Device Fingerprint (Privacy-friendly, anonymous, unique to this session)
  function getSessionId() {
    try {
      let sid = sessionStorage.getItem(STORAGE_KEY_SESSION);
      if (!sid) {
        sid = 'vx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
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

  function getBrowserOS() {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    return os;
  }

  const SESSION_ID = getSessionId();
  const DEVICE_TYPE = getDeviceType();
  const PLATFORM_OS = getBrowserOS();
  const SCREEN_RES = `${window.innerWidth}x${window.innerHeight}`;

  // 2. Local & Cross-Tab Realtime Bus
  let bus = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bus = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) {}

  // 3. Proprietary Dispatcher (Posts to VALIXIS Backend if configured)
  function dispatchToEndpoint(endpoint, payload) {
    if (!endpoint) return;
    try {
      if (navigator.sendBeacon && payload.type === 'session_exit') {
        navigator.sendBeacon(endpoint + '/api/telemetry/event', JSON.stringify(payload));
        return;
      }
      fetch(endpoint + '/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }

  function broadcastEvent(type, data) {
    const payload = {
      type,
      sessionId: SESSION_ID,
      device: DEVICE_TYPE,
      os: PLATFORM_OS,
      screen: SCREEN_RES,
      timestamp: Date.now(),
      data
    };

    // Send to proprietary VALIXIS server endpoint if active
    let customEndpoint = DEFAULT_ENDPOINT;
    try {
      customEndpoint = localStorage.getItem(STORAGE_KEY_CONFIG) || DEFAULT_ENDPOINT;
    } catch (e) {}
    if (customEndpoint) {
      dispatchToEndpoint(customEndpoint, payload);
    }

    // Broadcast channel for real-time local listening (e.g. ops dashboard)
    if (bus) {
      try { bus.postMessage(payload); } catch (e) {}
    }

    // Persist latest state in local registry for instant reconciliation
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
      const registry = raw ? JSON.parse(raw) : { sessions: {}, events: [], stats: { totalVisits: 0, gameStarts: 0 } };

      registry.sessions = registry.sessions || {};
      registry.stats = registry.stats || { totalVisits: 0, gameStarts: 0 };

      // Update session record
      registry.sessions[SESSION_ID] = {
        sessionId: SESSION_ID,
        device: DEVICE_TYPE,
        os: PLATFORM_OS,
        screen: SCREEN_RES,
        location: data.gameId || 'portal',
        locationName: data.gameName || 'Arcade Portal',
        status: type,
        lastPing: Date.now(),
        startedAt: registry.sessions[SESSION_ID]?.startedAt || Date.now(),
        score: data.score || 0,
        wave: data.wave || 0
      };

      if (type === 'presence_active') {
        registry.stats.totalVisits = (registry.stats.totalVisits || 0) + 1;
      } else if (type === 'game_start') {
        registry.stats.gameStarts = (registry.stats.gameStarts || 0) + 1;
      }

      // Clean sessions inactive for > 65 seconds
      const now = Date.now();
      for (const [id, s] of Object.entries(registry.sessions)) {
        if (now - s.lastPing > 65000) {
          delete registry.sessions[id];
        }
      }

      // Keep recent 50 events for the live log
      registry.events = registry.events || [];
      registry.events.unshift({
        time: new Date().toLocaleTimeString(),
        type,
        game: data.gameName || data.gameId || 'Portal',
        device: `${DEVICE_TYPE} (${PLATFORM_OS})`,
        details: data.details || ''
      });
      if (registry.events.length > 50) registry.events.length = 50;

      localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(registry));
    } catch (e) {}
  }

  // 4. Core Telemetry Public API
  const ValixisTelemetry = {
    sessionId: SESSION_ID,
    device: DEVICE_TYPE,
    os: PLATFORM_OS,

    init(options = {}) {
      const gameId = options.gameId || 'portal';
      const gameName = options.gameName || (gameId === 'portal' ? 'VALIXIS Games Arcade' : gameId);

      // Log initial presence
      this.trackPresence(gameId, gameName);

      // Start automatic heartbeat every 15 seconds while page is visible
      setInterval(() => {
        if (!document.hidden) {
          this.heartbeat(gameId, { gameName });
        }
      }, 15000);

      // Handle page exit
      window.addEventListener('beforeunload', () => {
        this.trackExit(gameId);
      });

      // Visibility change pauses/resumes active status
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          broadcastEvent('player_idle', { gameId, details: 'Tab in background' });
        } else {
          this.heartbeat(gameId, { gameName, details: 'Tab resumed' });
        }
      });

      console.log(`[VALIXIS Proprietary Telemetry] Initialized — Session: ${SESSION_ID} | ${DEVICE_TYPE} (${PLATFORM_OS}) | Target: ${gameName}`);
    },

    trackPresence(gameId, gameName) {
      broadcastEvent('presence_active', { gameId, gameName, details: `Player connected to ${gameName}` });
    },

    startGame(gameId, gameName, metadata = {}) {
      broadcastEvent('game_start', { gameId, gameName, details: `Player deployed into ${gameName}`, ...metadata });
    },

    heartbeat(gameId, metadata = {}) {
      broadcastEvent('heartbeat', { gameId, ...metadata });
    },

    milestone(gameId, milestoneName, value) {
      broadcastEvent('milestone', { gameId, details: `${milestoneName}: ${value}` });
    },

    gameOver(gameId, gameName, stats = {}) {
      broadcastEvent('game_over', { gameId, gameName, details: `Game Over — Final Score: ${stats.score || 0}`, ...stats });
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
        return raw ? JSON.parse(raw) : { sessions: {}, events: [], stats: { totalVisits: 0, gameStarts: 0 } };
      } catch (e) {
        return { sessions: {}, events: [], stats: { totalVisits: 0, gameStarts: 0 } };
      }
    },

    // Set custom VALIXIS backend endpoint
    setEndpoint(url) {
      try {
        if (url) localStorage.setItem(STORAGE_KEY_CONFIG, url);
        else localStorage.removeItem(STORAGE_KEY_CONFIG);
      } catch (e) {}
    },

    getEndpoint() {
      try {
        return localStorage.getItem(STORAGE_KEY_CONFIG) || DEFAULT_ENDPOINT;
      } catch (e) {
        return DEFAULT_ENDPOINT;
      }
    }
  };

  global.ValixisTelemetry = ValixisTelemetry;
})(typeof window !== 'undefined' ? window : this);
