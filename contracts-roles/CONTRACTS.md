# CONTRACTS.md

## Overview

This document defines the service layer contracts for the Local Event Board project.
All team members must follow these interfaces exactly.

All service methods:

* Return `Result<T, E>`
* Do NOT throw for expected errors
* Do NOT access session directly (userId/role passed in)

---

The event object is as defined below:

{
  ok: true,
  value: {
    id: "evt_123",
    title: "Hackathon",
    description: "24-hour coding event",
    location: "Campus Center",
    category: "tech",
    startTime: new Date("2026-05-01T10:00:00"),
    endTime: new Date("2026-05-02T10:00:00"),
    capacity: 100,
    status: "published",
    organizerId: "user_456"
  }
}

# EventService Contracts

## createEvent

**Description:** Create a new event in draft state.

**Input:**

```ts
{
  title: string
  description: string
  location: string
  category: string
  startTime: Date
  endTime: Date
  capacity?: number
  organizerId: string
}
```

**Success Output:**

```ts
Event
```

**Errors:**

* `InvalidInputError`
* `UnauthorizedError`

---

## getEventById

**Description:** Fetch event details with visibility rules.

**Input:**

```ts
{
  eventId: string
  userId: string
  role: string
}
```

**Success Output:**

```ts
Event
```

**Errors:**

* `EventNotFoundError`
* `UnauthorizedError`

---

## updateEvent

**Description:** Edit an existing event.

**Input:**

```ts
{
  eventId: string
  updates: Partial<Event>
  userId: string
  role: string
}
```

**Success Output:**

```ts
Event
```

**Errors:**

* `EventNotFoundError`
* `UnauthorizedError`
* `InvalidStateError`
* `InvalidInputError`

---

## getEvents (for list, filter, search)

**Description:** Retrieve published upcoming events with optional filters/search.

**Input:**

```ts
{
  category?: string
  timeframe?: "all" | "week" | "weekend"
  searchQuery?: string
}
```

**Success Output:**

```ts
Event[]
```

**Errors:**

* `InvalidInputError`

---

## getOrganizerEvents

**Description:** Get events created by an organizer.

**Input:**

```ts
{
  userId: string
  role: string
}
```

**Success Output:**

```ts
{
  draft: Event[]
  published: Event[]
  pastOrCancelled: Event[]
}
```

**Errors:**

* `UnauthorizedError`

---

---

# RSVPService Contracts

## toggleRSVP

**Description:** Toggle RSVP status (going, waitlisted, cancelled).

**Input:**

```ts
{
  eventId: string
  userId: string
}
```

**Success Output:**

```ts
{
  status: "going" | "waitlisted" | "cancelled"
}
```

**Errors:**

* `EventNotFoundError`
* `InvalidStateError`
* `UnauthorizedError`

---

## cancelRSVP (used for dashboards + waitlist logic)

**Description:** Cancel RSVP and trigger waitlist promotion.

**Input:**

```ts
{
  eventId: string
  userId: string
}
```

**Success Output:**

```ts
{
  cancelled: boolean
  promotedUserId?: string
}
```

**Errors:**

* `EventNotFoundError`
* `InvalidStateError`

---

## getUserRSVPs

**Description:** Get all RSVPs for a member.

**Input:**

```ts
{
  userId: string
}
```

**Success Output:**

```ts
{
  upcoming: Event[]
  past: Event[]
}
```

**Errors:**

* `UnauthorizedError`

---

## getEventAttendees

**Description:** Get attendees for an event.

**Input:**

```ts
{
  eventId: string
  userId: string
  role: string
}
```

**Success Output:**

```ts
{
  going: RSVP[]
  waitlisted: RSVP[]
  cancelled: RSVP[]
}
```

**Errors:**

* `UnauthorizedError`
* `EventNotFoundError`

---

---

# Shared Types

## Event

```ts
{
  id: string
  title: string
  description: string
  location: string
  category: string
  startTime: Date
  endTime: Date
  capacity?: number
  status: "draft" | "published" | "cancelled" | "past"
  organizerId: string
}
```

## RSVP

```ts
{
  id: string
  userId: string
  eventId: string
  status: "going" | "waitlisted" | "cancelled"
  createdAt: Date
}
```

---

# Error Types

All services must use these named errors:

* `InvalidInputError` → 400
* `UnauthorizedError` → 403
* `EventNotFoundError` → 404
* `InvalidStateError` → 409

---

# Notes

* These contracts must NOT change without team agreement.
* Controllers must map errors to HTTP responses.
* Repositories must match these data shapes.
* Any violation may result in an Integration Compromise penalty.
