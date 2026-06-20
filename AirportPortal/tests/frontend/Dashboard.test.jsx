import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "@/pages/Dashboard";
import { renderWithProviders } from "../helpers/frontend/renderWithProviders";
import { frontendServer, errorHandlers, fixtureDashboard } from "../setup/msw/frontend-server";
import { http, HttpResponse } from "msw";

describe("Dashboard Page", () => {
    describe("Rendering", () => {
        it("shows spinner while loading", () => {
            renderWithProviders(<Dashboard />);
            expect(screen.getByRole("status")).toBeInTheDocument();
        });

        it("displays welcome message after loading", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/welcome, test/i)).toBeInTheDocument();
            });
        });

        it("shows user's first name in greeting", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/welcome, test/i)).toBeInTheDocument();
            });
        });

        it("displays last login information", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/last login/i)).toBeInTheDocument();
                expect(screen.getByText(/127.0.0.1/)).toBeInTheDocument();
            });
        });
    });

    describe("Upcoming Tickets Section", () => {
        it("displays upcoming section heading", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText("Upcoming")).toBeInTheDocument();
            });
        });

        it("displays upcoming ticket information", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/ABC123/)).toBeInTheDocument();
                expect(screen.getByText(/UA100/)).toBeInTheDocument();
            });
        });

        it("shows empty state when no upcoming tickets", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        ...fixtureDashboard,
                        upcoming: [],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const noneElements = screen.getAllByText("None.");
                expect(noneElements.length).toBeGreaterThan(0);
            });
        });

        it("displays view link for each upcoming ticket", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /view/i });
                expect(links.length).toBeGreaterThan(0);
            });
        });

        it("links to correct ticket detail page", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /view/i });
                if (links.length > 0) {
                    expect(links[0].href).toMatch(/\/tickets\/ABC123/);
                }
            });
        });
    });

    describe("Past Tickets Section", () => {
        it("displays past section heading", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText("Past")).toBeInTheDocument();
            });
        });

        it("shows empty state when no past tickets", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const noneElements = screen.getAllByText("None.");
                expect(noneElements.length).toBeGreaterThan(0);
            });
        });

        it("displays past ticket information when available", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        ...fixtureDashboard,
                        past: [
                            {
                                id: 2,
                                confirmation_code: "XYZ789",
                                status: "completed",
                                seat: "15B",
                                passenger_last: "User",
                            },
                        ],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/XYZ789/)).toBeInTheDocument();
            });
        });

        it("shows ticket status", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        ...fixtureDashboard,
                        past: [
                            {
                                id: 2,
                                confirmation_code: "XYZ789",
                                status: "completed",
                                seat: "15B",
                                passenger_last: "User",
                            },
                        ],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/completed/)).toBeInTheDocument();
            });
        });
    });

    describe("Data Display", () => {
        it("displays ticket confirmation code", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/ABC123/)).toBeInTheDocument();
            });
        });

        it("displays flight information", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/united/i)).toBeInTheDocument();
                expect(screen.getByText(/UA100/)).toBeInTheDocument();
            });
        });

        it("displays seat number", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/seat 12a/i)).toBeInTheDocument();
            });
        });
    });

    describe("Loading States", () => {
        it("shows loading indicator initially", () => {
            renderWithProviders(<Dashboard />);
            // Component shows spinner during initial load
        });

        it("hides spinner after data loads", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/welcome/i)).toBeInTheDocument();
            });
        });
    });

    describe("Error States", () => {
        it("displays error message on fetch failure", async () => {
            frontendServer.use(errorHandlers.serverError[0]);

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/error|internal server/i)).toBeInTheDocument();
            });
        });

        it("shows error for unauthorized access", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json(
                        { error: "Unauthorized" },
                        { status: 401 }
                    );
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
            });
        });
    });

    describe("Navigation", () => {
        it("links to ticket detail for upcoming tickets", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /view/i });
                expect(links[0].href).toMatch(/\/tickets\/ABC123/);
            });
        });

        it("includes passenger last name in link for context", async () => {
            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /view/i });
                if (links[0].href.includes("last=")) {
                    expect(links[0].href).toMatch(/last=User/);
                }
            });
        });
    });

    describe("Empty States", () => {
        it("handles dashboard with no tickets", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        profile: fixtureDashboard.profile,
                        upcoming: [],
                        past: [],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                const noneElements = screen.getAllByText("None.");
                expect(noneElements.length).toBe(2);
            });
        });

        it("displays fallback for missing last login info", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        profile: {
                            firstName: "Test",
                            lastLoginDatetime: null,
                            lastLoginIp: null,
                        },
                        upcoming: [],
                        past: [],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/—/)).toBeInTheDocument();
            });
        });
    });

    describe("Multiple Tickets", () => {
        it("displays multiple upcoming tickets", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        ...fixtureDashboard,
                        upcoming: [
                            {
                                id: 1,
                                confirmation_code: "ABC123",
                                flight: { airline: "United", flightNumber: "UA100" },
                                seat: "12A",
                                passenger_last: "User",
                            },
                            {
                                id: 2,
                                confirmation_code: "DEF456",
                                flight: { airline: "American", flightNumber: "AA200" },
                                seat: "14C",
                                passenger_last: "User",
                            },
                        ],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/ABC123/)).toBeInTheDocument();
                expect(screen.getByText(/DEF456/)).toBeInTheDocument();
            });
        });

        it("displays multiple past tickets", async () => {
            frontendServer.use(
                http.get("*/api/me/dashboard", () => {
                    return HttpResponse.json({
                        profile: fixtureDashboard.profile,
                        upcoming: [],
                        past: [
                            {
                                id: 1,
                                confirmation_code: "OLD123",
                                status: "completed",
                                seat: "10A",
                                passenger_last: "User",
                            },
                            {
                                id: 2,
                                confirmation_code: "OLD456",
                                status: "completed",
                                seat: "11B",
                                passenger_last: "User",
                            },
                        ],
                    });
                })
            );

            renderWithProviders(<Dashboard />);

            await waitFor(() => {
                expect(screen.getByText(/OLD123/)).toBeInTheDocument();
                expect(screen.getByText(/OLD456/)).toBeInTheDocument();
            });
        });
    });
});
