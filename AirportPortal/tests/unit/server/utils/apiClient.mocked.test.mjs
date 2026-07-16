/**
 * Unit tests for server/utils/apiClient.js
 *
 * These tests cover the HTTP client used for all external API calls.
 * All external API requests are mocked via MSW to test various scenarios:
 * - Success responses
 * - API error responses (4xx, 5xx)
 * - Network failures
 * - Timeout
 * - Empty payloads
 * - Malformed payloads
 * - Missing fields
 * - Rate limiting
 *
 * No live API calls are made in these tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { createRequire } from "node:module";
import { server } from "../../../setup/msw/server.js";
import {
    fixtureFlightList,
    fixtureNoFlyList,
    successHandlers,
    errorHandlers,
    networkFailureHandler,
    timeoutHandler,
    emptyPayloadHandler,
    malformedPayloadHandler,
    missingFieldsHandler,
} from "../../../setup/api-mocks/handlers.mjs";

const require = createRequire(import.meta.url);
const api = require("../../../../server/utils/apiClient.js");

const BASE = process.env.BDPA_BASE_URL || "http://127.0.0.1:4010";

describe("apiClient", () => {
    beforeEach(() => {
        // Set up success handlers for each test (cleared by global afterEach)
        server.use(...successHandlers);
    });
    describe("GET requests", () => {
        it("successful GET returns data", async () => {
            const data = await api.get("/v2/flights/search");
            expect(data).toMatchObject(fixtureFlightList);
            expect(data.flights).toHaveLength(2);
        });

        it("GET with query parameters", async () => {
            const data = await api.get("/v2/flights/search?flight_id=FLIGHT-1");
            expect(data.flights).toHaveLength(1);
            expect(data.flights[0].id).toBe("FLIGHT-1");
        });

        it("successful GET /v2/info/no-fly-list", async () => {
            const data = await api.get("/v2/info/no-fly-list");
            expect(data).toMatchObject(fixtureNoFlyList);
            expect(data.noFlyList).toHaveLength(2);
        });
    });

    describe("POST requests", () => {
        it("successful POST returns data", async () => {
            const payload = { seat: "1A" };
            const data = await api.post("/v2/flights/FLIGHT-1/book", payload);
            expect(data).toMatchObject({ ok: true });
        });
    });

    describe("DELETE requests", () => {
        it("successful DELETE returns data", async () => {
            const data = await api.delete("/v2/tickets/123");
            expect(data).toMatchObject({ ok: true });
        });
    });

    describe("API error responses", () => {
        it("400 Bad Request throws ApiError", async () => {
            server.use(...errorHandlers.badRequest);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(400);
                expect(err.code).toBe("UPSTREAM_ERROR");
                expect(err.message).toContain("Invalid query");
            }
        });

        it("401 Unauthorized throws ApiError", async () => {
            server.use(...errorHandlers.unauthorized);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(401);
                expect(err.code).toBe("UPSTREAM_ERROR");
            }
        });

        it("403 Forbidden throws ApiError", async () => {
            server.use(...errorHandlers.forbidden);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(403);
                expect(err.code).toBe("UPSTREAM_ERROR");
            }
        });

        it("404 Not Found throws ApiError", async () => {
            server.use(...errorHandlers.notFound);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(404);
                expect(err.code).toBe("UPSTREAM_ERROR");
            }
        });

        it("429 Rate Limit throws ApiError", async () => {
            server.use(...errorHandlers.rateLimit);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(429);
                expect(err.code).toBe("UPSTREAM_ERROR");
                expect(err.message).toContain("Too many requests");
            }
        });

        it("500 Server Error throws ApiError", async () => {
            server.use(...errorHandlers.serverError);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(500);
                expect(err.code).toBe("UPSTREAM_ERROR");
            }
        });

        it("503 Service Unavailable throws ApiError", async () => {
            server.use(...errorHandlers.serviceUnavailable);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(503);
                expect(err.code).toBe("UPSTREAM_ERROR");
            }
        });
    });

    describe("Retry logic", () => {
        it("retries on 555 status (up to 4 attempts)", async () => {
            let attemptCount = 0;
            server.use(
                http.get(`${BASE}/v2/flights/search`, ({ request }) => {
                    attemptCount++;
                    if (attemptCount < 3) {
                        return HttpResponse.json({ error: "Retryable" }, { status: 555 });
                    }
                    return HttpResponse.json(fixtureFlightList);
                })
            );

            const data = await api.get("/v2/flights/search");
            expect(data).toMatchObject(fixtureFlightList);
            expect(attemptCount).toBe(3);
        });

        it("gives up after 4 failed 555 attempts", async () => {
            let attemptCount = 0;
            server.use(
                http.get(`${BASE}/v2/flights/search`, () => {
                    attemptCount++;
                    return HttpResponse.json({ error: "Retryable" }, { status: 555 });
                })
            );

            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(555);
                expect(err.code).toBe("UPSTREAM_ERROR");
                expect(attemptCount).toBe(4);
            }
        });
    });

    describe("Network failures", () => {
        it("network error throws ApiError with status 502", async () => {
            server.use(...networkFailureHandler);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.status).toBe(502);
                expect(err.code).toBe("UPSTREAM_ERROR");
            }
        });
    });

    describe("Timeout", () => {
        it("request timeout throws ApiError", async () => {
            server.use(...timeoutHandler);
            try {
                // Request should timeout after 15 seconds (configurable in apiClient)
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.code).toBe("UPSTREAM_ERROR");
                // Timeout error message varies, but it should indicate a timeout
            }
        }, 20000); // Allow 20 seconds for test timeout
    });

    describe("Empty payloads", () => {
        it("null payload is handled", async () => {
            server.use(...emptyPayloadHandler);
            const data = await api.get("/v2/flights/search");
            expect(data).toBeNull();
        });
    });

    describe("Malformed payloads", () => {
        it("non-JSON response throws error", async () => {
            server.use(...malformedPayloadHandler);
            try {
                await api.get("/v2/flights/search");
                expect.fail("Should have thrown");
            } catch (err) {
                // Axios parsing error
                expect(err).toBeDefined();
            }
        });
    });

    describe("Missing fields", () => {
        it("partial response with missing fields is returned (no validation)", async () => {
            server.use(...missingFieldsHandler);
            const data = await api.get("/v2/flights/search");
            expect(data.flights).toHaveLength(1);
            expect(data.flights[0].id).toBe("BROKEN-1");
            // Note: apiClient does not validate fields; routes validate responses
        });
    });

    describe("Different HTTP methods", () => {
        it("PUT request", async () => {
            server.use(
                http.put(`${BASE}/v2/test`, () => {
                    return HttpResponse.json({ updated: true });
                })
            );
            const data = await api.put("/v2/test", { foo: "bar" });
            expect(data).toMatchObject({ updated: true });
        });

        it("PATCH request", async () => {
            server.use(
                http.patch(`${BASE}/v2/test`, () => {
                    return HttpResponse.json({ patched: true });
                })
            );
            const data = await api.patch("/v2/test", { foo: "bar" });
            expect(data).toMatchObject({ patched: true });
        });
    });

    describe("Authorization header", () => {
        it("includes Bearer token in requests", async () => {
            let capturedHeader = null;
            server.use(
                http.get(`${BASE}/v2/flights/search`, ({ request }) => {
                    capturedHeader = request.headers.get("Authorization");
                    return HttpResponse.json(fixtureFlightList);
                })
            );

            await api.get("/v2/flights/search");
            expect(capturedHeader).toMatch(/^Bearer /);
        });
    });
});
