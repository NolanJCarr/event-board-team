# src/repository/ — Repository Module Guide

## Responsibility
Persistence contracts and implementations for the user data layer. Decouples storage details from auth services.

## File Map

| File | Purpose |
|------|---------|
| `UserRepository.ts` | `IUserRepository` interface — the persistence contract |
| `InMemoryUserRepository.ts` | In-memory impl seeded with `DEMO_USERS`; swap for DB impl here |

## Key Rules
- `IUserRepository` is the only type auth services depend on — never import a concrete class directly.
- All methods return `Result<T, AuthError>` — never throw.
- `InMemoryUserRepository` is constructed via `CreateInMemoryUserRepository()` (factory function). Instantiate through the factory, not `new`.
- `DEMO_USERS` seeds three roles (`admin`, `staff`, `user`) for local development. Passwords are `salt:hash` (scrypt, via `auth/PasswordHasher.ts`).

## Adding a Persistent Repository
1. Implement `IUserRepository` from `UserRepository.ts`.
2. Swap `CreateInMemoryUserRepository()` in `src/composition.ts`. No other files change.
