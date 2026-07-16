import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
    const lastName = params.get("last") || "";
    const [err, setErr] = useState(null);
    const [msg, setMsg] = useState(null);

    const path = `/api/tickets/by-confirmation?lastName=${encodeURIComponent(lastName)}&code=${encodeURIComponent(code)}`;
    const { data, error: loadError } = useLiveResource(path, { intervalMs: 30_000 });

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
        <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Ticket {t.confirmation_code}</h1>
                {direction && (
                    <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${direction === "Arrival"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                            }`}
                    >
                        {direction}
                    </span>
                )}
            </div>
            {msg && <p className="text-green-700">{msg}</p>}
            <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>Passenger</dt><dd>{t.passenger_first} {t.passenger_last}</dd>
                <dt>Seat</dt><dd>{t.seat}</dd>
                <dt>Status</dt><dd>{t.status}</dd>
                <dt>Total</dt><dd>${(t.total_cents / 100).toFixed(2)}</dd>
                <dt>Flight</dt><dd>{f ? `${f.airline} ${f.flightNumber}` : t.flight_id}</dd>
                <dt>Departs</dt><dd>{fmtDateTime(departValue)}</dd>
                <dt>Gate</dt><dd>{f?.gate || "—"}</dd>
            </dl>
            {t.status === "active" && (
                <button onClick={cancel} className="rounded border border-destructive px-4 py-2 text-destructive">
                    Cancel ticket
                </button>
            )}
        </div>
    );
}
