import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

export default function Checkin() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const initialCode = params.get("code") || "";
    const initialLast = params.get("last") || "";

    const [code, setCode] = useState(initialCode);
    const [lastName, setLastName] = useState(initialLast);
    const [result, setResult] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);

    const canSubmit = useMemo(() => code.trim() && lastName.trim(), [code, lastName]);

    const lookup = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setErr(null);
        try {
            const data = await api.get(
                `/api/tickets/by-confirmation?lastName=${encodeURIComponent(lastName.trim())}&code=${encodeURIComponent(code.trim())}`
            );
            setResult(data);
        } catch (error) {
            setErr(error);
            setResult(null);
        } finally {
            setBusy(false);
        }
    };

    const checkInNow = async () => {
        if (!result?.ticket?.id) return;
        setCheckingIn(true);
        setErr(null);
        try {
            await api.post(`/api/tickets/${result.ticket.id}/checkin`, {
                lastName: lastName.trim(),
            });
            const nextUrl = `/ticket/${encodeURIComponent(code.trim())}?last=${encodeURIComponent(lastName.trim())}`;
            navigate(nextUrl, { replace: true });
        } catch (error) {
            setErr(error);
        } finally {
            setCheckingIn(false);
        }
    };

    return (
        <div className="animate-in-up mx-auto max-w-xl space-y-5">
            <div className="space-y-1">
                <p className="page-eyebrow">Ticket Check-in</p>
                <h1>Check in to your flight</h1>
            </div>

            <form onSubmit={lookup} className="form-card space-y-4">
                <label className="block text-sm">
                    Confirmation code
                    <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="field-input"
                    />
                </label>
                <label className="block text-sm">
                    Passenger last name
                    <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="field-input"
                    />
                </label>
                <button
                    disabled={!canSubmit || busy}
                    className="btn-primary w-full disabled:opacity-60"
                >
                    {busy ? "Looking up…" : "Find ticket"}
                </button>
            </form>

            {err && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {err.data?.error || err.message}
                </p>
            )}

            {result?.ticket && (
                <div className="surface-card space-y-3 p-5 text-sm">
                    <p>
                        <span className="text-muted-foreground">Passenger:</span>{" "}
                        <span className="font-medium">
                            {result.ticket.passenger_first} {result.ticket.passenger_last}
                        </span>
                    </p>
                    <p>
                        <span className="text-muted-foreground">Flight:</span>{" "}
                        <span className="font-medium">
                            {result.flight?.airline} {result.flight?.flightNumber}
                        </span>
                    </p>
                    {!result.checkin_eligible && (
                        <p className="text-muted-foreground">
                            Check-in is not currently available.
                            {result.available_at ? ` Available at ${new Date(result.available_at).toLocaleString("en-US")}.` : ""}
                        </p>
                    )}
                    {!!result.checked_in_at && (
                        <p className="text-success">
                            Already checked in at {new Date(result.checked_in_at).toLocaleString("en-US")}.
                        </p>
                    )}
                    {result.checkin_eligible && !result.checked_in_at && (
                        <button
                            onClick={checkInNow}
                            disabled={checkingIn}
                            className="btn-primary"
                        >
                            {checkingIn ? "Checking in…" : "Check in now"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
