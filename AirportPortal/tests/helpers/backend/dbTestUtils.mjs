import fs from "node:fs";
import path from "node:path";

const TEST_TEMP_DIR = path.resolve(process.cwd(), "tests/.tmp");

export function ensureTestTempDir() {
    fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
    return TEST_TEMP_DIR;
}

export function getTestDbPath(name = "backend.sqlite") {
    ensureTestTempDir();
    return path.join(TEST_TEMP_DIR, name);
}

export function removeTestDbFiles(name = "backend.sqlite") {
    const dbPath = getTestDbPath(name);
    for (const file of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
        if (fs.existsSync(file)) {
            fs.rmSync(file, { force: true });
        }
    }
}

export function setTestDbEnv(name = "backend.sqlite") {
    const dbPath = getTestDbPath(name);
    process.env.DB_PATH = dbPath;
    return dbPath;
}
