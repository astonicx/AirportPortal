import { useOutletContext } from "react-router-dom";

export default function AdminDashboard() {
    const { stats } = useOutletContext();
    if (!stats) return <p>Loading stats…</p>;
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.windows.map((w) => (
                <div key={w.window} className="rounded border p-4">
                    <div className="text-xs uppercase text-muted-foreground">{w.window}</div>
                    <div className="mt-1 text-2xl font-bold">{w.tickets}</div>
                    <div className="text-sm">${(w.grossCents / 100).toFixed(2)}</div>
                </div>
            ))}
        </div>
    );
}
