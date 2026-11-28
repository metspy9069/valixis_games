/**
 * VALIXIS Proprietary Telemetry & Live Player Edge Worker
 * Deployable to Cloudflare Workers, Node.js, Vercel, or Deno
 * 
 * Routes:
 *   POST /api/telemetry/event  - Ingests presence pings & game milestones
 *   GET  /api/telemetry/live   - Returns live concurrent players & active games
 *   GET  /api/telemetry/stats  - Returns total visits & game launches
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// In-Memory Telemetry State (For Worker or Node runtime)
const presenceRegistry = new Map();
const recentEvents = [];
const stats = {
  totalVisits: 0,
  gameStarts: {
    'dead-signal': 0,
    'soul-ember': 0,
    'road-riot': 0,
    'dev-tycoon': 0,
    'portal': 0
  },
  deviceCounts: {
    Mobile: 0,
    Desktop: 0,
    Tablet: 0
  }
};

function cleanupDeadSessions() {
  const now = Date.now();
  for (const [id, session] of presenceRegistry.entries()) {
    if (now - session.lastPing > 45000) { // 45 seconds timeout
      presenceRegistry.delete(id);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    cleanupDeadSessions();

    // 1. Telemetry Event & Ping Ingestion
    if (url.pathname === '/api/telemetry/event' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const { type, sessionId, device, os, data, timestamp } = payload;

        if (sessionId) {
          // Update presence
          presenceRegistry.set(sessionId, {
            sessionId,
            device: device || 'Desktop',
            os: os || 'Unknown',
            game: data?.gameId || 'portal',
            gameName: data?.gameName || 'Arcade Portal',
            lastPing: timestamp || Date.now(),
            score: data?.score || 0,
            wave: data?.wave || 0
          });

          // Aggregate counters
          if (type === 'presence_active') {
            stats.totalVisits++;
            if (stats.deviceCounts[device] !== undefined) {
              stats.deviceCounts[device]++;
            }
          } else if (type === 'game_start') {
            const g = data?.gameId || 'portal';
            stats.gameStarts[g] = (stats.gameStarts[g] || 0) + 1;
          }

          // Append to recent events (max 50)
          recentEvents.unshift({
            time: new Date().toLocaleTimeString(),
            type,
            game: data?.gameName || data?.gameId || 'Portal',
            device: `${device} (${os})`,
            details: data?.details || ''
          });
          if (recentEvents.length > 50) recentEvents.length = 50;
        }

        return new Response(JSON.stringify({ ok: true, activePlayers: presenceRegistry.size }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Live Presence State (For Ops Center Dashboard)
    if (url.pathname === '/api/telemetry/live' && request.method === 'GET') {
      const activeSessions = Array.from(presenceRegistry.values());
      const gameBreakdown = {
        'dead-signal': activeSessions.filter(s => s.game.includes('dead-signal')).length,
        'soul-ember': activeSessions.filter(s => s.game.includes('soul-ember')).length,
        'road-riot': activeSessions.filter(s => s.game.includes('road-riot')).length,
        'dev-tycoon': activeSessions.filter(s => s.game.includes('dev-tycoon')).length,
        'portal': activeSessions.filter(s => s.game === 'portal').length
      };

      const mobiles = activeSessions.filter(s => s.device === 'Mobile').length;
      const desktops = activeSessions.filter(s => s.device === 'Desktop').length;
      const tablets = activeSessions.filter(s => s.device === 'Tablet').length;

      return new Response(JSON.stringify({
        livePlayers: activeSessions.length,
        gameBreakdown,
        deviceBreakdown: { mobiles, desktops, tablets },
        activeSessions,
        recentEvents
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // 3. Historical & Cumulative Statistics
    if (url.pathname === '/api/telemetry/stats' && request.method === 'GET') {
      return new Response(JSON.stringify({
        totalVisits: stats.totalVisits,
        gameStarts: stats.gameStarts,
        deviceDistribution: stats.deviceCounts,
        uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 0)
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response('VALIXIS Proprietary Telemetry Node &bull; Ready', {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' }
    });
  }
};
