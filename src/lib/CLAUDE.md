# src/lib/ — Shared Utilities

## result.ts

Railway-oriented `Result<T, E>` type for explicit error handling without throwing.

```ts
Ok<T>  — { ok: true,  value: T }
Err<E> — { ok: false, value: E }
```

### Usage in Services

```ts
import { type Result, Ok, Err } from "../lib/result";

function doSomething(input: string): Result<string, MyError> {
  if (!input) return Err(ValidationError("Input is required."));
  return Ok(input.trim());
}
```

### Usage in Controllers

```ts
const result = service.doSomething(input);

if (result.ok === false) {
  // result.value is the typed error
  return res.status(mapErrorStatus(result.value.name)).send(result.value.message);
}

// result.value is the success payload
res.status(200).send(result.value);
```

### Rules

- **All service methods return `Result<T, E>`** — this applies from Sprint 1 onward, not as a later upgrade.
- **Do not throw** from service methods for expected business-logic failures — return `Err(...)` instead.
- Only throw for truly unexpected failures (programmer errors, broken invariants) that the global error handler in `app.ts` should catch.
- Define domain-specific error unions (e.g., `AuthError`, `RSVPError`) with named `name` fields so controllers can switch on them to produce the correct HTTP status code.
