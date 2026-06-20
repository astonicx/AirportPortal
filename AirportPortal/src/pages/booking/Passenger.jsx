import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useBooking } from "@/context/BookingContext";
import { useState } from "react";

const pad = (n) => String(n).padStart(2, "0");
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Split a stored YYYY-MM-DD dob back into its parts for the selects.
function splitDob(dob) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || "");
    return m
        ? { year: m[1], month: String(+m[2]), day: String(+m[3]) }
        : { year: "", month: "", day: "" };
}

export default function BookingPassenger() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [p, setP] = useState(booking.passenger || {
        first: "", middle: "", last: "", dob: "", gender: "",
        email: "", phone: "",
    });
    const [bd, setBd] = useState(splitDob(p.dob));
    const [err, setErr] = useState(null);

    useEffect(() => {
        if (!booking.flight || booking.flightId !== id) {
            api.get(`/api/flights/${id}`)
                .then((f) => update({ flight: f, flightId: id }))
                .catch((e) => setErr(e));
        }
    }, [id, booking, update]);

    const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
    const setBdPart = (k) => (e) => setBd({ ...bd, [k]: e.target.value });

    const now = new Date();
    const years = Array.from({ length: 120 }, (_, i) => now.getFullYear() - i);
    const daysInMonth =
        bd.year && bd.month ? new Date(+bd.year, +bd.month, 0).getDate() : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const submit = async (e) => {
        e.preventDefault();
        setErr(null);
        if (!bd.year || !bd.month || !bd.day) {
            setErr({ message: "Please provide a complete birthday." });
            return;
        }
        const dob = `${bd.year}-${pad(+bd.month)}-${pad(+bd.day)}`;
        const passenger = { ...p, dob };
        try {
            const r = await api.post("/api/no-fly/check", passenger);
            if (r.blocked) {
                setErr({ message: "Passenger appears on the No Fly List." });
                return;
            }
            update({ passenger });
            navigate(`/book/${id}/seat`);
        } catch (e) { setErr(e); }
    };

    return (
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="text-xl font-bold">Passenger</h1>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                    ["First", "first", true], ["Middle", "middle"], ["Last", "last", true],
                    ["Gender", "gender", true],
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
                <fieldset className="sm:col-span-2 space-y-1">
                    <legend className="text-sm">
                        Birthday<span className="text-destructive"> *</span>
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                        <select
                            value={bd.month}
                            onChange={setBdPart("month")}
                            required
                            className="rounded border px-3 py-2"
                        >
                            <option value="">Month</option>
                            {MONTHS.map((m, i) => (
                                <option key={m} value={i + 1}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={bd.day}
                            onChange={setBdPart("day")}
                            required
                            className="rounded border px-3 py-2"
                        >
                            <option value="">Day</option>
                            {days.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                            value={bd.year}
                            onChange={setBdPart("year")}
                            required
                            className="rounded border px-3 py-2"
                        >
                            <option value="">Year</option>
                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </fieldset>
                {err && <p className="sm:col-span-2 text-destructive">{err.message}</p>}
                <button className="sm:col-span-2 rounded bg-milwaukeeBlue px-4 py-2 text-white">
                    Continue → Seat
                </button>
            </form>
        </div>
    );
}
