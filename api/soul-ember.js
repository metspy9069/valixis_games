import pg from "pg";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
let pool;
const heroes = ['cinder','grave','thorn','frost','bone','storm','plague','bell'];
function sign(value) {
  return createHmac("sha256", process.env.CHALLENGE_SECRET)
    .update(value)
    .digest("hex");
}
function challenge(kind, now = new Date()) {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (kind === "weekly")
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const id = `v3:${kind}:${date.toISOString().slice(0, 10)}`,
    hash = sign(id),
    seed = parseInt(hash.slice(0, 8), 16);
  return {
    id,
    kind,
    seed,
    hero: heroes[seed % heroes.length],
    modifier: seed % 2 ? "swarm" : "balanced",
    version: 3,
  };
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.DATABASE_URL || !process.env.CHALLENGE_SECRET)
    return res.status(503).json({ error: "Online service not configured" });
  pool ||= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  const action = req.query.action;
  const body = req.body || {};
  if (JSON.stringify(body).length > 4096)
    return res.status(413).json({ error: "Payload too large" });
  try {
    if (action === "start" && req.method === "POST") {
      if (!["daily", "weekly"].includes(body.kind))
        return res.status(400).json({ error: "Invalid challenge" });
      // A global minute budget limits anonymous abuse without storing visitor identifiers.
      const bucket = Math.floor(Date.now() / 60000);
      const limit = await pool.query(
        "INSERT INTO soul_budgets(bucket,total) VALUES($1,1) ON CONFLICT(bucket) DO UPDATE SET total=soul_budgets.total+1 RETURNING total",
        [bucket],
      );
      if (limit.rows[0].total > 300)
        return res.status(429).json({ error: "Try again shortly" });
      await pool.query("DELETE FROM soul_budgets WHERE bucket < $1", [
        bucket - 2,
      ]);
      const c = challenge(body.kind);
      const run = { ...c, nonce: randomUUID(), issued: Date.now() };
      const payload = Buffer.from(JSON.stringify(run)).toString("base64url");
      return res.json({ ...c, token: `${payload}.${sign(payload)}` });
    }
    if (action === "submit" && req.method === "POST") {
      if (typeof body.token !== "string")
        return res.status(400).json({ error: "Missing token" });
      const [payload, sig] = body.token.split(".");
      const expected = sign(payload || "");
      if (
        !sig ||
        !/^[a-f0-9]{64}$/.test(sig) ||
        !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      )
        return res.status(400).json({ error: "Invalid token" });
      const run = JSON.parse(Buffer.from(payload, "base64url").toString());
      const elapsed = (Date.now() - run.issued) / 1000;
      const { duration, kills, gold, victory } = body;
      if (
        ![duration, kills, gold].every(Number.isInteger) ||
        duration < 1 ||
        duration > 1800 ||
        elapsed < duration - 3 ||
        elapsed > 7200 ||
        kills < 0 ||
        kills > duration * 12 ||
        gold < 0 ||
        gold > kills * 10 + 500 ||
        typeof victory !== "boolean" ||
        (victory && duration < 465) ||
        run.version !== 3
      )
        return res.status(400).json({ error: "Invalid run" });
      if (run.id !== challenge(run.kind).id)
        return res.status(409).json({ error: "Challenge expired" });
      const score = Math.round(
        kills * 22 + duration * 35 + gold * 14 + (victory ? 5000 : 0),
      );
      const result = await pool.query(
        "INSERT INTO soul_runs(nonce,challenge,hero,duration,kills,gold,score,victory) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(nonce) DO NOTHING RETURNING score",
        [run.nonce, run.id, run.hero, duration, kills, gold, score, victory],
      );
      if (!result.rowCount)
        return res.status(409).json({ error: "Run already submitted" });
      return res.status(201).json({ score });
    }
    if (action === "board" && req.method === "GET") {
      if (!["daily", "weekly"].includes(req.query.kind))
        return res.status(400).json({ error: "Invalid board" });
      const c = challenge(req.query.kind);
      const records = await pool.query(
        "SELECT hero,duration,score FROM soul_runs WHERE challenge=$1 ORDER BY score DESC,created_at ASC LIMIT 50",
        [c.id],
      );
      return res.json({ challenge: c, records: records.rows });
    }
    if (action === "metric" && req.method === "POST") {
      if (process.env.ENABLE_METRICS !== "true") return res.status(204).end();
      if (
        !["run_start", "run_complete", "challenge_complete"].includes(
          body.event,
        )
      )
        return res.status(400).json({ error: "Unknown event" });
      await pool.query(
        "INSERT INTO soul_metrics(day,event,total) VALUES(CURRENT_DATE,$1,1) ON CONFLICT(day,event) DO UPDATE SET total=soul_metrics.total+1",
        [body.event],
      );
      return res.status(204).end();
    }
    return res.status(405).json({ error: "Unsupported request" });
  } catch (error) {
    console.error("Soul Ember API:", error.message);
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }
}
