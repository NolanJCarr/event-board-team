# session/AppSession.ts

## Purpose
Manages the Express session lifecycle for the app. Wraps `express-session`'s raw store with typed helpers that encapsulate all reads and mutations. Never touch `req.session` directly — use these helpers exclusively.

## Key Types

**`AppSessionStore`**
`Session & Partial<SessionData> & { app?: IAppBrowserSession }`
The typed session store passed as `req.session` in Express handlers.

**`IAppBrowserSession`**
The app-level session object stored at `store.app`. Tracks:
- `browserId` / `browserLabel` — stable browser identity
- `visitCount`, `createdAt`, `lastSeenAt` — visit metadata
- `authenticatedUser: IAuthenticatedUserSession | null` — null when anonymous

**`IAuthenticatedUserSession`**
Snapshot of authenticated identity stored in the session:
`userId`, `email`, `displayName`, `role`, `signedInAt`. Passwords are never stored here.

## Exported Functions

| Function | Purpose |
|---|---|
| `createInitialAppSession(now?, browserId?)` | Creates a fresh `IAppBrowserSession` with a new UUID browser ID and zero visit count. |
| `recordPageView(store, now?)` | Increments `visitCount`, updates `lastSeenAt`. Call on every page request. |
| `touchAppSession(store, now?)` | Updates `lastSeenAt` without incrementing visit count. |
| `signInAuthenticatedUser(store, user, now?)` | Writes user identity into `authenticatedUser`. |
| `signOutAuthenticatedUser(store, now?)` | Clears `authenticatedUser` to null. |
| `getAuthenticatedUser(store, now?)` | Returns `IAuthenticatedUserSession | null`. |
| `isAuthenticatedSession(store, now?)` | Returns `boolean` — true if a user is signed in. |

All functions accept an optional `now: Date` for testability.

## Rule
**Session mutations must go through these helpers. Never mutate `req.session` directly.**
All state lives under `store.app`; the helpers initialize it lazily via `ensureAppSession` if absent.
