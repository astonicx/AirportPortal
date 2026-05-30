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
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-xl font-bold">Bags</h1>
            <label className="block text-sm">
                Carry-on bags (0–2)
                <input
                    type="number" min={0} max={2} value={co}
                    onChange={(e) => update({ carryOnCount: Math.min(2, Math.max(0, +e.target.value)) })}
                    className="mt-1 w-full rounded border px-3 py-2"
                />
            </label>
            <label className="block text-sm">
                Checked bags (0–5)
                <input
                    type="number" min={0} max={5} value={ch}
                    onChange={(e) => update({ checkedCount: Math.min(5, Math.max(0, +e.target.value)) })}
                    className="mt-1 w-full rounded border px-3 py-2"
                />
            </label>
            <p className="text-sm">Bag fees: <span className="font-semibold">${feeFor(co, ch)}</span></p>
            <button
                onClick={() => navigate(`/book/${id}/payment`)}
                className="rounded bg-milwaukeeBlue px-4 py-2 text-white"
            >
                Continue → Payment
            </button>
        </div>
    );
}
