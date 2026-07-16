# Dev 1 — Backend & Auth Implementation Guide

> Copy-paste ready. Follow the order top-to-bottom: each step depends on the previous.
> **Rules:** All password hashing/verification is **server-side only**, using **argon2id** (modern, memory-hard, includes its own random salt). `server/server.js` stays slim — every route lives in its own file under `server/routes/`.

---

## Step 1 — Repo & tooling baseline (Task 1)

### 1a. Install dependencies
```bash
cd AirportPortal
npm uninstall bcryptjs
npm install argon2 better-sqlite3 cookie-parser helmet express-rate-limit uuid dotenv
npm install -D vitest supertest eslint
```

### 1b. Replace `package.json` scripts block
```json
"scripts": {
  "dev": "concurrently \"npm:dev:client\" \"npm:dev:server\"",
  "dev:client": "vite",
  "dev:server": "nodemon server/server.js",
  "build": "vite build",
  "start": "node server/server.js",
  "lint": "eslint .",
  "test": "vitest run"
}
```

### 1c. Replace `.env.example`
```dotenv
# Client
VITE_API_BASE_URL=http://localhost:5000

# Server
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
SESSION_COOKIE_SECRET=change-me-in-prod

# BDPA upstream
BEARER_TOKEN=Tobedeterminelater
BDPA_BASE_URL=https://airports.api.hscc.bdpa.org

# Root admin seed
ROOT_EMAIL=root@portal.local
ROOT_PASSWORD=ChangeMeImmediately!
```

---

## Step 2 — Express bootstrap (Task 2)

> Goal: `server.js` only loads env, middleware, mounts routers, error handler, listens.

### 2a. `server/middleware/requestId.js`
```js
"use strict";
const { randomUUID } = require("crypto");
module.exports = function requestId(req, _res, next) {
  req.id = req.headers["x-request-id"] || randomUUID();
  next();
};
```

### 2b. `server/middleware/errorHandler.js`
```js
"use strict";
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const payload = {
    error: err.publicMessage || (status >= 500 ? "Internal server error" : err.message),
    requestId: req.id,
  };
  if (process.env.NODE_ENV !== "production") payload.stack = err.stack;
  console.error(`[${req.id}]`, err);
  res.status(status).json(payload);
};
```

### 2c. `server/routes/health.js`
```js
"use strict";
const router = require("express").Router();
router.get("/", (_req, res) => res.json({ status: "ok", at: new Date().toISOString() }));
module.exports = router;
```

### 2d. Replace `server/server.js`
```js
"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const requestId = require("./middleware/requestId");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser(process.env.SESSION_COOKIE_SECRET));
app.use(requestId);

// Routes — one router per domain. Add new ones here as later tasks land.
app.use("/api/health",  require("./routes/health"));
app.use("/api/auth",    require("./routes/auth"));
// app.use("/api/flights", require("./routes/flights"));
// app.use("/api/no-fly",  require("./routes/noFly"));
// app.use("/api/bookings", require("./routes/bookings"));
// app.use("/api/tickets", require("./routes/tickets"));
// app.use("/api/me",      require("./routes/me"));
// app.use("/api/admin",   require("./routes/admin"));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 server on http://localhost:${PORT}`));
```

> **Delete** the old `POST /api/auth/hash`, `POST /api/auth/verify`, and inline `/api/proxy` route handlers — they were public hashing oracles. Anything legitimate moves into a router file.

---

## Step 3 — SQLite layer & migrations (Task 3)

### 3a. `server/db/index.js`
```js
"use strict";
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  const applied = new Set(db.prepare("SELECT name FROM _migrations").all().map(r => r.name));
  const insert = db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)");
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    db.exec("BEGIN"); try { db.exec(sql); insert.run(f, new Date().toISOString()); db.exec("COMMIT"); }
    catch (e) { db.exec("ROLLBACK"); throw e; }
    console.log(`migration applied: ${f}`);
  }
}

module.exports = { db, runMigrations };
```

### 3b. `server/db/migrations/0001_init.sql`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('customer','admin','root')),
      title TEXT, first_name TEXT NOT NULL, middle_name TEXT, last_name TEXT NOT NULL,
        suffix TEXT, dob TEXT, gender TEXT,
          address1 TEXT, city TEXT, state TEXT, zip TEXT, country TEXT,
            phone TEXT, email TEXT UNIQUE,
              login_disambiguator TEXT,
                password_hash TEXT NOT NULL,             -- argon2id PHC string (salt embedded)
                  default_sort TEXT DEFAULT 'time',
                    auto_logout_minutes INTEGER DEFAULT 15,
                      must_complete_profile INTEGER DEFAULT 0,
                        must_change_password INTEGER DEFAULT 0,
                          last_login_ip TEXT, last_login_datetime TEXT,
                            created_at TEXT NOT NULL DEFAULT (datetime('now'))
                            );
                            CREATE UNIQUE INDEX ux_users_name_disamb ON users(first_name, last_name, login_disambiguator);

CREATE TABLE user_login_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, ip TEXT, ua TEXT, success INTEGER, attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_lockouts (
  user_id INTEGER PRIMARY KEY,
  locked_until TEXT, failed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE security_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_hash TEXT NOT NULL                 -- argon2id PHC string
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                      -- random token id
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  remember_me INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saved_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last4 TEXT, brand TEXT, exp_month INTEGER, exp_year INTEGER,
  cardholder_name TEXT, billing_address TEXT, billing_zip TEXT, token_fake TEXT
);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  confirmation_code TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  flight_id TEXT NOT NULL,
  passenger_first TEXT, passenger_middle TEXT, passenger_last TEXT,
  passenger_dob TEXT, passenger_gender TEXT, passenger_email TEXT, passenger_phone TEXT,
  seat TEXT, carry_on_count INTEGER, checked_count INTEGER,
  subtotal_cents INTEGER, fees_cents INTEGER, total_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  booked_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT
);

CREATE TABLE seat_locks (
  flight_id TEXT NOT NULL, seat TEXT NOT NULL,
  session_id TEXT NOT NULL, locked_until TEXT NOT NULL,
  PRIMARY KEY (flight_id, seat)
);

CREATE TABLE airline_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_or_passenger_identity TEXT NOT NULL,
  airline TEXT NOT NULL
);

CREATE TABLE flight_cache (
  flight_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER, action TEXT, target_type TEXT, target_id TEXT,
  payload_json TEXT, at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3c. `server/db/seed.js`
```js
"use strict";
const { db } = require("./index");
const { hashPassword } = require("../utils/password");

async function seedRoot() {
  const email = process.env.ROOT_EMAIL;
  const pw = process.env.ROOT_PASSWORD;
  if (!email || !pw) return;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return;
  const hash = await hashPassword(pw);
  db.prepare(`INSERT INTO users (type, first_name, last_name, email, password_hash)
              VALUES ('root','Root','Admin',?,?)`).run(email, hash);
  console.log(`seeded root admin: ${email}`);
}

module.exports = { seedRoot };
```

### 3d. Wire migrations + seed into `server.js` (above `app.listen`)
```js
const { runMigrations } = require("./db");
const { seedRoot } = require("./db/seed");
runMigrations();
seedRoot().catch(e => console.error("seed failed:", e));
```

---

## Step 4 — API client + cache + 555 retry (Task 4)

### 4a. Replace `server/utils/apiClient.js`
```js
"use strict";
const axios = require("axios");

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const BASE = process.env.BDPA_BASE_URL || "";
const TOKEN = process.env.BEARER_TOKEN || "";

const instance = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  timeout: 15000,
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function request(config, attempt = 0) {
  try {
    const res = await instance.request(config);
    return res.data;
  } catch (err) {
    const status = err?.response?.status ?? 0;
    if (status === 555 && attempt < 3) {
      await sleep(200 * Math.pow(2, attempt));
      return request(config, attempt + 1);
    }
    const message = err?.response?.data?.error || err.message || "Upstream failure";
    throw new ApiError(status || 502, "UPSTREAM_ERROR", message);
  }
}

module.exports = {
  ApiError,
  get:    (url, config = {}) => request({ url, method: "GET",    ...config }),
  post:   (url, data, config = {}) => request({ url, method: "POST",   data, ...config }),
  put:    (url, data, config = {}) => request({ url, method: "PUT",    data, ...config }),
  patch:  (url, data, config = {}) => request({ url, method: "PATCH",  data, ...config }),
  delete: (url, config = {}) => request({ url, method: "DELETE", ...config }),
};
```

### 4b. `server/utils/cache.js`
```js
"use strict";
const { db } = require("../db");

const getStmt   = db.prepare("SELECT payload_json, fetched_at FROM flight_cache WHERE flight_id = ?");
const putStmt   = db.prepare(`INSERT INTO flight_cache (flight_id, payload_json, fetched_at)
                              VALUES (?, ?, datetime('now'))
                              ON CONFLICT(flight_id) DO UPDATE SET
                                payload_json=excluded.payload_json,
                                fetched_at=excluded.fetched_at`);
const pruneStmt = db.prepare(`DELETE FROM flight_cache
                              WHERE fetched_at < datetime('now', ?)
                                AND flight_id NOT IN (SELECT DISTINCT flight_id FROM tickets)`);

module.exports = {
  getCached(id) { const r = getStmt.get(id); return r ? { payload: JSON.parse(r.payload_json), fetchedAt: r.fetched_at } : null; },
  putCached(id, payload) { putStmt.run(id, JSON.stringify(payload)); },
  pruneOlderThan(days) { pruneStmt.run(`-${days} days`); },
};
```

---

## Step 5 — Password hashing utilities (Task 7) — **server-only, argon2id**

### 5a. Replace `server/utils/password.js`
```js
"use strict";
const argon2 = require("argon2");

// argon2id with memory-hard params; salt is generated internally (16 bytes default)
// and embedded in the returned PHC string. No separate salt column needed.
const ARGON_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,   // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

async function hashPassword(plain) {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }
  return argon2.hash(plain, ARGON_OPTS);   // returns "$argon2id$v=19$m=...,t=...,p=...$<salt>$<hash>"
}

async function verifyPassword(plain, phc) {
  if (typeof plain !== "string" || typeof phc !== "string") return false;
  try { return await argon2.verify(phc, plain); }
  catch { return false; }
}

// Strength is a UX hint; ENFORCEMENT happens server-side in the signup validator.
function passwordPolicy(plain) {
  const len = (plain || "").length;
  if (len <= 10) return { ok: false, level: "weak",   reason: "Password must be longer than 10 characters." };
  if (len >= 18) return { ok: true,  level: "strong", reason: null };
  return { ok: true, level: "medium", reason: null };
}

module.exports = { hashPassword, verifyPassword, passwordPolicy };
```

### 5b. `server/utils/password.test.js`
```js
"use strict";
const { describe, it, expect } = require("vitest");
const { hashPassword, verifyPassword, passwordPolicy } = require("./password");

describe("password", () => {
  it("hashes are unique per call", async () => {
    const a = await hashPassword("Correct horse battery staple!");
    const b = await hashPassword("Correct horse battery staple!");
    expect(a).not.toBe(b);
    expect(a.startsWith("$argon2id$")).toBe(true);
  });
  it("verify true/false", async () => {
    const h = await hashPassword("hunter22hunter22");
    expect(await verifyPassword("hunter22hunter22", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("policy rejects ≤10", () => {
    expect(passwordPolicy("short").ok).toBe(false);
    expect(passwordPolicy("a".repeat(11)).ok).toBe(true);
    expect(passwordPolicy("a".repeat(18)).level).toBe("strong");
  });
});
```

---

## Step 6 — Session helpers + auth middleware

### 6a. `server/utils/session.js`
```js
"use strict";
const { randomBytes, createHash, timingSafeEqual } = require("crypto");
const { db } = require("../db");

const COOKIE = "sid";

function newToken() {
  const id  = randomBytes(16).toString("hex");
  const tok = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(tok).digest("hex");
  return { id, tok, hash };
}

function issueSession(userId, rememberMe, idleMinutes) {
  const { id, tok, hash } = newToken();
  const ms = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * (idleMinutes || 15);
  const expires = new Date(Date.now() + ms).toISOString();
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, remember_me, expires_at)
              VALUES (?, ?, ?, ?, ?)`).run(id, userId, hash, rememberMe ? 1 : 0, expires);
  return { cookieValue: `${id}.${tok}`, expires };
}

function readCookie(req) {
  const raw = req.cookies?.[COOKIE];
  if (!raw || !raw.includes(".")) return null;
  const [id, tok] = raw.split(".");
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  if (!row) return null;
  const expected = Buffer.from(row.token_hash, "hex");
  const got = createHash("sha256").update(tok).digest();
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

function slide(sessionRow, idleMinutes) {
  if (sessionRow.remember_me) return;
  const expires = new Date(Date.now() + 1000 * 60 * (idleMinutes || 15)).toISOString();
  db.prepare("UPDATE sessions SET last_seen_at = datetime('now'), expires_at = ? WHERE id = ?")
    .run(expires, sessionRow.id);
}

function destroy(sessionId) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

const cookieOpts = expires => ({
  httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
  signed: false, expires: new Date(expires), path: "/",
});

module.exports = { COOKIE, issueSession, readCookie, slide, destroy, cookieOpts };
```

### 6b. `server/middleware/auth.js`
```js
"use strict";
const { db } = require("../db");
const { readCookie, slide } = require("../utils/session");

function attachUser(req, _res, next) {
  const session = readCookie(req);
  if (session) {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
    if (user) {
      slide(session, user.auto_logout_minutes);
      req.user = user;
      req.session = session;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Auth required" });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.type !== "admin" && req.user.type !== "root"))
    return res.status(403).json({ error: "Admin only" });
  next();
}
function requireRoot(req, res, next) {
  if (!req.user || req.user.type !== "root")
    return res.status(403).json({ error: "Root only" });
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin, requireRoot };
```

Mount `attachUser` globally in `server.js` **before** the route mounts:
```js
app.use(require("./middleware/auth").attachUser);
```

---

## Step 7 — Auth routes (Tasks 8, 9, 10, 11) — `server/routes/auth.js`

### 7a. `server/utils/validators.js` (zod schemas)
```js
"use strict";
const { z } = require("zod");

const signupSchema = z.object({
  title: z.string().optional(),
  first_name: z.string().min(1),
  middle_name: z.string().optional(),
  last_name: z.string().min(1),
  suffix: z.string().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.string().min(1),
  address1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  password: z.string(),
  captchaAnswer: z.string().min(1),
  captchaExpected: z.string().min(1),
  securityQuestions: z.array(z.object({ question: z.string().min(3), answer: z.string().min(1) })).min(3),
});

const loginSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(1),
  disambiguator: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

const recoverInitSchema   = z.object({ firstName: z.string(), lastName: z.string(), dob: z.string() });
const recoverAnswerSchema = z.object({ userId: z.number(), answers: z.array(z.string()).min(3) });
const recoverResetSchema  = z.object({ resetToken: z.string().min(10), password: z.string() });

module.exports = { signupSchema, loginSchema, recoverInitSchema, recoverAnswerSchema, recoverResetSchema };
```

### 7b. `server/routes/auth.js`
```js
"use strict";
const router = require("express").Router();
const { randomBytes } = require("crypto");
const { db } = require("../db");
const { hashPassword, verifyPassword, passwordPolicy } = require("../utils/password");
const { issueSession, destroy, COOKIE, cookieOpts } = require("../utils/session");
const { requireAuth } = require("../middleware/auth");
const {
  signupSchema, loginSchema,
  recoverInitSchema, recoverAnswerSchema, recoverResetSchema
} = require("../utils/validators");

// ── helpers ─────────────────────────────────────────────────────────────────
function uniqueDisambiguator(first, last) {
  const taken = new Set(
    db.prepare("SELECT login_disambiguator FROM users WHERE first_name=? AND last_name=?")
      .all(first, last).map(r => r.login_disambiguator || "")
  );
  if (!taken.has("")) return null;
  for (let i = 2; i < 9999; i++) if (!taken.has(String(i))) return String(i);
  return randomBytes(3).toString("hex");
}

function pickIdentity(rows, disambiguator) {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  if (!disambiguator) return { collision: true };
  return rows.find(r => r.login_disambiguator === disambiguator) || null;
}

// ── POST /api/auth/signup ───────────────────────────────────────────────────
router.post("/signup", async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);

    if (data.captchaAnswer.trim() !== data.captchaExpected.trim())
      return res.status(400).json({ error: "CAPTCHA failed" });

    const policy = passwordPolicy(data.password);
    if (!policy.ok) return res.status(400).json({ error: policy.reason });

    const disamb = uniqueDisambiguator(data.first_name, data.last_name);
    const pwHash = await hashPassword(data.password);

    const insertUser = db.prepare(`INSERT INTO users
      (type, title, first_name, middle_name, last_name, suffix, dob, gender,
       address1, city, state, zip, country, phone, email, login_disambiguator, password_hash)
      VALUES ('customer',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertQ = db.prepare("INSERT INTO security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)");

    const userId = db.transaction(() => {
      const info = insertUser.run(
        data.title || null, data.first_name, data.middle_name || null, data.last_name,
        data.suffix || null, data.dob, data.gender,
        data.address1, data.city, data.state, data.zip, data.country,
        data.phone, data.email, disamb, pwHash
      );
      return info.lastInsertRowid;
    })();

    for (const q of data.securityQuestions) {
      const ah = await hashPassword(q.answer.trim().toLowerCase());
      insertQ.run(userId, q.question, ah);
    }

    res.status(201).json({
      ok: true, userId, disambiguator: disamb, strength: policy.level,
    });
  } catch (e) { next(e); }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const rows = db.prepare("SELECT * FROM users WHERE first_name=? AND last_name=?")
      .all(data.firstName, data.lastName);
    const pick = pickIdentity(rows, data.disambiguator);
    if (!pick) return res.status(401).json({ error: "Invalid credentials" });
    if (pick.collision)
      return res.status(409).json({ error: "Name collision", needsDisambiguator: true });

    const user = pick;

    // lockout check
    const lock = db.prepare("SELECT * FROM user_lockouts WHERE user_id=?").get(user.id);
    if (lock?.locked_until && new Date(lock.locked_until) > new Date()) {
      return res.status(423).json({ error: "Locked", lockedUntil: lock.locked_until });
    }

    const ok = await verifyPassword(data.password, user.password_hash);
    if (!ok) {
      const failed = (lock?.failed_count || 0) + 1;
      const lockedUntil = failed >= 3 ? new Date(Date.now() + 3600_000).toISOString() : null;
      db.prepare(`INSERT INTO user_lockouts (user_id, locked_until, failed_count)
                  VALUES (?, ?, ?)
                  ON CONFLICT(user_id) DO UPDATE SET locked_until=excluded.locked_until,
                                                     failed_count=excluded.failed_count`)
        .run(user.id, lockedUntil, failed);
      return res.status(401).json({
        error: "Invalid credentials",
        attemptsRemaining: Math.max(0, 3 - failed),
        lockedUntil,
      });
    }

    // reset lockout
    db.prepare("DELETE FROM user_lockouts WHERE user_id=?").run(user.id);

    db.prepare(`UPDATE users SET last_login_ip=?, last_login_datetime=datetime('now') WHERE id=?`)
      .run(req.ip, user.id);

    const { cookieValue, expires } = issueSession(user.id, !!data.rememberMe, user.auto_logout_minutes);
    res.cookie(COOKIE, cookieValue, cookieOpts(expires));
    res.json({
      ok: true,
      user: { id: user.id, type: user.type, firstName: user.first_name, lastName: user.last_name,
              mustChangePassword: !!user.must_change_password, mustCompleteProfile: !!user.must_complete_profile },
    });
  } catch (e) { next(e); }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  if (req.session) destroy(req.session.id);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id, type: u.type,
    firstName: u.first_name, lastName: u.last_name, email: u.email,
    lastLoginIp: u.last_login_ip, lastLoginDatetime: u.last_login_datetime,
    mustChangePassword: !!u.must_change_password,
    mustCompleteProfile: !!u.must_complete_profile,
    autoLogoutMinutes: u.auto_logout_minutes,
  });
});

// ── Password recovery (customers only) ──────────────────────────────────────
const resetTokens = new Map(); // userId -> { token, expires }

router.post("/recover/init", (req, res, next) => {
  try {
    const { firstName, lastName, dob } = recoverInitSchema.parse(req.body);
    const user = db.prepare("SELECT * FROM users WHERE first_name=? AND last_name=? AND dob=? AND type='customer'")
      .get(firstName, lastName, dob);
    if (!user) return res.status(404).json({ error: "Not found" });
    const qs = db.prepare("SELECT id, question FROM security_questions WHERE user_id=?").all(user.id);
    res.json({ userId: user.id, questions: qs.map(q => q.question) });
  } catch (e) { next(e); }
});

router.post("/recover/answer", async (req, res, next) => {
  try {
    const { userId, answers } = recoverAnswerSchema.parse(req.body);
    const rows = db.prepare("SELECT answer_hash FROM security_questions WHERE user_id=? ORDER BY id")
      .all(userId);
    if (rows.length !== answers.length) return res.status(400).json({ error: "Answers mismatch" });
    for (let i = 0; i < rows.length; i++) {
      const ok = await verifyPassword(answers[i].trim().toLowerCase(), rows[i].answer_hash);
      if (!ok) return res.status(401).json({ error: "Recovery failed" });
    }
    const token = randomBytes(24).toString("hex");
    resetTokens.set(userId, { token, expires: Date.now() + 10 * 60_000 });
    res.json({ resetToken: token });
  } catch (e) { next(e); }
});

router.post("/recover/reset", async (req, res, next) => {
  try {
    const { resetToken, password } = recoverResetSchema.parse(req.body);
    const policy = passwordPolicy(password);
    if (!policy.ok) return res.status(400).json({ error: policy.reason });

    let userId = null;
    for (const [uid, entry] of resetTokens.entries()) {
      if (entry.token === resetToken && entry.expires > Date.now()) { userId = uid; break; }
    }
    if (!userId) return res.status(400).json({ error: "Invalid or expired token" });

    const hash = await hashPassword(password);
    db.prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?").run(hash, userId);
    resetTokens.delete(userId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
```

---

## Step 8 — Rate limiting (Task 39) — `server/middleware/rateLimit.js`
```js
"use strict";
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many auth attempts, slow down." },
});

const bookingLimiter = rateLimit({
  windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many booking attempts." },
});

module.exports = { authLimiter, bookingLimiter };
```

Apply in `server.js` right before the auth/booking route mounts:
```js
const { authLimiter, bookingLimiter } = require("./middleware/rateLimit");
app.use("/api/auth", authLimiter);
app.use("/api/bookings", bookingLimiter);
```

---

## Step 9 — Root admin routes (Task 34) — `server/routes/adminRoot.js`
```js
"use strict";
const router = require("express").Router();
const { db } = require("../db");
const { hashPassword } = require("../utils/password");
const { requireRoot } = require("../middleware/auth");
const { z } = require("zod");

router.use(requireRoot);

const createAdmin = z.object({
  first_name: z.string().min(1), last_name: z.string().min(1),
  email: z.string().email(), password: z.string().min(11),
});

function audit(req, action, targetId, payload) {
  db.prepare(`INSERT INTO admin_audit (admin_id, action, target_type, target_id, payload_json)
              VALUES (?, ?, 'admin', ?, ?)`)
    .run(req.user.id, action, String(targetId), JSON.stringify(payload || {}));
}

router.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT id, first_name, last_name, email, type FROM users WHERE type IN ('admin','root')`).all();
  res.json(rows);
});

router.post("/", async (req, res, next) => {
  try {
    const data = createAdmin.parse(req.body);
    const hash = await hashPassword(data.password);
    const info = db.prepare(`INSERT INTO users (type, first_name, last_name, email, password_hash)
                             VALUES ('admin', ?, ?, ?, ?)`)
      .run(data.first_name, data.last_name, data.email, hash);
    audit(req, "create", info.lastInsertRowid, { email: data.email });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.type === "root") return res.status(403).json({ error: "Cannot modify root" });
  const { first_name, last_name, email } = req.body;
  db.prepare("UPDATE users SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), email=COALESCE(?,email) WHERE id=?")
    .run(first_name, last_name, email, id);
  audit(req, "update", id, req.body);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.type === "root") return res.status(403).json({ error: "Cannot delete root" });
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  audit(req, "delete", id, {});
  res.json({ ok: true });
});

module.exports = router;
```

Mount in `server.js`:
```js
app.use("/api/admin/admins", require("./routes/adminRoot"));
```

---

## Step 10 — Admin-created customer first-login backend (Task 37 backend)

When Dev 2's `POST /api/admin/customers` lands, ensure it sets both flags:
```js
db.prepare(`INSERT INTO users
  (type, first_name, last_name, email, password_hash, must_change_password, must_complete_profile)
  VALUES ('customer', ?, ?, ?, ?, 1, 1)`).run(...);
```
`GET /api/auth/me` already exposes the flags. Add this middleware (used on protected routes Dev 3 writes):
```js
// server/middleware/completionGate.js
"use strict";
module.exports = function completionGate(req, res, next) {
  if (!req.user) return next();
  const blocked = req.user.must_change_password || req.user.must_complete_profile;
  const allowed = req.path.startsWith("/api/me/complete") || req.path.startsWith("/api/auth");
  if (blocked && !allowed) return res.status(409).json({ error: "Must complete profile first" });
  next();
};
```
Mount after `attachUser` in `server.js`:
```js
app.use(require("./middleware/completionGate"));
```

---

## Step 11 — Security hardening (Task 38)

- The hashing oracles (`/api/auth/hash`, `/api/auth/verify`) are **deleted** as part of Step 2 — do not restore them.
- `helmet()` is mounted (Step 2). For dev only, allow Vite:
```js
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
}));
```
- Confirm every SQL call uses `db.prepare(...).run(...)` / `.get(...)` / `.all(...)` with `?` placeholders — no string concatenation anywhere.
- Add a README **Security** section with these three rules:
  1. The browser never hashes passwords. The browser POSTs raw passwords over HTTPS to `/api/auth/*` only.
  2. Passwords and security-question answers are stored as argon2id PHC strings; salts are managed by argon2 and embedded in the hash.
  3. `BEARER_TOKEN` lives only in the server `.env`.

---

## Step 12 — Deployment prep (Task 43)

### 12a. Append to `package.json` scripts
```json
"build:full": "vite build && rm -rf server/public && cp -r dist server/public"
```

Serve static from `server.js` (above error handler):
```js
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res, next) =>
  /^\/api\//.test(_req.path) ? next() : res.sendFile(path.join(__dirname, "public", "index.html"))
);
```

### 12b. `Dockerfile`
```dockerfile
# ─── build stage ─────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:full

# ─── runtime stage ───────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server ./server
EXPOSE 5000
CMD ["node", "server/server.js"]
```

### 12c. README deploy checklist
1. `cp .env.example .env`, set `BEARER_TOKEN`, `ROOT_EMAIL`, `ROOT_PASSWORD`, `SESSION_COOKIE_SECRET`, `CLIENT_ORIGIN`.
2. `docker build -t airport-portal .`
3. `docker run -p 5000:5000 --env-file .env airport-portal`
4. Visit `http://localhost:5000`.

---

## Dependency order (Dev 1)

```
Step 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
```

Hand-off points to other devs:
- After **Step 4** Dev 2 can start flights/booking.
- After **Step 7** Dev 3 can start auth UI.
- After **Step 9** Dev 3 can build the root admin page.
