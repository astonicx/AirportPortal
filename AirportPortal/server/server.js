"use strict";
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const requestId = require("./middleware/requestId");
const errorHandler = require("./middleware/errorHandler");
const { attachUser } = require("./middleware/auth");
const bookingSession = require("./middleware/bookingSession");
const completionGate = require("./middleware/completionGate");
const { authLimiter, bookingLimiter } = require("./middleware/rateLimit");

const { runMigrations } = require("./db");
const { seedRoot, seedTestUsers } = require("./db/seed");

// Run migrations BEFORE requiring routes — several modules prepare
// statements against the schema at require-time.
runMigrations();
seedRoot()
  .then(() => seedTestUsers())
  .catch((e) => console.error("seed failed:", e));

const app = express();

// Behind a reverse proxy (Codespaces, nginx, etc.) the client IP arrives in
// the X-Forwarded-For header. Trust the first proxy hop so express-rate-limit
// can key on the real client IP instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

// ── Security + parsers ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser(process.env.SESSION_COOKIE_SECRET));
app.use(requestId);
app.use(attachUser);
app.use(bookingSession);
app.use(completionGate);

// ── Rate limiters (apply BEFORE the routers they protect) ────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/bookings", bookingLimiter);

// ── Routes — one router per domain ───────────────────────────────────────────
app.use("/api/health", require("./routes/health"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/flights", require("./routes/flights"));
app.use("/api/no-fly", require("./routes/noFly"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/me", require("./routes/me"));
app.use("/api/admin/admins", require("./routes/adminRoot")); // root-only; mount BEFORE /api/admin
app.use("/api/admin", require("./routes/admin"));

// ── Static SPA (production) ──────────────────────────────────────────────────
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// ── Error handler must be last ───────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ─────────────────────────────────────────────────────────────────────
const flightSync = require("./jobs/flightSync");
flightSync.start();
process.on("SIGTERM", () => {
  flightSync.stop();
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 server on http://localhost:${PORT}`);
});
