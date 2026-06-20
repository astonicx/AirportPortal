import { http, HttpResponse } from 'msw';

export const handlers = [
    // Mock BDPA API - Flights endpoint
    http.get('https://bdpa-simulator.airport.local/v1/flights', ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get('type'); // 'arrival' or 'departure'
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

        const mockFlights = [
            {
                id: 'FL001',
                flightNumber: 'UA123',
                airline: 'United Airlines',
                origin: 'ORD',
                destination: 'LAX',
                departureTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                arrivalTime: new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'scheduled',
                bookable: true,
                gate: 'B12',
                capacity: 180,
                available: 45,
            },
            {
                id: 'FL002',
                flightNumber: 'AA456',
                airline: 'American Airlines',
                origin: 'LAX',
                destination: 'JFK',
                departureTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                arrivalTime: new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'scheduled',
                bookable: true,
                gate: 'A5',
                capacity: 200,
                available: 60,
            },
        ];

        return HttpResponse.json({
            data: mockFlights,
            page,
            pageSize,
            total: mockFlights.length,
        });
    }),

    // Mock BDPA API - Flight detail
    http.get('https://bdpa-simulator.airport.local/v1/flights/:id', ({ params }) => {
        const { id } = params;

        return HttpResponse.json({
            id,
            flightNumber: 'UA123',
            airline: 'United Airlines',
            origin: 'ORD',
            destination: 'LAX',
            departureTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            arrivalTime: new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'scheduled',
            bookable: true,
            gate: 'B12',
            capacity: 180,
            available: 45,
        });
    }),

    // Mock BDPA API - Booking endpoint
    http.post('https://bdpa-simulator.airport.local/v1/flights/:id/book', async ({ params, request }) => {
        const body = await request.json();

        // Simulate occasional failures (HTTP 555) for retry testing
        if (body.simulateRetry === true) {
            return HttpResponse.json({ error: 'Server error' }, { status: 555 });
        }

        return HttpResponse.json({
            success: true,
            bookingId: 'BK' + Date.now(),
            confirmationCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
            pnr: 'PNR123456',
        });
    }),

    // Mock BDPA API - Seat release
    http.post('https://bdpa-simulator.airport.local/v1/flights/:id/seats/:seatId/release', () => {
        return HttpResponse.json({ success: true });
    }),
];
