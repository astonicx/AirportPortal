# Registration Flow: Send Email and Password to the Server

This guide shows how to:

1. Create a registration page in React
2. Send `email` and `password` to the server
3. Call the server-side encryption function
4. Hash the password on the server
5. Prove it works by printing the encrypted password in the server console

Note: logging password hashes is only for development proof. Do not keep that log in production.

## 1. Use the existing server-side password utility

The server already has a password utility in:

- `server/utils/password.js`

It exports:

- `hashPassword(password)`
- `verifyPassword(password, hash)`
- `getPasswordStrength(password)`
- `getPasswordStrengthLabel(password)`

That means the registration flow should hash the password on the server, not in React.

## 2. Update the server registration route

In `server/server.js`, import `hashPassword` from the server utility.

Example:

```js
"use strict";
const express = require("express");
const cors = require("cors");
const { ApiClient } = require("./utils/apiClient");
const { hashPassword } = require("./utils/password");

const app = express();
const PORT = 5000;
```

Then add a registration route like this:

```js
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required." });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required." });
  }

  try {
    const hashedPassword = await hashPassword(password);

    // Development proof only.
    console.log("Registered email:", email);
    console.log("Encrypted password:", hashedPassword);

    // In a real app, save email + hashedPassword to the database here.
    return res.status(201).json({
      message: "Registration received.",
      email,
      hashedPassword,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Registration failed." });
  }
});
```

## 3. Create a React registration page

Create a page such as `src/pages/Register.jsx`.

Example:

```jsx
import { useState } from "react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold">Register</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
              required
            />
          </div>

          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-white"
          >
            Submit Registration
          </button>
        </form>

        {error ? <p className="mt-4 text-red-600">{error}</p> : null}

        {result ? (
          <pre className="mt-4 overflow-auto rounded bg-slate-100 p-4 text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
```

## 4. Add the route in React

In `src/App.jsx`, add the page route.

Example:

```jsx
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
```

## 5. Why the frontend can call `/api/register`

This project already proxies `/api` requests from Vite to the Express server.

That setup is in:

- `vite.config.mts`

Because of that, this frontend request works during development:

```js
fetch("/api/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});
```

It will be forwarded to the Express server running on port `5000`.

## 6. What proves the encryption worked

When the form is submitted:

1. React sends the plain-text `email` and `password` to `POST /api/register`
2. The server receives them
3. The server calls `hashPassword(password)`
4. The server logs the hashed value with `console.log`

Expected server console output will look similar to this:

```txt
Registered email: user@example.com
Encrypted password: $2a$10$w3Pj7x8nK8D2r9M0T6Qv4eM9K5h7sX2mN1aB3cD4eF5gH6iJ7kL8m
```

The value beginning with `$2a$10$` or `$2b$10$` is a bcrypt hash, which proves the password was encrypted on the server.

## 7. Quick test steps

1. Start the stack:

```bash
npm run dev:all
```

2. Open the app in the browser.

3. Go to `/register`.

4. Enter an email and password.

5. Submit the form.

6. Check the server terminal.

You should see the email and encrypted password in the server console.

## 8. Important production note

For production, remove this line after testing:

```js
console.log("Encrypted password:", hashedPassword);
```

In production, you should:

- Hash the password on the server
- Save only the hash to the database
- Never log plain-text passwords
- Usually avoid logging password hashes too
