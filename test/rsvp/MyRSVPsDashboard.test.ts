import { CreateRSVPService } from "../../src/service/RSVPService";
import { CreateInMemoryRSVPRepository } from "../../src/repository/InMemoryRSVPRepository";
import { CreateInMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import type { AppEvent } from "../../src/events/Event";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AppEvent> & { id: string; startTime: Date }): AppEvent {
  return {
    title: "Test Event",
    description: "A test event",
    location: "Room 101",
    category: "social",
    endTime: new Date(overrides.startTime.getTime() + 2 * 60 * 60 * 1000),
    capacity: 10,
    status: "published",
    organizerId: "org-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const MEMBER = { userId: "user-1", role: "user" as const };
const ADMIN  = { userId: "admin-1", role: "admin" as const };
const STAFF  = { userId: "staff-1", role: "staff" as const };

const NOW = new Date("2026-04-14T12:00:00Z");
const FUTURE = new Date("2026-06-01T18:00:00Z");
const PAST   = new Date("2026-03-01T18:00:00Z");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RSVPService.getMyRSVPs", () => {
  it("returns an empty dashboard when the user has no RSVPs", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    const service = CreateRSVPService(rsvpRepo, eventRepo);

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(0);
      expect(result.value.pastAndCancelled).toHaveLength(0);
    }
  });

  it("rejects admin actors", async () => {
    const service = CreateRSVPService(CreateInMemoryRSVPRepository(), CreateInMemoryEventRepository());

    const result = await service.getMyRSVPs(ADMIN, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedError");
    }
  });

  it("rejects staff actors", async () => {
    const service = CreateRSVPService(CreateInMemoryRSVPRepository(), CreateInMemoryEventRepository());

    const result = await service.getMyRSVPs(STAFF, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedError");
    }
  });

  it("places an active RSVP for a future event in upcoming", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    const futureEvent = makeEvent({ id: "evt-1", startTime: FUTURE });
    eventRepo.seed([futureEvent]);

    await rsvpRepo.setCapacity("evt-1", 10);
    await CreateRSVPService(rsvpRepo, eventRepo).registerEvent("evt-1", 10);
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-1", 10);
    await service.toggleRSVP(MEMBER, "evt-1");

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(1);
      expect(result.value.upcoming[0].event.id).toBe("evt-1");
      expect(result.value.pastAndCancelled).toHaveLength(0);
    }
  });

  it("places an active RSVP for a past event in pastAndCancelled", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    const pastEvent = makeEvent({ id: "evt-past", startTime: PAST });
    eventRepo.seed([pastEvent]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-past", 10);
    await service.toggleRSVP(MEMBER, "evt-past");

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pastAndCancelled).toHaveLength(1);
      expect(result.value.pastAndCancelled[0].event.id).toBe("evt-past");
      expect(result.value.upcoming).toHaveLength(0);
    }
  });

  it("places a cancelled RSVP for a future event in pastAndCancelled", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    const futureEvent = makeEvent({ id: "evt-2", startTime: FUTURE });
    eventRepo.seed([futureEvent]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-2", 10);
    await service.toggleRSVP(MEMBER, "evt-2"); // going
    await service.toggleRSVP(MEMBER, "evt-2"); // cancelled

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(0);
      expect(result.value.pastAndCancelled).toHaveLength(1);
      expect(result.value.pastAndCancelled[0].rsvp.status).toBe("cancelled");
    }
  });

  it("sorts upcoming events soonest first", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    const soon   = makeEvent({ id: "evt-soon",  startTime: new Date("2026-05-01T10:00:00Z") });
    const later  = makeEvent({ id: "evt-later", startTime: new Date("2026-07-01T10:00:00Z") });
    eventRepo.seed([later, soon]); // seeded out of order intentionally

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-soon", 10);
    await service.registerEvent("evt-later", 10);
    await service.toggleRSVP(MEMBER, "evt-later");
    await service.toggleRSVP(MEMBER, "evt-soon");

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming[0].event.id).toBe("evt-soon");
      expect(result.value.upcoming[1].event.id).toBe("evt-later");
    }
  });

  it("sorts pastAndCancelled events most recent first", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    const older  = makeEvent({ id: "evt-older", startTime: new Date("2026-01-01T10:00:00Z") });
    const recent = makeEvent({ id: "evt-recent", startTime: new Date("2026-03-15T10:00:00Z") });
    eventRepo.seed([older, recent]);

    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-older", 10);
    await service.registerEvent("evt-recent", 10);
    await service.toggleRSVP(MEMBER, "evt-older");
    await service.toggleRSVP(MEMBER, "evt-recent");

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pastAndCancelled[0].event.id).toBe("evt-recent");
      expect(result.value.pastAndCancelled[1].event.id).toBe("evt-older");
    }
  });

  it("silently skips RSVPs whose event is not found (data consistency edge case)", async () => {
    const rsvpRepo = CreateInMemoryRSVPRepository();
    const eventRepo = CreateInMemoryEventRepository();
    // Register the event so the RSVP can be created, but don't seed it in eventRepo
    const service = CreateRSVPService(rsvpRepo, eventRepo);
    await service.registerEvent("evt-ghost", 10);
    await service.toggleRSVP(MEMBER, "evt-ghost");

    const result = await service.getMyRSVPs(MEMBER, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(0);
      expect(result.value.pastAndCancelled).toHaveLength(0);
    }
  });
});
