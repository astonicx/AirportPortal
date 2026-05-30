// Thin fetch wrapper that always sends cookies and raises an Error
// with .status and .data so callers can branch on either.
const BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
    const res = await fetch(BASE + path, {
        method,
        credentials: "include",
        signal,
        headers: { "Content-Type": "application/json", ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }
    if (!res.ok) {
        const err = new Error(data?.error || res.statusText || "Request failed");
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export const api = {
    get: (p, o) => request(p, { ...o, method: "GET" }),
    post: (p, body, o) => request(p, { ...o, method: "POST", body }),
    patch: (p, body, o) => request(p, { ...o, method: "PATCH", body }),
    put: (p, body, o) => request(p, { ...o, method: "PUT", body }),
    del: (p, o) => request(p, { ...o, method: "DELETE" }),
};
