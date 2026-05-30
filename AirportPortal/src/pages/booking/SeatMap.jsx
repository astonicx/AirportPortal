import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useBooking } from "@/context/BookingContext";
import Spinner from "@/components/Spinner";

export default function SeatMap() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [seats, setSeats] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try { setSeats((await api.get(`/api/flights/${id}/seats`)).seats); }
        catch (e) { setErr(e); }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 15_000);
        return () => clearInterval(t);
    }, [id]);

    const pick = async (seat) => {
        setBusy(true); setErr(null);
        try {
            await api.post(`/api/flights/${id}/seats/lock`, { seat });
            update({ seat });
            await load();
        } catch (e) { setErr(e); }
        finally { setBusy(false); }
    };

    if (!seats) return <Spinner />;
    const rows = {};
    seats.forEach((s) => {
        const r = s.seat.match(/^(\d+)/)[1];
        (rows[r] = rows[r] || []).push(s);
    });

    return (
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-xl font-bold">Pick a seat</h1>
            {err && <p className="text-destructive">{err.message}</p>}
            <div className="space-y-1">
                {Object.entries(rows).map(([r, list]) => (
                    <div key={r} className="flex items-center gap-1">
                        <span className="w-8 text-right text-xs text-muted-foreground">{r}</span>
                        {list.map((s) => {
                            const base = "h-8 w-8 rounded text-xs font-medium";
                            const color =
                                s.state === "taken" ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : s.state === "locked" ? "bg-milwaukeeGold/40 cursor-not-allowed"
                                        : s.state === "mine" ? "bg-green-600 text-white"
                                            : "bg-secondary hover:bg-milwaukeeBlue hover:text-white";
                            return (
                                <button
                                    key={s.seat}
                                    disabled={s.state === "taken" || s.state === "locked" || busy}
                                    onClick={() => pick(s.seat)}
                                    className={`${base} ${color}`}
                                    aria-pressed={s.state === "mine"}
                                >
                                    {s.seat.replace(/^\d+/, "")}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
            <button
                disabled={!booking.seat}
                onClick={() => navigate(`/book/${id}/bags`)}
                className="rounded bg-milwaukeeBlue px-4 py-2 text-white disabled:opacity-50"
            >
                Continue → Bags
            </button>
        </div>
    );
}
