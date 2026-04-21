# test/ — Integration Test Guide

## Location & Structure

Tests live in `test/` at the project root, mirroring the feature structure:

```
test/
  rsvp/
    ToggleRSVP.test.ts        # Feature 4 — RSVP toggle logic
    MyRSVPsDashboard.test.ts  # Feature 7 — dashboard grouping/sorting
  events/
    EventService.test.ts      # Features 1, 2, 3 — creation, detail, editing
    EventDetailPage.test.ts   # Feature 2 — detail page visibility rules
  attendee/
    AttendeeListService.test.ts  # Feature 12 — attendee list access + grouping
  smoke.test.ts               # Basic app startup smoke test
```

## Rules

1. **Use the in-memory repository** — never mock the repository. Tests run against the real in-memory implementation so they continue to pass after the Sprint 3 Prisma migration without modification.
2. **Cover the happy path, every named error, and at least one edge case** per feature.
3. **Tests must not read the session** — pass actor identity (`userId`, `role`) directly to service methods.
4. **No external dependencies** — no network calls, no file I/O, no real database in tests.

## What to Test per Feature

| Feature | Required Test Coverage |
|---|---|
| 1 — Event Creation | Happy path, each `InvalidInputError` case, unauthorized role |
| 2 — Event Detail Page | Published event visible, draft hidden from non-owner, not found |
| 3 — Event Editing | Happy path, not found, unauthorized, invalid state, invalid input |
| 4 — RSVP Toggle | New RSVP (attending), new RSVP (waitlisted when full), cancel (attending), cancel (waitlisted), reactivate cancelled, unauthorized role, event not found, cancelled/past event |
| 5 — Publishing & Cancellation | Draft→published, published→cancelled, invalid transitions, unauthorized |
| 6 — Category & Date Filter | No filter (all), category filter, each timeframe, invalid input |
| 7 — My RSVPs Dashboard | Correct grouping, correct sort, organizer/admin access rejected |
| 8 — Organizer Dashboard | Organizer sees own events only, admin sees all, member rejected, counts accurate |
| 9 — Waitlist Promotion | Promotion on cancel, no promotion when waitlist empty, atomic operation |
| 10 — Event Search | Match results, no results, empty query, invalid input |
| 12 — Attendee List | Authorized (organizer, admin), unauthorized (member), grouping, sorting |

## Running Tests

```bash
npm test           # run all tests
npm test -- --testPathPattern=rsvp   # run only RSVP tests
```

## Test File Pattern

```ts
import { CreateInMemoryFooRepository } from "../src/repository/InMemoryFooRepository";
import { CreateFooService } from "../src/service/FooService";

describe("FooService", () => {
  let service: IFooService;

  beforeEach(() => {
    const repo = CreateInMemoryFooRepository();
    service = CreateFooService(repo);
  });

  it("happy path", async () => {
    const result = await service.doSomething({ ... });
    expect(result.ok).toBe(true);
  });

  it("returns NamedError when ...", async () => {
    const result = await service.doSomething({ ... });
    expect(result.ok).toBe(false);
    expect(result.value.name).toBe("NamedError");
  });
});
```
