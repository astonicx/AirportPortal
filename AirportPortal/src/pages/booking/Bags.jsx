import { useNavigate, useParams } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";

function feeFor(co, ch) {
    let total = co === 2 ? 30 : 0;
    if (ch === 2) total += 50;
    else if (ch >= 3) total += 50 + 100 * (ch - 2);
    return total;
}

export default function Bags() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const co = booking.carryOnCount;
    const ch = booking.checkedCount;

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
                <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm">
                    <span>Bag fees</span>
                    <span className="font-semibold text-primary">${feeFor(co, ch)}</span>
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
