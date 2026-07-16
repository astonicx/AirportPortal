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
        <div className="animate-in-up space-y-8">
            <section className="relative overflow-hidden rounded-2xl bg-brand-hero p-6 text-white shadow-elevated sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-brand-sheen" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-white/70">Welcome back</p>
                        <h1 className="text-white">{data.profile.firstName}</h1>
                        <p className="text-sm text-white/80">
                            Last login: {data.profile.lastLoginDatetime || "—"} from{" "}
                            {data.profile.lastLoginIp || "—"}
                        </p>
                    </div>
                    <Link
                        to="/book"
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-semibold text-primary shadow-sm transition-all hover:shadow-md hover:brightness-95"
                    >
                        ✈ Book a flight
                    </Link>
                </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Upcoming trips" value={data.upcoming.length} tone="info" />
                <StatCard label="Past trips" value={data.past.length} tone="muted" />
                <StatCard
                    label="Total bookings"
                    value={data.upcoming.length + data.past.length}
                    tone="success"
                />
            </div>

            <section className="space-y-3">
                <h2>Upcoming</h2>
                {data.upcoming.length === 0 && (
                    <p className="surface-card p-6 text-center text-muted-foreground">
                        No upcoming trips yet.
                    </p>
                )}
                {data.upcoming.length > 0 && (
                    <ul className="surface-card divide-y divide-border/70 overflow-hidden">
                        {data.upcoming.map((t) => (
                            <li
                                key={t.id}
                                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-primary/5"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">
                                        {t.flight?.airline} {t.flight?.flightNumber}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {t.confirmation_code} · seat {t.seat}
                                    </p>
                                </div>
                                <Link
                                    to={`/tickets/${t.confirmation_code}?last=${encodeURIComponent(t.passenger_last)}`}
                                    className="shrink-0 rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
                                >
                                    View
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="space-y-3">
                <h2>Past</h2>
                {data.past.length === 0 && (
                    <p className="surface-card p-6 text-center text-muted-foreground">
                        No past trips.
                    </p>
                )}
                {data.past.length > 0 && (
                    <ul className="surface-card divide-y divide-border/70 overflow-hidden">
                        {data.past.map((t) => (
                            <li
                                key={t.id}
                                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-primary/5"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{t.confirmation_code}</p>
                                    <p className="text-sm text-muted-foreground">
                                        seat {t.seat} · {t.status}
                                    </p>
                                </div>
                                <Link
                                    to={`/tickets/${t.confirmation_code}?last=${encodeURIComponent(t.passenger_last)}`}
                                    className="shrink-0 rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
                                >
                                    View
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function StatCard({ label, value, tone }) {
    const tones = {
        info: "text-info",
        success: "text-success",
        muted: "text-muted-foreground",
    };
    return (
        <div className="surface-card p-5">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${tones[tone] || ""}`}>{value}</p>
        </div>
    );
}
