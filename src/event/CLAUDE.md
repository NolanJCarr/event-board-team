# src/event/ — Event Domain Types (Organizer Dashboard & RSVP)

This directory holds **shared domain types** used by the organizer dashboard feature and the RSVP module. It is not a feature module itself — it contains supporting types and a minimal repository interface for the organizer dashboard view.

## File Map

| File | Purpose |
|---|---|
| `RSVP.ts` | `IRSVP` interface, `RSVPStatus` type (`"going" \| "waitlisted" \| "cancelled"`) |
| `RSVPRepository.ts` | `IRSVPRepository` interface — `findByEventId(eventId): IRSVP[]` |
| `InMemoryRSVPRepository.ts` | In-memory implementation of `IRSVPRepository` |
| `DashboardService.ts` | Organizer dashboard service logic (Feature 8) |

## RSVP Types

```ts
type RSVPStatus = "going" | "waitlisted" | "cancelled"

interface IRSVP {
  userId: string;
  eventId: string;
  status: RSVPStatus;
}
```

> **Note:** `src/repository/` also has RSVP types (`RSVPRecord`, `IRSVPRepository`). The types in this directory (`src/event/`) are the older/simpler form used by the organizer dashboard. The `src/repository/` version is more complete and used by RSVPService and AttendeeListService. Prefer `src/repository/` for new work.

## DashboardService — Feature 8 (Dylan Wang)

Retrieves events grouped by status for the organizer dashboard.

- Organizer: sees only their own events
- Admin: sees all events across all organizers
- Member: → `UnauthorizedError`

Returns:
```ts
{
  draft: Event[]
  published: Event[]
  pastOrCancelled: Event[]
}
```

Each group includes accurate attendee counts derived from the RSVP repository.
