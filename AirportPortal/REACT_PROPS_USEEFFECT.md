# React Props and useEffect

This guide explains two core React concepts:

- `props`
- `useEffect`

## See also

For plain JavaScript function examples, see `FUNCTIONS_EXAMPLES.md`.

## 1. What props are

Props are values passed from a parent component to a child component.

They let components share data and behavior.

## 2. Basic props example

```jsx
function WelcomeMessage(props) {
  return <h1>Hello, {props.name}</h1>;
}

export default function App() {
  return <WelcomeMessage name="Ada" />;
}
```

Here:

- `name` is a prop
- the parent passes it in
- the child reads it

## 3. Destructured props example

```jsx
function WelcomeMessage({ name, role }) {
  return (
    <div>
      <h1>Hello, {name}</h1>
      <p>Role: {role}</p>
    </div>
  );
}

export default function App() {
  return <WelcomeMessage name="Grace" role="Engineer" />;
}
```

This is the most common style in React.

## 4. Passing a function as a prop

Parents can pass functions to children.

```jsx
function ChildButton({ onPress }) {
  return <button onClick={onPress}>Click Me</button>;
}

export default function Parent() {
  function handlePress() {
    console.log("Button clicked in child.");
  }

  return <ChildButton onPress={handlePress} />;
}
```

This is useful because child components can trigger logic owned by the parent.

## 5. What useEffect is

`useEffect` is a React hook used for side effects.

Examples of side effects:

- fetching API data
- setting up timers
- listening for browser events
- updating browser state outside the render

Basic syntax:

```jsx
import { useEffect } from "react";

useEffect(() => {
  console.log("Effect ran");
}, []);
```

The second argument is the dependency array.

## 6. Run once when the component loads

```jsx
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    console.log("Component mounted");
  }, []);

  return <p>Page loaded</p>;
}
```

This runs once after the first render.

## 7. Fetch data with useEffect

```jsx
import { useEffect, useState } from "react";

export default function HealthCheck() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError("Failed to load health status.");
      }
    };

    loadHealth();
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading...</p>;

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

This is a common pattern for loading server data when a component appears.

## 8. Run when a value changes

```jsx
import { useEffect, useState } from "react";

export default function SearchExample() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!query) return;
    console.log("Search query changed:", query);
  }, [query]);

  return (
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search"
    />
  );
}
```

This effect runs every time `query` changes.

## 9. Cleanup example

```jsx
import { useEffect } from "react";

export default function TimerExample() {
  useEffect(() => {
    const id = setInterval(() => {
      console.log("Tick");
    }, 1000);

    return () => {
      clearInterval(id);
    };
  }, []);

  return <p>Timer running</p>;
}
```

The function returned by `useEffect` is cleanup logic.

It runs when:

- the component is removed
- or before the effect runs again

## 10. Summary

Use `props` when:

- a parent needs to pass data to a child
- a parent needs to pass a function to a child

Use `useEffect` when:

- code should run after render
- you need to fetch data
- you need timers or subscriptions
- you need cleanup logic
