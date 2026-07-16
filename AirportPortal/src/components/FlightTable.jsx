import { Link } from "react-router-dom";
import { statusPillClass } from "@/lib/flightStatus";

const COLUMNS = [
    { key: "flightNumber", label: "Flight" },
    { key: "airline", label: "Airline" },
    { key: "from", label: "From", sortable: false },
    { key: "to", label: "To", sortable: false },
    { key: "time", label: "Time" },
    { key: "gate", label: "Gate" },
    { key: "status", label: "Status", sortable: false },
];

// Desktop / tablet table view with clickable, sortable column headers.
export default function FlightTable({ items, sortBy, sortDir, onSort }) {
    const indicator = (key) =>
        sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

    return (
        <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        {COLUMNS.map((c) => (
                            <th key={c.key} className="px-4 py-3 text-left font-semibold">
                                {c.sortable === false ? (
                                    c.label
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onSort(c.key)}
                                        className="font-semibold uppercase tracking-wide underline-offset-2 hover:text-foreground hover:underline"
                                        aria-label={`Sort by ${c.label}`}
                                    >
                                        {c.label}
                                        {indicator(c.key)}
                                    </button>
                                )}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-left font-semibold">Bookable</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((f) => (
                        <tr
                            key={f.flight_id || f.id}
                            className="border-b transition-colors even:bg-muted/30 hover:bg-primary/5"
                        >
                            <td className="px-4 py-3 font-semibold">{f.flightNumber}</td>
                            <td className="px-4 py-3">{f.airline}</td>
                            <td className="px-4 py-3">{f.from || "\u2014"}</td>
                            <td className="px-4 py-3">{f.to || "\u2014"}</td>
                            <td className="px-4 py-3">{f.time}</td>
                            <td className="px-4 py-3">{f.gate || "\u2014"}</td>
                            <td className="px-4 py-3">
                                <span className={statusPillClass(f.status)}>{f.status}</span>
                            </td>
                            <td className="px-4 py-3">
                                {f.canBook ? (
                                    <span className="pill pill-success">Bookable</span>
                                ) : (
                                    <span className="pill bg-secondary text-muted-foreground">
                                        Not bookable
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <Link
                                    to={`/flights/${f.flight_id || f.id}`}
                                    className="font-medium text-primary hover:underline"
                                >
                                    Details →
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {!items.length && (
                        <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                No flights.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
