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
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-xl font-bold">Payment</h1>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                    Card number
                    <input type="text" required value={p.cardNumber} onChange={set("cardNumber")}
                        inputMode="numeric" autoComplete="cc-number"
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="block text-sm">
                    Exp Month
                    <input type="number" min={1} max={12} required value={p.expMonth} onChange={set("expMonth")}
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="block text-sm">
                    Exp Year
                    <input type="number" required value={p.expYear} onChange={set("expYear")}
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="block text-sm">
                    CVC
                    <input type="text" required value={p.cvc} onChange={set("cvc")} autoComplete="cc-csc"
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="block text-sm">
                    Cardholder
                    <input type="text" required value={p.cardholder} onChange={set("cardholder")} autoComplete="cc-name"
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="block text-sm sm:col-span-2">
                    Billing address
                    <input type="text" required value={p.billingAddress} onChange={set("billingAddress")}
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="block text-sm">
                    Billing ZIP
                    <input type="text" required value={p.billingZip} onChange={set("billingZip")}
                        className="mt-1 w-full rounded border px-3 py-2" />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={p.saveCard} onChange={set("saveCard")} />
                    Save card for future bookings
                </label>
                <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">
                    Continue → Review
                </button>
            </form>
        </div>
    );
}
