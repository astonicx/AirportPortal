"use strict";
const { db } = require("../db");

const getStmt = db.prepare(
    "SELECT payload_json, fetched_at FROM flight_cache WHERE flight_id = ?"
);
const putStmt = db.prepare(
    `INSERT INTO flight_cache (flight_id, payload_json, fetched_at)
   VALUES (?, ?, datetime('now'))
   ON CONFLICT(flight_id) DO UPDATE SET
     payload_json = excluded.payload_json,
     fetched_at = excluded.fetched_at`
);
const pruneStmt = db.prepare(
    `DELETE FROM flight_cache
   WHERE fetched_at < datetime('now', ?)
     AND flight_id NOT IN (SELECT DISTINCT flight_id FROM tickets)`
);

module.exports = {
    getCached(id) {
        const r = getStmt.get(id);
        return r ? { payload: JSON.parse(r.payload_json), fetchedAt: r.fetched_at } : null;
    },
    putCached(id, payload) {
        putStmt.run(id, JSON.stringify(payload));
    },
    pruneOlderThan(days) {
        pruneStmt.run(`-${days} days`);
    },
};
