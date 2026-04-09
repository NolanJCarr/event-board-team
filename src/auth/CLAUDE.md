# src/auth/ — Auth Module Guide

## Responsibility
Authentication (login/logout) and admin user management (create/delete/list). Role-based access: `admin | staff | user` (defined in `User.ts`).

## File Map

| File | Purpose |
|------|---------|
| `User.ts` | Domain types: `IUserRecord`, `IAuthenticatedUser`, `IUserSummary`, `UserRole` |
| `errors.ts` | `AuthError` discriminated union + factory functions |
| `UserRepository.ts` | `IUserRepository` interface — the persistence contract |
| `InMemoryUserRepository.ts` | In-memory impl seeded with `DEMO_USERS`; swap for DB impl here |
| `PasswordHasher.ts` | `IPasswordHasher` interface + scrypt impl (`salt:hash` format) |
| `AuthService.ts` | `IAuthService.authenticate()` — validates credentials, returns `Result<IAuthenticatedUser, AuthError>` |
| `AdminUserService.ts` | `IAdminUserService` — list/create/delete users; enforces business rules |
| `AuthController.ts` | `IAuthController` — handles Express `Response`, renders views, mutates session |

## Data Flow

```
Form POST → AuthController → AuthService / AdminUserService → IUserRepository
                          ↓
                 session/AppSession (sign-in / sign-out)
```

## Error Handling
All service methods return `Result<T, AuthError>` — never throw. `AuthController.mapErrorStatus()` maps `AuthError.name` to HTTP status codes:

| Error name | Status |
|-----------|--------|
| `InvalidCredentials` | 401 |
| `AuthorizationRequired` | 403 |
| `UserNotFound` | 404 |
| `UserAlreadyExists` / `ProtectedUserOperation` | 409 |
| `ValidationError` | 400 |
| `UnexpectedDependencyError` | 500 |

## Key Rules
- **Passwords never leave this module as plaintext.** `IUserRecord.passwordHash` stores `salt:hash`. `PasswordHasher.verify()` uses `timingSafeEqual`.
- **`IUserRecord` stays internal.** Controllers and callers receive `IAuthenticatedUser` or `IUserSummary` only.
- **Validation lives in services**, not the controller. Controller does only type-narrowing of raw form strings.
- **Admin cannot delete themselves.** Enforced in `AdminUserService.deleteUser()` via `ProtectedUserOperation`.
- Email is always normalized (`trim().toLowerCase()`) before any lookup or storage.

## Adding a Persistent Repository
1. Implement `IUserRepository` from `UserRepository.ts`.
2. Swap `CreateInMemoryUserRepository()` in `src/composition.ts`. No other files change.

## Views
Auth views live in `src/views/auth/` (`login.ejs`, `users.ejs`). Controller passes `{ session, pageError, users? }`.
