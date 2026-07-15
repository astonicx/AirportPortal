import { http, HttpResponse } from "msw";

// Base URL for all API endpoints
const BASE = process.env.BDPA_BASE_URL || "http://127.0.0.1:4010";

// ─── Fixture: Flights Response ────────────────────────────────────────────────

export const fixtureFlightList = {
    flights: [
        {
            id: "FLIGHT-1",
            flight_id: "FLIGHT-1",
            type: "departure",
            flightNumber: "UA100",
            airline: "United",
            status: "scheduled",
            bookable: true,
            landingAt: "MWK",
            departingTo: "ORD",
            seat_price: 250,
            departFromSender: "2030-01-15T10:00:00.000Z",
            arriveAtReceiver: "2030-01-15T14:00:00.000Z",
        },
        {
            id: "FLIGHT-2",
            flight_id: "FLIGHT-2",
            type: "departure",
            flightNumber: "AA200",
            airline: "American",
            status: "scheduled",
            bookable: true,
            landingAt: "MWK",
            departingTo: "DFW",
            seat_price: 200,
            departFromSender: "2030-01-15T11:00:00.000Z",
            arriveAtReceiver: "2030-01-15T15:00:00.000Z",
        },
    ],
};

export const fixtureFlightSingle = {
    flights: [
        {
            id: "FLIGHT-1",
            flight_id: "FLIGHT-1",
            type: "departure",
            flightNumber: "UA100",
            airline: "United",
            status: "scheduled",
            bookable: true,
            landingAt: "MWK",
            departingTo: "ORD",
            seat_price: 250,
            departFromSender: "2030-01-15T10:00:00.000Z",
            arriveAtReceiver: "2030-01-15T14:00:00.000Z",
        },
    ],
};

export const fixtureNoFlyList = {
    noFlyList: [
        {
            id: "NFE-1",
            name: { first: "John", last: "Doe" },
            birthdate: { year: 1985, month: 5, day: 15 },
            sex: "male",
            reason: "Security concern",
        },
        {
            id: "NFE-2",
            name: { first: "Jane", last: "Smith" },
            birthdate: { year: 1990, month: 3, day: 20 },
            sex: "female",
            reason: "Travel ban",
        },
    ],
};

// ─── Handlers: Success Cases ────────────────────────────────────────────────

export const successHandlers = [
    http.get(`${BASE}/v1/flights/search`, ({ request }) => {
        const url = new URL(request.url);
        const flightId = url.searchParams.get("flight_id");
        if (flightId) {
            return HttpResponse.json(fixtureFlightSingle);
        }
        return HttpResponse.json(fixtureFlightList);
    }),

    http.get(`${BASE}/v1/info/no-fly-list`, () => {
        return HttpResponse.json(fixtureNoFlyList);
    }),

    http.post(`${BASE}/v1/flights/:id/book`, () => {
        return HttpResponse.json({ ok: true, booked: true });
    }),

    http.delete(`${BASE}/v1/tickets/:id`, () => {
        return HttpResponse.json({ ok: true });
    }),
];

// ─── Handlers: API Error Responses ──────────────────────────────────────────

export const errorHandlers = {
    badRequest: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Invalid query parameters" }, { status: 400 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Invalid query parameters" }, { status: 400 });
        }),
    ],
    unauthorized: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }),
    ],
    forbidden: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
        }),
    ],
    notFound: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Not found" }, { status: 404 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Not found" }, { status: 404 });
        }),
    ],
    rateLimit: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json(
                { error: "Too many requests" },
                { status: 429, headers: { "Retry-After": "60" } }
            );
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json(
                { error: "Too many requests" },
                { status: 429, headers: { "Retry-After": "60" } }
            );
        }),
    ],
    serverError: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
        }),
    ],
    serviceUnavailable: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Service unavailable" }, { status: 503 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Service unavailable" }, { status: 503 });
        }),
    ],
    retryableError: [
        http.get(`${BASE}/v1/flights/search`, () => {
            return HttpResponse.json({ error: "Upstream temporarily unavailable" }, { status: 555 });
        }),
        http.get(`${BASE}/v1/info/no-fly-list`, () => {
            return HttpResponse.json({ error: "Upstream temporarily unavailable" }, { status: 555 });
        }),
    ],
};

// ─── Handlers: Network Failures ────────────────────────────────────────────

export const networkFailureHandler = [
    http.get(`${BASE}/v1/flights/search`, () => {
        return HttpResponse.error();
    }),
];

// ─── Handlers: Timeout (slow response) ─────────────────────────────────────

export const timeoutHandler = [
    http.get(`${BASE}/v1/flights/search`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20000)); // 20 seconds
        return HttpResponse.json(fixtureFlightList);
    }),
];

// ─── Handlers: Empty/Malformed Payloads ─────────────────────────────────────

export const emptyPayloadHandler = [
    http.get(`${BASE}/v1/flights/search`, () => {
        return HttpResponse.json(null);
    }),
];

export const malformedPayloadHandler = [
    http.get(`${BASE}/v1/flights/search`, () => {
        return HttpResponse.text("Not JSON {{{", { status: 200 });
    }),
];

export const missingFieldsHandler = [
    http.get(`${BASE}/v1/flights/search`, () => {
        return HttpResponse.json({
            flights: [
                {
                    // Missing required fields like flightNumber, airline, etc.
                    id: "BROKEN-1",
                    flight_id: "BROKEN-1",
                },
            ],
        });
    }),
];

// ─── Handler Factory: Create handler for specific endpoint/scenario ──────────

export function createHandler(endpoint, responseData, statusCode = 200, statusText = "OK") {
    const baseUrl = new URL(endpoint, BASE).toString();
    return http.get(baseUrl, () => {
        if (typeof responseData === "function") {
            return responseData();
        }
        if (statusCode >= 400) {
            return HttpResponse.json(responseData, { status: statusCode, statusText });
        }
        return HttpResponse.json(responseData, { status: statusCode });
    });
}

// ─── Handler Factory: Create error handler ─────────────────────────────────

export function createErrorHandler(endpoint, statusCode, errorMessage) {
    return createHandler(
        endpoint,
        { error: errorMessage },
        statusCode,
        `Error ${statusCode}`
    );
}
