import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { statusPillClass } from "@/lib/flightStatus";

const TABS = [
    { key: "flights", label: "Flights" },
    { key: "customers", label: "Customers" },
    { key: "tickets", label: "Tickets" },
    { key: "create", label: "Create ticket" },
];

const EMPTY_TICKET = {
    flightId: "",
    passenger: { first: "", last: "", dob: "", gender: "", email: "", phone: "" },
    seat: "",
    seatClass: "",
    carryOnCount: 0,
    checkedCount: 0,
};

export default function AttendantDashboard() {
    const [tab, setTab] = useState("flights");

    return (
        <div className="animate-in-up space-y-6">
            <header className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="pill pill-info">Attendant</span>
                    <h1>Attendant dashboard</h1>
                </div>
                <nav className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card p-1 text-sm shadow-card">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${tab === t.key
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </header>

            {tab === "flights" && <FlightsPanel />}
            {tab === "customers" && <CustomersPanel />}
            {tab === "tickets" && <TicketsPanel />}
            {tab === "create" && <CreateTicketPanel onCreated={() => setTab("tickets")} />}
        </div>
    );
}

function SearchInput({ value, onChange, placeholder }) {
    return (
        <div className="relative w-full max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                🔍
            </span>
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
        </div>
    );
}

function FlightsPanel() {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [err, setErr] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => {
            api
                .get(`/api/attendant/flights?q=${encodeURIComponent(q)}`)
                .then((d) => setRows(d.items || []))
                .catch(setErr);
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <section className="space-y-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search flights…" />
            {err && <p className="text-destructive">{err.data?.error || err.message}</p>}
            <div className="surface-card overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3 text-left font-semibold">Flight</th>
                            <th className="px-4 py-3 text-left font-semibold">From</th>
                            <th className="px-4 py-3 text-left font-semibold">To</th>
                            <th className="px-4 py-3 text-left font-semibold">Time</th>
                            <th className="px-4 py-3 text-left font-semibold">Gate</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((f) => (
                            <tr
                                key={f.flight_id}
                                className="border-b transition-colors even:bg-muted/30 hover:bg-primary/5"
                            >
                                <td className="px-4 py-3 font-semibold">
                                    {f.airline} {f.flightNumber}
                                </td>
                                <td className="px-4 py-3">{f.from || "—"}</td>
                                <td className="px-4 py-3">{f.to || "—"}</td>
                                <td className="px-4 py-3">{f.time}</td>
                                <td className="px-4 py-3">{f.gate || "—"}</td>
                                <td className="px-4 py-3">
                                    <span className={statusPillClass(f.status)}>{f.status}</span>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    No flights for your airline.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function CustomersPanel() {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [err, setErr] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => {
            api
                .get(`/api/attendant/customers?q=${encodeURIComponent(q)}`)
                .then(setRows)
                .catch(setErr);
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <section className="space-y-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search customers…" />
            {err && <p className="text-destructive">{err.data?.error || err.message}</p>}
            <ul className="surface-card divide-y divide-border/70 overflow-hidden">
                {rows.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                            <p className="truncate font-semibold">
                                {c.first_name} {c.last_name}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                                {c.email} · {c.phone || "no phone"}
                            </p>
                        </div>
                        <span className="pill pill-info shrink-0">
                            {c.ticket_count} ticket{c.ticket_count === 1 ? "" : "s"}
                        </span>
                    </li>
                ))}
                {!rows.length && (
                    <li className="p-6 text-center text-muted-foreground">
                        No customers found for your airline.
                    </li>
                )}
            </ul>
        </section>
    );
}

function TicketsPanel() {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [err, setErr] = useState(null);
    const [detail, setDetail] = useState(null);

    const load = () => {
        api
            .get(`/api/attendant/tickets?q=${encodeURIComponent(q)}`)
            .then(setRows)
            .catch(setErr);
    };
    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [q]);

    const view = async (id) => {
        try {
            const d = await api.get(`/api/attendant/tickets/${id}`);
            setDetail(d);
        } catch (e) {
            setErr(e);
        }
    };

    const cancel = async (id) => {
        if (!confirm("Cancel this ticket?")) return;
        await api.post(`/api/attendant/tickets/${id}/cancel`, {});
        setDetail(null);
        load();
    };

    return (
        <section className="space-y-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search tickets…" />
            {err && <p className="text-destructive">{err.data?.error || err.message}</p>}
            <div className="surface-card overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3 text-left font-semibold">Confirmation</th>
                            <th className="px-4 py-3 text-left font-semibold">Passenger</th>
                            <th className="px-4 py-3 text-left font-semibold">Flight</th>
                            <th className="px-4 py-3 text-left font-semibold">Seat</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((t) => (
                            <tr
                                key={t.id}
                                className="border-b transition-colors even:bg-muted/30 hover:bg-primary/5"
                            >
                                <td className="px-4 py-3 font-mono">{t.confirmation_code}</td>
                                <td className="px-4 py-3">
                                    {t.passenger_first} {t.passenger_last}
                                </td>
                                <td className="px-4 py-3">
                                    {t.flight?.airline} {t.flight?.flightNumber || t.flight_id}
                                </td>
                                <td className="px-4 py-3">{t.seat}</td>
                                <td className="px-4 py-3">
                                    {t.status === "cancelled" ? (
                                        <span className="pill pill-danger">cancelled</span>
                                    ) : (
                                        <span className="pill pill-success">{t.status}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => view(t.id)}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    No tickets found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md space-y-4 rounded-xl bg-background p-6 shadow-elevated">
                        <div className="flex items-center justify-between">
                            <h3>Ticket {detail.ticket.confirmation_code}</h3>
                            <button
                                onClick={() => setDetail(null)}
                                className="text-muted-foreground underline"
                            >
                                Close
                            </button>
                        </div>
                        <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                            <dt className="text-muted-foreground">Passenger</dt>
                            <dd className="text-right font-medium">
                                {detail.ticket.passenger_first} {detail.ticket.passenger_last}
                            </dd>
                            <dt className="text-muted-foreground">Flight</dt>
                            <dd className="text-right font-medium">
                                {detail.flight?.airline} {detail.flight?.flightNumber || detail.ticket.flight_id}
                            </dd>
                            <dt className="text-muted-foreground">Seat</dt>
                            <dd className="text-right font-medium">{detail.ticket.seat}</dd>
                            <dt className="text-muted-foreground">Status</dt>
                            <dd className="text-right font-medium">{detail.ticket.status}</dd>
                            <dt className="text-muted-foreground">Total</dt>
                            <dd className="text-right font-medium">
                                ${((detail.ticket.total_cents || 0) / 100).toFixed(2)}
                            </dd>
                        </dl>
                        {detail.ticket.status !== "cancelled" && (
                            <button
                                onClick={() => cancel(detail.ticket.id)}
                                className="w-full rounded-lg bg-destructive px-4 py-2 font-semibold text-destructive-foreground transition-all hover:brightness-110"
                            >
                                Cancel ticket
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

function CreateTicketPanel({ onCreated }) {
    const [form, setForm] = useState(EMPTY_TICKET);
    const [err, setErr] = useState(null);
    const [ok, setOk] = useState(null);
    const [busy, setBusy] = useState(false);

    const setP = (k) => (e) =>
        setForm((f) => ({ ...f, passenger: { ...f.passenger, [k]: e.target.value } }));

    const submit = async (e) => {
        e.preventDefault();
        setErr(null);
        setOk(null);
        setBusy(true);
        try {
            const res = await api.post("/api/attendant/tickets", {
                ...form,
                carryOnCount: Number(form.carryOnCount) || 0,
                checkedCount: Number(form.checkedCount) || 0,
            });
            setOk(res);
            setForm(EMPTY_TICKET);
        } catch (e2) {
            setErr(e2);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="max-w-2xl space-y-3">
            <form onSubmit={submit} className="surface-card grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
                <label className="block text-sm font-medium sm:col-span-2">
                    Flight ID
                    <input
                        required
                        value={form.flightId}
                        onChange={(e) => setForm({ ...form, flightId: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                    />
                </label>
                {[
                    ["First name", "first", true],
                    ["Last name", "last", true],
                    ["Date of birth (YYYY-MM-DD)", "dob", true],
                    ["Gender", "gender", true],
                    ["Email", "email", true],
                    ["Phone", "phone", true],
                ].map(([label, key, req]) => (
                    <label key={key} className="block text-sm font-medium">
                        {label}
                        <input
                            required={req}
                            value={form.passenger[key]}
                            onChange={setP(key)}
                            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                        />
                    </label>
                ))}
                <label className="block text-sm font-medium">
                    Seat
                    <input
                        required
                        value={form.seat}
                        onChange={(e) => setForm({ ...form, seat: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                    />
                </label>
                <label className="block text-sm font-medium">
                    Seat class
                    <input
                        value={form.seatClass}
                        onChange={(e) => setForm({ ...form, seatClass: e.target.value })}
                        placeholder="economy"
                        className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                    />
                </label>
                <label className="block text-sm font-medium">
                    Carry-on bags
                    <input
                        type="number"
                        min={0}
                        max={2}
                        value={form.carryOnCount}
                        onChange={(e) => setForm({ ...form, carryOnCount: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                    />
                </label>
                <label className="block text-sm font-medium">
                    Checked bags
                    <input
                        type="number"
                        min={0}
                        max={5}
                        value={form.checkedCount}
                        onChange={(e) => setForm({ ...form, checkedCount: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                    />
                </label>
                {err && (
                    <p className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {err.data?.error || err.message}
                    </p>
                )}
                {ok && (
                    <p className="sm:col-span-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                        Ticket created — confirmation {ok.confirmationCode} · $
                        {((ok.totalCents || 0) / 100).toFixed(2)}
                    </p>
                )}
                <div className="flex gap-2 sm:col-span-2">
                    <button
                        type="submit"
                        disabled={busy}
                        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-60"
                    >
                        {busy && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                        {busy ? "Creating…" : "Create ticket"}
                    </button>
                    {ok && (
                        <button
                            type="button"
                            onClick={onCreated}
                            className="rounded-lg border border-border px-4 py-2.5 font-medium transition-colors hover:bg-secondary"
                        >
                            View tickets
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}
