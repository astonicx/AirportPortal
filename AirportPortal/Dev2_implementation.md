# Dev 2 — Flights, Booking & API Integration Implementation Guide

> Copy-paste ready. Begin once Dev 1 has finished Step 4 (`server/utils/apiClient.js` + `cache.js`) and Step 7 (auth + `requireAuth` middleware).
> **Rules:** Every route lives in its own `server/routes/<domain>.js` file. `server.js` only mounts. All upstream calls go through `apiClient` (handles bearer token + HTTP 555 retry).

---

## Step 1 — Flights proxy + cache (Task 16)

### 1a. `server/routes/flights.js`
```js
"use strict";
const router = require("express").Router();
const api = require("../utils/apiClient");
const { getCached, putCached } = require("../utils/cache");
const { db } = require("../db");

const SORTABLE = new Set(["flightNumber", "airline", "airport", "city", "time", "gate"]);

function sortFlights(list, sortBy, sortDir) {
  if (!SORTABLE.has(sortBy)) return list;
  const dir = sortDir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = a[sortBy] ?? ""; const bv = b[sortBy] ?? "";
    if (av < bv) return -1 * dir;
    if (av > bv) return  1 * dir;
    return 0;
  });
}

function matchesQuery(f, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return ["flightNumber","airline","airport","city","gate"]
    .some(k => String(f[k] ?? "").toLowerCase().includes(needle));
}

// GET /api/flights
router.get("/", async (req, res, next) => {
  try {
    const type      = req.query.type === "arrival" ? "arrival" : "departure";
    const page      = Math.max(1, parseInt(req.query.page ?? "1", 10));
    const pageSize  = Math.min(50, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
    const q         = (req.query.q || "").trim();
    const sortBy    = req.query.sortBy || "time";
    const sortDir   = req.query.sortDir === "desc" ? "desc" : "asc";

    const upstream = await api.get(`/v1/flights?type=${type}`);
    const flights = (upstream.flights || upstream || [])
      .filter(f => f.status !== "past")
      .filter(f => matchesQuery(f, q));

    // write-through cache
    for (const f of flights) putCached(f.flight_id || f.id, f);

    const sorted = sortFlights(flights, sortBy, sortDir);
    const start  = (page - 1) * pageSize;
    res.json({
      page, pageSize, total: sorted.length,
      items: sorted.slice(start, start + pageSize),
    });
  } catch (e) { next(e); }
});

// GET /api/flights/:id
router.get("/:id", async (req, res, next) => {
  try {
    const cached = getCached(req.params.id);
    if (cached) return res.json(cached.payload);
    const data = await api.get(`/v1/flights/${req.params.id}`);
    putCached(req.params.id, data);
    res.json(data);
  } catch (e) { next(e); }
});

module.exports = router;
```

Mount in `server.js`:
```js
app.use("/api/flights", require("./routes/flights"));
```

### 1b. Document shape in `server/routes/flights.md`
```md
# Flights API

## GET /api/flights
Query: type=arrival|departure, page=1, pageSize=20, q=<string>,
       sortBy=flightNumber|airline|airport|city|time|gate, sortDir=asc|desc
Response: { page, pageSize, total, items: Flight[] }

## GET /api/flights/:id
Response: Flight
```

---

## Step 2 — Flight cache refresher (Task 17)

### 2a. `server/jobs/flightSync.js`
```js
"use strict";
const api = require("../utils/apiClient");
const { putCached, pruneOlderThan } = require("../utils/cache");

const INTERVAL_MS = Number(process.env.FLIGHT_SYNC_MS || 60_000);
let timer = null;

async function tick() {
  try {
    for (const type of ["arrival", "departure"]) {
      const data = await api.get(`/v1/flights?type=${type}`);
      const flights = data.flights || data || [];
      for (const f of flights) putCached(f.flight_id || f.id, f);
    }
    pruneOlderThan(7);
  } catch (e) {
    console.error("[flightSync]", e.message);
  }
}

function start() { if (!timer) { tick(); timer = setInterval(tick, INTERVAL_MS); } }
function stop()  { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop };
```

### 2b. Wire into `server.js` (after `runMigrations()`):
```js
const flightSync = require("./jobs/flightSync");
flightSync.start();
process.on("SIGTERM", () => { flightSync.stop(); process.exit(0); });
```

---

## Step 3 — No Fly check (Task 21) — `server/routes/noFly.js`
```js
"use strict";
const router = require("express").Router();
const api = require("../utils/apiClient");
const { z } = require("zod");

const schema = z.object({
  first: z.string(), middle: z.string().optional(),
  last: z.string(), dob: z.string(), gender: z.string(),
});

function norm(s) { return (s || "").trim().toLowerCase(); }

router.post("/check", async (req, res, next) => {
  try {
    const p = schema.parse(req.body);
    const list = await api.get("/v1/no-fly-list");
    const entries = list.entries || list || [];
    const hit = entries.find(e =>
      norm(e.first)  === norm(p.first)  &&
      norm(e.last)   === norm(p.last)   &&
      norm(e.dob)    === norm(p.dob)    &&
      norm(e.gender) === norm(p.gender)
    );
    res.json({ blocked: !!hit, reason: hit ? "Match on No Fly List" : null });
  } catch (e) { next(e); }
});

module.exports = router;
```
Mount: `app.use("/api/no-fly", require("./routes/noFly"));`

### Test `server/routes/noFly.test.js`
```js
"use strict";
const { describe, it, expect, vi } = require("vitest");
vi.mock("../utils/apiClient", () => ({
  get: vi.fn().mockResolvedValue({ entries: [
    { first: "Restricted", middle: "User", last: "Flier", dob: "1985-12-25", gender: "male" }
  ]})
}));
const request = require("supertest");
const express = require("express");
const router = require("./noFly");

const app = express(); app.use(express.json()); app.use("/api/no-fly", router);

describe("no-fly", () => {
  it("blocks documented passenger", async () => {
    const res = await request(app).post("/api/no-fly/check").send({
      first: "restricted", last: "FLIER", dob: "1985-12-25", gender: "Male"
    });
    expect(res.body.blocked).toBe(true);
  });
});
```

---

## Step 4 — Seat availability + locking (Task 22)

### 4a. `server/utils/seats.js`
```js
"use strict";
const ROWS = 18; const COLS = ["A","B","C","D","E","F"]; // 18×6 minus aisle? full 90
const SEATS = Array.from({ length: ROWS }, (_, r) => COLS.map(c => `${r+1}${c}`)).flat();

module.exports = { SEATS };
```

### 4b. `server/routes/flights.js` — append seat endpoints to the existing router
```js
const { db } = require("../db");
const { SEATS } = require("../utils/seats");
const { requireAuth } = require("../middleware/auth");

const LOCK_MIN = 10;

router.get("/:id/seats", (req, res) => {
  const flightId = req.params.id;
  const taken = new Set(
    db.prepare("SELECT seat FROM tickets WHERE flight_id=? AND status='active'").all(flightId).map(r => r.seat)
  );
  db.prepare("DELETE FROM seat_locks WHERE locked_until < datetime('now')").run();
  const locks = db.prepare("SELECT seat, session_id FROM seat_locks WHERE flight_id=?").all(flightId);
  const mySessionId = req.session?.id;
  res.json({
    seats: SEATS.map(s => {
      if (taken.has(s)) return { seat: s, state: "taken" };
      const lock = locks.find(l => l.seat === s);
      if (lock) return { seat: s, state: lock.session_id === mySessionId ? "mine" : "locked" };
      return { seat: s, state: "available" };
    })
  });
});

router.post("/:id/seats/lock", requireAuth, (req, res) => {
  const { seat } = req.body;
  if (!SEATS.includes(seat)) return res.status(400).json({ error: "Invalid seat" });
  const expires = new Date(Date.now() + LOCK_MIN * 60_000).toISOString();
  db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND session_id=?")
    .run(req.params.id, req.session.id);
  try {
    db.prepare(`INSERT INTO seat_locks (flight_id, seat, session_id, locked_until)
                VALUES (?, ?, ?, ?)`).run(req.params.id, seat, req.session.id, expires);
    res.json({ ok: true, lockedUntil: expires });
  } catch {
    res.status(409).json({ error: "Seat already locked" });
  }
});

router.delete("/:id/seats/lock", requireAuth, (req, res) => {
  db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND session_id=?")
    .run(req.params.id, req.session.id);
  res.json({ ok: true });
});
```

### 4c. Background sweep — add to `server/jobs/flightSync.js`
```js
const { db } = require("../db");
setInterval(() => {
  db.prepare("DELETE FROM seat_locks WHERE locked_until < datetime('now')").run();
}, 60_000).unref();
```

---

## Step 5 — Booking endpoint (Task 23) — `server/routes/bookings.js`

### 5a. `server/utils/pricing.js`
```js
"use strict";
function bagFees(carryOnCount, checkedCount) {
  const co = carryOnCount === 2 ? 30 : 0;
  let ch = 0;
  if (checkedCount === 2) ch = 50;
  else if (checkedCount >= 3) ch = 50 + 100 * (checkedCount - 2);
  return co + ch;
}
function confirmationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = require("crypto").randomBytes(8);
  let out = ""; for (let i = 0; i < 8; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
module.exports = { bagFees, confirmationCode };
```

### 5b. `server/utils/pricing.test.js`
```js
"use strict";
const { describe, it, expect } = require("vitest");
const { bagFees } = require("./pricing");

describe("bagFees", () => {
  it("0 bags free", () => expect(bagFees(0, 0)).toBe(0));
  it("2 carry-on = 30", () => expect(bagFees(2, 0)).toBe(30));
  it("2 checked = 50", () => expect(bagFees(0, 2)).toBe(50));
  it("4 checked = 50 + 100*2", () => expect(bagFees(0, 4)).toBe(250));
});
```

### 5c. `server/routes/bookings.js`
```js
"use strict";
const router = require("express").Router();
const { z } = require("zod");
const api = require("../utils/apiClient");
const { db } = require("../db");
const { getCached, putCached } = require("../utils/cache");
const { bagFees, confirmationCode } = require("../utils/pricing");

const schema = z.object({
  flightId: z.string(),
  passenger: z.object({
    first: z.string(), middle: z.string().optional(), last: z.string(),
    dob: z.string(), gender: z.string(),
    email: z.string().email(), phone: z.string(),
  }),
  payment: z.object({
    cardNumber: z.string(), expMonth: z.number(), expYear: z.number(),
    cvc: z.string(), cardholder: z.string(), billingAddress: z.string(), billingZip: z.string(),
    saveCard: z.boolean().optional(),
  }),
  seat: z.string(),
  carryOnCount: z.number().int().min(0).max(2),
  checkedCount: z.number().int().min(0).max(5),
});

async function getFlight(id) {
  const c = getCached(id);
  if (c) return c.payload;
  const f = await api.get(`/v1/flights/${id}`);
  putCached(id, f); return f;
}

router.post("/", async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const flight = await getFlight(data.flightId);

    // 1. flight must be bookable
    if (!flight.bookable || flight.status !== "scheduled")
      return res.status(400).json({ error: "Flight not bookable" });
    const arrives = new Date(flight.arriveAtReceiver);
    if (arrives.getTime() < Date.now() + 24 * 3600 * 1000)
      return res.status(400).json({ error: "Flight departs within 24h" });

    // 2. seat lock must be owned by this session
    const lock = db.prepare("SELECT * FROM seat_locks WHERE flight_id=? AND seat=?")
      .get(data.flightId, data.seat);
    if (!lock || lock.session_id !== req.session?.id)
      return res.status(409).json({ error: "Seat lock not owned" });

    // 3. No Fly + airline-ban checks
    const noFly = await api.get("/v1/no-fly-list");
    const norm = s => (s||"").trim().toLowerCase();
    const blocked = (noFly.entries || []).find(e =>
      norm(e.first) === norm(data.passenger.first) &&
      norm(e.last)  === norm(data.passenger.last)  &&
      norm(e.dob)   === norm(data.passenger.dob)   &&
      norm(e.gender)=== norm(data.passenger.gender)
    );
    if (blocked) return res.status(403).json({ error: "No Fly List match" });

    const banKey = `${norm(data.passenger.first)} ${norm(data.passenger.last)} ${norm(data.passenger.dob)}`;
    const banned = db.prepare("SELECT id FROM airline_bans WHERE lower(user_or_passenger_identity)=? AND lower(airline)=?")
      .get(banKey, norm(flight.airline));
    if (banned) return res.status(403).json({ error: "Banned from this airline" });

    // 4. price
    const seatPriceCents = Math.round((flight.seat_price ?? flight.seatPrice ?? 0) * 100);
    const fees = bagFees(data.carryOnCount, data.checkedCount) * 100;
    const total = seatPriceCents + fees;

    // 5. call upstream
    await api.post(`/v1/flights/${data.flightId}/book`, { seat: data.seat });

    // 6. persist ticket
    const code = confirmationCode();
    const info = db.prepare(`INSERT INTO tickets
      (confirmation_code, user_id, flight_id, passenger_first, passenger_middle, passenger_last,
       passenger_dob, passenger_gender, passenger_email, passenger_phone, seat,
       carry_on_count, checked_count, subtotal_cents, fees_cents, total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        code, req.user?.id ?? null, data.flightId,
        data.passenger.first, data.passenger.middle || null, data.passenger.last,
        data.passenger.dob, data.passenger.gender, data.passenger.email, data.passenger.phone,
        data.seat, data.carryOnCount, data.checkedCount,
        seatPriceCents, fees, total
      );

    // 7. cleanup lock
    db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(data.flightId, data.seat);

    // 8. save card if requested + logged in
    if (data.payment.saveCard && req.user) {
      const last4 = data.payment.cardNumber.slice(-4);
      db.prepare(`INSERT INTO saved_cards
        (user_id, last4, brand, exp_month, exp_year, cardholder_name, billing_address, billing_zip, token_fake)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          req.user.id, last4, "unknown", data.payment.expMonth, data.payment.expYear,
          data.payment.cardholder, data.payment.billingAddress, data.payment.billingZip, `fake_${code}`
        );
    }

    res.status(201).json({ ok: true, ticketId: info.lastInsertRowid, confirmationCode: code, totalCents: total });
  } catch (e) { next(e); }
});

module.exports = router;
```

Mount: `app.use("/api/bookings", require("./routes/bookings"));`

---

## Step 6 — Ticket lookup + cancel (Task 24) — `server/routes/tickets.js`
```js
"use strict";
const router = require("express").Router();
const { db } = require("../db");
const api = require("../utils/apiClient");
const { getCached } = require("../utils/cache");
const { requireAuth } = require("../middleware/auth");

router.get("/by-confirmation", (req, res) => {
  const { lastName, code } = req.query;
  if (!lastName || !code) return res.status(400).json({ error: "Missing params" });
  const row = db.prepare("SELECT * FROM tickets WHERE confirmation_code=? AND lower(passenger_last)=lower(?)")
    .get(code, lastName);
  if (!row) return res.status(404).json({ error: "Not found" });
  const cached = getCached(row.flight_id);
  res.json({ ticket: row, flight: cached?.payload || null });
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const t = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (t.status === "cancelled") return res.status(409).json({ error: "Already cancelled" });

    const isOwner = req.user && req.user.id === t.user_id;
    const isAdmin = req.user && (req.user.type === "admin" || req.user.type === "root");
    const { lastName, code } = req.body || {};
    const isGuest = lastName && code &&
      String(code) === t.confirmation_code &&
      String(lastName).toLowerCase() === String(t.passenger_last).toLowerCase();
    if (!isOwner && !isAdmin && !isGuest) return res.status(403).json({ error: "Forbidden" });

    const flight = getCached(t.flight_id)?.payload;
    if (flight) {
      const dep = new Date(flight.departFromSender || flight.depart_time || 0);
      if (dep.getTime() < Date.now()) return res.status(409).json({ error: "Flight already departed" });
    }

    try { await api.delete(`/v1/tickets/${t.id}`); } catch (e) { /* upstream best-effort */ }

    db.prepare("UPDATE tickets SET status='cancelled', cancelled_at=datetime('now') WHERE id=?").run(id);
    db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(t.flight_id, t.seat);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
```
Mount: `app.use("/api/tickets", require("./routes/tickets"));`

---

## Step 7 — Customer dashboard endpoints (Task 30) — `server/routes/me.js`
```js
"use strict";
const router = require("express").Router();
const { db } = require("../db");
const { getCached } = require("../utils/cache");
const { requireAuth } = require("../middleware/auth");
const { z } = require("zod");

router.use(requireAuth);

router.get("/dashboard", (req, res) => {
  const u = req.user;
  const tickets = db.prepare("SELECT * FROM tickets WHERE user_id=? ORDER BY booked_at DESC").all(u.id);
  const now = Date.now();
  const upcoming = []; const past = [];
  for (const t of tickets) {
    const flight = getCached(t.flight_id)?.payload || null;
    const dep = flight ? new Date(flight.departFromSender || flight.depart_time || 0).getTime() : 0;
    (dep > now && t.status === "active" ? upcoming : past).push({ ...t, flight });
  }
  res.json({
    profile: {
      id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email,
      lastLoginIp: u.last_login_ip, lastLoginDatetime: u.last_login_datetime,
      defaultSort: u.default_sort, autoLogoutMinutes: u.auto_logout_minutes,
    },
    upcoming, past,
  });
});

const patchSchema = z.object({
  title: z.string().optional(), middle_name: z.string().optional(), suffix: z.string().optional(),
  address1: z.string().optional(), city: z.string().optional(), state: z.string().optional(),
  zip: z.string().optional(), country: z.string().optional(), phone: z.string().optional(),
  email: z.string().email().optional(),
  default_sort: z.string().optional(),
  auto_logout_minutes: z.number().int().optional(),
});

router.patch("/", (req, res, next) => {
  try {
    const data = patchSchema.parse(req.body);
    const sets = []; const vals = [];
    for (const [k, v] of Object.entries(data)) { sets.push(`${k}=?`); vals.push(v); }
    if (!sets.length) return res.json({ ok: true });
    vals.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).run(...vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/", (req, res) => {
  // anonymize tickets, then delete the user
  db.prepare("UPDATE tickets SET user_id=NULL WHERE user_id=?").run(req.user.id);
  db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
  res.json({ ok: true });
});

router.post("/cards", (req, res) => {
  const { cardNumber, expMonth, expYear, cardholder, billingAddress, billingZip } = req.body;
  const last4 = String(cardNumber).slice(-4);
  const info = db.prepare(`INSERT INTO saved_cards
    (user_id, last4, brand, exp_month, exp_year, cardholder_name, billing_address, billing_zip, token_fake)
    VALUES (?, ?, 'unknown', ?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, last4, expMonth, expYear, cardholder, billingAddress, billingZip, `fake_${Date.now()}`);
  res.status(201).json({ id: info.lastInsertRowid, last4 });
});

router.delete("/cards/:id", (req, res) => {
  db.prepare("DELETE FROM saved_cards WHERE id=? AND user_id=?").run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

router.post("/claim-ticket", (req, res) => {
  const { lastName, confirmation } = req.body;
  const t = db.prepare("SELECT * FROM tickets WHERE confirmation_code=? AND lower(passenger_last)=lower(?)")
    .get(confirmation, lastName);
  if (!t) return res.status(404).json({ error: "Not found" });
  if (t.user_id && t.user_id !== req.user.id) return res.status(409).json({ error: "Already claimed" });
  db.prepare("UPDATE tickets SET user_id=? WHERE id=?").run(req.user.id, t.id);
  res.json({ ok: true });
});

module.exports = router;
```
Mount: `app.use("/api/me", require("./routes/me"));`

---

## Step 8 — Admin endpoints (Task 33) — `server/routes/admin.js`
```js
"use strict";
const router = require("express").Router();
const { db } = require("../db");
const { hashPassword } = require("../utils/password");
const { requireAdmin } = require("../middleware/auth");
const { z } = require("zod");

router.use(requireAdmin);

function statsWindow(label, sinceModifier) {
  const where = sinceModifier ? `WHERE booked_at >= datetime('now', '${sinceModifier}')` : "";
  const row = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total_cents),0) AS gross FROM tickets ${where}`).get();
  return { window: label, tickets: row.n, grossCents: row.gross };
}

router.get("/stats", (_req, res) => {
  res.json({
    windows: [
      statsWindow("1d",  "-1 day"),
      statsWindow("7d",  "-7 days"),
      statsWindow("30d", "-30 days"),
      statsWindow("365d","-365 days"),
      statsWindow("all", null),
    ]
  });
});

// ── customers ───────────────────────────────────────────────────────────────
router.get("/customers", (req, res) => {
  const q = `%${(req.query.q || "").toLowerCase()}%`;
  const rows = db.prepare(`SELECT id, first_name, last_name, email, phone, address1, city
                           FROM users
                           WHERE type='customer'
                             AND (lower(email) LIKE ? OR lower(first_name) LIKE ? OR lower(last_name) LIKE ?
                                  OR lower(phone) LIKE ? OR lower(address1) LIKE ?)`)
    .all(q, q, q, q, q);
  res.json(rows);
});

const createCust = z.object({
  first_name: z.string(), last_name: z.string(),
  email: z.string().email(), password: z.string().min(11),
});
router.post("/customers", async (req, res, next) => {
  try {
    const data = createCust.parse(req.body);
    const hash = await hashPassword(data.password);
    const info = db.prepare(`INSERT INTO users
      (type, first_name, last_name, email, password_hash, must_change_password, must_complete_profile)
      VALUES ('customer', ?, ?, ?, ?, 1, 1)`)
      .run(data.first_name, data.last_name, data.email, hash);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { next(e); }
});

router.patch("/customers/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.type !== "customer") return res.status(403).json({ error: "Admins managed by root" });
  const fields = ["first_name","last_name","email","phone","address1","city","state","zip","country"];
  const sets = []; const vals = [];
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  if (!sets.length) return res.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).run(...vals);
  res.json({ ok: true });
});

router.delete("/customers/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT type FROM users WHERE id=?").get(id);
  if (!target || target.type !== "customer") return res.status(403).json({ error: "Forbidden" });
  db.prepare("UPDATE tickets SET user_id=NULL WHERE user_id=?").run(id);
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ ok: true });
});

// ── tickets search/cancel ───────────────────────────────────────────────────
router.get("/tickets", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const rows = db.prepare("SELECT * FROM tickets ORDER BY booked_at DESC LIMIT 500").all();
  const filtered = q ? rows.filter(r =>
    Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q))
  ) : rows;
  res.json(filtered);
});

router.post("/tickets/:id/cancel", (req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
  if (!t) return res.status(404).json({ error: "Not found" });
  db.prepare("UPDATE tickets SET status='cancelled', cancelled_at=datetime('now') WHERE id=?").run(id);
  db.prepare("DELETE FROM seat_locks WHERE flight_id=? AND seat=?").run(t.flight_id, t.seat);
  res.json({ ok: true });
});

// ── airline bans ────────────────────────────────────────────────────────────
router.post("/airline-bans", (req, res) => {
  const { identity, airline } = req.body;
  const info = db.prepare("INSERT INTO airline_bans (user_or_passenger_identity, airline) VALUES (?, ?)")
    .run(identity, airline);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/airline-bans/:id", (req, res) => {
  db.prepare("DELETE FROM airline_bans WHERE id=?").run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
```
Mount: `app.use("/api/admin", require("./routes/admin"));` (Dev 1's `/api/admin/admins` mount must come **before** this if both exist; Express picks the most specific first.)

---

## Step 9 — Test suite (Task 42)

### 9a. `vitest.config.js`
```js
"use strict";
module.exports = { test: { environment: "node", include: ["server/**/*.test.js"] } };
```

### 9b. Integration test `server/tests/auth-booking.test.js`
```js
"use strict";
const { describe, it, expect, vi, beforeAll } = require("vitest");
vi.mock("../utils/apiClient", () => ({
  get:    vi.fn().mockImplementation((url) => {
    if (url.includes("no-fly")) return Promise.resolve({ entries: [] });
    if (url.includes("/v1/flights/")) return Promise.resolve({
      flight_id: "F1", bookable: true, status: "scheduled",
      arriveAtReceiver: new Date(Date.now() + 48*3600*1000).toISOString(),
      departFromSender: new Date(Date.now() + 36*3600*1000).toISOString(),
      seat_price: 100, airline: "TestAir",
    });
    return Promise.resolve({ flights: [] });
  }),
  post:   vi.fn().mockResolvedValue({ ok: true }),
  delete: vi.fn().mockResolvedValue({ ok: true }),
}));

const request = require("supertest");
// build a minimal app — adapt to your real bootstrap
const express = require("express");
const cookieParser = require("cookie-parser");
const { runMigrations } = require("../db");
const { attachUser } = require("../middleware/auth");

beforeAll(() => { process.env.DB_PATH = ":memory:"; runMigrations(); });

const app = express();
app.use(express.json()); app.use(cookieParser()); app.use(attachUser);
app.use("/api/auth",     require("../routes/auth"));
app.use("/api/flights",  require("../routes/flights"));
app.use("/api/bookings", require("../routes/bookings"));

describe("happy path", () => {
  it("signup → login → book", async () => {
    const agent = request.agent(app);
    const signup = await agent.post("/api/auth/signup").send({
      first_name: "Joe", last_name: "Tester", dob: "1990-01-01", gender: "male",
      address1: "1 Way", city: "Town", state: "ST", zip: "00000", country: "US",
      phone: "5550100", email: "joe@x.com", password: "longenoughpw",
      captchaAnswer: "4", captchaExpected: "4",
      securityQuestions: [{question:"q1",answer:"a"},{question:"q2",answer:"b"},{question:"q3",answer:"c"}],
    });
    expect(signup.status).toBe(201);

    const login = await agent.post("/api/auth/login")
      .send({ firstName:"Joe", lastName:"Tester", password:"longenoughpw" });
    expect(login.status).toBe(200);

    await agent.post("/api/flights/F1/seats/lock").send({ seat: "1A" });
    const book = await agent.post("/api/bookings").send({
      flightId: "F1",
      passenger: { first:"Joe", last:"Tester", dob:"1990-01-01", gender:"male",
                   email:"joe@x.com", phone:"5550100" },
      payment: { cardNumber:"4111111111111111", expMonth:1, expYear:2030,
                 cvc:"123", cardholder:"Joe", billingAddress:"1 Way", billingZip:"00000" },
      seat: "1A", carryOnCount: 0, checkedCount: 0,
    });
    expect(book.status).toBe(201);
    expect(book.body.confirmationCode).toMatch(/^[A-Z2-9]{8}$/);
  });
});
```

### 9c. CI workflow `.github/workflows/ci.yml`
```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci
      - run: npm test
```

---

## Dependency order (Dev 2)

```
Dev1.Step4  →  Step 1 (flights proxy)
              →  Step 2 (sync job)
              →  Step 3 (No Fly)
              →  Step 4 (seats)        ← requires Dev1.Step6 (auth middleware)
              →  Step 5 (booking)      ← requires Step 3 & 4
              →  Step 6 (tickets)      ← requires Step 5
              →  Step 7 (me dashboard) ← requires Step 6 + Dev1.Step7
              →  Step 8 (admin)        ← requires Step 5 + 7
              →  Step 9 (tests)        ← after everything
```

Hand-off points to Dev 3:
- After **Step 1** Dev 3 can build the Flights view.
- After **Step 4** Dev 3 can build the seat-map UI.
- After **Step 5** Dev 3 can build the booking review/confirm flow.
- After **Step 7** Dev 3 can build the customer dashboard.
- After **Step 8** Dev 3 can build the admin dashboard.
