import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TEST_DB_DIR = path.resolve(process.cwd(), "tests/.tmp/db");
const TEST_MIGRATIONS_DIR = path.resolve(process.cwd(), "tests/db/migrations");

function workerId() {
    return process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || "main";
}

export function ensureTestDbDir() {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    return TEST_DB_DIR;
}

export function resolveTestDbPath() {
    if (process.env.TEST_DB_PATH) return process.env.TEST_DB_PATH;
    const base = process.env.TEST_DB_BASENAME || "backend.test";
    return path.join(ensureTestDbDir(), `${base}.${workerId()}.sqlite`);
}

function assertTestPath(dbPath) {
    const normalized = path.resolve(dbPath);
    const allowedRoot = path.resolve(path.join(process.cwd(), "tests/.tmp"));
    if (!normalized.startsWith(allowedRoot + path.sep)) {
        throw new Error(`Refusing to operate on non-test DB path: ${dbPath}`);
    }
}

export function configureTestDbEnv() {
    const dbPath = resolveTestDbPath();
    assertTestPath(dbPath);
    process.env.DB_PATH = dbPath;
    return dbPath;
}

export function removeDbArtifacts(dbPath = resolveTestDbPath()) {
    assertTestPath(dbPath);
    for (const file of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
        if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    }
}

function loadDbApi() {
    return require("../../../server/db");
}

function runTestMigrations(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS _test_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`);

    if (!fs.existsSync(TEST_MIGRATIONS_DIR)) return;

    const files = fs
        .readdirSync(TEST_MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".sql"))
        .sort();

    const applied = new Set(
        db.prepare("SELECT name FROM _test_migrations").all().map((row) => row.name)
    );
    const mark = db.prepare(
        "INSERT INTO _test_migrations (name, applied_at) VALUES (?, ?)"
    );

    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = fs.readFileSync(path.join(TEST_MIGRATIONS_DIR, file), "utf8");
        db.exec("BEGIN");
        try {
            db.exec(sql);
            mark.run(file, new Date().toISOString());
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    }
}

export async function setupTestDatabase({ clean = true, withSeed = false } = {}) {
    const dbPath = configureTestDbEnv();
    if (clean) removeDbArtifacts(dbPath);

    const { db, runMigrations } = loadDbApi();
    runMigrations();
    runTestMigrations(db);

    if (withSeed) {
        await resetTestDatabase({ withSeed: true });
    }

    return { dbPath };
}

export async function resetTestDatabase({ withSeed = false } = {}) {
    configureTestDbEnv();
    const { db, runMigrations } = loadDbApi();

    runMigrations();
    runTestMigrations(db);

    db.exec("PRAGMA foreign_keys = OFF");
    const tables = db
        .prepare(
            `SELECT name
             FROM sqlite_master
             WHERE type='table'
               AND name NOT LIKE 'sqlite_%'
               AND name NOT IN ('_migrations', '_test_migrations')`
        )
        .all()
        .map((row) => row.name);

    for (const table of tables) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare("DELETE FROM sqlite_sequence").run();
    db.exec("PRAGMA foreign_keys = ON");

    if (withSeed) {
        const { seedDeterministicData } = await import("../../db/seeds/deterministicSeed.mjs");
        await seedDeterministicData(db);
    }
}

export function teardownTestDatabase() {
    const dbPath = resolveTestDbPath();
    assertTestPath(dbPath);

    const { db } = loadDbApi();
    db.close();
    removeDbArtifacts(dbPath);
}
