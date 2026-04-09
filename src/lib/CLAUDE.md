# src/lib/ — Shared Utilities

## result.ts
Railway-oriented `Result<T, E>` type for explicit error handling without throwing.

```ts
Ok<T>  — { ok: true,  value: T }
Err<E> — { ok: false, value: E }
```

**Usage**: return `Ok(value)` or `Err(error)`; check `result.ok` before accessing `result.value`.

Services across the codebase return `Result<T, AuthError>` — never throw recoverable errors.
