// Maps a flight status string to a status pill className.
// Falls back to a neutral (info) pill for unknown statuses.
export function statusPillClass(status) {
    const s = String(status || "").toLowerCase();
    if (/(cancel|divert)/.test(s)) return "pill pill-danger";
    if (/(delay|late)/.test(s)) return "pill pill-warning";
    if (/(land|arriv|depart|board|complete|on ?time|scheduled|active)/.test(s))
        return "pill pill-success";
    return "pill pill-info";
}
