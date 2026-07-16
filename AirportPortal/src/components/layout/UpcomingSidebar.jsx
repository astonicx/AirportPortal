import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLiveResource } from "@/hooks/useLiveResource";

function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function displayValue(value) {
    return value ? String(value) : "-";
}

function getFlightSummary(flight) {
    if (!flight) {
        return {
            airlineAndNumber: "-",
            destination: "-",
            departureDateTime: "-",
        };
    }

    const airline = flight.airline;
    const number = flight.flightNumber || flight.flight_number;
    const destination =
        flight.departingTo ||
        flight.to ||
        flight.destination ||
        flight.arriveToReceiver ||
        flight.arrivalAirport;
    const departureAt =
        flight.departFromSender ||
        flight.depart_time ||
        flight.departureTime ||
        flight.departure_date ||
        flight.departAt;

    return {
        airlineAndNumber: displayValue([airline, number].filter(Boolean).join(" ")),
        destination: displayValue(destination),
        departureDateTime: departureAt ? fmtDate(departureAt) : "-",
    };
}

export default function UpcomingSidebar() {
    const { user } = useAuth();
    const { data: dashboard } = useLiveResource("/api/me/dashboard", {
        intervalMs: 30_000,
        enabled: !!user,
    });
    const { data: ffm } = useLiveResource("/api/me/ffm", {
        intervalMs: 30_000,
        enabled: !!user,
    });

    const next = dashboard?.upcoming?.[0] || null;
    const flight = next?.flight || null;
    const summary = getFlightSummary(flight);
    const firstName = user?.firstName || user?.first_name || "Traveler";

    return (
        <aside className="w-full shrink-0 xl:w-96">
            <div className="space-y-4 rounded-2xl border border-transparent bg-card/0 p-6 opacity-30 shadow-sm transition-all duration-300 hover:border-border/70 hover:bg-card hover:opacity-100 xl:sticky xl:top-24">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Account</p>
                    <p className="mt-1 text-sm font-semibold">
                        Hi, {firstName}!
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{displayValue(user?.email)}</p>
                </div>

                {(user?.type === "customer" || user?.user_type === "customer") && (
                    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">FFM Balance</p>
                        <p className="mt-1 text-lg font-bold text-primary">
                            {Number(ffm?.ffmBalance || 0).toLocaleString()} pts
                        </p>
                    </div>
                )}

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming Flight</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                            <span className="font-medium text-foreground">Flight:</span> {summary.airlineAndNumber}
                        </p>
                        <p>
                            <span className="font-medium text-foreground">Destination:</span> {summary.destination}
                        </p>
                        <p>
                            <span className="font-medium text-foreground">Departure:</span> {summary.departureDateTime}
                        </p>
                    </div>
                    {next ? (
                        <Link
                            to={`/ticket/${next.confirmation_code}?last=${encodeURIComponent(next.passenger_last || "")}`}
                            className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                        >
                            View ticket
                        </Link>
                    ) : (
                        <p className="text-xs text-muted-foreground">No upcoming flights.</p>
                    )}
                </div>
            </div>
        </aside>
    );
}
