import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function FlightDetail() {
    const { id } = useParams();
    const [flight, setFlight] = useState(null);
    const [err, setErr] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api
            .get(`/api/flights/${id}`)
            .then((f) => !cancelled && setFlight(f))
            .catch((e) => !cancelled && setErr(e));
        return () => { cancelled = true; };
    }, [id]);

    if (err) return <p className="text-destructive">{err.message}</p>;
    if (!flight) return <Spinner />;

    const canBook =
        flight.bookable && flight.status === "scheduled" &&
        flight.type === "arrival" &&
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
