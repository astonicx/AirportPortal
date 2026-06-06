import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(() => {
        api.get("/api/me/dashboard").then(setData).catch(setErr);
    }, []);

    if (err) return <p className="text-destructive">{err.message}</p>;
    if (!data) return <Spinner />;

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-bold">Welcome, {data.profile.firstName}</h1>
                <p className="text-sm text-muted-foreground">
                    Last login: {data.profile.lastLoginDatetime || "—"} from {data.profile.lastLoginIp || "—"}
                </p>
                <Link
                    to="/book"
                    className="mt-3 inline-block rounded bg-milwaukeeBlue px-4 py-2 text-white hover:opacity-90"
                >
                    Book a flight
                </Link>
            </section>
            <section>
                <h2 className="text-lg font-semibold">Upcoming</h2>
                {data.upcoming.length === 0 && <p className="text-muted-foreground">None.</p>}
                <ul className="divide-y rounded border">
                    {data.upcoming.map((t) => (
                        <li key={t.id} className="flex justify-between p-3">
                            <span>{t.confirmation_code} · {t.flight?.airline} {t.flight?.flightNumber} · seat {t.seat}</span>
                            <Link to={`/tickets/${t.confirmation_code}?last=${encodeURIComponent(t.passenger_last)}`} className="underline">View</Link>
                        </li>
                    ))}
                </ul>
            </section>
            <section>
                <h2 className="text-lg font-semibold">Past</h2>
                {data.past.length === 0 && <p className="text-muted-foreground">None.</p>}
                <ul className="divide-y rounded border">
                    {data.past.map((t) => (
                        <li key={t.id} className="flex justify-between p-3">
                            <span>{t.confirmation_code} · seat {t.seat} · {t.status}</span>
                            <Link to={`/tickets/${t.confirmation_code}?last=${encodeURIComponent(t.passenger_last)}`} className="underline">View</Link>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
