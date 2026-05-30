import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useBooking } from "@/context/BookingContext";
import { useState } from "react";

export default function BookingPassenger() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [p, setP] = useState(booking.passenger || {
        first: "", middle: "", last: "", dob: "", gender: "",
        email: "", phone: "",
    });
    const [err, setErr] = useState(null);

    useEffect(() => {
        if (!booking.flight || booking.flightId !== id) {
            api.get(`/api/flights/${id}`)
                .then((f) => update({ flight: f, flightId: id }))
                .catch((e) => setErr(e));
        }
    }, [id, booking, update]);

    const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setErr(null);
        try {
            const r = await api.post("/api/no-fly/check", p);
            if (r.blocked) {
                setErr({ message: "Passenger appears on the No Fly List." });
                return;
            }
            update({ passenger: p });
            navigate(`/book/${id}/seat`);
        } catch (e) { setErr(e); }
    };

    return (
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-xl font-bold">Passenger</h1>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                    ["First", "first", true], ["Middle", "middle"], ["Last", "last", true],
                    ["DOB (YYYY-MM-DD)", "dob", true], ["Gender", "gender", true],
                    ["Email", "email", true, "email"], ["Phone", "phone", true],
                ].map(([label, key, req, type = "text"]) => (
                    <label key={key} className="block text-sm">
                        {label}{req && <span className="text-destructive"> *</span>}
                        <input
                            type={type}
                            value={p[key]}
                            onChange={set(key)}
                            required={req}
                            className="mt-1 w-full rounded border px-3 py-2"
                        />
                    </label>
                ))}
                {err && <p className="sm:col-span-2 text-destructive">{err.message}</p>}
                <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">
                    Continue → Seat
                </button>
            </form>
        </div>
    );
}
