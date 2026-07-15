/**
 * Integration tests for routes that use external API calls.
 *
 * These tests verify that routes handle:
 * - Successful API responses
 * - API errors and timeouts
 * - Network failures with fallback behavior
 * - Missing/malformed upstream data
 *
 * All API calls are mocked; no live requests are made.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import request from "supertest";
import { createRequire } from "node:module";
import { server } from "../setup/msw/server.js";
import {
    fixtureFlightList,
    fixtureFlightSingle,
    fixtureNoFlyList,
    successHandlers,
    errorHandlers,
} from "../setup/api-mocks/handlers.mjs";

const require = createRequire(import.meta.url);
const {
    db,
    getApp,
    resetDb,
    createUser,
    createAuthCookie,
} = require("./helpers/routeTestHarness");

const BASE = process.env.BDPA_BASE_URL || "http://127.0.0.1:4010";
const app = getApp();

describe("routes with API integration (mocked)", () => {
    beforeEach(() => {
        // Set up success handlers for each test (cleared by global afterEach)
        server.use(...successHandlers);
    });

    afterEach(() => {
        resetDb();
    });

    describe("GET /api/flights (flights list)", () => {
        it("successful response returns flights from upstream", async () => {
            const res = await request(app).get("/api/flights");
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.items)).toBe(true);
            expect(res.body.total).toBeGreaterThanOrEqual(0);
        });

        it("upstream error falls back to local cache", async () => {
            // Seed local cache
            db.prepare(
                `INSERT INTO flight_cache (flight_id, payload_json)
                 VALUES ('CACHED-1', ?)`
            ).run(
                JSON.stringify({
                    id: "CACHED-1",
                    flight_id: "CACHED-1",
                    flightNumber: "CA100",
                    status: "scheduled",
                })
            );

            // Make upstream fail
            server.use(...errorHandlers.serverError);

            const res = await request(app).get("/api/flights");
            expect(res.status).toBe(200);
            expect(res.body.items).toBeDefined();
        });

        it("filters out past flights", async () => {
            server.use(
                http.get(`${BASE}/v1/flights/search`, () => {
                    return HttpResponse.json({
                        flights: [
                            {
                                id: "PAST-1",
                                flight_id: "PAST-1",
                                type: "departure",
                                flightNumber: "PA100",
                                status: "past",
                                landingAt: "MWK",
                                departFromSender: "2020-01-01T10:00:00Z",
                            },
                            {
                                id: "FUTURE-1",
                                flight_id: "FUTURE-1",
                                type: "departure",
                                flightNumber: "FA100",
                                status: "scheduled",
                                landingAt: "MWK",
                                departFromSender: "2030-01-15T10:00:00Z",
                            },
                        ],
                    });
                })
            );

            const res = await request(app).get("/api/flights");
            expect(res.status).toBe(200);
            // Only future flight should be included
            const ids = res.body.items.map((f) => f.flight_id);
            expect(ids).not.toContain("PAST-1");
            expect(ids).toContain("FUTURE-1");
        });

        it("supports pagination", async () => {
            const res = await request(app)
                .get("/api/flights")
                .query({ page: 1, pageSize: 10 });
            expect(res.status).toBe(200);
            expect(res.body.page).toBe(1);
            expect(res.body.pageSize).toBe(10);
        });
    });

    describe("GET /api/flights/:id (flight detail)", () => {
        it("successful response returns flight", async () => {
            const res = await request(app).get("/api/flights/FLIGHT-1");
            expect(res.status).toBe(200);
            expect(res.body.flight_id).toBe("FLIGHT-1");
        });

        it("returns cached flight without upstream call", async () => {
            // Seed cache
            db.prepare(
                `INSERT INTO flight_cache (flight_id, payload_json)
                 VALUES ('CACHED-FLIGHT', ?)`
            ).run(
                JSON.stringify({
                    id: "CACHED-FLIGHT",
                    flight_id: "CACHED-FLIGHT",
                    flightNumber: "CF100",
                    status: "scheduled",
                })
            );

            // Do NOT mock the upstream endpoint
            const res = await request(app).get("/api/flights/CACHED-FLIGHT");
            expect(res.status).toBe(200);
            expect(res.body.flight_id).toBe("CACHED-FLIGHT");
        });

        it("upstream error without cache returns error status", async () => {
            // When upstream returns error, error is passed through
            server.use(...errorHandlers.serverError);
            const res = await request(app).get("/api/flights/UNKNOWN");
            expect(res.status).toBe(500); // Upstream 500 is passed through
        });
    });

    describe("POST /api/no-fly/check (no-fly check)", () => {
        it("successful response returns blocked status", async () => {
            const res = await request(app)
                .post("/api/no-fly/check")
                .send({
                    first: "Jane",
                    last: "Smith",
                    dob: "1990-03-20",
                    gender: "female",
                });
            expect(res.status).toBe(200);
            expect(res.body.blocked).toBe(true);
            expect(res.body.reason).toBeDefined();
        });

        it("passenger not on list returns blocked=false", async () => {
            const res = await request(app)
                .post("/api/no-fly/check")
                .send({
                    first: "Safe",
                    last: "Passenger",
                    dob: "2000-01-01",
                    gender: "male",
                });
            expect(res.status).toBe(200);
            expect(res.body.blocked).toBe(false);
        });

        it("upstream error returns error status", async () => {
            server.use(...errorHandlers.serverError);
            const res = await request(app)
                .post("/api/no-fly/check")
                .send({
                    first: "Test",
                    last: "User",
                    dob: "1990-01-01",
                    gender: "male",
                });
            expect(res.status).toBe(500); // Upstream 500 is passed through
        });

        it("malformed upstream data handled gracefully", async () => {
            server.use(
                http.get(`${BASE}/v1/info/no-fly-list`, () => {
                    return HttpResponse.json({
                        noFlyList: [
                            {
                                // Missing required name structure
                                id: "BAD-1",
                                birthdate: { year: 1990, month: 1, day: 1 },
                            },
                        ],
                    });
                })
            );

            const res = await request(app)
                .post("/api/no-fly/check")
                .send({
                    first: "Test",
                    last: "User",
                    dob: "1990-01-01",
                    gender: "male",
                });
            expect(res.status).toBe(200);
            // Should not match due to missing name
            expect(res.body.blocked).toBe(false);
        });
    });

    describe("POST /api/bookings (create booking)", () => {
        it("successful booking with no-fly check passes", async () => {
            const user = await createUser({
                first_name: "Booker",
                last_name: "User",
                password: "StrongPassword123",
            });
            const auth = createAuthCookie(user.id);

            // Lock seat first
            await request(app)
                .post("/api/flights/FLIGHT-1/seats/lock")
                .set("Cookie", auth.header)
                .send({ seat: "1A" });

            // Attempt booking
            const res = await request(app)
                .post("/api/bookings")
                .set("Cookie", auth.header)
                .send({
                    flightId: "FLIGHT-1",
                    passenger: {
                        first: "Safe",
                        last: "Passenger",
                        dob: "2000-01-01",
                        gender: "male",
                        email: "safe@test.local",
                        phone: "555-0001",
                    },
                    payment: {
                        cardNumber: "4111111111111111",
                        expMonth: 1,
                        expYear: 2030,
                        cvc: "123",
                        cardholder: "Safe Passenger",
                        billingAddress: "123 A",
                        billingZip: "53202",
                    },
                    seat: "1A",
                    carryOnCount: 1,
                    checkedCount: 0,
                });

            expect(res.status).toBe(201);
            expect(res.body.ticketId).toBeDefined();
            expect(res.body.confirmationCode).toBeDefined();
        });

        it("booking rejected if passenger on no-fly list", async () => {
            const user = await createUser({
                first_name: "Booker",
                last_name: "User",
                password: "StrongPassword123",
            });
            const auth = createAuthCookie(user.id);

            // Lock seat
            await request(app)
                .post("/api/flights/FLIGHT-1/seats/lock")
                .set("Cookie", auth.header)
                .send({ seat: "1A" });

            // Attempt booking with person on no-fly list
            const res = await request(app)
                .post("/api/bookings")
                .set("Cookie", auth.header)
                .send({
                    flightId: "FLIGHT-1",
                    passenger: {
                        first: "John",
                        last: "Doe",
                        dob: "1985-05-15",
                        gender: "male",
                        email: "john@test.local",
                        phone: "555-0001",
                    },
                    payment: {
                        cardNumber: "4111111111111111",
                        expMonth: 1,
                        expYear: 2030,
                        cvc: "123",
                        cardholder: "John Doe",
                        billingAddress: "123 A",
                        billingZip: "53202",
                    },
                    seat: "1A",
                    carryOnCount: 1,
                    checkedCount: 0,
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain("No Fly List");
        });

        it("booking handles upstream no-fly check error gracefully", async () => {
            server.use(
                http.get(`${BASE}/v1/info/no-fly-list`, () => {
                    return HttpResponse.error();
                })
            );

            const user = await createUser({
                first_name: "Booker",
                last_name: "User",
                password: "StrongPassword123",
            });
            const auth = createAuthCookie(user.id);

            // Lock seat
            await request(app)
                .post("/api/flights/FLIGHT-1/seats/lock")
                .set("Cookie", auth.header)
                .send({ seat: "1A" });

            // Attempt booking (should proceed with empty no-fly list as fallback)
            const res = await request(app)
                .post("/api/bookings")
                .set("Cookie", auth.header)
                .send({
                    flightId: "FLIGHT-1",
                    passenger: {
                        first: "Safe",
                        last: "Passenger",
                        dob: "2000-01-01",
                        gender: "male",
                        email: "safe@test.local",
                        phone: "555-0001",
                    },
                    payment: {
                        cardNumber: "4111111111111111",
                        expMonth: 1,
                        expYear: 2030,
                        cvc: "123",
                        cardholder: "Safe Passenger",
                        billingAddress: "123 A",
                        billingZip: "53202",
                    },
                    seat: "1A",
                    carryOnCount: 1,
                    checkedCount: 0,
                });

            // Should succeed because route handles API error gracefully
            expect(res.status).toBe(201);
        });
    });

    describe("API error handling with fallback", () => {
        it("rate limit error (429) falls back to empty cache", async () => {
            // When upstream returns rate limit error, route falls back to cache (which is empty)
            server.use(
                http.get(`${BASE}/v1/flights/search`, () => {
                    return HttpResponse.json(
                        { error: "Too many requests" },
                        { status: 429, headers: { "Retry-After": "60" } }
                    );
                })
            );
            const res = await request(app).get("/api/flights");
            expect(res.status).toBe(200); // Graceful fallback to empty cache
            expect(res.body.items).toEqual([]);
            expect(res.body.total).toBe(0);
        });
    });

    describe("Empty and malformed responses", () => {
        it("empty flights array handled", async () => {
            server.use(
                http.get(`${BASE}/v1/flights/search`, () => {
                    return HttpResponse.json({ flights: [] });
                })
            );

            const res = await request(app).get("/api/flights");
            expect(res.status).toBe(200);
            expect(res.body.items).toEqual([]);
        });

        it("null flights response handled", async () => {
            server.use(
                http.get(`${BASE}/v1/flights/search`, () => {
                    return HttpResponse.json(null);
                })
            );

            const res = await request(app).get("/api/flights");
            expect(res.status).toBe(200);
            // Routes handle null/undefined gracefully
        });
    });
});
