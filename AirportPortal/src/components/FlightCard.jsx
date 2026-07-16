import { Link } from "react-router-dom";
import { statusPillClass } from "@/lib/flightStatus";

// Mobile card view — one card per flight, shown only below the md breakpoint.
export default function FlightCard({ flight: f }) {
    return (
        <div className="surface-card p-4 text-sm transition-shadow hover:shadow-elevated">
            <div className="flex items-center justify-between">
                <span className="text-base font-bold">
                    {f.airline} {f.flightNumber}
                </span>
                {f.canBook ? (
                    <span className="pill pill-success">Bookable</span>
                ) : (
                    <span className="pill bg-secondary text-muted-foreground">
                        Not bookable
                    </span>
                )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">From</dt>
                <dd className="text-right font-medium">{f.from || "\u2014"}</dd>
                <dt className="text-muted-foreground">To</dt>
                <dd className="text-right font-medium">{f.to || "\u2014"}</dd>
                <dt className="text-muted-foreground">Time</dt>
                <dd className="text-right font-medium">{f.time}</dd>
                <dt className="text-muted-foreground">Gate</dt>
                <dd className="text-right font-medium">{f.gate || "\u2014"}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right">
                    <span className={statusPillClass(f.status)}>{f.status}</span>
                </dd>
            </dl>
            <Link
                to={`/flights/${f.flight_id || f.id}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110"
            >
                View details
            </Link>
        </div>
    );
}
