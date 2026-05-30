"use strict";
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { ApiClient } = require("./utils/apiClient");

const app = express();
const PORT = 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// ── Password routes ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/hash
 * Body: { password: string }
 * Returns: { hash: string }
 */
app.post("/api/auth/hash", async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== "string" || password.trim() === "") {
    return res.status(400).json({ error: "Password must be a non-empty string." });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    return res.json({ hash });
  } catch (err) {
    return res.status(500).json({ error: "Failed to hash password." });
  }
});

/**
 * POST /api/auth/verify
 * Body: { password: string, hash: string }
 * Returns: { valid: boolean }
 */
app.post("/api/auth/verify", async (req, res) => {
  const { password, hash } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password must be a non-empty string." });
  }
  if (!hash || typeof hash !== "string") {
    return res.status(400).json({ error: "Hash must be a valid string." });
  }
  try {
    const valid = await bcrypt.compare(password, hash);
    return res.json({ valid });
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify password." });
  }
});

// ── Generic external-API proxy ───────────────────────────────────────────────
// Forwards GET /api/proxy?url=<encoded-url> to an external service.
// Use for fetching third-party data server-side to avoid CORS issues.
app.get("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing required query param: url" });
  }
  try {
    const client = new ApiClient("");
    const result = await client.getAll(targetUrl);
    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy request failed." });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
