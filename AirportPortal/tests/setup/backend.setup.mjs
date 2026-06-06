import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw/server.js";

// Each Vitest worker is a separate process with its own module registry.
// Using :memory: gives every worker a completely isolated SQLite database
// so parallel test files can never share or corrupt each other's data.
// If DB_PATH is already set in the environment (e.g. CI with a real file),
// that value is respected.
process.env.DB_PATH = process.env.DB_PATH || ":memory:";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://127.0.0.1:3000";
process.env.SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || "test-session-secret";
process.env.BDPA_BASE_URL = process.env.BDPA_BASE_URL || "http://127.0.0.1:4010";
process.env.BEARER_TOKEN = process.env.BEARER_TOKEN || "test-bearer-token";

beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
});

afterAll(() => {
    server.close();
});
