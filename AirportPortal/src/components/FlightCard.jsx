import { Link } from "react-router-dom";

// Mobile card view — one card per flight, shown only below the md breakpoint.
export default function FlightCard({ flight: f }) {
    return (
        <div className="rounded border p-4 text-sm">
            <div className="flex items-center justify-between">
                <span className="font-semibold">
                    {f.airline} {f.flightNumber}
                </span>
                {f.canBook ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Bookable
                    </span>
                ) : (
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Not bookable
                    </span>
                )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1">
                <dt className="text-muted-foreground">From</dt>
                <dd>{f.from || "\u2014"}</dd>
                <dt className="text-muted-foreground">To</dt>
                <dd>{f.to || "\u2014"}</dd>
                <dt className="text-muted-foreground">Time</dt>
                <dd>{f.time}</dd>
                <dt className="text-muted-foreground">Gate</dt>
                <dd>{f.gate || "\u2014"}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{f.status}</dd>
            </dl>
            <Link
                to={`/flights/${f.flight_id || f.id}`}
                className="mt-3 inline-block underline"
            >
                Details
            </Link>
        </div>
    );
}
