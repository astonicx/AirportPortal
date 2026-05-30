import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TicketLookup() {
    const navigate = useNavigate();
    const [lastName, setLastName] = useState("");
    const [code, setCode] = useState("");

    const submit = (e) => {
        e.preventDefault();
        navigate(`/tickets/${encodeURIComponent(code)}?last=${encodeURIComponent(lastName)}`);
    };

    return (
        <div className="mx-auto max-w-md space-y-4">
            <h1 className="text-2xl font-bold">Look up a ticket</h1>
            <form onSubmit={submit} className="space-y-3">
                <label className="block text-sm">
                    Last name
                    <input
                        type="text" required value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2"
                    />
                </label>
                <label className="block text-sm">
                    Confirmation code
                    <input
                        type="text" required value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded border px-3 py-2"
                    />
                </label>
                <button className="w-full rounded bg-milwaukeeBlue px-4 py-2 text-white">
                    Find ticket
                </button>
            </form>
        </div>
    );
}
