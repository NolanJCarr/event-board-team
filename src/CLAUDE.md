# src/ — Codebase Guide

## Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Express with EJS templating (`express-ejs-layouts`)
- **Sessions**: `express-session` — session store is `AppSessionStore` (`session/AppSession.ts`)
- **Auth**: Role-based (`admin | staff | user`); roles defined in `auth/User.ts`
- **Frontend interactivity**: HTMX (`HX-Request` header checked in `app.ts`)

## Architecture

**Composition root**: `composition.ts` wires all dependencies. Add new services here.

**Contracts**: `contracts.ts` defines `IApp` and `IServer` interfaces — the app/server boundary. Depend on interfaces, not concretions.

**Layers** (top → bottom):
```
routes (app.ts) → controllers (auth/) → services (auth/) → repositories (auth/)
```

**Error handling**: Use `Result<T, E>` from `lib/result.ts` for recoverable errors. Throw only for unexpected failures caught by the global error handler in `app.ts`.

## Key Conventions

- All Express route handlers go through `asyncHandler()` in `app.ts`.
- Auth guards use `requireAuthenticated()` / `requireRole()` — inline helpers, not middleware.
- Session mutations go through helpers in `session/AppSession.ts` (never mutate `req.session` directly).
- HTMX requests get partial renders (no layout); standard requests get full page renders.
- Static files: `src/static/` (create if needed).

## Current Data Layer
`InMemoryUserRepository` — no database. When adding persistence, implement `IUserRepository` (`auth/UserRepository.ts`) and swap in `composition.ts`.

## Adding Features
1. Define interfaces in `contracts.ts` or the relevant domain folder.
2. Implement services, wire in `composition.ts`.
3. Add routes to `app.ts` using existing auth guard pattern.
4. Views go in `src/views/`; partials for HTMX responses in `src/views/partials/`.
