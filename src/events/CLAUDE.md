# src/events/ — Events Module Guide

Owns **Features 1 (Event Creation)**, **2 (Event Detail Page)**, **3 (Event Editing)**, **5 (Event Publishing & Cancellation)**, **6 (Category and Date Filter)**, **8 (Organizer Event Dashboard)**, and **10 (Event Search)**.

| Feature | Owner |
|---|---|
| 1 — Event Creation | Haamed Rahman |
| 2 — Event Detail Page | Dylan Wang |
| 3 — Event Editing | Haamed Rahman |
| 5 — Event Publishing & Cancellation | Dylan Wang |
| 6 — Category and Date Filter | Megan Wells |
| 8 — Organizer Event Dashboard | Dylan Wang |
| 10 — Event Search | Megan Wells |

## File Map

| File | Purpose |
|---|---|
| `Event.ts` | Domain types: `Event`, `CreateEventInput`, `UpdateEventInput`, `EventCategory`, `EventStatus` |
| `errors.ts` | `EventError` discriminated union + factory functions |
| `EventRepository.ts` | `IEventRepository` interface — full CRUD (`create`, `findById`, `findAll`, `update`, `findByOrganizerId`) |
| `InMemoryEventRepository.ts` | In-memory impl of `IEventRepository` |
| `EventService.ts` | `IEventService` — `createEvent`, `getEventById`, `updateEvent` |
| `EventController.ts` | `IEventController` — event list, detail, filter, search routes |
| `EventCreationController.ts` | Handles creation form GET/POST |
| `EventEditingController.ts` | Handles edit form GET/POST |

> **Two EventRepository interfaces exist in the project:**
> - `src/events/EventRepository.ts` — full CRUD interface used by creation/editing/detail
> - `src/repository/EventRepository.ts` — filter-based `getEvents(filter)` used by the event list
>
> Do not confuse them. Each has its own in-memory implementation.

## Domain Types

```ts
type EventStatus   = "draft" | "published" | "cancelled" | "past"
type EventCategory = "social" | "educational" | "volunteer" | "sports" | "arts" | "technology" | "other"

interface Event {
  id: string
  title: string
  description: string
  location: string
  category: EventCategory
  startTime: Date
  endTime: Date
  capacity?: number
  status: EventStatus
  organizerId: string
}
```

## Error Types

```ts
type EventError =
  | { name: "InvalidInputError";   message: string }  // → 400
  | { name: "UnauthorizedError";   message: string }  // → 403
  | { name: "EventNotFoundError";  message: string }  // → 404
  | { name: "InvalidStateError";   message: string }  // → 409
```

## Feature Summaries

### Feature 1 — Event Creation (Haamed Rahman)
- Route: `GET /events/new`, `POST /events`
- Organizer identity comes from session, not the form
- New events start in `"draft"` status
- Validates: required fields, valid category, `endTime > startTime`, capacity ≥ 1
- Sprint 2: HTMX form submission + error display without full reload
- Sprint 4: Alpine.js character counter on description field

### Feature 2 — Event Detail Page (Dylan Wang)
- Route: `GET /events/:eventId`
- Visibility rule: drafts visible only to the creating organizer and admins
- Shows title, description, location, category, times, organizer name, attendee count vs capacity
- Organizers/admins see edit + cancel controls; members see RSVP button
- Sprint 4: Alpine.js relative time label ("in 3 days") alongside server-rendered date

### Feature 3 — Event Editing (Haamed Rahman)
- Route: `GET /events/:eventId/edit`, `POST /events/:eventId/edit`
- Organizer can edit their own non-cancelled, non-past events
- Admin can edit any event
- Same validation rules as creation
- Sprint 4: Alpine.js unsaved-changes warning on navigation

### Feature 5 — Event Publishing & Cancellation (Dylan Wang)
- Routes: `POST /events/:eventId/publish`, `POST /events/:eventId/cancel`
- Transitions: `draft → published`, `published → cancelled` (cancelled is terminal)
- Organizer can publish/cancel their own events; admin can cancel any event
- Invalid transition (e.g., publishing an already-published event) → `InvalidStateError`
- Sprint 2: HTMX inline badge/control update

### Feature 6 — Category and Date Filter (Megan Wells)
- Filter bar on the event list: category + timeframe (`all` | `week` | `weekend`)
- Only published events appear in results
- Active filters reflected in URL query params (bookmarkable)
- Works without JS via normal form submission (progressive enhancement)
- Sprint 2: HTMX inline list update with URL sync

### Feature 8 — Organizer Event Dashboard (Dylan Wang)
- Route: `GET /dashboard/organizer`
- Organizers see their own events grouped by status (published, draft, cancelled/past) with attendee counts
- Admins see all events across all organizers
- Members → 403
- Publish/cancel quick actions inline via HTMX (reuses Feature 5 routes)
- Sprint 4: Alpine.js collapsed cancelled/past section

### Feature 10 — Event Search (Megan Wells)
- Search input on main event list; matches title, description, location
- Empty query returns all published upcoming events
- Sprint 2: HTMX debounced inline update as user types
- Sprint 3: Prisma case-insensitive multi-field match
- Sprint 4: Alpine.js clear button inside field

## Views

```
src/views/events/
  index.ejs          # Event list with filter bar + search input
  new.ejs            # Creation form
  edit.ejs           # Edit form
  attendees.ejs      # Attendee list partial target
  _results.ejs       # HTMX partial: filtered/searched event list
src/views/event/
  detail.ejs         # Event detail page
  partials/
    edit-form.ejs    # HTMX partial: inline edit form
    event-detail.ejs # HTMX partial: event detail section
```

## Sprint Roadmap

| Sprint | Goal |
|---|---|
| 1 | Full CRUD stack, visibility rules, filter/search logic, in-memory data |
| 2 | Named error types, integration tests for all features, HTMX for form/filter/search/publish/cancel |
| 3 | Prisma-backed repositories for all features, tests still pass |
| 4 | Tailwind polish, Alpine.js enhancements per feature |
