# useState Examples

This guide explains how `useState` works in React with simple examples.

## 1. What `useState` does

`useState` lets a React component remember values between renders.

You usually use it for things like:

- text input values
- counters
- toggles
- form data
- API loading state
- error messages

Basic syntax:

```jsx
import { useState } from "react";

export default function Example() {
  const [count, setCount] = useState(0);

  return <p>{count}</p>;
}
```

In this example:

- `count` is the current state value
- `setCount` updates the state
- `0` is the initial value

## 2. Example: counter

```jsx
import { useState } from "react";

export default function CounterExample() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increase</button>
      <button onClick={() => setCount(count - 1)}>Decrease</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

What happens here:

- clicking `Increase` adds `1`
- clicking `Decrease` subtracts `1`
- clicking `Reset` sets the value back to `0`

## 3. Example: text input

```jsx
import { useState } from "react";

export default function NameExample() {
  const [name, setName] = useState("");

  return (
    <div>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Enter your name"
      />
      <p>Hello, {name || "friend"}.</p>
    </div>
  );
}
```

What happens here:

- the input shows the current `name`
- typing calls `setName(...)`
- the paragraph updates immediately

## 4. Example: boolean toggle

```jsx
import { useState } from "react";

export default function ToggleExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "Hide" : "Show"}
      </button>

      {isOpen ? <p>The panel is open.</p> : null}
    </div>
  );
}
```

This is useful for:

- modals
- dropdowns
- accordions
- mobile menus
- show/hide sections

## 5. Example: multiple fields in one object

When a form has several related values, you can store them in one object.

```jsx
import { useState } from "react";

export default function FormExample() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  return (
    <form>
      <input
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Email"
      />

      <input
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Password"
      />

      <pre>{JSON.stringify(formData, null, 2)}</pre>
    </form>
  );
}
```

Why use this pattern:

- it keeps related form values together
- it scales better than many separate state variables
- it works well for registration and login forms

## 6. Example: array state

You can also store arrays in state.

```jsx
import { useState } from "react";

export default function TodoExample() {
  const [items, setItems] = useState(["Learn React"]);
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (!newItem.trim()) return;

    setItems((current) => [...current, newItem]);
    setNewItem("");
  };

  return (
    <div>
      <input
        value={newItem}
        onChange={(event) => setNewItem(event.target.value)}
        placeholder="Add item"
      />
      <button onClick={addItem}>Add</button>

      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

Common array operations with state:

- add item with `[...current, newItem]`
- remove item with `.filter(...)`
- update item with `.map(...)`

## 7. Example: loading and error state for API calls

This pattern is common when talking to a server.

```jsx
import { useState } from "react";

export default function ApiExample() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const fetchHealth = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/health");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError("Failed to load API response.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchHealth} disabled={loading}>
        {loading ? "Loading..." : "Check API"}
      </button>

      {error ? <p>{error}</p> : null}
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : null}
    </div>
  );
}
```

This pattern is useful because it separates:

- the request state
- the successful response
- the failure message

## 8. Example: functional state updates

When the next state depends on the previous state, use the callback form.

```jsx
import { useState } from "react";

export default function FunctionalUpdateExample() {
  const [count, setCount] = useState(0);

  const addThree = () => {
    setCount((current) => current + 1);
    setCount((current) => current + 1);
    setCount((current) => current + 1);
  };

  return (
    <div>
      <p>{count}</p>
      <button onClick={addThree}>Add 3</button>
    </div>
  );
}
```

Why this matters:

- `setCount(count + 1)` can use an older value
- `setCount((current) => current + 1)` always uses the latest state

Use the functional form when:

- incrementing counters
- toggling based on previous value
- updating arrays or objects from current state

## 9. Example: registration form using `useState`

This example matches a real app pattern.

```jsx
import { useState } from "react";

export default function RegisterExample() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Registration failed.");
      }

      setMessage("Registration submitted successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />

      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />

      <button type="submit">Register</button>
      <p>{message}</p>
    </form>
  );
}
```

Here `useState` is used for:

- `email`
- `password`
- `message`

That is a common and clean pattern for simple forms.

## 10. Common mistakes

### Mistake: updating objects without copying existing values

Wrong:

```jsx
setFormData({ email: "new@example.com" });
```

This replaces the whole object.

Better:

```jsx
setFormData((current) => ({
  ...current,
  email: "new@example.com",
}));
```

### Mistake: mutating arrays directly

Wrong:

```jsx
items.push("New item");
setItems(items);
```

Better:

```jsx
setItems((current) => [...current, "New item"]);
```

### Mistake: expecting state to update immediately

Wrong expectation:

```jsx
setCount(count + 1);
console.log(count);
```

The `console.log` may still print the old value during that render cycle.

## 11. Quick rule of thumb

Use `useState` when:

- the value changes over time
- the UI should re-render when the value changes
- the value belongs to that component

Examples:

- form inputs
- open/closed UI state
- fetched API data
- loading indicators
- local validation messages

## 12. Summary

`useState` is one of the main React hooks.

It gives you:

- a current value
- a function to update that value
- automatic re-rendering when the value changes

Pattern:

```jsx
const [value, setValue] = useState(initialValue);
```

Examples in this guide covered:

- numbers
- strings
- booleans
- objects
- arrays
- forms
- API state

Once `useState` feels comfortable, the next hook to learn is usually `useEffect`.
