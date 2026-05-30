import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
            navigate(`/tickets/${r.confirmationCode}?last=${encodeURIComponent(booking.passenger.last)}`);
        } catch (e) { setErr(e); }
        finally { setBusy(false); }
    };

    if (!booking.passenger || !booking.payment || !booking.seat) {
        return <p>Missing booking details.</p>;
    }

    return (
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-xl font-bold">Review &amp; book</h1>
            <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>Passenger</dt><dd>{booking.passenger.first} {booking.passenger.last}</dd>
                <dt>Seat</dt><dd>{booking.seat}</dd>
                <dt>Bags</dt><dd>{booking.carryOnCount} carry-on · {booking.checkedCount} checked</dd>
                <dt>Card ending</dt><dd>•••• {booking.payment.cardNumber.slice(-4)}</dd>
                <dt>Seat price</dt><dd>${seatPrice.toFixed(2)}</dd>
                <dt>Bag fees</dt><dd>${fees(booking.carryOnCount, booking.checkedCount).toFixed(2)}</dd>
                <dt className="font-semibold">Total</dt><dd className="font-semibold">${total.toFixed(2)}</dd>
            </dl>
            {err && <p className="text-destructive">{err.data?.error || err.message}</p>}
            <button
                disabled={busy}
                onClick={submit}
                className="rounded bg-milwaukeeBlue px-4 py-2 text-white disabled:opacity-50"
            >
                {busy ? "Booking…" : "Confirm booking"}
            </button>
        </div>
    );
}
