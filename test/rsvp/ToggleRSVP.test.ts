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
  
  // tests for waitlist promotion
  it("does not promote anyone when waitlist is empty", async()=>{
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE})]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1",1);

    await service.toggleRSVP(MEMBER, "evt-1", NOW);

    await service.toggleRSVP(MEMBER, "evt-1", NOW);

    const count = await rsvpRepo.countAttendees("evt-1");
    expect(count.ok).toBe(true);
    if (count.ok) expect(count.value).toBe(0); 
  });

  it("returns correct wailtist positions", async() =>{
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE})]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);

    await service.toggleRSVP(MEMBER, "evt-1", NOW);
    await service.toggleRSVP(MEMBER2, "evt-1", NOW);

    const MEMBER3 = {userId: "user-3", role: "user" as const};
    await service.toggleRSVP(MEMBER3, "evt-1", NOW);

    const pos1 = await rsvpRepo.getWaitlistPosition(MEMBER2.userId, "evt-1");
    const pos2 = await rsvpRepo.getWaitlistPosition(MEMBER3.userId, "evt-1");

    expect(pos1.ok).toBe(true);
    expect(pos2.ok).toBe(true);

    if(pos1.ok) expect(pos1.value).toBe(1);
    if(pos2.ok) expect(pos2.value).toBe(2);
  });
});

describe("RSVPService.getStatusForEvent", () => {
  it("returns null when the user has no RSVP for the event", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);

    const result = await service.getStatusForEvent(MEMBER, "evt-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("returns 'going' after the user RSVPs to an event with capacity", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);

    const result = await service.getStatusForEvent(MEMBER, "evt-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("going");
  });

  it("returns 'waitlisted' when the event is full and the user is on the waitlist", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);   // fills the one spot
    await service.toggleRSVP(MEMBER2, "evt-1", NOW);  // waitlisted

    const result = await service.getStatusForEvent(MEMBER2, "evt-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("waitlisted");
  });

  it("returns 'cancelled' after the user cancels their active RSVP", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // going
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // cancel

    const result = await service.getStatusForEvent(MEMBER, "evt-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("cancelled");
  });
});

describe("RSVPService.getUserRSVPStatuses", () => {
  it("returns an empty map when the user has no RSVPs", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    const service = CreateRSVPService(rsvpRepo, eventRepo);

    const result = await service.getUserRSVPStatuses(MEMBER);

    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.value).length).toBe(0);
  });

  it("includes an event the user is going to", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);

    const result = await service.getUserRSVPStatuses(MEMBER);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value["evt-1"]).toBe("going");
  });

  it("includes an event the user is waitlisted for", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);   // fills the spot
    await service.toggleRSVP(MEMBER2, "evt-1", NOW);  // waitlisted

    const result = await service.getUserRSVPStatuses(MEMBER2);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value["evt-1"]).toBe("waitlisted");
  });

  it("excludes events where the user has cancelled their RSVP", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([makeEvent({ id: "evt-1", startTime: FUTURE })]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // going
    await service.toggleRSVP(MEMBER, "evt-1", NOW);  // cancel

    const result = await service.getUserRSVPStatuses(MEMBER);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value["evt-1"]).toBeUndefined();
  });

  it("returns statuses for multiple events", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = new InMemoryEventRepository();
    eventRepo.seed([
      makeEvent({ id: "evt-1", startTime: FUTURE }),
      makeEvent({ id: "evt-2", startTime: FUTURE }),
    ]);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 1);
    await service.registerEvent("evt-2", 10);
    await service.toggleRSVP(MEMBER, "evt-1", NOW);   // going (fills it)
    await service.toggleRSVP(MEMBER2, "evt-1", NOW);  // waitlisted on evt-1
    await service.toggleRSVP(MEMBER2, "evt-2", NOW);  // going on evt-2

    const result = await service.getUserRSVPStatuses(MEMBER2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["evt-1"]).toBe("waitlisted");
      expect(result.value["evt-2"]).toBe("going");
    }
  });
});
