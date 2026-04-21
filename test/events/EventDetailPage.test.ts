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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    organizerId: "user-admin",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/**
 * Build a fully composed Express app backed by in-memory repositories, seeded
 * with the provided events. Mirrors src/composition.ts but lets tests control
 * the initial event data.
 */
function buildAppWithEvents(events: Event[]): Express {
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

  return CreateApp(
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
}

/** Log in as one of the demo users and return the authenticated session cookie. */
async function loginAs(app: Express, email: string, password = "password123"): Promise<string> {
  const agent = request.agent(app);
  const res = await agent
    .post("/login")
    .type("form")
    .send({ email, password });

  // Successful login responds with a redirect (302) to /.
  expect(res.status).toBe(302);

  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sidCookie = cookies.find((c: string) => c.startsWith("app.sid="));
  if (!sidCookie) {
    throw new Error("No app.sid cookie returned from /login");
  }
  return sidCookie.split(";")[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /events/:id — Event Detail Page", () => {
  describe("Happy path", () => {
    it("returns 200 and renders the event details for a published event", async () => {
      const published = makeEvent({
        id: "evt-pub-1",
        title: "Spring Tech Meetup",
        description: "Talks on web development and open source.",
        location: "Campus Center",
        status: "published",
      });
      const app = buildAppWithEvents([published]);

      const res = await request(app).get("/events/evt-pub-1");

      expect(res.status).toBe(200);
      expect(res.text).toContain("Spring Tech Meetup");
      expect(res.text).toContain("Talks on web development and open source.");
      expect(res.text).toContain("Campus Center");
      // The page is rendered without an error partial on the happy path.
      expect(res.text).not.toContain("<h3 class=\"text-base font-semibold mb-1\">Error</h3>");
    });
  });

  describe("Domain errors", () => {
    it("returns 404 and a not-found message when the event does not exist (EventNotFoundError)", async () => {
      const app = buildAppWithEvents([makeEvent({ id: "evt-other" })]);

      const res = await request(app).get("/events/evt-does-not-exist");

      expect(res.status).toBe(404);
      expect(res.text).toContain("not found");
      expect(res.text).toContain("evt-does-not-exist");
    });

    it("returns 403 and a permission message when an anonymous viewer requests a draft event (UnauthorizedError)", async () => {
      const draft = makeEvent({
        id: "evt-draft-1",
        title: "Secret Draft Event",
        status: "draft",
        organizerId: "user-admin",
      });
      const app = buildAppWithEvents([draft]);

      const res = await request(app).get("/events/evt-draft-1");

      expect(res.status).toBe(403);
      expect(res.text).toContain("do not have permission");
      // The event body must NOT be rendered when authorization fails.
      expect(res.text).not.toContain("Secret Draft Event");
    });

    it("returns 400 and an input-required message when the event id is blank (InvalidInputError)", async () => {
      const app = buildAppWithEvents([makeEvent({ id: "evt-1" })]);

      // A URL-encoded whitespace path param hits the route but fails service-layer validation.
      const res = await request(app).get("/events/%20");

      expect(res.status).toBe(400);
      expect(res.text).toContain("Event ID is required");
    });
  });

  describe("Edge case", () => {
    it("allows an authenticated admin to view another organizer's draft event (draft visibility rule)", async () => {
      const draft = makeEvent({
        id: "evt-draft-admin-view",
        title: "Hidden Draft Workshop",
        description: "An unpublished session only admins and the organizer can see.",
        status: "draft",
        organizerId: "user-staff", // someone other than the logged-in admin
      });
      const app = buildAppWithEvents([draft]);
      const cookie = await loginAs(app, "admin@app.test");

      const res = await request(app)
        .get("/events/evt-draft-admin-view")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Hidden Draft Workshop");
      expect(res.text).toContain("An unpublished session only admins and the organizer can see.");
      // The rendered status badge confirms the draft was actually served (not a fallback).
      expect(res.text).toContain("Draft");
    });
  });
});
