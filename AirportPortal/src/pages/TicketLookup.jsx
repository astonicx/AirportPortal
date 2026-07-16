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
        <div className="animate-in-up mx-auto max-w-md space-y-6">
            <div className="space-y-1 text-center">
                <p className="page-eyebrow">Manage travel</p>
                <h1>Look up a ticket</h1>
                <p className="text-sm text-muted-foreground">
                    Enter the passenger last name and confirmation code from your booking.
                </p>
            </div>
            <form onSubmit={submit} className="form-card space-y-4">
                <label className="field-label">
                    Last name
                    <input
                        type="text" required value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="field-input"
                    />
                </label>
                <label className="field-label">
                    Confirmation code
                    <input
                        type="text" required value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g. AB12CD"
                        className="field-input font-mono tracking-wider"
                    />
                </label>
                <button className="btn-primary w-full">Find ticket</button>
            </form>
        </div>
    );
}
