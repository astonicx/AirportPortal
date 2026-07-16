"use strict";
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");

function openDatabaseWithRecovery(dbPath) {
    const configure = (instance) => {
        instance.pragma("journal_mode = WAL");
        instance.pragma("foreign_keys = ON");
        return instance;
    };

    try {
        return configure(new Database(dbPath));
    } catch (err) {
        if (err?.code !== "SQLITE_CORRUPT") throw err;

        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupBase = `${dbPath}.corrupt-${stamp}`;
        const sidecars = ["", "-wal", "-shm"];

        for (const suffix of sidecars) {
            const src = `${dbPath}${suffix}`;
            const dst = `${backupBase}${suffix}`;
            if (fs.existsSync(src)) {
                fs.renameSync(src, dst);
            }
        }

        console.warn(
            `SQLite database was corrupt and has been moved to ${backupBase}*; creating a fresh database.`
        );
        return configure(new Database(dbPath));
    }
}

const db = openDatabaseWithRecovery(DB_PATH);

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
    const pending = files.filter((f) => !applied.has(f));
    if (!pending.length) return;
    const insert = db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)");
    // Disable foreign key enforcement while migrations run. Some migrations need
    // to rebuild a parent table (SQLite can't alter CHECK constraints in place),
    // and dropping a referenced table with FKs on would cascade-delete child
    // rows. The pragma must be toggled outside any transaction. We re-enable and
    // verify integrity with foreign_key_check once all migrations are applied.
    db.pragma("foreign_keys = OFF");
    try {
        for (const f of pending) {
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
        const violations = db.pragma("foreign_key_check");
        if (violations.length) {
            throw new Error(
                `foreign_key_check failed after migrations: ${JSON.stringify(violations)}`
            );
        }
    } finally {
        db.pragma("foreign_keys = ON");
    }
}

module.exports = { db, runMigrations };
