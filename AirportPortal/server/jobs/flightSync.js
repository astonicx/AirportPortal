"use strict";
const api = require("../utils/apiClient");
const { putCached, pruneOlderThan } = require("../utils/cache");
const { db } = require("../db");

const INTERVAL_MS = Number(process.env.FLIGHT_SYNC_MS || 60_000);
let timer = null;
let sweepTimer = null;

async function tick() {
    try {
        for (const type of ["arrival", "departure"]) {
            // `sort=desc` returns the newest (currently scheduled) flights;
            // the default order returns the oldest, already-past flights.
            const data = await api.get(
                `/v1/flights/search?type=${type}&sort=desc`
            );
            const flights = data.flights || data || [];
            for (const f of flights) putCached(f.flight_id || f.id, f);
        }
        pruneOlderThan(7);
    } catch (e) {
        console.error("[flightSync]", e.message);
    }
}

function start() {
    if (!timer) {
        tick();
        timer = setInterval(tick, INTERVAL_MS);
    }
    if (!sweepTimer) {
        sweepTimer = setInterval(() => {
            db.prepare(
                "DELETE FROM seat_locks WHERE locked_until < datetime('now')"
            ).run();
        }, 60_000);
        sweepTimer.unref?.();
    }
}

function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
    }
}

module.exports = { start, stop };
