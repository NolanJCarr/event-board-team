# src/attendee/ — Attendee List Module Guide

Owns **Feature 12 — Attendee List (Organizer)**.

Feature owner: **Emily Chu**

## What It Does

From the event detail page, an organizer can view everyone who has RSVPed to their event, grouped by status: attending, waitlisted, and cancelled. Each entry shows the attendee's display name and the time they RSVPed. Admins can see any event's attendee list. Members cannot.

## File Map

| File | Purpose |
|---|---|
| `Attendee.ts` | Domain types: `AttendeeEntry`, `AttendeeList` |
| `AttendeeListController.ts` | `IAttendeeListController` — handles `GET /events/:eventId/attendees`, maps errors to HTTP |
| `errors.ts` | `AttendeeListError` discriminated union + factory functions |

The service (`IAttendeeListService`) lives in `src/service/AttendeeListService.ts`. The RSVP repository (`IRSVPRepository`) lives in `src/repository/`.

## Domain Types

```ts
interface AttendeeEntry {
  userId: string;
  displayName: string;
  status: RSVPStatus;       // "going" | "waitlisted" | "cancelled"
  rsvpedAt: Date;           // maps to RSVPRecord.createdAt
}

interface AttendeeList {
  eventId: string;
  attending: AttendeeEntry[];
  waitlisted: AttendeeEntry[];
  cancelled: AttendeeEntry[];
}
```

## Error Types

```ts
type AttendeeListError =
  | { name: "AttendeeListForbiddenError";   message: string }  // → 403
  | { name: "AttendeeListNotFoundError";    message: string }  // → 404
  | { name: "AttendeeListUserLookupError";  message: string }  // → 500
```

## Controller → HTTP Mapping

| Error name | HTTP status |
|---|---|
| `AttendeeListForbiddenError` | 403 |
| `AttendeeListNotFoundError` | 404 |
| `AttendeeListUserLookupError` | 500 |

## Access Rules

- `staff` or `admin` role, **or** the organizer of the event → allowed
- `user` role → `AttendeeListForbiddenError` (403)

## Route

```
GET /events/:eventId/attendees
```

Always returns the attendee list as an **HTMX partial** (`layout: false`). Triggered by the "View Attendees" button on the event detail page:

```html
<button hx-get="/events/<%= event.id %>/attendees"
        hx-target="#attendee-list"
        hx-swap="innerHTML">
  View Attendees
</button>
<div id="attendee-list" class="mt-6"></div>
```

## View

`src/views/event/partials/attendees.ejs` — HTMX fragment showing the three grouped sections.

## Sprint Roadmap

| Sprint | Goal |
|---|---|
| 1 | Route + service + in-memory repository; enforce organizer/admin access; group + sort results |
| 2 | Tests: authorized access, unauthorized access, grouping, sorting; HTMX inline load |
| 3 | Prisma-backed repository joining RSVPs with user display names |
| 4 | Alpine.js toggle (hidden by default, revealed on button click); styled panel |

## Coordination — Feature 4 (RSVP Toggle, Nolan Carreiro)

The attendee list reads from the same RSVP data that Feature 4 writes. The `RSVPRecord` shape and `RSVPStatus` values are defined in `src/repository/`. Do not change those types without coordinating with the Feature 4 owner.
