import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useBooking } from "@/context/BookingContext";
import { api } from "@/lib/api";

function fees(co, ch) {
    let t = co === 2 ? 30 : 0;
    if (ch === 2) t += 50;
    else if (ch >= 3) t += 50 + 100 * (ch - 2);
    return t;
}

export default function Review() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, reset } = useBooking();
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const seatPrice = booking.flight?.seat_price ?? booking.flight?.seatPrice ?? 0;
    const total = seatPrice + fees(booking.carryOnCount, booking.checkedCount);

    const submit = async () => {
        setErr(null); setBusy(true);
        try {
            const r = await api.post("/api/bookings", {
                flightId: id,
                passenger: booking.passenger,
                payment: booking.payment,
                seat: booking.seat,
                carryOnCount: booking.carryOnCount,
                checkedCount: booking.checkedCount,
            });
            reset();
            toast.success(`Booking confirmed — confirmation ${r.confirmationCode}`);
            navigate(`/ticket/${r.confirmationCode}?last=${encodeURIComponent(booking.passenger.last)}`);
        } catch (e) { setErr(e); }
        finally { setBusy(false); }
    };

    if (!booking.passenger || !booking.payment || !booking.seat) {
        return <p>Missing booking details.</p>;
    }

    return (
        <div className="animate-in-up mx-auto max-w-xl space-y-5">
            <div className="space-y-1">
                <p className="page-eyebrow">Booking · Step 5</p>
                <h1>Review &amp; book</h1>
            </div>
            <div className="form-card space-y-3">
                <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Passenger</dt><dd className="font-medium">{booking.passenger.first} {booking.passenger.last}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Seat</dt><dd className="font-medium">{booking.seat}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Bags</dt><dd className="font-medium">{booking.carryOnCount} carry-on · {booking.checkedCount} checked</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Card ending</dt><dd className="font-medium">•••• {booking.payment.cardNumber.slice(-4)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Seat price</dt><dd className="font-medium">${seatPrice.toFixed(2)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Bag fees</dt><dd className="font-medium">${fees(booking.carryOnCount, booking.checkedCount).toFixed(2)}</dd></div>
                    <div className="flex justify-between border-t border-border/70 pt-2 text-base"><dt className="font-semibold">Total</dt><dd className="font-bold text-primary">${total.toFixed(2)}</dd></div>
                </dl>
                {err && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err.data?.error || err.message}</p>}
                <button
                    disabled={busy}
                    onClick={submit}
                    className="btn-primary w-full"
                >
                    {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                    {busy ? "Booking…" : "Confirm booking"}
                </button>
            </div>
        </div>
    );
}
