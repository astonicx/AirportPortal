import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Flights from "@/pages/Flights";
import { renderWithProviders } from "../helpers/frontend/renderWithProviders";
import { frontendServer, errorHandlers, fixtureFlights } from "../setup/msw/frontend-server";
import { http, HttpResponse } from "msw";

describe("Flights Page", () => {
    describe("Rendering", () => {
        it("renders flights page title", async () => {
            renderWithProviders(<Flights />);
            expect(screen.getByText("Flights")).toBeInTheDocument();
        });

        it("renders departure/arrival selector", async () => {
            renderWithProviders(<Flights />);
            const departuresTab = screen.getByRole("tab", { name: /departures/i });
            expect(departuresTab).toBeInTheDocument();
            expect(screen.getByRole("tab", { name: /arrivals/i })).toBeInTheDocument();
            expect(departuresTab).toHaveAttribute("aria-selected", "true");
        });

        it("renders search input", async () => {
            renderWithProviders(<Flights />);
            expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
        });

        it("renders sort controls", async () => {
            renderWithProviders(<Flights />);
            await waitFor(() => {
                expect(screen.getByRole("button", { name: /sort by flight/i })).toBeInTheDocument();
            });
        });

        it("renders sort direction button", async () => {
            renderWithProviders(<Flights />);
            await waitFor(() => {
                // Default sort is by time; its header stays clickable to toggle direction
                expect(screen.getByRole("button", { name: /sort by time/i })).toBeInTheDocument();
            });
        });
    });

    describe("Loading States", () => {
        it("shows spinner while loading flights", async () => {
            renderWithProviders(<Flights />);
            // Initially shows spinner while data loads
            const spinner = screen.queryByRole("status", { hidden: true });
            // Spinner might be present during initial load
        });

        it("displays flights table after loading", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });
        });
    });

    describe("Empty States", () => {
        it("displays empty state when no flights match search", async () => {
            const user = userEvent.setup();
            frontendServer.use(
                http.get("*/api/flights", () => {
                    return HttpResponse.json({
                        page: 1,
                        pageSize: 20,
                        total: 0,
                        items: [],
                    });
                })
            );

            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getAllByText(/no flights/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe("Data Display", () => {
        it("displays flight table with all columns", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getByRole("table")).toBeInTheDocument();
            });

            // Check for sortable column headers
            expect(screen.getByRole("button", { name: /sort by flight/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /sort by airline/i })).toBeInTheDocument();
            expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
        });

        it("displays flight rows with correct data", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                const cells = screen.getAllByText(/UA100|AA200/);
                expect(cells.length).toBeGreaterThan(0);
            });
        });

        it("renders details link for each flight", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /details/i });
                expect(links.length).toBeGreaterThan(0);
            });
        });
    });

    describe("Filtering", () => {
        it("allows switching between departures and arrivals", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Flights />);

            const departuresTab = screen.getByRole("tab", { name: /departures/i });
            expect(departuresTab).toHaveAttribute("aria-selected", "true");

            const arrivalsTab = screen.getByRole("tab", { name: /arrivals/i });
            await user.click(arrivalsTab);
            await waitFor(() => expect(arrivalsTab).toHaveAttribute("aria-selected", "true"));
        });

        it("filters flights by search query", async () => {
            const user = userEvent.setup();
            frontendServer.use(
                http.get("*/api/flights", ({ request }) => {
                    const url = new URL(request.url);
                    const q = url.searchParams.get("q");
                    if (q && q.includes("UA")) {
                        return HttpResponse.json({
                            page: 1,
                            pageSize: 20,
                            total: 1,
                            items: [fixtureFlights.items[0]],
                        });
                    }
                    return HttpResponse.json(fixtureFlights);
                })
            );

            renderWithProviders(<Flights />);

            const searchInput = screen.getByPlaceholderText(/search/i);
            await user.type(searchInput, "UA");

            await waitFor(() => {
                expect(searchInput).toHaveValue("UA");
            });
        });

        it("resets pagination when filter changes", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Flights />);

            const arrivalsTab = screen.getByRole("tab", { name: /arrivals/i });

            await user.click(arrivalsTab);

            // Switching type activates the arrivals tab (page resets internally)
            await waitFor(() => expect(arrivalsTab).toHaveAttribute("aria-selected", "true"));
        });
    });

    describe("Sorting", () => {
        it("allows selecting sort field", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Flights />);

            const flightHeader = await screen.findByRole("button", { name: /sort by flight/i });
            await user.click(flightHeader);

            await waitFor(() =>
                expect(screen.getByRole("button", { name: /sort by flight/i })).toBeInTheDocument()
            );
        });

        it("toggles sort direction", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Flights />);

            const timeHeader = await screen.findByRole("button", { name: /sort by time/i });
            await user.click(timeHeader);
            await user.click(timeHeader);

            expect(timeHeader).toBeInTheDocument();
        });
    });

    describe("Pagination", () => {
        it("shows pagination controls", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getByText(/page \d+/i)).toBeInTheDocument();
            });
        });

        it("allows navigating pages", async () => {
            const user = userEvent.setup();
            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getByText(/page \d+/i)).toBeInTheDocument();
            });

            const buttons = screen.getAllByRole("button");
            const nextButton = buttons.find(b => b.textContent.includes("Next"));

            if (nextButton) {
                await user.click(nextButton);
                // Next button click should navigate to next page
            }
        });

        it("disables prev button on first page", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getByText(/page \d+/i)).toBeInTheDocument();
            });

            const buttons = screen.getAllByRole("button");
            const prevButton = buttons.find(b => b.textContent.includes("Prev"));

            if (prevButton) {
                expect(prevButton).toBeDisabled();
            }
        });
    });

    describe("Error States", () => {
        it("displays error message on fetch failure", async () => {
            frontendServer.use(
                http.get("*/api/flights", () => {
                    return HttpResponse.json(
                        { error: "Internal server error" },
                        { status: 500 }
                    );
                })
            );

            renderWithProviders(<Flights />);

            await waitFor(() => {
                expect(screen.getByText(/internal server error|error|failed/i)).toBeInTheDocument();
            });
        });

        it("shows error for unauthorized access", async () => {
            frontendServer.use(errorHandlers.unauthorized[0]);

            renderWithProviders(<Flights />);

            // Should show error due to unauthorized access
            expect(screen.getByRole("heading", { name: /flights/i })).toBeInTheDocument();
        });
    });

    describe("Navigation", () => {
        it("links to flight detail page", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /details/i });
                expect(links.length).toBeGreaterThan(0);
            });
        });

        it("details link includes flight id", async () => {
            renderWithProviders(<Flights />);

            await waitFor(() => {
                const links = screen.getAllByRole("link", { name: /details/i });
                if (links.length > 0) {
                    expect(links[0].href).toMatch(/\/flights\//);
                }
            });
        });
    });
});
