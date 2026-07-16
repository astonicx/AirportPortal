import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useLiveResource } from "@/hooks/useLiveResource";
import Spinner from "@/components/Spinner";

function fmtDateTime(value) {
    if (!value) return "—";
    const d = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.toLocaleDateString("en-US")} ${d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

export default function Ticket() {
    const { code } = useParams();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const lastName = params.get("last") || "";
    const [err, setErr] = useState(null);
    const [msg, setMsg] = useState(null);

    const path = `/api/tickets/by-confirmation?lastName=${encodeURIComponent(lastName)}&code=${encodeURIComponent(code)}`;
    const { data, error: loadError } = useLiveResource(path, { intervalMs: 30_000 });

    useEffect(() => {
        if (!data) return;
        if (data.requires_checkin_first && !data.checked_in_at) {
            const lname = lastName || data.ticket?.passenger_last || "";
            navigate(
                `/checkin?code=${encodeURIComponent(code)}&last=${encodeURIComponent(lname)}`,
                { replace: true }
            );
        }
    }, [data, code, lastName, navigate]);

    const cancel = async () => {
        if (!confirm("Cancel this ticket?")) return;
        try {
            await api.post(`/api/tickets/${data.ticket.id}/cancel`, { lastName, code });
            setMsg("Ticket cancelled.");
        } catch (e) {
            setErr(e);
        }
    };

    if (loadError) return <p className="text-destructive">{loadError.data?.error || loadError.message}</p>;
    if (err) return <p className="text-destructive">{err.data?.error || err.message}</p>;
    if (!data) return <Spinner />;

    const t = data.ticket;
    const f = data.flight;
    // Determine whether this leg is an arrival or departure for the portal.
    const direction = f
        ? (f.type === "arrival" ? "Arrival" : "Departure")
        : null;
    const departValue = f
        ? (f.departFromSender || f.departFromReceiver || f.depart_time)
        : null;

    return (
        <div className="animate-in-up mx-auto max-w-2xl space-y-5">
            <div className="flex flex-wrap items-center gap-3">
                <h1>Ticket <span className="font-mono">{t.confirmation_code}</span></h1>
                {direction && (
                    <span className={`pill ${direction === "Arrival" ? "pill-info" : "pill-warning"}`}>
                        {direction}
                    </span>
                )}
            </div>
            {msg && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}
            <div className="surface-card p-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><dt className="text-muted-foreground">Passenger</dt><dd className="font-medium">{t.passenger_first} {t.passenger_last}</dd></div>
                    <div><dt className="text-muted-foreground">Seat</dt><dd className="font-medium">{t.seat}</dd></div>
                    <div><dt className="text-muted-foreground">Status</dt><dd className="font-medium capitalize">{t.status}</dd></div>
                    <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold text-primary">${(t.total_cents / 100).toFixed(2)}</dd></div>
                    <div><dt className="text-muted-foreground">Flight</dt><dd className="font-medium">{f ? `${f.airline} ${f.flightNumber}` : t.flight_id}</dd></div>
                    <div><dt className="text-muted-foreground">Departs</dt><dd className="font-medium">{fmtDateTime(departValue)}</dd></div>
                    <div><dt className="text-muted-foreground">Gate</dt><dd className="font-medium">{f?.gate || "—"}</dd></div>
                </dl>
            </div>
            {t.status === "active" && (
                <button onClick={cancel} className="rounded-lg border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground">
                    Cancel ticket
                </button>
            )}
        </div>
    );
}
