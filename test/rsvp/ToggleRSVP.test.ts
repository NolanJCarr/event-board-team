import { CreateRSVPService } from "../../src/service/RSVPService";
import { CreateInMemoryRSVPRepository } from "../../src/repository/InMemoryRSVPRepository";
import { InMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import type { Event } from "../../src/events/Event";

function makeEvent(overrides: Partial<Event> & { id: string; startTime: Date }): Event {
  return {
    title: "Test Event",
    description: "A test event",
    location: "Room 101",
    category: "technology",
    endTime: new Date(overrides.startTime.getTime() + 2 * 60 * 60 * 1000),
    capacity: 10,
    status: "published",
    organizerId: "org-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const MEMBER  = { userId: "user-1", role: "user"  as const };
const MEMBER2 = { userId: "user-2", role: "user"  as const };
const ADMIN   = { userId: "admin-1", role: "admin" as const };
const STAFF   = { userId: "staff-1", role: "staff" as const };

const NOW    = new Date("2026-04-21T12:00:00Z");
const FUTURE = new Date("2026-06-01T18:00:00Z");
const PAST   = new Date("2026-03-01T18:00:00Z");

describe("RSVPService.toggleRSVP", () => {
  it("returns 'going' for a new RSVP when capacity is available", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);

    const result = await service.toggleRSVP(MEMBER, "evt-1", NOW);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("going");
  });

  it("returns 'waitlisted' for a new RSVP when event is full", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // fills the 1 spot

    const result = await service.toggleRSVP(MEMBER2, "evt-1", NOW);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("waitlisted");
  });

  it("cancels an active 'going' RSVP", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // going

    const result = await service.toggleRSVP(MEMBER, "evt-1", NOW);  // cancel

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("cancelled");
  });

  it("promotes the first waitlisted member when a 'going' RSVP is cancelled", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);   // going (fills capacity)
    await service.toggleRSVP(MEMBER2, "evt-1", NOW);  // waitlisted

    await service.toggleRSVP(MEMBER, "evt-1", NOW);   // cancel — should promote MEMBER2

    const rsvp = await rsvpRepo.findRSVP(MEMBER2.userId, "evt-1");
    expect(rsvp.ok).toBe(true);
    if (rsvp.ok) expect(rsvp.value?.status).toBe("going");
  });

  it("cancels an active 'waitlisted' RSVP", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);   // going (fills capacity)
    await service.toggleRSVP(MEMBER2, "evt-1", NOW);  // waitlisted

    const result = await service.toggleRSVP(MEMBER2, "evt-1", NOW);  // cancel waitlist

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("cancelled");
  });

  it("reactivates a previously cancelled RSVP", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // going
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // cancelled

    const result = await service.toggleRSVP(MEMBER, "evt-1", NOW);  // reactivate

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("going");
  });

  it("rejects admin actors", async () => {
    const service = CreateRSVPService(CreateInMemoryRSVPRepository(), new InMemoryEventRepository());

    const result = await service.toggleRSVP(ADMIN, "evt-1", NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("UnauthorizedError");
  });

  it("rejects staff actors", async () => {
    const service = CreateRSVPService(CreateInMemoryRSVPRepository(), new InMemoryEventRepository());

    const result = await service.toggleRSVP(STAFF, "evt-1", NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("UnauthorizedError");
  });

  it("rejects when event does not exist", async () => {
    const service = CreateRSVPService(CreateInMemoryRSVPRepository(), new InMemoryEventRepository());

    const result = await service.toggleRSVP(MEMBER, "evt-ghost", NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("EventNotFoundError");
  });

  it("rejects RSVP to a cancelled event", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE, status: "cancelled" })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);

    const result = await service.toggleRSVP(MEMBER, "evt-1", NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("InvalidStateError");
  });

  it("rejects RSVP to a past event", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: PAST })]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);

    const result = await service.toggleRSVP(MEMBER, "evt-1", NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("InvalidStateError");
  });
});
