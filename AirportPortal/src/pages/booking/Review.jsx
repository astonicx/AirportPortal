import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useBooking } from "@/context/BookingContext";
import { api } from "@/lib/api";

function priceAt(prices = [], count = 0) {
    if (!count) return 0;
    const idx = Math.min(count, prices.length - 1);
    return Number(prices[idx] || prices[prices.length - 1] || 0);
}

export default function Review() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update, reset } = useBooking();
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    const classes = booking.flight?.seatClasses || [];
    const selectedClass = classes.find(
        (c) => String(c.class).toLowerCase() === String(booking.seatClass || "").toLowerCase()
    );
    const seatPrice = Number(
        selectedClass?.priceCents != null
            ? selectedClass.priceCents / 100
            : booking.flight?.seat_price ?? booking.flight?.seatPrice ?? 0
    );
    const bagFeeCents =
        priceAt(booking.baggagePricing?.carryOnPrices, booking.carryOnCount) +
        priceAt(booking.baggagePricing?.checkedPrices, booking.checkedCount);
    const extrasCatalog = booking.flight?.availableExtras || [];
    const extrasChosen = extrasCatalog.filter((e) =>
        (booking.extras || []).some(
            (name) => String(name).toLowerCase() === String(e.name).toLowerCase()
        )
    );
    const extrasMoney = extrasChosen.reduce((sum, e) => sum + Number(e.costCents || 0), 0) / 100;
    const total = seatPrice + bagFeeCents / 100 + extrasMoney;

    const submit = async () => {
        setErr(null); setBusy(true);
        try {
            const r = await api.post("/api/bookings", {
                flightId: id,
                passenger: booking.passenger,
                payment: {
                    ...booking.payment,
                    method: booking.ffmToApply > 0 ? "mixed" : "money",
                    ffmToApply: Math.max(0, Number(booking.ffmToApply || 0)),
                },
                seat: booking.seat,
                seatClass: booking.seatClass,
                extras: booking.extras || [],
                carryOnCount: booking.carryOnCount,
                checkedCount: booking.checkedCount,
            });
            reset();
            toast.success(`Booking confirmed — confirmation ${r.confirmationCode}`);
            navigate(`/ticket/${r.confirmationCode}?last=${encodeURIComponent(booking.passenger.last)}`);
        } catch (e) {
            const code = e?.data?.code;
            if (code === "AIRLINE_RESTRICTED") {
                setErr({ message: "You are not permitted to book with this airline. Please choose a different flight." });
            } else if (code === "BOOKING_TOO_CLOSE") {
                setErr({ message: "This flight is within the 36-hour booking window. Please choose a later flight." });
            } else if (code === "INSUFFICIENT_FFM") {
                setErr({ message: "Insufficient frequent flier miles for this selection." });
            } else {
                setErr(e);
            }
        }
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
                {!!extrasCatalog.length && (
                    <div className="space-y-2 rounded-lg border border-border/70 p-3 text-sm">
                        <p className="font-semibold">Extras</p>
                        <div className="grid gap-1">
                            {extrasCatalog.map((ex) => {
                                const checked = (booking.extras || []).includes(ex.name);
                                return (
                                    <label key={ex.name} className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                                const set = new Set(booking.extras || []);
                                                if (e.target.checked) set.add(ex.name);
                                                else set.delete(ex.name);
                                                update({ extras: [...set] });
                                            }}
                                            className="h-4 w-4"
                                        />
                                        <span>
                                            {ex.name} (${(Number(ex.costCents || 0) / 100).toFixed(2)} / {Number(ex.costFfm || 0)} FFM)
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}
                <label className="block text-sm">
                    Frequent flier miles to apply
                    <input
                        type="number"
                        min={0}
                        value={booking.ffmToApply || 0}
                        onChange={(e) => {
                            const next = Math.max(0, Number(e.target.value || 0));
                            update({ ffmToApply: next });
                        }}
                        className="field-input"
                    />
                </label>
                <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Passenger</dt><dd className="font-medium">{booking.passenger.first} {booking.passenger.last}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Seat</dt><dd className="font-medium">{booking.seat}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Seat class</dt><dd className="font-medium">{booking.seatClass ? String(booking.seatClass).replace(/_/g, " ") : "economy"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Bags</dt><dd className="font-medium">{booking.carryOnCount} carry-on · {booking.checkedCount} checked</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Card ending</dt><dd className="font-medium">•••• {booking.payment.cardNumber.slice(-4)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Seat price</dt><dd className="font-medium">${seatPrice.toFixed(2)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Bag fees</dt><dd className="font-medium">${(bagFeeCents / 100).toFixed(2)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Extras</dt><dd className="font-medium">${extrasMoney.toFixed(2)}</dd></div>
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
