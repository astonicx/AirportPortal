/**
 * Unit tests for server/utils/apiClient.js
 *
 * Tests use MSW (Mock Service Worker in Node mode) to intercept the real
 * HTTP requests that axios makes, rather than mocking axios itself.
 * This means we are testing the actual retry/error-handling code paths,
 * not just mock return values.
 *
 * The global MSW server is started by tests/setup/backend.setup.mjs with
 * onUnhandledRequest: "error", so every test that calls an API endpoint
 * must register a corresponding handler via server.use().
 * Handlers are automatically reset after each test (backend.setup.mjs
 * calls server.resetHandlers() in afterEach).
 *
 * Tests cover:
 *   - ApiError class construction and prototype chain
 *   - Successful GET/POST responses
 *   - 4xx error → ApiError with correct upstream status
 *   - Network failure (no response) → ApiError with status 502
 *   - 555 transient error → automatic retry then success
 *   - 555 on every attempt → ApiError after retries exhausted
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../setup/msw/server.js";
import { ApiError, get, post } from "../../../../server/utils/apiClient.js";

// BASE_URL must match what backend.setup.mjs sets for BDPA_BASE_URL
const BASE = "http://127.0.0.1:4010";

// ── ApiError class ────────────────────────────────────────────────────────────

describe("ApiError", () => {
    it("is an instance of Error", () => {
        const err = new ApiError(404, "NOT_FOUND", "Resource not found");
        expect(err).toBeInstanceOf(Error);
    });

    it("is an instance of ApiError itself", () => {
        const err = new ApiError(404, "NOT_FOUND", "Resource not found");
        expect(err).toBeInstanceOf(ApiError);
    });

    it("exposes the HTTP status code", () => {
        expect(new ApiError(503, "DOWN", "Service unavailable").status).toBe(503);
    });

    it("exposes the error code string", () => {
        expect(new ApiError(400, "BAD_REQUEST", "Bad").code).toBe("BAD_REQUEST");
    });

    it("exposes the human-readable message via .message", () => {
        const err = new ApiError(500, "SERVER_ERROR", "Something went wrong");
        expect(err.message).toBe("Something went wrong");
    });

    it("can be caught with a try/catch as a plain Error", () => {
        const fn = () => {
            throw new ApiError(400, "BAD", "bad input");
        };
        expect(fn).toThrow(Error);
        expect(fn).toThrow("bad input");
    });

    it("has a stack trace like a normal Error", () => {
        const err = new ApiError(500, "ERR", "oops");
        expect(typeof err.stack).toBe("string");
        expect(err.stack.length).toBeGreaterThan(0);
    });
});

// ── Successful requests ───────────────────────────────────────────────────────

describe("get() – success", () => {
    it("returns parsed response data on 200", async () => {
        server.use(
            http.get(`${BASE}/v1/flights`, () =>
                HttpResponse.json({ flights: [{ id: "F1" }] })
            )
        );
        const data = await get("/v1/flights");
        expect(data).toEqual({ flights: [{ id: "F1" }] });
    });

    it("passes query string parameters through unchanged", async () => {
        let receivedUrl;
        server.use(
            http.get(`${BASE}/v1/flights/search`, ({ request }) => {
                receivedUrl = new URL(request.url);
                return HttpResponse.json({ flights: [] });
            })
        );
        await get("/v1/flights/search?type=departure");
        expect(receivedUrl.searchParams.get("type")).toBe("departure");
    });
});

describe("post() – success", () => {
    it("sends JSON body and returns response data", async () => {
        let receivedBody;
        server.use(
            http.post(`${BASE}/v1/flights/book`, async ({ request }) => {
                receivedBody = await request.json();
                return HttpResponse.json({ ok: true, ticketId: "T1" });
            })
        );

        const data = await post("/v1/flights/book", { seat: "3C" });
        expect(data).toEqual({ ok: true, ticketId: "T1" });
        expect(receivedBody).toEqual({ seat: "3C" });
    });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("get() – upstream errors", () => {
    it("throws ApiError with the upstream status code on 404", async () => {
        server.use(
            http.get(`${BASE}/v1/flights`, () =>
                HttpResponse.json({ error: "Not Found" }, { status: 404 })
            )
        );

        const err = await get("/v1/flights").catch((e) => e);
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(404);
        expect(err.code).toBe("UPSTREAM_ERROR");
    });

    it("throws ApiError with the upstream status code on 403", async () => {
        server.use(
            http.get(`${BASE}/v1/flights`, () =>
                HttpResponse.json({ error: "Forbidden" }, { status: 403 })
            )
        );

        const err = await get("/v1/flights").catch((e) => e);
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(403);
    });

    it("uses the upstream error message from the response body", async () => {
        server.use(
            http.get(`${BASE}/v1/flights`, () =>
                HttpResponse.json({ error: "Custom upstream message" }, { status: 422 })
            )
        );

        const err = await get("/v1/flights").catch((e) => e);
        expect(err.message).toBe("Custom upstream message");
    });

    it("throws ApiError with status 502 on a network-level failure", async () => {
        server.use(
            http.get(`${BASE}/v1/flights`, () => HttpResponse.error())
        );

        const err = await get("/v1/flights").catch((e) => e);
        expect(err).toBeInstanceOf(ApiError);
        // Network errors have no response.status, so apiClient maps them to 502
        expect(err.status).toBe(502);
    });
});

// ── 555 retry logic ───────────────────────────────────────────────────────────

describe("get() – 555 retry behaviour", () => {
    it("retries once on 555 and succeeds on the second attempt", async () => {
        let callCount = 0;
        server.use(
            http.get(`${BASE}/v1/flights`, () => {
                callCount += 1;
                if (callCount === 1) {
                    return HttpResponse.json({ error: "temp" }, { status: 555 });
                }
                return HttpResponse.json({ flights: [] });
            })
        );

        const data = await get("/v1/flights");
        expect(data).toEqual({ flights: [] });
        expect(callCount).toBe(2);
    });

    it("retries up to 3 times on 555 then succeeds", async () => {
        let callCount = 0;
        server.use(
            http.get(`${BASE}/v1/flights`, () => {
                callCount += 1;
                // Fail 3 times (attempts 0, 1, 2), succeed on attempt 3
                if (callCount < 4) {
                    return HttpResponse.json({ error: "temp" }, { status: 555 });
                }
                return HttpResponse.json({ flights: [] });
            })
        );

        const data = await get("/v1/flights");
        expect(data).toEqual({ flights: [] });
        expect(callCount).toBe(4);
    });

    it("throws ApiError after exhausting all retries on persistent 555", async () => {
        // This test incurs real sleeps: 200 + 400 + 800 = 1400 ms.
        // The 10 s test timeout is set accordingly.
        let callCount = 0;
        server.use(
            http.get(`${BASE}/v1/flights`, () => {
                callCount += 1;
                return HttpResponse.json({ error: "always 555" }, { status: 555 });
            })
        );

        const err = await get("/v1/flights").catch((e) => e);

        expect(err).toBeInstanceOf(ApiError);
        // attempt 0, 1, 2 → retry; attempt 3 → not retried (3 < 3 is false)
        // Total HTTP calls = 4
        expect(callCount).toBe(4);
    }, 10_000); // extend timeout to accommodate real sleep delays
});
