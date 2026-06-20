import { beforeAll, afterEach, afterAll } from 'vitest';
import { mswServer } from './mocks/server.mjs';

// Start MSW server before all tests
beforeAll(() => {
    // Only handle unmatched external BDPA API requests
    mswServer.listen({
        onUnhandledRequest(request) {
            // Allow localhost/127.0.0.1 requests (our Express app)
            if (request.url.includes('localhost') || request.url.includes('127.0.0.1')) {
                return;
            }
            // Handle external requests
            console.warn(`[MSW] Unhandled ${request.method} ${request.url}`);
        }
    });
});

// Reset handlers after each test
afterEach(() => {
    mswServer.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
    mswServer.close();
});
