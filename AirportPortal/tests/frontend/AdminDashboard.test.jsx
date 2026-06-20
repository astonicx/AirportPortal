import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import React from "react";
import { renderWithProviders } from "../helpers/frontend/renderWithProviders";
import { frontendServer, errorHandlers } from "../setup/msw/frontend-server";

// Mock admin customer list component
function AdminCustomers() {
    const [customers, setCustomers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        fetch("/api/admin/customers")
            .then(async (r) => {
                const d = await r.json();
                if (!r.ok) throw new Error(d?.error || "Request failed");
                return d;
            })
            .then(d => setCustomers(d.items || []))
            .catch(e => setError(e))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <p className="text-destructive">{error.message}</p>;
    if (loading) return <p>Loading customers…</p>;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Customers</h2>
            {customers.length === 0 ? (
                <p className="text-muted-foreground">No customers.</p>
            ) : (
                <ul className="divide-y rounded border">
                    {customers.map(c => (
                        <li key={c.id} className="flex justify-between p-3">
                            <span>{c.first_name} {c.last_name}</span>
                            <span className="text-sm text-muted-foreground">{c.email}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Mock admin tickets component
function AdminTickets() {
    const [tickets, setTickets] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        fetch("/api/admin/tickets")
            .then(async (r) => {
                const d = await r.json();
                if (!r.ok) throw new Error(d?.error || "Request failed");
                return d;
            })
            .then(d => setTickets(d.items || []))
            .catch(e => setError(e))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <p className="text-destructive">{error.message}</p>;
    if (loading) return <p>Loading tickets…</p>;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tickets</h2>
            {tickets.length === 0 ? (
                <p className="text-muted-foreground">No tickets.</p>
            ) : (
                <table className="w-full text-sm">
                    <tbody>
                        {tickets.map(t => (
                            <tr key={t.id} className="border-t">
                                <td className="px-3 py-2">{t.confirmation_code}</td>
                                <td className="px-3 py-2">{t.status}</td>
                                <td className="px-3 py-2">Seat {t.seat}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

describe("Admin Dashboard", () => {
    describe("Customers Management", () => {
        it("displays customers list", async () => {
            renderWithProviders(<AdminCustomers />);

            await waitFor(() => {
                expect(screen.getByText("Customers")).toBeInTheDocument();
                expect(screen.getByText("Test User")).toBeInTheDocument();
            });
        });

        it("displays customer email", async () => {
            renderWithProviders(<AdminCustomers />);

            await waitFor(() => {
                expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
            });
        });

        it("shows empty state when no customers", async () => {
            frontendServer.use(
                http.get("*/api/admin/customers", () => {
                    return HttpResponse.json({
                        items: [],
                        total: 0,
                    });
                })
            );

            renderWithProviders(<AdminCustomers />);

            await waitFor(() => {
                expect(screen.getByText(/no customers/i)).toBeInTheDocument();
            });
        });

        it("handles error fetching customers", async () => {
            frontendServer.use(
                http.get("*/api/admin/customers", () => {
                    return HttpResponse.json(
                        { error: "Forbidden" },
                        { status: 403 }
                    );
                })
            );

            renderWithProviders(<AdminCustomers />);

            await waitFor(() => {
                expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
            });
        });
    });

    describe("Tickets Management", () => {
        it("displays tickets list", async () => {
            renderWithProviders(<AdminTickets />);

            await waitFor(() => {
                expect(screen.getByText("Tickets")).toBeInTheDocument();
                expect(screen.getByText(/ABC123/)).toBeInTheDocument();
            });
        });

        it("displays ticket status", async () => {
            renderWithProviders(<AdminTickets />);

            await waitFor(() => {
                expect(screen.getByText(/active/i)).toBeInTheDocument();
            });
        });

        it("displays seat information", async () => {
            renderWithProviders(<AdminTickets />);

            await waitFor(() => {
                expect(screen.getByText(/seat 12a/i)).toBeInTheDocument();
            });
        });

        it("shows empty state when no tickets", async () => {
            frontendServer.use(
                http.get("*/api/admin/tickets", () => {
                    return HttpResponse.json({
                        items: [],
                        total: 0,
                    });
                })
            );

            renderWithProviders(<AdminTickets />);

            await waitFor(() => {
                expect(screen.getByText(/no tickets/i)).toBeInTheDocument();
            });
        });

        it("displays multiple tickets", async () => {
            frontendServer.use(
                http.get("*/api/admin/tickets", () => {
                    return HttpResponse.json({
                        items: [
                            {
                                id: 1,
                                confirmation_code: "ABC123",
                                status: "active",
                                seat: "12A",
                            },
                            {
                                id: 2,
                                confirmation_code: "DEF456",
                                status: "completed",
                                seat: "14C",
                            },
                        ],
                        total: 2,
                    });
                })
            );

            renderWithProviders(<AdminTickets />);

            await waitFor(() => {
                expect(screen.getByText(/ABC123/)).toBeInTheDocument();
                expect(screen.getByText(/DEF456/)).toBeInTheDocument();
            });
        });
    });

    describe("Loading States", () => {
        it("shows loading message initially", () => {
            renderWithProviders(<AdminCustomers />);
            expect(screen.getByText(/loading customers/i)).toBeInTheDocument();
        });

        it("hides loading after data loads", async () => {
            renderWithProviders(<AdminCustomers />);

            await waitFor(() => {
                expect(screen.queryByText(/loading customers/i)).not.toBeInTheDocument();
            });
        });
    });

    describe("Error States", () => {
        it("displays error message on fetch failure", async () => {
            frontendServer.use(
                http.get("*/api/admin/customers", () => {
                    return HttpResponse.json(
                        { error: "Internal server error" },
                        { status: 500 }
                    );
                })
            );

            renderWithProviders(<AdminCustomers />);

            await waitFor(() => {
                expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
            });
        });
    });
});
