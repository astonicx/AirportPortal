import { useOutletContext } from "react-router-dom";

export default function AdminDashboard() {
    const { stats } = useOutletContext();
    if (!stats) return <p className="text-muted-foreground">Loading stats…</p>;
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {stats.windows.map((w) => (
                <div key={w.window} className="surface-card p-5">
                    <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {w.window}
                    </div>
                    <div className="mt-1 text-3xl font-bold">{w.tickets}</div>
                    <div className="mt-0.5 text-sm font-medium text-success">
                        ${(w.grossCents / 100).toFixed(2)}
                    </div>
                </div>
            ))}
        </div>
    );
}
