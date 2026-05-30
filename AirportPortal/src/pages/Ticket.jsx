import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function Ticket() {
    const { code } = useParams();
    const [params] = useSearchParams();
    const lastName = params.get("last") || "";
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [msg, setMsg] = useState(null);

    const load = () => {
        api.get(`/api/tickets/by-confirmation?lastName=${encodeURIComponent(lastName)}&code=${encodeURIComponent(code)}`)
            .then(setData)
            .catch(setErr);
    };
    useEffect(load, [code, lastName]);

    const cancel = async () => {
        if (!confirm("Cancel this ticket?")) return;
        try {
            await api.post(`/api/tickets/${data.ticket.id}/cancel`, { lastName, code });
            setMsg("Ticket cancelled.");
            load();
        } catch (e) { setErr(e); }
    };

    if (err) return <p className="text-destructive">{err.data?.error || err.message}</p>;
    if (!data) return <Spinner />;

    const t = data.ticket;
    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <h1 className="text-2xl font-bold">Ticket {t.confirmation_code}</h1>
            {msg && <p className="text-green-700">{msg}</p>}
            <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>Passenger</dt><dd>{t.passenger_first} {t.passenger_last}</dd>
                <dt>Seat</dt><dd>{t.seat}</dd>
                <dt>Status</dt><dd>{t.status}</dd>
                <dt>Total</dt><dd>${(t.total_cents / 100).toFixed(2)}</dd>
                <dt>Flight</dt><dd>{data.flight ? `${data.flight.airline} ${data.flight.flightNumber}` : t.flight_id}</dd>
            </dl>
            {t.status === "active" && (
                <button onClick={cancel} className="rounded border border-destructive px-4 py-2 text-destructive">
                    Cancel ticket
                </button>
            )}
        </div>
    );
}
