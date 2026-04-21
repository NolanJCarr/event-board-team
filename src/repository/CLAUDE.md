# src/repository/ — Repository Module Guide

## Responsibility
Persistence contracts and in-memory implementations for the data layer. The repository is the only layer that touches the data store. Services depend on interfaces, never concrete classes.

## Rules for Every Repository

1. **Return `Result<T, E>`** from all methods — never throw.
2. **Implement an interface** (`IFooRepository`) and a factory function (`CreateInMemoryFooRepository()`).
3. **The interface is the contract** — services import only the interface. Swapping to Prisma in Sprint 3 means implementing the same interface, nothing else changes.
4. **Wire in `composition.ts`** — never instantiate repositories inside services or controllers.

## Current Files

| File | Purpose |
|---|---|
| `UserRepository.ts` | `IUserRepository` interface — persistence contract for users |
| `InMemoryUserRepository.ts` | In-memory impl seeded with `DEMO_USERS`; swap for Prisma in Sprint 3 |
| `EventRepository.ts` | `IEventRepository` filter-based interface — `getEvents(filter)` returning `Result<Event[], EventError>`. Used by `EventService` for the event list/filter/search features. |
| `InMemoryEventRepository.ts` | In-memory impl of the filter-based `IEventRepository` |
| `RSVPRepository.ts` | `IRSVPRepository` interface + `RSVPRecord` type — used by RSVPService and AttendeeListService |
| `InMemoryRSVPRepository.ts` | In-memory impl of `IRSVPRepository` |

> **Two EventRepository interfaces exist in the project:**
> - `src/repository/EventRepository.ts` — filter-based `getEvents(filter)`. Used by the event list/filter/search service.
> - `src/events/EventRepository.ts` — full CRUD (`create`, `findById`, `findAll`, `update`, `findByOrganizerId`). Used by creation/editing/detail features.
>
> Do not confuse them. Each has its own in-memory implementation.

## RSVPRecord Type

```ts
interface RSVPRecord {
  id: string;
  userId: string;
  eventId: string;
  status: RSVPStatus;   // "going" | "waitlisted" | "cancelled"
  createdAt: Date;
}
```

## DEMO_USERS seed (InMemoryUserRepository)
Seeds three roles (`admin`, `staff`, `user`) for local development. Passwords stored as `salt:hash` (scrypt via `auth/PasswordHasher.ts`).

## Adding a Repository (Sprint 1 pattern)

1. Define `IFooRepository` in a new `FooRepository.ts` — list every method with its `Result<T, E>` return type.
2. Implement `InMemoryFooRepository` in a separate file.
3. Export a factory: `CreateInMemoryFooRepository(): IFooRepository`.
4. Register in `composition.ts`; inject into the relevant service constructor.

## Sprint 3 Migration

Implement the **same** `IFooRepository` interface backed by the Prisma client. Swap the factory call in `composition.ts`. The service and controller layers must not change — if they do, the layers were not properly separated.
