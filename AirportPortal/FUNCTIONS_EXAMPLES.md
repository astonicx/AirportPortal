# Functions Examples

This guide explains what functions are in JavaScript and shows common patterns you will use in general JavaScript, Node.js, and server code.

## See also

For React-specific examples with `props` and `useEffect`, see `REACT_PROPS_USEEFFECT.md`.

## 1. What a function is

A function is a reusable block of code.

You define it once, then call it whenever you need that logic.

Functions help you:

- avoid repeating code
- organize logic
- make code easier to read
- pass behavior into other code

## 2. Basic function declaration

```js
function sayHello() {
  console.log("Hello");
}

sayHello();
```

What happens:

- `sayHello` is the function name
- the code inside `{}` runs when you call it
- `sayHello()` calls the function

## 3. Function with parameters

Parameters let you pass values into a function.

```js
function greet(name) {
  console.log("Hello, " + name);
}

greet("Ada");
greet("Grace");
```

Here:

- `name` is the parameter
- `"Ada"` and `"Grace"` are arguments

## 4. Function that returns a value

A function can give a value back using `return`.

```js
function add(a, b) {
  return a + b;
}

const total = add(2, 3);
console.log(total);
```

What happens:

- `add(2, 3)` returns `5`
- that returned value is stored in `total`

## 5. Function expression

You can store a function in a variable.

```js
const multiply = function (a, b) {
  return a * b;
};

console.log(multiply(4, 5));
```

This is called a function expression.

## 6. Arrow function

Arrow functions are a shorter syntax.

```js
const subtract = (a, b) => {
  return a - b;
};

console.log(subtract(10, 4));
```

Shorter version when there is only one expression:

```js
const square = (number) => number * number;

console.log(square(6));
```

## 7. Function with no parameters

```js
const showMessage = () => {
  console.log("This function takes no arguments.");
};

showMessage();
```

## 8. Function with one parameter

```js
const double = (value) => value * 2;

console.log(double(8));
```

## 9. Function with default values

Default values are used when no argument is passed.

```js
function greetUser(name = "friend") {
  return "Hello, " + name;
}

console.log(greetUser());
console.log(greetUser("Jordan"));
```

## 10. Function passed as a callback

A callback is a function passed into another function.

```js
function processUserInput(callback) {
  const name = "Taylor";
  callback(name);
}

processUserInput(function (value) {
  console.log("Received:", value);
});
```

Arrow function version:

```js
processUserInput((value) => {
  console.log("Received:", value);
});
```

## 11. Functions in array methods

Functions are often passed into `.map()`, `.filter()`, and `.forEach()`.

### `map`

```js
const numbers = [1, 2, 3];
const doubled = numbers.map((number) => number * 2);

console.log(doubled);
```

### `filter`

```js
const numbers = [1, 2, 3, 4, 5];
const evenNumbers = numbers.filter((number) => number % 2 === 0);

console.log(evenNumbers);
```

### `forEach`

```js
const names = ["Ada", "Grace", "Linus"];

names.forEach((name) => {
  console.log(name);
});
```

## 12. Function that returns an object

```js
function createUser(email, role) {
  return {
    email,
    role,
  };
}

const user = createUser("user@example.com", "admin");
console.log(user);
```

This is useful when building structured data.

## 13. Async functions

An `async` function lets you use `await`.

```js
async function getHealth() {
  const response = await fetch("/api/health");
  const data = await response.json();
  return data;
}
```

Using it:

```js
getHealth().then((result) => {
  console.log(result);
});
```

Or inside another async function:

```js
async function run() {
  const result = await getHealth();
  console.log(result);
}

run();
```

## 14. Server-side function example

This matches the kind of code used in Express routes.

```js
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    throw new Error("Email is required.");
  }

  return email.includes("@");
}

console.log(validateEmail("user@example.com"));
```

This function:

- checks input
- throws an error if the input is invalid
- returns `true` or `false`

## 15. Function that calls another function

Functions are often combined.

```js
function formatName(name) {
  return name.trim().toUpperCase();
}

function greetFormattedName(name) {
  const cleanName = formatName(name);
  return "Hello, " + cleanName;
}

console.log(greetFormattedName("  ada  "));
```

This helps break large tasks into smaller pieces.

## 16. Pure functions

A pure function:

- gives the same output for the same input
- does not change values outside itself

```js
function toCelsius(fahrenheit) {
  return (fahrenheit - 32) * (5 / 9);
}
```

Pure functions are easier to test and reuse.

## 17. Impure function example

```js
let total = 0;

function addToTotal(value) {
  total += value;
}
```

This changes outside state, so it is not pure.

Impure functions are not always wrong, but they require more care.

## 18. Common mistakes

### Mistake: forgetting to call the function

Wrong:

```js
console.log(add);
```

Correct:

```js
console.log(add(2, 3));
```

### Mistake: forgetting `return`

Wrong:

```js
function add(a, b) {
  a + b;
}
```

Correct:

```js
function add(a, b) {
  return a + b;
}
```

### Mistake: calling the function immediately

Wrong:

```js
runTask();
```

when you meant to pass the function itself somewhere.

Correct:

```js
runTask;
```

or pass it as a callback where needed.

## 19. When to use each style

### Function declaration

Use when:

- you want a named reusable function
- you want clear readability
- you define general-purpose logic

```js
function calculateTotal(price, tax) {
  return price + tax;
}
```

### Function expression

Use when:

- you want to store a function in a variable
- you want to pass it around

```js
const calculateTotal = function (price, tax) {
  return price + tax;
};
```

### Arrow function

Use when:

- you want shorter syntax
- you are writing callbacks
- you want consistency in modern JavaScript code

```js
const calculateTotal = (price, tax) => price + tax;
```

## 20. Summary

Functions are one of the most important parts of JavaScript.

They let you:

- group logic
- reuse code
- respond to events
- process data
- call APIs
- structure backend and utility code

Examples in this guide covered:

- function declarations
- parameters and return values
- function expressions
- arrow functions
- callbacks
- async functions
- array method callbacks
- server-side validation functions
- pure and impure functions

A simple rule:

- if you want reusable logic, put it in a function
- if the code should run later, pass a function
- if you need a result back, `return` a value

- you want to store a function in a variable
- you want to pass it around

```js
const calculateTotal = function (price, tax) {
  return price + tax;
};
```

### Arrow function

Use when:

- you want shorter syntax
- you are writing callbacks
- you want consistency in modern React code

```js
const calculateTotal = (price, tax) => price + tax;
```

## 22. Summary

Functions are one of the most important parts of JavaScript.

They let you:

- group logic
- reuse code
- respond to events
- process data
- call APIs
- structure React components and server code

Common patterns you will use often:

- `function name() {}`
- `const name = function () {}`
- `const name = () => {}`
- `async function name() {}`

A simple rule:

- if you want reusable logic, put it in a function
- if the code should run later, pass a function
- if you need a result back, `return` a value
