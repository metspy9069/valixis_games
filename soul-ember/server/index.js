import { createServer } from "node:http";
import handler from "../../api/soul-ember.js";
createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  req.query = Object.fromEntries(url.searchParams);
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (value) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  if (url.pathname !== "/api/soul-ember")
    return res.status(404).json({ error: "Not found" });
  let body = "";
  try {
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096)
        return res.status(413).json({ error: "Payload too large" });
    }
    req.body = body ? JSON.parse(body) : {};
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  await handler(req, res);
}).listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log("Soul Ember API listening on http://127.0.0.1:3001"),
);
