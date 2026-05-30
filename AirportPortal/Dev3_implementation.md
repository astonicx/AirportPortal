# Dev 3 — Frontend, Dashboards & UX Implementation Guide

> Copy-paste ready. Every fetch hits the Express backend at `VITE_API_BASE_URL` (default `http://localhost:5000`). Passwords are sent **as plain strings** to `/api/auth/*` over HTTPS — the browser **never** hashes anything. Hashing is the server's job (Dev 1, argon2id).

---

## Step 1 — App shell & routing (Task 5)

### 1a. Install
```bash
npm install react-router-dom
```

### 1b. `src/lib/api.js`
```js
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText);
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}
export const api = {
  get:    (p)        => request("GET",    p),
  post:   (p, body)  => request("POST",   p, body),
  patch:  (p, body)  => request("PATCH",  p, body),
  del:    (p)        => request("DELETE", p),
};
```

### 1c. `src/components/layout/Layout.jsx`
```jsx
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <nav className="container mx-auto flex items-center justify-between p-4">
          <Link to="/" className="font-bold">BDPA Airports</Link>
          <div className="flex gap-4 items-center">
            <Link to="/flights">Flights</Link>
            <Link to="/ticket-lookup">Find Ticket</Link>
            {user ? (
              <>
                <Link to={user.type === "customer" ? "/dashboard" : "/admin"}>
                  {user.firstName}
                </Link>
                <button onClick={logout} className="underline">Logout</button>
              </>
            ) : (
              <><Link to="/login">Login</Link><Link to="/signup">Sign up</Link></>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1 container mx-auto p-4"><Outlet /></main>
      <footer className="border-t p-4 text-center text-sm text-muted-foreground">
        © BDPA Airports
      </footer>
    </div>
  );
}
```

### 1d. Replace `src/App.jsx`
```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { AuthProvider } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";

import Home from "@/pages/Home";
import Flights from "@/pages/Flights";
import FlightDetail from "@/pages/FlightDetail";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Recover from "@/pages/Recover";
import TicketLookup from "@/pages/TicketLookup";
import Ticket from "@/pages/Ticket";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import CompleteProfile from "@/pages/CompleteProfile";
import Passenger from "@/pages/Booking/Passenger";
import Payment from "@/pages/Booking/Payment";
import SeatMap from "@/pages/Booking/SeatMap";
import Bags from "@/pages/Booking/Bags";
import Review from "@/pages/Booking/Review";
import AdminDashboard from "@/pages/Admin/Dashboard";
import AdminCustomers from "@/pages/Admin/Customers";
import AdminTickets from "@/pages/Admin/Tickets";
import AdminAdmins from "@/pages/Admin/Admins";
import { RequireAuth, RequireAdmin, RequireRoot } from "@/components/Guards";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/flights" element={<Flights />} />
              <Route path="/flights/:id" element={<FlightDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/recover" element={<Recover />} />
              <Route path="/ticket-lookup" element={<TicketLookup />} />
              <Route path="/ticket/:confirmation" element={<Ticket />} />
              <Route path="/complete-profile" element={<RequireAuth><CompleteProfile /></RequireAuth>} />

              <Route path="/book/:flightId" element={<RequireAuth><Passenger /></RequireAuth>} />
              <Route path="/book/:flightId/payment"  element={<RequireAuth><Payment /></RequireAuth>} />
              <Route path="/book/:flightId/seat"     element={<RequireAuth><SeatMap /></RequireAuth>} />
              <Route path="/book/:flightId/bags"     element={<RequireAuth><Bags /></RequireAuth>} />
              <Route path="/book/:flightId/review"   element={<RequireAuth><Review /></RequireAuth>} />

              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/dashboard/settings" element={<RequireAuth><Settings /></RequireAuth>} />

              <Route path="/admin"          element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
              <Route path="/admin/customers"element={<RequireAdmin><AdminCustomers /></RequireAdmin>} />
              <Route path="/admin/tickets"  element={<RequireAdmin><AdminTickets /></RequireAdmin>} />
              <Route path="/admin/admins"   element={<RequireRoot><AdminAdmins /></RequireRoot>} />

              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

## Step 2 — Tailwind theme & base (Task 6)

### 2a. Update `tailwind.config.cjs`
```js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        brand: { DEFAULT: "#0ea5e9", dark: "#075985" },
      },
      screens: { xs: "320px", sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### 2b. Append to `src/index.css`
```css
@layer base {
  *:focus-visible { @apply outline-none ring-2 ring-brand ring-offset-2; }
  body { @apply text-slate-900 bg-slate-50 antialiased; }
  h1 { @apply text-3xl font-bold; }
  h2 { @apply text-2xl font-semibold; }
}
```

---

## Step 3 — `useLiveResource` polling hook (Task 20)

### 3a. `src/hooks/useLiveResource.js`
```js
import { useEffect, useRef, useState } from "react";

export function useLiveResource(key, fetcher, intervalMs = 15000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        const res = await fetcher();
        if (cancelled) return;
        const json = JSON.stringify(res);
        if (lastRef.current && lastRef.current !== json) {
          // payload changed — emit toast if available
          window.dispatchEvent(new CustomEvent("toast", { detail: { message: "Updated", kind: "info" } }));
        }
        lastRef.current = json;
        setData(res); setError(null);
      } catch (e) { if (!cancelled) setError(e); }
      finally     { if (!cancelled) setLoading(false); }
    }
    function schedule() {
      if (document.visibilityState === "visible") {
        tick();
        timer = setTimeout(schedule, intervalMs);
      } else {
        timer = setTimeout(schedule, intervalMs);
      }
    }
    schedule();
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [key]); // eslint-disable-line

  return { data, error, loading };
}
```

---

## Step 4 — Error boundary + spinner + toast surface (Task 40)

### 4a. `src/components/Spinner.jsx`
```jsx
export default function Spinner({ size = 24 }) {
  return (
    <div role="status" aria-live="polite"
         className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent"
         style={{ width: size, height: size }} />
  );
}
```

### 4b. `src/components/ErrorBoundary.jsx`
```jsx
import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UI error", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <h1>Something broke.</h1>
          <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
          <button className="mt-4 underline" onClick={() => location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 4c. Global toast listener — add inside `Layout.jsx` (above `<Outlet/>`):
```jsx
import { useEffect, useState } from "react";
// ...inside Layout component:
const [toasts, setToasts] = useState([]);
useEffect(() => {
  const onToast = (e) => {
    const id = Math.random();
    setToasts(t => [...t, { id, ...e.detail }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  window.addEventListener("toast", onToast);
  return () => window.removeEventListener("toast", onToast);
}, []);
// then render:
// <div className="fixed bottom-4 right-4 space-y-2 z-50">
//   {toasts.map(t => <div key={t.id} className="bg-slate-900 text-white px-4 py-2 rounded">{t.message}</div>)}
// </div>
```

---

## Step 5 — Auth context + guards + auto-logout (Task 15)

### 5a. `src/context/AuthContext.jsx`
```jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try { setUser(await api.get("/api/auth/me")); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function login(payload) {
    const res = await api.post("/api/auth/login", payload);
    setUser(res.user);
    return res.user;
  }
  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
    navigate("/");
  }

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
```

### 5b. `src/components/Guards.jsx`
```jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Spinner from "@/components/Spinner";

function Gate({ ok, children }) {
  const { loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!ok) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

export function RequireAuth({ children }) {
  const { user } = useAuth();
  return <Gate ok={!!user}>{children}</Gate>;
}
export function RequireAdmin({ children }) {
  const { user } = useAuth();
  return <Gate ok={user && (user.type === "admin" || user.type === "root")}>{children}</Gate>;
}
export function RequireRoot({ children }) {
  const { user } = useAuth();
  return <Gate ok={user && user.type === "root"}>{children}</Gate>;
}
```

### 5c. `src/hooks/useAutoLogout.js`
```jsx
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export function useAutoLogout(minutes, enabled = true) {
  const { logout } = useAuth();
  useEffect(() => {
    if (!enabled || !minutes) return;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, minutes * 60_000); };
    ["mousemove","keydown","scroll","click"].forEach(e => window.addEventListener(e, reset));
    reset();
    return () => { clearTimeout(timer);
      ["mousemove","keydown","scroll","click"].forEach(e => window.removeEventListener(e, reset)); };
  }, [minutes, enabled, logout]);
}
```

---

## Step 6 — Login page (Task 12)

### `src/pages/Login.jsx`
```jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", disambiguator: "", rememberMe: false });
  const [needsDisamb, setNeedsDisamb] = useState(false);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null);

  async function onSubmit(e) {
    e.preventDefault(); setError(null);
    try {
      const user = await login(form);
      nav(user.type === "customer" ? "/dashboard" : "/admin", { replace: true });
    } catch (err) {
      if (err.status === 409 && err.data?.needsDisambiguator) { setNeedsDisamb(true); setError("Two users share that name. Enter your disambiguator."); }
      else if (err.status === 423) setLockedUntil(err.data?.lockedUntil);
      else { setAttempts(err.data?.attemptsRemaining ?? null); setError(err.message); }
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4">
      <h1>Log in</h1>
      <input className="border p-2 w-full" placeholder="First name" value={form.firstName}
             onChange={e => setForm({...form, firstName: e.target.value})} />
      <input className="border p-2 w-full" placeholder="Last name" value={form.lastName}
             onChange={e => setForm({...form, lastName: e.target.value})} />
      {needsDisamb && (
        <input className="border p-2 w-full" placeholder="Disambiguator (assigned at signup)"
               value={form.disambiguator}
               onChange={e => setForm({...form, disambiguator: e.target.value})} />
      )}
      <input type="password" className="border p-2 w-full" placeholder="Password"
             value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
      <label className="flex gap-2 items-center">
        <input type="checkbox" checked={form.rememberMe}
               onChange={e => setForm({...form, rememberMe: e.target.checked})} />
        Remember me
      </label>
      {error && <p className="text-red-600">{error}</p>}
      {attempts !== null && <p className="text-amber-700">Attempts remaining: {attempts}</p>}
      {lockedUntil && <p className="text-red-700">Locked until {new Date(lockedUntil).toLocaleString()}</p>}
      <button className="bg-brand text-white px-4 py-2 rounded">Log in</button>
      <div className="text-sm">
        <Link to="/signup" className="underline mr-4">Sign up</Link>
        <Link to="/recover" className="underline">Forgot password?</Link>
      </div>
    </form>
  );
}
```

---

## Step 7 — Signup page + CAPTCHA + strength meter (Task 13)

### 7a. `src/components/PasswordStrengthMeter.jsx`
```jsx
export function strength(pw) {
  const len = pw.length;
  if (len <= 10) return { level: "weak",   score: 0, label: "Too short" };
  if (len >= 18) return { level: "strong", score: 2, label: "Strong" };
  return { level: "medium", score: 1, label: "OK" };
}
export default function PasswordStrengthMeter({ password }) {
  const s = strength(password || "");
  const colors = ["bg-red-500","bg-amber-500","bg-emerald-500"];
  return (
    <div>
      <div className="h-2 w-full bg-slate-200 rounded">
        <div className={`h-2 rounded ${colors[s.score]}`} style={{ width: `${(s.score+1)*33}%` }} />
      </div>
      <p className="text-xs mt-1">{s.label}</p>
    </div>
  );
}
```

### 7b. `src/components/Captcha.jsx`
```jsx
import { useState, useEffect } from "react";
export default function Captcha({ value, onChange, onExpectedChange }) {
  const [a, setA] = useState(0); const [b, setB] = useState(0);
  function refresh() { const x = Math.floor(Math.random()*9)+1, y = Math.floor(Math.random()*9)+1;
    setA(x); setB(y); onExpectedChange(String(x+y)); }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="flex gap-2 items-center">
      <span>{a} + {b} =</span>
      <input className="border p-2 w-20" value={value} onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={refresh} className="underline text-sm">refresh</button>
    </div>
  );
}
```

### 7c. `src/pages/Signup.jsx`
```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PasswordStrengthMeter, { strength } from "@/components/PasswordStrengthMeter";
import Captcha from "@/components/Captcha";

const empty = {
  title: "", first_name: "", middle_name: "", last_name: "", suffix: "",
  dob: "", gender: "", address1: "", city: "", state: "", zip: "", country: "",
  phone: "", email: "", password: "",
};

export default function Signup() {
  const [f, setF] = useState(empty);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaExpected, setCaptchaExpected] = useState("");
  const [questions, setQuestions] = useState([{question:"",answer:""},{question:"",answer:""},{question:"",answer:""}]);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const update = k => e => setF({...f, [k]: e.target.value});
  const s = strength(f.password);

  async function onSubmit(e) {
    e.preventDefault(); setError(null);
    if (!s || s.level === "weak") { setError("Password too weak (must be more than 10 characters)."); return; }
    try {
      const res = await api.post("/api/auth/signup", {
        ...f, captchaAnswer, captchaExpected, securityQuestions: questions,
      });
      setDone(res);
    } catch (err) { setError(err.message); }
  }

  if (done) return (
    <div className="max-w-md mx-auto space-y-4">
      <h1>Account created!</h1>
      {done.disambiguator && <p>Your name was taken; your login disambiguator is <strong>{done.disambiguator}</strong>. Save it.</p>}
      <Link to="/login" className="underline">Continue to login →</Link>
    </div>
  );

  const text = (k, label, required) => (
    <label className="block">
      <span>{label}{required && " *"}</span>
      <input required={required} className="border p-2 w-full" value={f[k]} onChange={update(k)} />
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-4">
      <h1>Sign up</h1>
      {text("first_name","First name",true)}
      {text("middle_name","Middle name",false)}
      {text("last_name","Last name",true)}
      <label className="block"><span>DOB *</span>
        <input type="date" required className="border p-2 w-full" value={f.dob} onChange={update("dob")} /></label>
      <label className="block"><span>Gender *</span>
        <select required className="border p-2 w-full" value={f.gender} onChange={update("gender")}>
          <option value="">…</option><option>male</option><option>female</option><option>other</option>
        </select></label>
      {text("address1","Address",true)}{text("city","City",true)}{text("state","State",true)}
      {text("zip","ZIP",true)}{text("country","Country",true)}
      {text("phone","Phone",true)}{text("email","Email",true)}
      <label className="block">
        <span>Password *</span>
        <input type="password" required className="border p-2 w-full" value={f.password} onChange={update("password")} />
        <PasswordStrengthMeter password={f.password} />
      </label>

      <fieldset className="border p-3">
        <legend>Security questions (≥3)</legend>
        {questions.map((q, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mt-2">
            <input className="border p-2" placeholder="Question" value={q.question}
                   onChange={e => setQuestions(qs => qs.map((x,j) => j===i ? {...x, question:e.target.value} : x))} />
            <input className="border p-2" placeholder="Answer" value={q.answer}
                   onChange={e => setQuestions(qs => qs.map((x,j) => j===i ? {...x, answer:e.target.value} : x))} />
          </div>
        ))}
        <button type="button" className="mt-2 underline" onClick={() => setQuestions(q => [...q, {question:"",answer:""}])}>+ add</button>
        {questions.length > 3 && (
          <button type="button" className="ml-4 underline" onClick={() => setQuestions(q => q.slice(0,-1))}>– remove</button>
        )}
      </fieldset>

      <Captcha value={captchaAnswer} onChange={setCaptchaAnswer} onExpectedChange={setCaptchaExpected} />

      {error && <p className="text-red-600">{error}</p>}
      <button className="bg-brand text-white px-4 py-2 rounded">Create account</button>
    </form>
  );
}
```

---

## Step 8 — Recover page (Task 14)

### `src/pages/Recover.jsx`
```jsx
import { useState } from "react";
import { api } from "@/lib/api";
import PasswordStrengthMeter, { strength } from "@/components/PasswordStrengthMeter";

export default function Recover() {
  const [step, setStep] = useState(1);
  const [identify, setIdentify] = useState({ firstName: "", lastName: "", dob: "" });
  const [userId, setUserId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [resetToken, setResetToken] = useState(null);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(null);

  async function doInit(e) {
    e.preventDefault(); setMsg(null);
    try {
      const r = await api.post("/api/auth/recover/init", identify);
      setUserId(r.userId); setQuestions(r.questions); setAnswers(r.questions.map(() => "")); setStep(2);
    } catch { setMsg("If your details match, you'll proceed."); }
  }
  async function doAnswer(e) {
    e.preventDefault(); setMsg(null);
    try { const r = await api.post("/api/auth/recover/answer", { userId, answers }); setResetToken(r.resetToken); setStep(3); }
    catch { setMsg("Something didn't match."); }
  }
  async function doReset(e) {
    e.preventDefault(); setMsg(null);
    if (strength(pw).level === "weak") return setMsg("Password too weak.");
    try { await api.post("/api/auth/recover/reset", { resetToken, password: pw }); setMsg("Password reset. You may log in."); setStep(4); }
    catch (err) { setMsg(err.message); }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1>Recover password</h1>
      {step === 1 && (
        <form onSubmit={doInit} className="space-y-2">
          <input className="border p-2 w-full" placeholder="First name" onChange={e=>setIdentify({...identify,firstName:e.target.value})}/>
          <input className="border p-2 w-full" placeholder="Last name"  onChange={e=>setIdentify({...identify,lastName:e.target.value})}/>
          <input type="date" className="border p-2 w-full" onChange={e=>setIdentify({...identify,dob:e.target.value})}/>
          <button className="bg-brand text-white px-4 py-2 rounded">Continue</button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={doAnswer} className="space-y-2">
          {questions.map((q,i) => (
            <label key={i} className="block">{q}
              <input className="border p-2 w-full" value={answers[i]}
                     onChange={e => setAnswers(a => a.map((x,j) => j===i ? e.target.value : x))} />
            </label>
          ))}
          <button className="bg-brand text-white px-4 py-2 rounded">Verify</button>
        </form>
      )}
      {step === 3 && (
        <form onSubmit={doReset} className="space-y-2">
          <input type="password" className="border p-2 w-full" placeholder="New password"
                 value={pw} onChange={e => setPw(e.target.value)} />
          <PasswordStrengthMeter password={pw} />
          <button className="bg-brand text-white px-4 py-2 rounded">Reset</button>
        </form>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
```

---

## Step 9 — Flights view + detail (Tasks 18, 19)

### 9a. `src/components/FlightTable.jsx`
```jsx
import { Link } from "react-router-dom";
export default function FlightTable({ items, sortBy, sortDir, onSort }) {
  const cols = [
    ["flightNumber","Flight"], ["airline","Airline"], ["airport","Airport"],
    ["city","City"], ["time","Time"], ["gate","Gate"], ["status","Status"]
  ];
  return (
    <table className="w-full hidden md:table">
      <thead><tr>{cols.map(([k,l]) =>
        <th key={k} className="text-left p-2 cursor-pointer" onClick={() => onSort(k)}>
          {l} {sortBy===k && (sortDir==="asc"?"▲":"▼")}
        </th>)}<th></th></tr></thead>
      <tbody>{items.map(f => (
        <tr key={f.flight_id || f.id} className="border-t">
          <td className="p-2">{f.flightNumber}</td><td>{f.airline}</td>
          <td>{f.airport}</td><td>{f.city}</td><td>{f.time}</td><td>{f.gate}</td>
          <td><span className="px-2 py-1 rounded bg-slate-200 text-xs">{f.status}</span></td>
          <td><Link to={`/flights/${f.flight_id || f.id}`} className="underline">Details</Link></td>
        </tr>))}
      </tbody>
    </table>
  );
}
```

### 9b. `src/components/FlightCard.jsx`
```jsx
import { Link } from "react-router-dom";
export default function FlightCard({ f }) {
  return (
    <Link to={`/flights/${f.flight_id || f.id}`} className="md:hidden block border rounded p-3 mb-2">
      <div className="flex justify-between"><strong>{f.flightNumber}</strong><span>{f.status}</span></div>
      <div className="text-sm">{f.airline} · {f.airport} · {f.city}</div>
      <div className="text-sm">{f.time} {f.gate && `· gate ${f.gate}`}</div>
    </Link>
  );
}
```

### 9c. `src/pages/Flights.jsx`
```jsx
import { useState, useEffect, useMemo } from "react";
import { useLiveResource } from "@/hooks/useLiveResource";
import FlightTable from "@/components/FlightTable";
import FlightCard from "@/components/FlightCard";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function Flights() {
  const [type, setType] = useState("departure");
  const [q, setQ] = useState(""); const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState("time");
  const [sortDir, setSortDir] = useState("asc");

  const key = useMemo(() => `${type}|${dq}|${page}|${pageSize}|${sortBy}|${sortDir}`, [type,dq,page,pageSize,sortBy,sortDir]);
  const { data, loading } = useLiveResource(key,
    () => api.get(`/api/flights?type=${type}&q=${encodeURIComponent(dq)}&page=${page}&pageSize=${pageSize}&sortBy=${sortBy}&sortDir=${sortDir}`),
    30000);

  function onSort(k) { if (sortBy===k) setSortDir(d => d==="asc"?"desc":"asc"); else { setSortBy(k); setSortDir("asc"); } }

  return (
    <section>
      <h1>Flights</h1>
      <div className="flex gap-2 my-3">
        <button onClick={() => setType("departure")} className={`px-3 py-1 rounded ${type==="departure"?"bg-brand text-white":"bg-slate-200"}`}>Departures</button>
        <button onClick={() => setType("arrival")} className={`px-3 py-1 rounded ${type==="arrival"?"bg-brand text-white":"bg-slate-200"}`}>Arrivals</button>
        <input className="border p-2 ml-auto" placeholder="Search…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
      </div>
      {loading && !data && <Spinner />}
      {data && (
        <>
          <FlightTable items={data.items} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          <div className="md:hidden">{data.items.map(f => <FlightCard key={f.flight_id || f.id} f={f} />)}</div>
          <div className="flex gap-2 mt-3">
            <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 bg-slate-200 disabled:opacity-50">Prev</button>
            <span>Page {page} of {Math.max(1, Math.ceil(data.total/pageSize))}</span>
            <button disabled={page*pageSize >= data.total} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 bg-slate-200 disabled:opacity-50">Next</button>
          </div>
        </>
      )}
    </section>
  );
}
```

### 9d. `src/pages/FlightDetail.jsx`
```jsx
import { useParams, Link } from "react-router-dom";
import { useLiveResource } from "@/hooks/useLiveResource";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function FlightDetail() {
  const { id } = useParams();
  const { data: f, loading } = useLiveResource(id, () => api.get(`/api/flights/${id}`), 15000);
  if (loading) return <Spinner />;
  if (!f) return <p>Not found</p>;
  const bookable = f.bookable && f.status === "scheduled" &&
                   new Date(f.arriveAtReceiver).getTime() > Date.now() + 24*3600*1000;
  return (
    <article className="space-y-2">
      <h1>{f.airline} {f.flightNumber}</h1>
      <p>From {f.city} ({f.airport}) — {f.time}</p>
      <p>Status: {f.status} {f.gate && `· Gate ${f.gate}`}</p>
      {bookable
        ? <Link to={`/book/${f.flight_id || f.id}`} className="inline-block bg-brand text-white px-4 py-2 rounded">Book this flight</Link>
        : <p className="text-sm text-amber-700">Not bookable.</p>}
    </article>
  );
}
```

---

## Step 10 — Booking flow (Tasks 25, 26, 27)

### 10a. `src/context/BookingContext.jsx`
```jsx
import { createContext, useContext, useReducer } from "react";
const Ctx = createContext(null);
export const useBooking = () => useContext(Ctx);
const init = { passenger: {}, payment: {}, seat: null, carryOnCount: 0, checkedCount: 0 };

function reducer(s, a) {
  switch (a.type) {
    case "PATCH": return { ...s, ...a.payload };
    case "RESET": return init;
    default: return s;
  }
}
export function BookingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
```
Wrap the `/book` routes in `App.jsx` with `<BookingProvider>` (or use it page-local).

### 10b. `src/pages/Booking/Passenger.jsx`
```jsx
import { useNavigate, useParams } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";

export default function Passenger() {
  const { state, dispatch } = useBooking();
  const nav = useNavigate(); const { flightId } = useParams();
  const p = state.passenger;
  const set = k => e => dispatch({ type: "PATCH", payload: { passenger: { ...p, [k]: e.target.value } } });
  return (
    <form onSubmit={e => { e.preventDefault(); nav(`/book/${flightId}/payment`); }} className="max-w-md space-y-3">
      <h1>Passenger</h1>
      <input required placeholder="First" className="border p-2 w-full" value={p.first||""} onChange={set("first")} />
      <input placeholder="Middle" className="border p-2 w-full" value={p.middle||""} onChange={set("middle")} />
      <input required placeholder="Last" className="border p-2 w-full" value={p.last||""} onChange={set("last")} />
      <input required type="date" className="border p-2 w-full" value={p.dob||""} onChange={set("dob")} />
      <select required className="border p-2 w-full" value={p.gender||""} onChange={set("gender")}>
        <option value="">Gender…</option><option>male</option><option>female</option><option>other</option>
      </select>
      <input required type="email" placeholder="Email" className="border p-2 w-full" value={p.email||""} onChange={set("email")} />
      <input required placeholder="Phone" className="border p-2 w-full" value={p.phone||""} onChange={set("phone")} />
      <button className="bg-brand text-white px-4 py-2 rounded">Next</button>
    </form>
  );
}
```

### 10c. `src/pages/Booking/Payment.jsx`
```jsx
import { useNavigate, useParams } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import { useAuth } from "@/context/AuthContext";

export default function Payment() {
  const { user } = useAuth();
  const { state, dispatch } = useBooking();
  const nav = useNavigate(); const { flightId } = useParams();
  const p = state.payment;
  const set = k => e => dispatch({ type: "PATCH", payload: { payment: { ...p, [k]: e.target.value } } });
  return (
    <form onSubmit={e => { e.preventDefault(); nav(`/book/${flightId}/seat`); }} className="max-w-md space-y-3">
      <h1>Payment</h1>
      <p className="bg-amber-100 p-2 text-sm rounded">⚠️ Never enter real card data. This is a demo.</p>
      <input required inputMode="numeric" placeholder="Card number" className="border p-2 w-full"
             value={p.cardNumber||""} onChange={set("cardNumber")} />
      <div className="grid grid-cols-3 gap-2">
        <input required placeholder="MM" className="border p-2" value={p.expMonth||""}
               onChange={e => dispatch({type:"PATCH", payload:{payment:{...p, expMonth:Number(e.target.value)}}})} />
        <input required placeholder="YYYY" className="border p-2" value={p.expYear||""}
               onChange={e => dispatch({type:"PATCH", payload:{payment:{...p, expYear:Number(e.target.value)}}})} />
        <input required placeholder="CVC" className="border p-2" value={p.cvc||""} onChange={set("cvc")} />
      </div>
      <input required placeholder="Cardholder" className="border p-2 w-full" value={p.cardholder||""} onChange={set("cardholder")} />
      <input required placeholder="Billing address" className="border p-2 w-full" value={p.billingAddress||""} onChange={set("billingAddress")} />
      <input required placeholder="ZIP" className="border p-2 w-full" value={p.billingZip||""} onChange={set("billingZip")} />
      {user && (
        <label className="flex gap-2 items-center">
          <input type="checkbox" checked={!!p.saveCard}
                 onChange={e => dispatch({type:"PATCH", payload:{payment:{...p, saveCard:e.target.checked}}})} />
          Save card for later
        </label>
      )}
      <button className="bg-brand text-white px-4 py-2 rounded">Next</button>
    </form>
  );
}
```

### 10d. `src/pages/Booking/SeatMap.jsx`
```jsx
import { useParams, useNavigate } from "react-router-dom";
import { useLiveResource } from "@/hooks/useLiveResource";
import { api } from "@/lib/api";
import { useBooking } from "@/context/BookingContext";
import Spinner from "@/components/Spinner";

export default function SeatMap() {
  const { flightId } = useParams(); const nav = useNavigate();
  const { state, dispatch } = useBooking();
  const { data, loading } = useLiveResource(flightId, () => api.get(`/api/flights/${flightId}/seats`), 10000);

  async function pick(seat) {
    try { await api.post(`/api/flights/${flightId}/seats/lock`, { seat });
      dispatch({ type: "PATCH", payload: { seat } });
    } catch (e) { alert(e.message); }
  }

  if (loading) return <Spinner />;
  return (
    <section>
      <h1>Pick a seat</h1>
      <div className="grid grid-cols-6 gap-2 max-w-md">
        {data.seats.map(s => {
          const me = state.seat === s.seat;
          const cls = me ? "bg-brand text-white"
            : s.state==="taken" ? "bg-slate-400 cursor-not-allowed"
            : s.state==="locked"? "bg-amber-300 cursor-not-allowed"
            : "bg-emerald-200 hover:bg-emerald-300";
          return <button key={s.seat} disabled={s.state==="taken"||s.state==="locked"} onClick={() => pick(s.seat)}
            className={`p-2 rounded text-sm ${cls}`}>{s.seat}</button>;
        })}
      </div>
      <div className="mt-3 text-xs flex gap-3">
        <span>🟩 available</span><span>🟨 locked</span><span>⬜ taken</span><span>🟦 mine</span>
      </div>
      <button disabled={!state.seat} onClick={() => nav(`/book/${flightId}/bags`)} className="mt-4 bg-brand text-white px-4 py-2 rounded disabled:opacity-50">Next</button>
    </section>
  );
}
```

### 10e. `src/pages/Booking/Bags.jsx`
```jsx
import { useParams, useNavigate } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";

function bagFees(co, ch) {
  const c = co === 2 ? 30 : 0;
  let k = 0; if (ch === 2) k = 50; else if (ch >= 3) k = 50 + 100 * (ch - 2);
  return c + k;
}

export default function Bags() {
  const { state, dispatch } = useBooking();
  const { flightId } = useParams(); const nav = useNavigate();
  const fees = bagFees(state.carryOnCount, state.checkedCount);
  const set = k => v => dispatch({ type: "PATCH", payload: { [k]: v } });
  return (
    <section className="max-w-md space-y-4">
      <h1>Bags</h1>
      <div>
        <label>Carry-on (max 2)</label>
        <input type="number" min={0} max={2} className="border p-2 w-24"
               value={state.carryOnCount} onChange={e => set("carryOnCount")(Number(e.target.value))} />
      </div>
      <div>
        <label>Checked (max 5)</label>
        <input type="number" min={0} max={5} className="border p-2 w-24"
               value={state.checkedCount} onChange={e => set("checkedCount")(Number(e.target.value))} />
      </div>
      <p>Bag fees: <strong>${fees}</strong></p>
      <button onClick={() => nav(`/book/${flightId}/review`)} className="bg-brand text-white px-4 py-2 rounded">Next</button>
    </section>
  );
}
```

### 10f. `src/pages/Booking/Review.jsx`
```jsx
import { useParams, useNavigate } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import { api } from "@/lib/api";
import { useState } from "react";

export default function Review() {
  const { state, dispatch } = useBooking();
  const { flightId } = useParams(); const nav = useNavigate();
  const [error, setError] = useState(null); const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null); setBusy(true);
    try {
      const res = await api.post("/api/bookings", { flightId, ...state });
      dispatch({ type: "RESET" });
      window.dispatchEvent(new CustomEvent("toast", { detail: { message: "Booked!", kind: "success" } }));
      nav(`/ticket/${res.confirmationCode}`);
    } catch (e) {
      setError(e.status === 403 && /No Fly/i.test(e.message)
        ? "You appear on the No Fly List. Booking is denied."
        : e.message);
    } finally { setBusy(false); }
  }

  return (
    <section className="max-w-md space-y-3">
      <h1>Review</h1>
      <pre className="bg-slate-100 p-3 text-xs">{JSON.stringify(state, null, 2)}</pre>
      {error && <p className="text-red-600">{error}</p>}
      <button disabled={busy} onClick={submit} className="bg-brand text-white px-4 py-2 rounded disabled:opacity-50">
        {busy ? "Booking…" : "Confirm & Book"}
      </button>
    </section>
  );
}
```

---

## Step 11 — Ticket lookup + ticket view (Tasks 28, 29)

### 11a. `src/pages/TicketLookup.jsx`
```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TicketLookup() {
  const [last, setLast] = useState(""); const [code, setCode] = useState("");
  const nav = useNavigate();
  return (
    <form className="max-w-md space-y-3"
          onSubmit={e => { e.preventDefault(); nav(`/ticket/${code}?lastName=${encodeURIComponent(last)}`); }}>
      <h1>Find my ticket</h1>
      <input className="border p-2 w-full" placeholder="Last name" value={last} onChange={e=>setLast(e.target.value)} />
      <input className="border p-2 w-full" placeholder="Confirmation code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
      <button className="bg-brand text-white px-4 py-2 rounded">Look up</button>
    </form>
  );
}
```

### 11b. `src/pages/Ticket.jsx`
```jsx
import { useParams, useSearchParams } from "react-router-dom";
import { useLiveResource } from "@/hooks/useLiveResource";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { useState } from "react";

export default function Ticket() {
  const { confirmation } = useParams();
  const [params] = useSearchParams();
  const lastName = params.get("lastName") || "";
  const { data, loading } = useLiveResource(confirmation,
    () => api.get(`/api/tickets/by-confirmation?lastName=${encodeURIComponent(lastName)}&code=${confirmation}`),
    15000);
  const [confirm, setConfirm] = useState(false);
  if (loading) return <Spinner />;
  if (!data) return <p>Not found.</p>;
  const { ticket, flight } = data;
  const departed = flight && new Date(flight.departFromSender || flight.depart_time).getTime() < Date.now();

  async function cancel() {
    await api.post(`/api/tickets/${ticket.id}/cancel`, { lastName, code: ticket.confirmation_code });
    window.dispatchEvent(new CustomEvent("toast", { detail: { message: "Cancelled", kind: "info" } }));
    location.reload();
  }
  return (
    <article className="space-y-2 max-w-lg">
      <h1>{ticket.confirmation_code}</h1>
      <p>{flight?.airline} {flight?.flightNumber} — {flight?.city}</p>
      <p>Depart: {flight?.departFromSender} · Gate {flight?.gate}</p>
      <p>Passenger: {ticket.passenger_first} {ticket.passenger_last}</p>
      <p>Seat: {ticket.seat} · Status: {ticket.status}</p>
      {ticket.status === "active" && !departed && (
        <>
          {!confirm
            ? <button onClick={() => setConfirm(true)} className="bg-red-600 text-white px-4 py-2 rounded">Cancel ticket</button>
            : <div className="space-x-2">
                <button onClick={cancel} className="bg-red-600 text-white px-4 py-2 rounded">Confirm cancel</button>
                <button onClick={() => setConfirm(false)} className="underline">No</button>
              </div>}
        </>
      )}
    </article>
  );
}
```

---

## Step 12 — Customer dashboard + settings (Tasks 31, 32)

### 12a. `src/pages/Dashboard.jsx`
```jsx
import { Link } from "react-router-dom";
import { useLiveResource } from "@/hooks/useLiveResource";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  useAutoLogout(user?.autoLogoutMinutes, true);
  const { data, loading } = useLiveResource("dashboard", () => api.get("/api/me/dashboard"), 20000);
  if (loading) return <Spinner />;
  const { profile, upcoming, past } = data;
  return (
    <section className="space-y-4">
      <h1>Welcome, {profile.firstName}</h1>
      <p className="text-sm">Last login: {profile.lastLoginDatetime} from {profile.lastLoginIp}</p>
      <Link to="/dashboard/settings" className="underline">Settings</Link>
      <h2>Upcoming flights</h2>
      <ul>{upcoming.map(t => (
        <li key={t.id}><Link className="underline" to={`/ticket/${t.confirmation_code}?lastName=${t.passenger_last}`}>
          {t.confirmation_code} — {t.flight?.airline} {t.flight?.flightNumber}
        </Link></li>))}</ul>
      <h2>Past flights</h2>
      <ul>{past.map(t => (
        <li key={t.id}>{t.confirmation_code} — {t.flight?.airline || "?"} ({t.status})</li>))}</ul>
    </section>
  );
}
```

### 12b. `src/pages/Settings.jsx`
```jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { user, logout, refresh } = useAuth();
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(0);
  const [claim, setClaim] = useState({ lastName: "", confirmation: "" });
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (user) setForm({
    default_sort: user.defaultSort, auto_logout_minutes: user.autoLogoutMinutes,
    email: user.email,
  }); }, [user]);

  async function save() { await api.patch("/api/me", form); await refresh(); setMsg("Saved"); }
  async function del() {
    if (confirmDelete < 2) return setConfirmDelete(c => c + 1);
    await api.del("/api/me"); logout();
  }
  async function doClaim() {
    try { await api.post("/api/me/claim-ticket", claim); setMsg("Claimed"); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <section className="max-w-md space-y-4">
      <h1>Settings</h1>
      <label>Email <input className="border p-2 w-full" value={form.email||""}
        onChange={e => setForm({...form, email: e.target.value})} /></label>
      <label>Default sort
        <select className="border p-2 w-full" value={form.default_sort||"time"}
          onChange={e => setForm({...form, default_sort: e.target.value})}>
          <option>time</option><option>airline</option><option>flightNumber</option>
        </select></label>
      <label>Auto-logout
        <select className="border p-2 w-full" value={form.auto_logout_minutes||15}
          onChange={e => setForm({...form, auto_logout_minutes: Number(e.target.value)})}>
          <option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={60}>1 hour</option>
        </select></label>
      <button onClick={save} className="bg-brand text-white px-4 py-2 rounded">Save</button>

      <h2>Claim a guest booking</h2>
      <input className="border p-2 w-full" placeholder="Last name" value={claim.lastName} onChange={e=>setClaim({...claim,lastName:e.target.value})} />
      <input className="border p-2 w-full" placeholder="Confirmation" value={claim.confirmation} onChange={e=>setClaim({...claim,confirmation:e.target.value})} />
      <button onClick={doClaim} className="bg-slate-700 text-white px-4 py-2 rounded">Claim</button>

      <h2>Delete account</h2>
      <button onClick={del} className="bg-red-600 text-white px-4 py-2 rounded">
        {confirmDelete === 0 && "Delete account"}
        {confirmDelete === 1 && "Click again to confirm"}
        {confirmDelete >= 2 && "Click once more to permanently delete"}
      </button>

      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
```

---

## Step 13 — Admin pages (Tasks 35, 36)

### 13a. `src/pages/Admin/Dashboard.jsx`
```jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/api/admin/stats").then(setStats); }, []);
  if (!stats) return null;
  return (
    <section>
      <h1>Admin Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
        {stats.windows.map(w => (
          <div key={w.window} className="border rounded p-3">
            <div className="text-xs uppercase">{w.window}</div>
            <div className="text-2xl">{w.tickets}</div>
            <div className="text-sm">${(w.grossCents/100).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 13b. `src/pages/Admin/Customers.jsx`
```jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminCustomers() {
  const [q, setQ] = useState(""); const [rows, setRows] = useState([]);
  const [create, setCreate] = useState({ first_name:"", last_name:"", email:"", password:"" });
  const [ban, setBan] = useState({ identity:"", airline:"" });

  async function load() { setRows(await api.get(`/api/admin/customers?q=${encodeURIComponent(q)}`)); }
  useEffect(() => { load(); }, [q]); // eslint-disable-line

  async function doCreate(e) { e.preventDefault(); await api.post("/api/admin/customers", create); setCreate({first_name:"",last_name:"",email:"",password:""}); load(); }
  async function doBan(e) { e.preventDefault(); await api.post("/api/admin/airline-bans", ban); setBan({identity:"",airline:""}); }
  async function delCustomer(id) { if (confirm("Delete customer?")) { await api.del(`/api/admin/customers/${id}`); load(); } }

  return (
    <section className="space-y-4">
      <h1>Customers</h1>
      <input className="border p-2" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
      <table className="w-full">
        <thead><tr><th className="text-left">Name</th><th>Email</th><th>Phone</th><th></th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} className="border-t"><td>{r.first_name} {r.last_name}</td><td>{r.email}</td><td>{r.phone}</td>
            <td><button className="underline text-red-600" onClick={()=>delCustomer(r.id)}>delete</button></td></tr>))}</tbody>
      </table>

      <h2>Create customer</h2>
      <form onSubmit={doCreate} className="space-y-2 max-w-md">
        <input required placeholder="First" className="border p-2 w-full" value={create.first_name} onChange={e=>setCreate({...create,first_name:e.target.value})}/>
        <input required placeholder="Last"  className="border p-2 w-full" value={create.last_name}  onChange={e=>setCreate({...create,last_name:e.target.value})}/>
        <input required type="email" placeholder="Email" className="border p-2 w-full" value={create.email} onChange={e=>setCreate({...create,email:e.target.value})}/>
        <input required type="password" placeholder="Temp password (>10 chars)" className="border p-2 w-full" value={create.password} onChange={e=>setCreate({...create,password:e.target.value})}/>
        <button className="bg-brand text-white px-4 py-2 rounded">Create</button>
      </form>

      <h2>Airline ban</h2>
      <form onSubmit={doBan} className="space-y-2 max-w-md">
        <input required placeholder="Identity (first last yyyy-mm-dd)" className="border p-2 w-full" value={ban.identity} onChange={e=>setBan({...ban,identity:e.target.value})}/>
        <input required placeholder="Airline" className="border p-2 w-full" value={ban.airline} onChange={e=>setBan({...ban,airline:e.target.value})}/>
        <button className="bg-slate-700 text-white px-4 py-2 rounded">Add ban</button>
      </form>
    </section>
  );
}
```

### 13c. `src/pages/Admin/Tickets.jsx`
```jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";

export default function AdminTickets() {
  const [q, setQ] = useState(""); const [rows, setRows] = useState([]);
  async function load() { setRows(await api.get(`/api/admin/tickets?q=${encodeURIComponent(q)}`)); }
  useEffect(() => { load(); }, [q]); // eslint-disable-line
  async function cancel(id) {
    if (!confirm("Cancel this ticket?")) return;
    await api.post(`/api/admin/tickets/${id}/cancel`); load();
  }
  return (
    <section>
      <h1>Tickets</h1>
      <input className="border p-2" placeholder="Search any field…" value={q} onChange={e=>setQ(e.target.value)} />
      <table className="w-full mt-3">
        <thead><tr><th>Code</th><th>Passenger</th><th>Flight</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(t => (
          <tr key={t.id} className="border-t">
            <td><Link className="underline" to={`/ticket/${t.confirmation_code}?lastName=${t.passenger_last}`}>{t.confirmation_code}</Link></td>
            <td>{t.passenger_first} {t.passenger_last}</td>
            <td>{t.flight_id}</td><td>{t.status}</td>
            <td>{t.status==="active" && <button className="text-red-600 underline" onClick={()=>cancel(t.id)}>cancel</button>}</td>
          </tr>))}</tbody>
      </table>
    </section>
  );
}
```

### 13d. `src/pages/Admin/Admins.jsx` (root only)
```jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminAdmins() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ first_name:"", last_name:"", email:"", password:"" });
  async function load() { setRows(await api.get("/api/admin/admins")); }
  useEffect(() => { load(); }, []);
  async function add(e) { e.preventDefault(); await api.post("/api/admin/admins", form); setForm({first_name:"",last_name:"",email:"",password:""}); load(); }
  async function del(id) { if (confirm("Delete admin?")) { await api.del(`/api/admin/admins/${id}`); load(); } }
  return (
    <section className="space-y-4">
      <h1>Admins</h1>
      <ul>{rows.map(a => (
        <li key={a.id} className="flex justify-between border-b py-2">
          <span>{a.first_name} {a.last_name} — {a.email} <em>({a.type})</em></span>
          {a.type !== "root" && <button onClick={()=>del(a.id)} className="text-red-600 underline">delete</button>}
        </li>))}</ul>
      <form onSubmit={add} className="space-y-2 max-w-md">
        <h2>Create admin</h2>
        <input required placeholder="First" className="border p-2 w-full" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/>
        <input required placeholder="Last"  className="border p-2 w-full" value={form.last_name}  onChange={e=>setForm({...form,last_name:e.target.value})}/>
        <input required type="email" placeholder="Email" className="border p-2 w-full" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        <input required type="password" placeholder="Password (>10)" className="border p-2 w-full" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
        <button className="bg-brand text-white px-4 py-2 rounded">Create</button>
      </form>
    </section>
  );
}
```

---

## Step 14 — Admin-created customer first-login (Task 37)

### 14a. `src/pages/CompleteProfile.jsx`
```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PasswordStrengthMeter, { strength } from "@/components/PasswordStrengthMeter";

export default function CompleteProfile() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState(""); const [profile, setProfile] = useState({});
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault(); setError(null);
    if (strength(pw).level === "weak") return setError("Password too weak.");
    try {
      // Endpoint to add on the server: POST /api/me/complete (resets must_* flags)
      await api.post("/api/me/complete", { password: pw, profile });
      await refresh(); nav("/dashboard");
    } catch (e) { setError(e.message); }
  }
  if (!user) return null;
  return (
    <form onSubmit={submit} className="max-w-md space-y-3">
      <h1>Finish setting up your account</h1>
      {user.mustChangePassword && (
        <>
          <input type="password" required className="border p-2 w-full" placeholder="New password"
                 value={pw} onChange={e=>setPw(e.target.value)} />
          <PasswordStrengthMeter password={pw} />
        </>
      )}
      {user.mustCompleteProfile && (
        <>
          <input required placeholder="Phone" className="border p-2 w-full" onChange={e=>setProfile({...profile, phone:e.target.value})} />
          <input required placeholder="Address" className="border p-2 w-full" onChange={e=>setProfile({...profile, address1:e.target.value})} />
        </>
      )}
      {error && <p className="text-red-600">{error}</p>}
      <button className="bg-brand text-white px-4 py-2 rounded">Save & continue</button>
    </form>
  );
}
```

Add a router-level redirect inside `Layout.jsx`:
```jsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
// ...inside Layout component:
const nav = useNavigate(); const loc = useLocation();
useEffect(() => {
  if (user && (user.mustChangePassword || user.mustCompleteProfile) && loc.pathname !== "/complete-profile") {
    nav("/complete-profile", { replace: true });
  }
}, [user, loc.pathname]);
```

> **Coordinate with Dev 1:** ask Dev 1 to expose `POST /api/me/complete` that updates password (via `hashPassword`) and profile fields, then sets `must_change_password=0, must_complete_profile=0`.

---

## Step 15 — Responsive QA (Task 41)

Checklist (verify each page at 320px, 768px, 1280px):

- `<input>` / `<button>` height ≥ 44px on touch (`p-2` ≈ 40px → bump to `py-3`).
- Tables: replace with `FlightCard.jsx` style at `md:hidden`.
- Sticky table headers: add `className="sticky top-0 bg-white"` to `<thead>`.
- Mobile nav drawer: in `Layout.jsx` collapse the nav links behind a hamburger when `w < 640px`.
- Run Lighthouse mobile on `/`, `/flights`, `/dashboard` — aim ≥ 90.
- Verify no horizontal scroll: open DevTools → Computed → check `body` width.

---

## Dependency order (Dev 3)

```
Step 1  (shell)            ← Dev1.Step1
Step 2  (theme)            ← Step 1
Step 3  (useLiveResource)  ← Step 1
Step 4  (error/spinner)    ← Step 1
Step 5  (auth context)     ← Dev1.Step6  (sessions live)
Step 6  (Login)            ← Step 5 + Dev1.Step7
Step 7  (Signup)           ← Step 5 + Dev1.Step7
Step 8  (Recover)          ← Step 7 + Dev1.Step7
Step 9  (Flights/Detail)   ← Step 3   + Dev2.Step1
Step 10 (Booking flow)     ← Step 9   + Dev2.Step4-5
Step 11 (Ticket)           ← Step 3   + Dev2.Step6
Step 12 (Dashboard/Settings) ← Step 5 + Dev2.Step7
Step 13 (Admin)            ← Step 12  + Dev2.Step8 / Dev1.Step9
Step 14 (CompleteProfile)  ← Step 5   + Dev1.Step10
Step 15 (Responsive QA)    ← all UI complete
```
