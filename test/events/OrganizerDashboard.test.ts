import request from "supertest";
import type { Express } from "express";

import { CreateApp } from "../../src/app";
import { CreateAuthService } from "../../src/auth/AuthService";
import { CreateAuthController } from "../../src/auth/AuthController";
import { CreateAdminUserService } from "../../src/auth/AdminUserService";
import { CreatePasswordHasher } from "../../src/auth/PasswordHasher";
import { CreateInMemoryUserRepository } from "../../src/repository/InMemoryUserRepository";
import { CreateLoggingService } from "../../src/service/LoggingService";
import { CreateDashboardService } from "../../src/event/DashboardService";
import { CreateRSVPService } from "../../src/service/RSVPService";
import { CreateRSVPController } from "../../src/rsvp/RSVPController";
import { CreateInMemoryRSVPRepository } from "../../src/repository/InMemoryRSVPRepository";
import { InMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import { InMemoryEventRepository as FilterEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateEventService as CreateFilterEventService } from "../../src/service/EventService";
import { CreateEventController } from "../../src/events/EventController";
import { CreateAttendeeListController } from "../../src/attendee/AttendeeListController";
import { CreateAttendeeListService } from "../../src/service/AttendeeListService";
import { CreateEventCreationController } from "../../src/events/EventCreationController";
import { CreateEventEditingController } from "../../src/events/EventEditingController";
import { EventService } from "../../src/events/EventService";
import type { Event } from "../../src/events/Event";
import type { IRSVPRepository } from "../../src/repository/RSVPRepository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<Event> & { id: string; organizerId: string }): Event {
  return {
    title: "Test Event",
    description: "A test event description",
    location: "Room 101",
    category: "technology",
    startTime: new Date("2026-06-01T18:00:00"),
    endTime: new Date("2026-06-01T20:00:00"),
    capacity: 50,
    status: "published",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

interface BuiltApp {
  app: Express;
  rsvpRepository: IRSVPRepository;
}

function buildAppWithEvents(events: Event[]): BuiltApp {
  const logger = CreateLoggingService();

  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, logger);

  const sharedEventRepository = new InMemoryEventRepository();
  sharedEventRepository.seed(events);

  const rsvpRepository = CreateInMemoryRSVPRepository();
  const rsvpService = CreateRSVPService(rsvpRepository, sharedEventRepository);
  const rsvpController = CreateRSVPController(rsvpService, logger);

  const dashboardService = CreateDashboardService(sharedEventRepository, rsvpRepository);

  const filterEventRepository = new FilterEventRepository();
  filterEventRepository.seedFromCrudRepo(sharedEventRepository);

  const crudEventService = new EventService(sharedEventRepository);
  const filterEventService = CreateFilterEventService(filterEventRepository);

  const eventController = CreateEventController(filterEventService, logger);
  const eventCreationController = CreateEventCreationController(crudEventService, logger);
  const eventEditingController = CreateEventEditingController(crudEventService, logger);
  const attendeeListService = CreateAttendeeListService(
    sharedEventRepository,
    rsvpRepository,
    authUsers,
  );
  const attendeeListController = CreateAttendeeListController(attendeeListService, logger);

  const app = CreateApp(
    authController,
    rsvpController,
    eventController,
    attendeeListController,
    eventCreationController,
    eventEditingController,
    logger,
    crudEventService,
    dashboardService,
  ).getExpressApp();

  return { app, rsvpRepository };
}

async function loginAs(app: Express, email: string, password = "password123"): Promise<string> {
  const res = await request(app)
    .post("/login")
    .type("form")
    .send({ email, password });

  expect(res.status).toBe(302);

  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sidCookie = cookies.find((c: string) => c.startsWith("app.sid="));
  if (!sidCookie) {
    throw new Error("No app.sid cookie returned from /login");
  }
  return sidCookie.split(";")[0];
}

async function seedRsvp(
  repo: IRSVPRepository,
  userId: string,
  eventId: string,
  status: "going" | "waitlisted" | "cancelled" = "going",
): Promise<void> {
  const result = await repo.saveRSVP({
    id: `rsvp-${userId}-${eventId}`,
    userId,
    eventId,
    status,
    createdAt: new Date(),
  });
  if (result.ok === false) {
    throw new Error(`Failed to seed RSVP: ${result.value.message}`);
  }
}

// Known demo-user IDs from InMemoryUserRepository.DEMO_USERS
const ADMIN_ID = "user-admin";
const STAFF_ID = "user-staff";
const READER_ID = "user-reader";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /dashboard — Organizer Event Dashboard", () => {
  describe("Authorization", () => {
    it("redirects anonymous users to /login (authentication required)", async () => {
      const { app } = buildAppWithEvents([]);

      const res = await request(app).get("/dashboard");

      // requireAuthenticated redirects unauthenticated users.
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/login/);
    });

    it("returns 403 and an UnauthorizedError message when a member (role=user) requests the dashboard", async () => {
      const { app } = buildAppWithEvents([
        makeEvent({ id: "evt-1", organizerId: STAFF_ID }),
      ]);
      const cookie = await loginAs(app, "user@app.test");

      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.text.toLowerCase()).toContain("organizer");
      // No event data must be rendered when authorization fails.
      expect(res.text).not.toContain("Test Event");
    });
  });

  describe("Organizer scoping (role=staff)", () => {
    it("returns 200 and shows only events the staff organizer owns — never another organizer's events", async () => {
      const mine = makeEvent({
        id: "evt-staff-mine",
        title: "Staff Own Workshop",
        organizerId: STAFF_ID,
        status: "published",
      });
      const theirs = makeEvent({
        id: "evt-admin-other",
        title: "Admin Other Workshop",
        organizerId: ADMIN_ID,
        status: "published",
      });
      const { app } = buildAppWithEvents([mine, theirs]);
      const cookie = await loginAs(app, "staff@app.test");

      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Staff Own Workshop");
      expect(res.text).not.toContain("Admin Other Workshop");
    });

    it("groups the organizer's events into draft, published, and past/cancelled buckets", async () => {
      const draft = makeEvent({
        id: "evt-staff-draft",
        title: "Staff Draft Event",
        organizerId: STAFF_ID,
        status: "draft",
      });
      const published = makeEvent({
        id: "evt-staff-pub",
        title: "Staff Published Event",
        organizerId: STAFF_ID,
        status: "published",
      });
      const cancelled = makeEvent({
        id: "evt-staff-cancel",
        title: "Staff Cancelled Event",
        organizerId: STAFF_ID,
        status: "cancelled",
      });
      const { app } = buildAppWithEvents([draft, published, cancelled]);
      const cookie = await loginAs(app, "staff@app.test");

      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Staff Draft Event");
      expect(res.text).toContain("Staff Published Event");
      expect(res.text).toContain("Staff Cancelled Event");
      // Each section heading is rendered (with count suffix).
      expect(res.text).toMatch(/Published\s*<span[^>]*>\(1\)/);
      expect(res.text).toMatch(/Draft\s*<span[^>]*>\(1\)/);
      expect(res.text).toMatch(/Past &amp; Cancelled\s*<span[^>]*>\(1\)/);
    });
  });

  describe("Admin scoping (role=admin)", () => {
    it("returns 200 and shows every organizer's events to an admin", async () => {
      const adminOwn = makeEvent({
        id: "evt-admin-own",
        title: "Admin Own Event",
        organizerId: ADMIN_ID,
        status: "published",
      });
      const staffOwn = makeEvent({
        id: "evt-staff-own",
        title: "Staff Own Event",
        organizerId: STAFF_ID,
        status: "published",
      });
      const staffDraft = makeEvent({
        id: "evt-staff-draft",
        title: "Staff Draft Event",
        organizerId: STAFF_ID,
        status: "draft",
      });
      const { app } = buildAppWithEvents([adminOwn, staffOwn, staffDraft]);
      const cookie = await loginAs(app, "admin@app.test");

      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Admin Own Event");
      expect(res.text).toContain("Staff Own Event");
      expect(res.text).toContain("Staff Draft Event");
    });
  });

  describe("Attendee counts", () => {
    it("renders an accurate 'going' count per event and excludes cancelled/waitlisted RSVPs", async () => {
      const event = makeEvent({
        id: "evt-count-1",
        title: "Count Event",
        organizerId: STAFF_ID,
        status: "published",
      });
      const { app, rsvpRepository } = buildAppWithEvents([event]);

      // Three 'going' attendees — the only ones that should be counted.
      await seedRsvp(rsvpRepository, "attendee-1", "evt-count-1", "going");
      await seedRsvp(rsvpRepository, "attendee-2", "evt-count-1", "going");
      await seedRsvp(rsvpRepository, "attendee-3", "evt-count-1", "going");
      // Non-going RSVPs must NOT inflate the count.
      await seedRsvp(rsvpRepository, "attendee-4", "evt-count-1", "cancelled");
      await seedRsvp(rsvpRepository, "attendee-5", "evt-count-1", "waitlisted");

      const cookie = await loginAs(app, "staff@app.test");
      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("3 going");
      expect(res.text).not.toContain("5 going");
    });

    it("renders '0 going' for an event with no RSVPs (edge case)", async () => {
      const event = makeEvent({
        id: "evt-count-zero",
        title: "Zero Count Event",
        organizerId: STAFF_ID,
        status: "published",
      });
      const { app } = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Zero Count Event");
      expect(res.text).toContain("0 going");
    });

    it("reports independent counts for different events owned by the same organizer", async () => {
      const a = makeEvent({
        id: "evt-a",
        title: "Event A",
        organizerId: STAFF_ID,
        status: "published",
      });
      const b = makeEvent({
        id: "evt-b",
        title: "Event B",
        organizerId: STAFF_ID,
        status: "published",
      });
      const { app, rsvpRepository } = buildAppWithEvents([a, b]);

      await seedRsvp(rsvpRepository, "u1", "evt-a", "going");
      await seedRsvp(rsvpRepository, "u2", "evt-a", "going");
      await seedRsvp(rsvpRepository, "u1", "evt-b", "going");

      const cookie = await loginAs(app, "staff@app.test");
      const res = await request(app).get("/dashboard").set("Cookie", cookie);

      expect(res.status).toBe(200);
      // Both counts should appear exactly once — a=2, b=1.
      const twoGoing = res.text.match(/2 going/g) ?? [];
      const oneGoing = res.text.match(/1 going/g) ?? [];
      expect(twoGoing.length).toBe(1);
      expect(oneGoing.length).toBe(1);
    });
  });
});

// Touch the imported READER_ID so lint/tsc don't complain about unused bindings.
void READER_ID;
