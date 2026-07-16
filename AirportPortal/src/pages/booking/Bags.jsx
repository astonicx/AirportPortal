import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useBooking } from "@/context/BookingContext";

function priceAt(prices = [], count = 0) {
    if (!count) return 0;
    const idx = Math.min(count, prices.length - 1);
    return Number(prices[idx] || prices[prices.length - 1] || 0);
}

export default function Bags() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [pricing, setPricing] = useState(booking.baggagePricing || null);
    const [err, setErr] = useState(null);
    const co = booking.carryOnCount;
    const ch = booking.checkedCount;

    useEffect(() => {
        let cancelled = false;
        api
            .get(`/api/flights/${id}/baggage`)
            .then((r) => {
                if (cancelled) return;
                setPricing(r);
                update({ baggagePricing: r });
            })
            .catch((e) => {
                if (cancelled) return;
                setErr(e);
            });
        return () => {
            cancelled = true;
        };
    }, [id, update]);

    const bagFeeCents = useMemo(() => {
        if (!pricing) return 0;
        return (
            priceAt(pricing.carryOnPrices, co) +
            priceAt(pricing.checkedPrices, ch)
        );
    }, [pricing, co, ch]);

    return (
        <div className="animate-in-up mx-auto max-w-xl space-y-5">
            <div className="space-y-1">
                <p className="page-eyebrow">Booking · Step 3</p>
                <h1>Bags</h1>
            </div>
            <div className="form-card space-y-4">
                <label className="field-label">
                    Carry-on bags (0–2)
                    <input
                        type="number" min={0} max={2} value={co}
                        onChange={(e) => update({ carryOnCount: Math.min(2, Math.max(0, +e.target.value)) })}
                        className="field-input"
                    />
                </label>
                <label className="field-label">
                    Checked bags (0–5)
                    <input
                        type="number" min={0} max={5} value={ch}
                        onChange={(e) => update({ checkedCount: Math.min(5, Math.max(0, +e.target.value)) })}
                        className="field-input"
                    />
                </label>
                {err && <p className="text-sm text-destructive">{err.data?.error || err.message}</p>}
                <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm">
                    <span>Bag fees</span>
                    <span className="font-semibold text-primary">${(bagFeeCents / 100).toFixed(2)}</span>
                </div>
                <button
                    onClick={() => navigate(`/book/${id}/payment`)}
                    className="btn-primary w-full"
                >
                    Continue → Payment
                </button>
            </div>
        </div>
    );
}
