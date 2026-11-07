// Simple Express backend for high‑score storage (in‑memory)
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let scores = [];

app.get('/scores', (req, res) => {
  res.json(scores);
});

app.post('/scores', (req, res) => {
  const { name, score } = req.body;
  if (typeof name === 'string' && typeof score === 'number') {
    scores.push({ name, score, ts: Date.now() });
    // keep top 100
    scores = scores.sort((a, b) => b.score - a.score).slice(0, 100);
    res.status(201).json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
