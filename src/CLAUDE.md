# src/ — Codebase Guide

## Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Express with EJS templating (`express-ejs-layouts`)
- **Sessions**: `express-session` — session store is `AppSessionStore` (`session/AppSession.ts`)
- **Auth**: Role-based (`admin | staff | user`); roles defined in `auth/User.ts`
- **Frontend interactivity**: HTMX 2.0, Alpine.js v3, Tailwind CSS v4 (all loaded via CDN in `layouts/base.ejs`)

## 4-Layer Architecture

Every HTTP request must flow through these layers in order — no skipping, no shortcuts:

```
Route (app.ts)  →  Controller  →  Service  →  Repository
```

| Layer | Responsibility |
|---|---|
| **Route** | Maps a URL + HTTP method to a controller function. Lives in `app.ts`. |
| **Controller** | Parses request (body, query, headers, session). Calls service. Maps `Result` to HTTP response. |
| **Service** | All business logic. No knowledge of HTTP. Returns `Result<T, E>`. Receives acting-user identity as parameters — **never reads the session**. |
| **Repository** | Data storage only. Sprint 1–2: in-memory. Sprint 3: Prisma. |

**Composition root**: `composition.ts` wires all dependencies. All `new` calls and factory calls happen here — never inside controllers or services.

## Result Pattern (mandatory from Sprint 1)

All service methods must return `Result<T, E>` from `lib/result.ts`. Do **not** throw for expected failures.

```ts
const result = service.doSomething(input);

if (result.ok === false) {
  return res.status(400).json({ error: result.value.message });
}

// result.value is the success value
```

Controllers map error `name` fields to HTTP status codes:

| Status | When |
|---|---|
| 400 | Invalid input / validation failure |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate, invalid state transition) |
| 500 | Unexpected failure |

## Key Conventions

- All Express route handlers go through `asyncHandler()` in `app.ts`.
- Auth guards use `requireAuthenticated()` / `requireRole()` — inline helpers, not middleware.
- Session mutations go through helpers in `session/AppSession.ts` (never mutate `req.session` directly).
- Validation lives in the **service layer**, not the controller. The controller extracts inputs and passes them down.
- HTMX requests (`HX-Request: true` header) get partial renders (`layout: false`); standard requests get full page renders.
- Static files: `src/static/` (create if needed).

## HTMX Partial Pattern

Detect HTMX requests with `req.get("HX-Request") === "true"`. Return an HTML fragment, not a full page:

```ts
if (req.get("HX-Request") === "true") {
  return res.render("partials/my-partial", { data, layout: false });
}
res.render("my-full-page", { data });
```

## Testing Requirements

Every feature must have integration tests that:
- Cover the happy path
- Cover every named error type
- Cover at least one edge case
- Run against the **in-memory repository** (not mocks of the repository)
- Continue to pass without modification after the Sprint 3 Prisma migration

## Feature Ownership

| # | Feature | Owner |
|---|---|---|
| 1 | Event Creation | Haamed Rahman |
| 2 | Event Detail Page | Dylan Wang |
| 3 | Event Editing | Haamed Rahman |
| 4 | RSVP Toggle | Nolan Carreiro |
| 5 | Event Publishing & Cancellation | Dylan Wang |
| 6 | Category and Date Filter | Megan Wells |
| 7 | My RSVPs Dashboard | Nolan Carreiro |
| 8 | Organizer Event Dashboard | Dylan Wang |
| 9 | Waitlist Promotion | Emily Chu |
| 10 | Event Search | Megan Wells |
| 12 | Attendee List | Emily Chu |

## Data Layer
Sprint 1–2: In-memory repositories (no database). Sprint 3: Swap in Prisma-backed implementations in `composition.ts` — service and controller layers must not change.

## Adding a Feature
1. Define the domain error union and factory functions (follow `src/auth/errors.ts` as the pattern).
2. Define the repository interface; implement an in-memory version.
3. Implement the service — returns `Result<T, E>`, accepts acting-user identity as a parameter.
4. Wire everything in `composition.ts`.
5. Add routes to `app.ts` using the existing auth guard pattern.
6. Views in `src/views/`; HTMX partials in `src/views/partials/`.
