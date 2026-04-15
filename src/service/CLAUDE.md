# src/service/ — Services Guide

## Rules for Every Service

1. **Return `Result<T, E>`** from all methods — never throw for expected failures. Import `Ok`, `Err`, and `Result` from `../lib/result`.
2. **No HTTP knowledge** — services have no access to `req`, `res`, or `session`. The controller extracts what's needed and passes it in as plain parameters.
3. **Acting-user identity is a parameter** — accept a typed actor object (e.g., `{ userId, role }`) when the operation depends on who is doing it.
4. **Export an interface** (`IFooService`) and a **factory function** (`CreateFooService()`), not the class directly.
5. **Singleton pattern**: Use a module-level `let instance: IFooService | null = null` guard inside the factory if the service is stateless/shared.
6. **Wire in `composition.ts`**: All dependency injection happens there — never instantiate services inside controllers or routes.
7. Keep services focused — one responsibility per service file.

---

## LoggingService

Singleton logger with ISO-timestamped output. Implements `ILoggingService`.

### Interface

```ts
interface ILoggingService {
  info(message: string): void;   // console.log  — ISO timestamp + [INFO]
  warn(message: string): void;   // console.warn — ISO timestamp + [WARN]
  error(message: string): void;  // console.error — ISO timestamp + [ERROR]
}
```

### Factory

```ts
CreateLoggingService(): ILoggingService  // returns/creates the singleton
```

### Usage Across the App

- **`composition.ts`**: Calls `CreateLoggingService()` and injects the instance into `App` and `AuthController` via constructor.
- **`app.ts` / `AuthController.ts`**: Accept `ILoggingService` as a constructor parameter — always depend on the interface, never the concrete class.
- Tests or alternate compositions can inject a mock by passing a custom `ILoggingService` to `createComposedApp(logger?)`.

---

## RSVPService (Feature 4 — Nolan Carreiro)

Handles all RSVP toggle logic for events. Implements `IRSVPService`.

### Error Types

```ts
export type RSVPError =
  | { name: "UnauthorizedError";         message: string }  // wrong role
  | { name: "EventNotFoundError";        message: string }  // event doesn't exist
  | { name: "InvalidStateError";         message: string }  // cancelled or past (Sprint 2+)
  | { name: "UnexpectedDependencyError"; message: string }  // repository failure
```

Defined in `src/rsvp/errors.ts`. Names match the team contract in `contracts-roles/CONTRACTS.md`.

### Actor

```ts
export interface RSVPActor {
  userId: string;
  role: "admin" | "staff" | "user";
}
```

The controller reads `role` and `userId` from the session and passes an `RSVPActor` down — the service never touches the session.

### Interface

```ts
export interface IRSVPService {
  registerEvent(event_id: string, capacity: number): void;
  toggleRSVP(actor: RSVPActor, event_id: string): Result<RSVPOutcome, RSVPError>;
}
```

`registerEvent` is a Sprint 1 stand-in — in Sprint 3 it is removed and capacity is queried from Prisma.

### Toggle Logic (three internal cases)

| Current state | Outcome |
|---|---|
| No existing record | `"attending"` if capacity allows, `"waitlisted"` if full |
| Active RSVP (`attending` or `waitlisted`) | `"cancelled"`; if attending, promote first waitlisted member |
| Previously cancelled | Same capacity check as a new RSVP |

The controller does **not** determine which case applies — that is business logic and lives in the service.

### Rejection Rules

- `admin` and `staff` roles → `Unauthorized`
- Event not registered (Sprint 1) / not found (Sprint 3) → `EventNotFound`
- Cancelled or past event → `InvalidEventState` *(enforced Sprint 2+)*

### Controller Mapping

| RSVPError name | HTTP status |
|---|---|
| `UnauthorizedError` | 403 |
| `EventNotFoundError` | 404 |
| `InvalidStateError` | 409 |
| `UnexpectedDependencyError` | 500 |

### Sprint Roadmap

| Sprint | Goal |
|---|---|
| 1 | In-memory store, `toggleRSVP` route + service logic, role rejection |
| 2 | Expand error types (cancelled/past events). Tests for all toggle states and capacity. HTMX button — no full reload. |
| 3 | Replace in-memory store with Prisma. Capacity check against live data. Tests still pass. |
| 4 | Style RSVP button per state. Alpine.js visual transition on state change. |

**Coordination note (Feature 9 — Waitlist Promotion):** Emily Chu's feature extends the cancellation path. Agree on the `toggleRSVP` return shape and waitlist-promotion side effect before Sprint 1 ends — changing the interface after she builds against it is an Integration Compromise.
