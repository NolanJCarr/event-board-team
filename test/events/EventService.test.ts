import { CreateEventService } from "../../src/service/EventService";
import { Ok, Err } from "../../src/lib/result";
import type { Event, EventError, GetEventsFilter } from "../../src/repository/EventRepository";
import type { IEventRepository } from "../../src/repository/EventRepository";


function makeFakeRepository(events: Event[]): IEventRepository {
  return {
    async getEvents(_filter: GetEventsFilter) {
      return Ok(events);
    },
  };
}

function makeEvent(overrides: Partial<Event> & { id: string }): Event {
  return {
    title: "Test Event",
    description: "A test event description",
    location: "Room 101",
    category: "technology",
    startTime: new Date("2026-06-01T18:00:00"),
    endTime: new Date("2026-06-01T20:00:00"),
    capacity: 50,
    status: "published",
    organizerId: "org-1",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("EventService.getEvents", () => {


  it("returns all events when no filters are passed in", async () => {
    const events = [
      makeEvent({ id: "evt-1" }),
      makeEvent({ id: "evt-2" }),
    ];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({});
   

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });

  it("returns events when a valid category filter is passed in", async () => {
    const events = [makeEvent({ id: "evt-1", category: "technology" })];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({ category: "technology" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });

  it("returns events when timeframe is set to all", async () => {
    const events = [makeEvent({ id: "evt-1" })];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({ timeframe: "all" });

    expect(result.ok).toBe(true);
  });

  it("returns events when timeframe is set to week", async () => {
    const events = [makeEvent({ id: "evt-1" })];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({ timeframe: "week" });

    expect(result.ok).toBe(true);
  });

  it("returns events when timeframe is set to weekend", async () => {
    const events = [makeEvent({ id: "evt-1" })];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({ timeframe: "weekend" });

    expect(result.ok).toBe(true);
  });

  it("returns events when a valid search query is passed in", async () => {
    const events = [makeEvent({ id: "evt-1", title: "Jazz Night" })];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({ searchQuery: "Jazz" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });

  it("returns events when category, timeframe, and searchQuery are all passed together", async () => {
    const events = [makeEvent({ id: "evt-1" })];
    const service = CreateEventService(makeFakeRepository(events));

    const result = await service.getEvents({
      category: "technology",
      timeframe: "week",
      searchQuery: "meetup",
    });

    expect(result.ok).toBe(true);
  });

  it("returns an empty list when the repository has no events", async () => {
    const service = CreateEventService(makeFakeRepository([]));

    const result = await service.getEvents({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("returns an error when the search query is only whitespace", async () => {
    const service = CreateEventService(makeFakeRepository([]));

    const result = await service.getEvents({ searchQuery: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidSearchError");
    }
  });

  it("returns InvalidTimeframeError when timeframe is not a valid value", async () => {
    const service = CreateEventService(makeFakeRepository([]));


    const result = await service.getEvents({
      timeframe: "tomorrow" as "all" | "week" | "weekend",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidTimeframeError");
      expect(result.value.message).toBe("Invalid timeframe value. Must be all, week, or weekend.");
    }
  });

  it("returns InvalidSearchError when the search query is over 200 characters", async () => {
    const service = CreateEventService(makeFakeRepository([]));
    const longQuery = "a".repeat(201);
   

    const result = await service.getEvents({ searchQuery: longQuery });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidSearchError");
      expect(result.value.message).toBe("Search query is too long. Must be under 200 characters.");
    }
  });

  it("returns ok when the search query is exactly 200 characters", async () => {
    const service = CreateEventService(makeFakeRepository([]));
    const maxQuery = "a".repeat(200);
   

    const result = await service.getEvents({ searchQuery: maxQuery });

    expect(result.ok).toBe(true);
  });
});