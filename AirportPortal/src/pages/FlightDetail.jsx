import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useLiveResource } from "@/hooks/useLiveResource";
import Spinner from "@/components/Spinner";

export default function FlightDetail() {
    const { id } = useParams();
    const [homeAirport, setHomeAirport] = useState(null);

    // Live-poll the flight so gate/status changes appear without a manual reload.
    const { data: flight, error: err } = useLiveResource(`/api/flights/${id}`, {
        intervalMs: 30_000,
    });

    useEffect(() => {
        let cancelled = false;
        api
            .get("/api/flights/home-airport")
            .then((r) => !cancelled && setHomeAirport(r.airport))
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    if (err) return <p className="text-destructive">{err.message}</p>;
    if (!flight) return <Spinner />;

    // Only flights landing at our airport are bookable. The upstream `type`
    // field is unreliable, so compare landingAt to our home airport.
    const landsHere = !homeAirport || flight.landingAt === homeAirport;
    const canBook =
        flight.bookable && flight.status === "scheduled" &&
        landsHere &&
        new Date(flight.arriveAtReceiver || 0).getTime() > Date.now() + 24 * 3600_000;

    return (
        <div className="animate-in-up mx-auto max-w-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="page-eyebrow">Flight detail</p>
                    <h1>
                        {flight.airline} {flight.flightNumber}
                    </h1>
                </div>
                <span className="pill pill-info capitalize">{flight.status}</span>
            </div>
            <div className="surface-card p-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><dt className="text-muted-foreground">Origin</dt><dd className="font-medium">{flight.comingFrom || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Destination</dt><dd className="font-medium">{flight.departingTo || flight.landingAt || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Departs</dt><dd className="font-medium">{flight.departFromSender || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Arrives</dt><dd className="font-medium">{flight.arriveAtReceiver || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Gate</dt><dd className="font-medium">{flight.gate || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Seat price</dt><dd className="font-semibold text-primary">${(flight.seat_price ?? flight.seatPrice ?? 0).toFixed(2)}</dd></div>
                </dl>
            </div>
            {canBook ? (
                <Link to={`/book/${id}/passenger`} className="btn-primary">
                    Book this flight
                </Link>
            ) : (
                <p className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                    This flight is not currently bookable.
                </p>
            )}
        </div>
    );
}
