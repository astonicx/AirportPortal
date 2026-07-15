import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw/server.js";
import {
    configureTestDbEnv,
    setupTestDatabase,
    teardownTestDatabase,
} from "../helpers/backend/sqliteTestEnv.mjs";

// Configure an isolated SQLite file per worker under tests/.tmp.
// This ensures test DB writes can never touch production DB files.
configureTestDbEnv();
await setupTestDatabase({ clean: true, withSeed: false });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
// Keep unit/integration tests deterministic by default.
// When live tests are explicitly enabled (SKIP_LIVE=0), preserve upstream
// env values from .env so apiClient.live tests can hit the real API.
const liveTestsEnabled =
    process.env.SKIP_LIVE === "0" && process.env.CI !== "true";

process.env.CLIENT_ORIGIN = "http://127.0.0.1:3000";
process.env.SESSION_COOKIE_SECRET = "test-session-secret";

if (liveTestsEnabled) {
    process.env.BDPA_BASE_URL = process.env.BDPA_BASE_URL || "";
    process.env.BEARER_TOKEN = process.env.BEARER_TOKEN || "";
} else {
    process.env.BDPA_BASE_URL = "http://127.0.0.1:4010";
    process.env.BEARER_TOKEN = "test-bearer-token";
    process.env.HOME_AIRPORT = "";
}

beforeAll(() => {
    server.listen({
        onUnhandledRequest(req, print) {
            const url = new URL(req.url);
            // Supertest drives a local ephemeral HTTP server (127.0.0.1 or localhost).
            // Those requests are app-internal and should not be treated as missing MSW mocks.
            if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
                return;
            }
            print.error();
        },
    });
});

afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
});

afterAll(() => {
    server.close();
});

afterAll(() => {
    teardownTestDatabase();
});
