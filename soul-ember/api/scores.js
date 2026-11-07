// Vercel Serverless Function for high‑score API
// POST /api/scores   { name, score }
// GET  /api/scores   returns top scores
let scores = [];

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(scores);
  }
  if (req.method === 'POST') {
    const { name, score } = req.body;
    if (typeof name === 'string' && typeof score === 'number') {
      scores.push({ name, score, ts: Date.now() });
      scores = scores.sort((a, b) => b.score - a.score).slice(0, 100);
      return res.status(201).json({ success: true });
    }
    return res.status(400).json({ error: 'Invalid payload' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
