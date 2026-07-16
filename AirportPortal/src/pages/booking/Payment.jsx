import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";

export default function Payment() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [p, setP] = useState(booking.payment || {
        cardNumber: "", expMonth: 1, expYear: new Date().getFullYear() + 1,
        cvc: "", cardholder: "", billingAddress: "", billingZip: "", saveCard: false,
    });
    const set = (k) => (e) => setP({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

    const submit = (e) => {
        e.preventDefault();
        update({
            payment: {
                ...p,
                expMonth: Number(p.expMonth),
                expYear: Number(p.expYear),
            },
        });
        navigate(`/book/${id}/review`);
    };

    return (
        <div className="animate-in-up mx-auto max-w-xl space-y-5">
            <div className="space-y-1">
                <p className="page-eyebrow">Booking · Step 4</p>
                <h1>Payment</h1>
            </div>
            <div
                role="alert"
                className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
            >
                <strong>Demo only — never enter real card data.</strong> This is a
                practice portal. Do not type a real credit card number, CVC, or billing
                details. Use placeholder values such as 4111 1111 1111 1111.
            </div>
            <form onSubmit={submit} className="form-card grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="field-label sm:col-span-2">
                    Card number
                    <input type="text" required value={p.cardNumber} onChange={set("cardNumber")}
                        inputMode="numeric" autoComplete="cc-number"
                        className="field-input" />
                </label>
                <label className="field-label">
                    Exp Month
                    <input type="number" min={1} max={12} required value={p.expMonth} onChange={set("expMonth")}
                        className="field-input" />
                </label>
                <label className="field-label">
                    Exp Year
                    <input type="number" required value={p.expYear} onChange={set("expYear")}
                        className="field-input" />
                </label>
                <label className="field-label">
                    CVC
                    <input type="text" required value={p.cvc} onChange={set("cvc")} autoComplete="cc-csc"
                        className="field-input" />
                </label>
                <label className="field-label">
                    Cardholder
                    <input type="text" required value={p.cardholder} onChange={set("cardholder")} autoComplete="cc-name"
                        className="field-input" />
                </label>
                <label className="field-label sm:col-span-2">
                    Billing address
                    <input type="text" required value={p.billingAddress} onChange={set("billingAddress")}
                        className="field-input" />
                </label>
                <label className="field-label">
                    Billing ZIP
                    <input type="text" required value={p.billingZip} onChange={set("billingZip")}
                        className="field-input" />
                </label>
                <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={p.saveCard} onChange={set("saveCard")} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
                    Save card for future bookings
                </label>
                <button className="btn-primary sm:col-span-2">
                    Continue → Review
                </button>
            </form>
        </div>
    );
}
