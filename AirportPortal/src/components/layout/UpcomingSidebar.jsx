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

    return (
        <aside className="w-full shrink-0 lg:w-72">
            <div className="sticky top-24 space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Account</p>
                    <p className="mt-1 text-sm font-semibold">
                        Hi, {user?.firstName || user?.email || "Traveler"}!
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
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
                    {next ? (
                        <>
                            <p className="text-sm font-semibold">
                                {flight?.airline} {flight?.flightNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                To {flight?.departingTo || flight?.to || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Departs {fmtDate(flight?.departFromSender || flight?.departFromReceiver || flight?.arriveAtReceiver)}
                            </p>
                            <Link
                                to={`/ticket/${next.confirmation_code}?last=${encodeURIComponent(next.passenger_last || "")}`}
                                className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                            >
                                View ticket
                            </Link>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">No upcoming flights.</p>
                    )}
                </div>
            </div>
        </aside>
    );
}
