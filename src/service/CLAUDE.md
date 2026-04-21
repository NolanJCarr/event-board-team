# src/service/ — Services Guide

## Rules for Every Service

1. **Return `Result<T, E>`** from all methods — never throw for expected failures. Import `Ok`, `Err`, and `Result` from `../lib/result`.
2. **No HTTP knowledge** — services have no access to `req`, `res`, or `session`. The controller extracts what's needed and passes it in as plain parameters.
3. **Acting-user identity is a parameter** — accept a typed actor object (e.g., `{ userId, role }`) when the operation depends on who is doing it.
4. **Export an interface** (`IFooService`) and a **factory function** (`CreateFooService()`), not the class directly.
5. **Wire in `composition.ts`**: All dependency injection happens there — never instantiate services inside controllers or routes.

---

## LoggingService

Singleton logger with ISO-timestamped output. Implements `ILoggingService`.

```ts
interface ILoggingService {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

CreateLoggingService(): ILoggingService  // returns/creates the singleton
```

---

## RSVPService (Features 4 & 7 — Nolan Carreiro)

See `src/rsvp/CLAUDE.md` for full documentation. Summary:

- `toggleRSVP(actor, event_id)` — handles new/active/cancelled RSVP states
- `registerEvent(event_id, capacity)` — Sprint 1 stand-in, removed in Sprint 3
- Rejects `admin` and `staff` roles with `UnauthorizedError`
- Automatically promotes first waitlisted member when an attending member cancels (Feature 9 coordination)

```ts
interface IRSVPService {
  registerEvent(event_id: string, capacity: number): void;
  toggleRSVP(actor: RSVPActor, event_id: string): Result<RSVPOutcome, RSVPError>;
}
```

---

## EventService (Features 1, 2, 3 — Haamed Rahman / Dylan Wang)

Handles event creation, detail lookup, and editing. Lives in `src/events/EventService.ts`.

```ts
interface IEventService {
  createEvent(input: CreateEventInput): Promise<Result<Event, EventError>>;
  getEventById(input: { eventId: string; userId: string; role: string }): Promise<Result<Event, EventError>>;
  updateEvent(input: UpdateEventInput): Promise<Result<Event, EventError>>;
}
```

### Validation Rules (createEvent / updateEvent)
- All required fields must be non-empty strings
- `category` must be one of: `social | educational | volunteer | sports | arts | technology | other`
- `endTime` must be after `startTime`
- `capacity` must be ≥ 1 if provided

### Visibility Rule (getEventById)
- Published events: visible to all authenticated users
- Draft events: visible only to the organizer who created them and admins
- All others → `EventNotFoundError`

### Error → HTTP Mapping
| Error name | Status |
|---|---|
| `InvalidInputError` | 400 |
| `UnauthorizedError` | 403 |
| `EventNotFoundError` | 404 |
| `InvalidStateError` | 409 |

---

## AttendeeListService (Feature 12 — Emily Chu)

Retrieves RSVPs for an event, joined with user display names, grouped by status. Lives in `src/service/AttendeeListService.ts`.

```ts
interface IAttendeeListService {
  getAttendeeList(input: { eventId: string; userId: string; role: string }): Promise<Result<AttendeeList, AttendeeListError>>;
}
```

- Organizer of the event or admin → allowed
- Member → `AttendeeListForbiddenError`
- Event not found → `AttendeeListNotFoundError`
- User lookup failure → `AttendeeListUserLookupError`

Returns `AttendeeList` with `attending`, `waitlisted`, and `cancelled` arrays, each sorted by `rsvpedAt` ascending.

---

## DashboardService (Feature 8 — Dylan Wang)

Retrieves events grouped by status for the organizer dashboard. Lives in `src/event/DashboardService.ts`.

- Organizer → sees their own events only
- Admin → sees all events
- Member → `UnauthorizedError`

Returns `{ draft: Event[], published: Event[], pastOrCancelled: Event[] }` with attendee counts.
