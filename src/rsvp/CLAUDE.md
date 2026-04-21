# src/rsvp/ — RSVP Module Guide

Owns **Features 4 (RSVP Toggle)**, **7 (My RSVPs Dashboard)**, and coordinates with **Feature 9 (Waitlist Promotion)** owned by Emily Chu.

Feature owner: **Nolan Carreiro**

## File Map

| File | Purpose |
|---|---|
| `RSVPController.ts` | `IRSVPController` — handles toggle route and dashboard route, maps errors to HTTP |
| `errors.ts` | `RSVPError` discriminated union + factory functions |

Domain types (`IRSVP`, `RSVPStatus`) and the repository live in `src/event/` and `src/repository/`.

## Feature 4 — RSVP Toggle

Members see an RSVP button on each event's detail page. Clicking toggles their attendance. If the event is full, the member is placed on the waitlist. The button updates inline via HTMX — no full page reload.

### Error Types

```ts
export type RSVPError =
  | { name: "UnauthorizedError";         message: string }  // wrong role (admin/staff)
  | { name: "EventNotFoundError";        message: string }  // event doesn't exist
  | { name: "InvalidStateError";         message: string }  // cancelled or past event
  | { name: "UnexpectedDependencyError"; message: string }  // repository failure
```

### Actor

```ts
export interface RSVPActor {
  userId: string;
  role: "admin" | "staff" | "user";
}
```

### Toggle Logic (three internal cases)

| Current state | Outcome |
|---|---|
| No existing record | `"attending"` if capacity allows, `"waitlisted"` if full |
| Active RSVP (`attending` or `waitlisted`) | `"cancelled"`; if attending, promote first waitlisted member (Feature 9) |
| Previously cancelled | Same capacity check as a new RSVP |

### Rejection Rules

- `admin` and `staff` roles → `UnauthorizedError`
- Event not found → `EventNotFoundError`
- Cancelled or past event → `InvalidStateError`

### Controller → HTTP Mapping

| RSVPError name | HTTP status |
|---|---|
| `UnauthorizedError` | 403 |
| `EventNotFoundError` | 404 |
| `InvalidStateError` | 409 |
| `UnexpectedDependencyError` | 500 |

### Route

```
POST /events/:eventId/rsvp
```

HTMX: returns `rsvp/partials/rsvp-button.ejs` (Sprint 2+) with `{ layout: false }`.

## Feature 7 — My RSVPs Dashboard

Members view all their RSVPs grouped into upcoming (attending/waitlisted) and past/cancelled. They can cancel an RSVP directly from this page — reuses the toggle route.

### Access Rules

- `user` role only — `admin` and `staff` do not have RSVPs, return 403.

### Grouping & Sort

| Section | Contents | Sort |
|---|---|---|
| Upcoming | `attending` or `waitlisted` RSVPs for future events | Soonest event first |
| Past / Cancelled | `cancelled` RSVPs or RSVPs for past/cancelled events | Most recent first |

### Route

```
GET /rsvp/dashboard
```

### View

`src/views/rsvp/dashboard.ejs` — full page render. Cancel action posts to `POST /events/:eventId/rsvp` via HTMX (Feature 4 route) and swaps the row inline.

## Coordination — Feature 9 (Waitlist Promotion, Emily Chu)

When an attending member cancels, `toggleRSVP` must atomically:
1. Set their RSVP to `"cancelled"`
2. Promote the earliest `"waitlisted"` member to `"attending"`

The contract for this side effect is defined in `contracts-roles/CONTRACTS.md`. Do not change the `toggleRSVP` return shape without coordinating with Emily.

## Sprint Roadmap

| Sprint | Goal |
|---|---|
| 1 | In-memory toggle, role rejection, dashboard route |
| 2 | Named error types, tests for all toggle/dashboard states, HTMX button |
| 3 | Prisma-backed repository, capacity check against live data |
| 4 | Style button per state, Alpine.js transition, confirmation prompt on dashboard cancel |
