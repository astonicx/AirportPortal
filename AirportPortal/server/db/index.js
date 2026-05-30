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
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const applied = new Set(
        db.prepare("SELECT name FROM _migrations").all().map((r) => r.name)
    );
    const insert = db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)");
    for (const f of files) {
        if (applied.has(f)) continue;
        const sql = fs.readFileSync(path.join(dir, f), "utf8");
        db.exec("BEGIN");
        try {
            db.exec(sql);
            insert.run(f, new Date().toISOString());
            db.exec("COMMIT");
        } catch (e) {
            db.exec("ROLLBACK");
            throw e;
        }
        console.log(`migration applied: ${f}`);
    }
}

module.exports = { db, runMigrations };
