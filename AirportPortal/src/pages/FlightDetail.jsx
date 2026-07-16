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
        <div className="mx-auto max-w-2xl space-y-4">
            <h1 className="text-2xl font-bold">
                {flight.airline} {flight.flightNumber}
            </h1>
            <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="font-medium">Origin</dt><dd>{flight.comingFrom || "—"}</dd>
                <dt className="font-medium">Destination</dt><dd>{flight.departingTo || flight.landingAt || "—"}</dd>
                <dt className="font-medium">Departs</dt><dd>{flight.departFromSender || "—"}</dd>
                <dt className="font-medium">Arrives</dt><dd>{flight.arriveAtReceiver || "—"}</dd>
                <dt className="font-medium">Gate</dt><dd>{flight.gate || "—"}</dd>
                <dt className="font-medium">Status</dt><dd>{flight.status}</dd>
                <dt className="font-medium">Seat price</dt>
                <dd>${(flight.seat_price ?? flight.seatPrice ?? 0).toFixed(2)}</dd>
            </dl>
            {canBook ? (
                <Link
                    to={`/book/${id}/passenger`}
                    className="inline-block rounded bg-milwaukeeBlue px-4 py-2 text-white"
                >
                    Book this flight
                </Link>
            ) : (
                <p className="text-sm text-muted-foreground">
                    This flight is not currently bookable.
                </p>
            )}
        </div>
    );
}
