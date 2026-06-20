/**
 * Live API smoke tests.
 *
 * These tests make real HTTP calls to external APIs and should ONLY run in
 * development/staging environments, never in CI.
 *
 * To skip in CI: These tests are marked with .skip by default and should only
 * be run explicitly when testing against a real API environment.
 *
 * To run manually:
 *   BDPA_BASE_URL=https://api.example.com BEARER_TOKEN=xxx npm run test:backend:live
 *
 * These tests do NOT modify the test database and do NOT use mocks.
 */

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const api = require("../../server/utils/apiClient");

const SKIP_LIVE = process.env.SKIP_LIVE !== "0" || process.env.CI === "true";

describe.skipIf(SKIP_LIVE)("live API smoke tests", () => {
    it("can GET /v1/flights/search with type=departure", async () => {
        const response = await api.get("/v1/flights/search?type=departure");
        expect(response).toBeDefined();
        expect(response.flights || response).toBeDefined();
    });

    it("can GET /v1/flights/search with type=arrival", async () => {
        const response = await api.get("/v1/flights/search?type=arrival");
        expect(response).toBeDefined();
        expect(response.flights || response).toBeDefined();
    });

    it("can GET /v1/info/no-fly-list", async () => {
        const response = await api.get("/v1/info/no-fly-list");
        expect(response).toBeDefined();
        expect(response.noFlyList).toBeDefined();
        expect(Array.isArray(response.noFlyList)).toBe(true);
    });

    it("handles rate limiting gracefully", async () => {
        // Make multiple rapid requests to test rate limit handling
        const requests = [];
        for (let i = 0; i < 5; i++) {
            requests.push(api.get("/v1/flights/search"));
        }

        try {
            const results = await Promise.allSettled(requests);
            // At least some should succeed, some may fail with rate limit
            const succeeded = results.filter((r) => r.status === "fulfilled");
            expect(succeeded.length).toBeGreaterThan(0);
        } catch (err) {
            // Rate limit or other error is acceptable in this context
            expect(err).toBeDefined();
        }
    });

    it("API responds within timeout", async () => {
        const startTime = Date.now();
        const response = await api.get("/v1/flights/search");
        const elapsed = Date.now() - startTime;
        expect(response).toBeDefined();
        // Should complete well within 15 second timeout
        expect(elapsed).toBeLessThan(15000);
    });
});

// Example of how to run live tests:
// SKIP_LIVE=1 BDPA_BASE_URL=https://actual-api.example.com BEARER_TOKEN=your-token npm run test:backend
