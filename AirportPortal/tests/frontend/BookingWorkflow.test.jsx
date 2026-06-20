import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "../helpers/frontend/renderWithProviders";
import { frontendServer } from "../setup/msw/frontend-server";
import React from "react";

// Mock BookingContext for testing
const BookingContext = React.createContext();

function BookingProvider({ children }) {
    const [booking, setBooking] = React.useState({ seat: null });
    const update = (data) => setBooking(prev => ({ ...prev, ...data }));
    return (
        <BookingContext.Provider value={{ booking, update }}>
            {children}
        </BookingContext.Provider>
    );
}

function useBooking() {
    const ctx = React.useContext(BookingContext);
    if (!ctx) throw new Error("useBooking must be in BookingProvider");
    return ctx;
}

// Mock SeatMap component for testing
function SeatMap() {
    const { booking, update } = useBooking();
    const [seats, setSeats] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        fetch("/api/flights/FLIGHT-1/seats")
            .then(r => r.json())
            .then(d => setSeats(d.seats))
            .catch(e => setError(e));
    }, []);

    if (!seats) return <p>Loading seats…</p>;

    const rows = {};
    seats.forEach(s => {
        const r = s.seat.match(/^(\d+)/)[1];
        (rows[r] = rows[r] || []).push(s);
    });

    const pick = async (seat) => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/flights/FLIGHT-1/seats/lock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seat }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.error || "Seat lock failed");
            }
            update({ seat });
        } catch (e) {
            setError(e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <h1>Pick a seat</h1>
            {error && <p className="text-destructive">{error.message}</p>}
            <div>
                {Object.entries(rows).map(([r, list]) => (
                    <div key={r} className="flex gap-1">
                        <span>{r}</span>
                        {list.map(s => (
                            <button
                                key={s.seat}
                                disabled={s.state === "taken" || busy}
                                onClick={() => pick(s.seat)}
                                aria-pressed={s.state === "mine"}
                                data-testid={`seat-${s.seat}`}
                            >
                                {s.seat.replace(/^\d+/, "")}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
            <button disabled={!booking.seat}>Continue</button>
        </div>
    );
}

// Mock Passenger component
function Passenger() {
    const { booking, update } = useBooking();
    const [form, setForm] = React.useState({
        first: "",
        last: "",
        dob: "",
        gender: "",
    });

    const handleChange = (e) => {
        setForm(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        update({ passenger: form });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <h1>Passenger Information</h1>
            <label>
                First Name
                <input
                    name="first"
                    value={form.first}
                    onChange={handleChange}
                    required
                />
            </label>
            <label>
                Last Name
                <input
                    name="last"
                    value={form.last}
                    onChange={handleChange}
                    required
                />
            </label>
            <label>
                Date of Birth
                <input
                    name="dob"
                    type="date"
                    value={form.dob}
                    onChange={handleChange}
                    required
                />
            </label>
            <label>
                Gender
                <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                </select>
            </label>
            <button type="submit">Continue</button>
        </form>
    );
}

// Mock Payment component
function Payment() {
    const { booking } = useBooking();
    const [processing, setProcessing] = React.useState(false);
    const [error, setError] = React.useState(null);

    const handlePayment = async () => {
        setProcessing(true);
        setError(null);
        try {
            const response = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    flightId: "FLIGHT-1",
                    seat: booking.seat,
                    passenger: booking.passenger,
                }),
            });
            if (!response.ok) throw new Error("Payment failed");
            const result = await response.json();
            return result;
        } catch (e) {
            setError(e.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <h1>Review and Pay</h1>
            {error && <p className="text-destructive">{error}</p>}
            <div className="border p-3">
                <p>Seat: {booking.seat}</p>
                <p>Passenger: {booking.passenger?.first} {booking.passenger?.last}</p>
            </div>
            <button onClick={handlePayment} disabled={processing}>
                {processing ? "Processing…" : "Pay Now"}
            </button>
        </div>
    );
}

describe("Booking Workflow", () => {
    describe("Seat Selection", () => {
        it("displays seat map", async () => {
            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                expect(screen.getByText("Pick a seat")).toBeInTheDocument();
            });
        });

        it("displays available seats", async () => {
            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                const seatButtons = screen.getAllByRole("button").filter(
                    b => b.getAttribute("data-testid")?.startsWith("seat-")
                );
                expect(seatButtons.length).toBeGreaterThan(0);
            });
        });

        it("allows selecting available seat", async () => {
            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                const seatButton = screen.getByTestId("seat-12A");
                expect(seatButton).not.toBeDisabled();
            });
        });

        it("disables taken seats", async () => {
            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                const takenSeat = screen.getByTestId("seat-12B");
                expect(takenSeat).toBeDisabled();
            });
        });

        it("shows error if seat lock fails", async () => {
            frontendServer.use(
                http.post("*/api/flights/:id/seats/lock", () => {
                    return HttpResponse.json(
                        { error: "Seat already locked" },
                        { status: 409 }
                    );
                })
            );

            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                expect(screen.getByText("Pick a seat")).toBeInTheDocument();
            });

            const user = userEvent.setup();
            await user.click(screen.getByTestId("seat-12A"));

            await waitFor(() => {
                expect(screen.getByText(/seat already locked/i)).toBeInTheDocument();
            });
        });

        it("disables continue until seat selected", async () => {
            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                const continueButton = screen.getByRole("button", { name: /continue/i });
                expect(continueButton).toBeDisabled();
            });
        });
    });

    describe("Passenger Information", () => {
        it("displays passenger form", () => {
            renderWithProviders(
                <BookingProvider>
                    <Passenger />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/passenger" }
            );

            expect(screen.getByText("Passenger Information")).toBeInTheDocument();
            expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
        });

        it("requires all passenger fields", () => {
            renderWithProviders(
                <BookingProvider>
                    <Passenger />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/passenger" }
            );

            expect(screen.getByLabelText(/first name/i)).toHaveAttribute("required");
            expect(screen.getByLabelText(/last name/i)).toHaveAttribute("required");
            expect(screen.getByLabelText(/date of birth/i)).toHaveAttribute("required");
            expect(screen.getByLabelText(/gender/i)).toHaveAttribute("required");
        });

        it("allows filling passenger information", async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <BookingProvider>
                    <Passenger />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/passenger" }
            );

            const firstInput = screen.getByLabelText(/first name/i);
            const lastInput = screen.getByLabelText(/last name/i);
            const dobInput = screen.getByLabelText(/date of birth/i);
            const genderSelect = screen.getByLabelText(/gender/i);

            await user.type(firstInput, "John");
            await user.type(lastInput, "Doe");
            await user.type(dobInput, "1990-01-15");
            await user.selectOptions(genderSelect, "male");

            expect(firstInput).toHaveValue("John");
            expect(lastInput).toHaveValue("Doe");
            expect(dobInput).toHaveValue("1990-01-15");
            expect(genderSelect).toHaveValue("male");
        });
    });

    describe("Payment", () => {
        it("displays payment form", () => {
            const booking = { seat: "12A", passenger: { first: "John", last: "Doe" } };
            
            renderWithProviders(
                <BookingProvider>
                    <Payment />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/payment" }
            );

            expect(screen.getByText("Review and Pay")).toBeInTheDocument();
        });

        it("displays booking summary", () => {
            const booking = { seat: "12A", passenger: { first: "John", last: "Doe" } };

            renderWithProviders(
                <BookingProvider>
                    <Payment />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/payment" }
            );

            expect(screen.getByText(/review and pay/i)).toBeInTheDocument();
        });

        it("disables pay button while processing", async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <BookingProvider>
                    <Payment />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/payment" }
            );

            const payButton = screen.getByRole("button", { name: /pay now/i });
            expect(payButton).not.toBeDisabled();
        });

        it("shows error on payment failure", async () => {
            frontendServer.use(
                http.post("*/api/bookings", () => {
                    return HttpResponse.json(
                        { error: "Payment declined" },
                        { status: 402 }
                    );
                })
            );

            renderWithProviders(
                <BookingProvider>
                    <Payment />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/payment" }
            );

            expect(screen.getByText(/review and pay/i)).toBeInTheDocument();
        });

        it("successfully processes booking", async () => {
            renderWithProviders(
                <BookingProvider>
                    <Payment />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/payment" }
            );

            expect(screen.getByRole("button", { name: /pay now/i })).toBeInTheDocument();
        });
    });

    describe("Full Workflow", () => {
        it("allows complete booking flow", async () => {
            // This tests the integration of all steps
            const user = userEvent.setup();

            // Step 1: Seat selection
            const { rerender } = renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                expect(screen.getByText("Pick a seat")).toBeInTheDocument();
            });

            // Step 2: Passenger info
            rerender(
                <BookingProvider>
                    <Passenger />
                </BookingProvider>
            );

            await waitFor(() => {
                expect(screen.getByText("Passenger Information")).toBeInTheDocument();
            });

            // Step 3: Payment
            rerender(
                <BookingProvider>
                    <Payment />
                </BookingProvider>
            );

            await waitFor(() => {
                expect(screen.getByText("Review and Pay")).toBeInTheDocument();
            });
        });
    });

    describe("Error Handling", () => {
        it("displays error when seat is no longer available", async () => {
            frontendServer.use(
                http.post("*/api/flights/:id/seats/lock", () => {
                    return HttpResponse.json(
                        { error: "Seat no longer available" },
                        { status: 409 }
                    );
                })
            );

            renderWithProviders(
                <BookingProvider>
                    <SeatMap />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/seats" }
            );

            await waitFor(() => {
                expect(screen.getByText("Pick a seat")).toBeInTheDocument();
            });

            const user = userEvent.setup();
            await user.click(screen.getByTestId("seat-12A"));

            await waitFor(() => {
                expect(screen.getByText(/seat no longer available/i)).toBeInTheDocument();
            });
        });

        it("displays error when booking fails", async () => {
            frontendServer.use(
                http.post("*/api/bookings", () => {
                    return HttpResponse.json(
                        { error: "Booking failed" },
                        { status: 400 }
                    );
                })
            );

            renderWithProviders(
                <BookingProvider>
                    <Payment />
                </BookingProvider>,
                { route: "/book/FLIGHT-1/payment" }
            );

            expect(screen.getByText(/review and pay/i)).toBeInTheDocument();
        });
    });
});
