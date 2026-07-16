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
        // 555 is the BDPA upstream's "try again" signal — surface a friendly toast.
        if (res.status === 555) {
            window.dispatchEvent(
                new CustomEvent("toast", {
                    detail: {
                        title: "BDPA API hiccup",
                        description: "The flight service is busy — retrying…",
                        variant: "destructive",
                    },
                })
            );
        }
        // Immediate ban enforcement: if the server signals the account is banned,
        // broadcast a global event so the app can terminate the session and kick
        // the user out to /login on the very next interaction.
        if (res.status === 401 && data?.code === "ACCOUNT_BANNED") {
            window.dispatchEvent(
                new CustomEvent("auth:banned", {
                    detail: { reason: data?.reason || null },
                })
            );
        }
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
