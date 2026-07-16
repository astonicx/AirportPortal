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
    const [seatClasses, setSeatClasses] = useState([]);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const data = await api.get(`/api/flights/${id}/seats`);
            setSeats(data.seats);
            setSeatClasses(data.seatClasses || []);
        }
        catch (e) { setErr(e); }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 10_000);
        return () => clearInterval(t);
    }, [id]);

    const pick = async (seat, seatClass) => {
        setBusy(true); setErr(null);
        try {
            await api.post(`/api/flights/${id}/seats/lock`, { seat, seatClass });
            update({ seat, seatClass });
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
            <h1>Pick a seat</h1>
            {err && <p className="text-destructive">{err.message}</p>}
            {!!seatClasses.length && (
                <div className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-xs">
                    <p className="mb-2 font-semibold text-foreground">Seat classes</p>
                    <div className="flex flex-wrap gap-2">
                        {seatClasses.map((c) => (
                            <span key={c.class} className="rounded-full border border-border px-2 py-1">
                                {c.class.replace(/_/g, " ")} · ${(Number(c.priceCents || 0) / 100).toFixed(2)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            <div className="space-y-1">
                {Object.entries(rows).map(([r, list]) => (
                    <div key={r} className="flex items-center gap-1">
                        <span className="w-8 text-right text-xs text-muted-foreground">{r}</span>
                        {list.map((s) => {
                            const base = "h-8 w-8 rounded text-xs font-medium";
                            const color =
                                s.state === "taken" ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : s.state === "locked" ? "bg-accent/40 cursor-not-allowed"
                                        : s.state === "mine" ? "bg-green-600 text-white"
                                            : "bg-secondary hover:bg-primary hover:text-white";
                            return (
                                <button
                                    key={s.seat}
                                    disabled={s.state === "taken" || s.state === "locked" || busy}
                                    onClick={() => pick(s.seat, s.class)}
                                    className={`${base} ${color}`}
                                    aria-pressed={s.state === "mine"}
                                    title={`${s.seat} · ${String(s.class || "economy").replace(/_/g, " ")} · $${(Number(s.priceCents || 0) / 100).toFixed(2)}`}
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
                className="btn-primary"
            >
                Continue → Bags {booking.seatClass ? `(${String(booking.seatClass).replace(/_/g, " ")})` : ""}
            </button>
        </div>
    );
}
