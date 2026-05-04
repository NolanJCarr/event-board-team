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
    organizerId: "user-staff",
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
  const eventEditingController = CreateEventEditingController(crudEventService, logger, dashboardService);
  const attendeeListService = CreateAttendeeListService(
    sharedEventRepository,
    rsvpRepository,
    authUsers,
  );
  const attendeeListController = CreateAttendeeListController(attendeeListService, logger);

  return CreateApp(
    authController,
    rsvpController,
    rsvpService,
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

describe("POST /events/:id — Event Editing", () => {
  describe("Happy path", () => {
    it("updates an event with valid input and returns 302 redirect (full page submission)", async () => {
      const event = makeEvent({
        id: "evt-1",
        title: "Original Title",
        organizerId: "user-staff",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      const updateData = {
        title: "Updated Title",
        description: "Updated description",
        location: "Updated location",
        category: "educational",
        startTime: "2026-06-02T10:00",
        endTime: "2026-06-02T12:00",
        capacity: "75",
      };

      const res = await request(app)
        .post("/events/evt-1")
        .set("Cookie", cookie)
        .type("form")
        .send(updateData);

      // Full page submission should redirect to event detail
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events/evt-1");
    });

    it("updates an event and returns updated event detail (HTMX submission)", async () => {
      const event = makeEvent({
        id: "evt-2",
        title: "Before Update",
        organizerId: "user-admin",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "admin@app.test");

      const updateData = {
        title: "After Update",
        description: "New description",
        location: "New location",
        category: "sports",
        startTime: "2026-07-01T14:00",
        endTime: "2026-07-01T16:00",
      };

      const res = await request(app)
        .post("/events/evt-2")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      // HTMX submission should return event detail partial
      expect(res.status).toBe(200);
      expect(res.text).toContain("After Update");
      expect(res.text).toContain("New description");
    });

    it("allows partial update (only some fields changed)", async () => {
      const event = makeEvent({
        id: "evt-3",
        title: "Original Title",
        description: "Original description",
        organizerId: "user-staff",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      // Only update title
      const updateData = {
        title: "Only Title Changed",
        description: event.description,
        location: event.location,
        category: event.category,
        startTime: event.startTime.toISOString().slice(0, 16),
        endTime: event.endTime.toISOString().slice(0, 16),
      };

      const res = await request(app)
        .post("/events/evt-3")
        .set("Cookie", cookie)
        .type("form")
        .send(updateData);

      expect(res.status).toBe(302);
    });
  });

  describe("Domain errors", () => {
    it("returns 404 EventNotFoundError when event does not exist", async () => {
      const app = buildAppWithEvents([]);
      const cookie = await loginAs(app, "admin@app.test");

      const updateData = {
        title: "Updated Title",
        description: "Updated description",
        location: "Updated location",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-nonexistent")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(404);
      expect(res.text).toContain("not found");
    });

    it("returns 403 UnauthorizedError when non-organizer/non-admin tries to edit", async () => {
      const event = makeEvent({
        id: "evt-4",
        organizerId: "user-admin", // owned by admin
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test"); // different user

      const updateData = {
        title: "Unauthorized Update",
        description: "Should not work",
        location: "No access",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-4")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(403);
      expect(res.text).toContain("permission");
    });

    it("returns 409 InvalidStateError when trying to edit cancelled event", async () => {
      const event = makeEvent({
        id: "evt-5",
        status: "cancelled",
        organizerId: "user-staff",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      const updateData = {
        title: "Cannot Edit Cancelled",
        description: "Event is cancelled",
        location: "Nowhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-5")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(409);
      expect(res.text).toContain("Cannot edit a cancelled event");
    });

    it("returns 409 InvalidStateError when trying to edit past event", async () => {
      const event = makeEvent({
        id: "evt-6",
        status: "past",
        organizerId: "user-admin",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "admin@app.test");

      const updateData = {
        title: "Cannot Edit Past",
        description: "Event is in the past",
        location: "History",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-6")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(409);
      expect(res.text).toContain("Cannot edit a past event");
    });

    it("returns 400 InvalidInputError when title is empty", async () => {
      const event = makeEvent({
        id: "evt-7",
        organizerId: "user-staff",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      const updateData = {
        title: "",
        description: "Valid description",
        location: "Valid location",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-7")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("required");
    });

    it("returns 400 InvalidInputError when end time is before start time", async () => {
      const event = makeEvent({
        id: "evt-8",
        organizerId: "user-admin",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "admin@app.test");

      const updateData = {
        title: "Time Paradox",
        description: "Invalid time range",
        location: "Somewhere",
        category: "social",
        startTime: "2026-06-01T18:00",
        endTime: "2026-06-01T10:00", // ends before start
      };

      const res = await request(app)
        .post("/events/evt-8")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("Event end time must be after start time");
    });

    it("returns 401 when user is not authenticated", async () => {
      const event = makeEvent({ id: "evt-9" });
      const app = buildAppWithEvents([event]);

      const updateData = {
        title: "Unauthorized",
        description: "No auth",
        location: "Nowhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-9")
        .type("form")
        .send(updateData);

      expect(res.status).toBe(401);
      expect(res.text).toContain("Please log in");
    });
  });

  describe("Edge cases", () => {
    it("allows admin to edit any event (not just their own)", async () => {
      const event = makeEvent({
        id: "evt-10",
        organizerId: "user-staff", // owned by staff
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "admin@app.test"); // admin editing

      const updateData = {
        title: "Admin Can Edit Any Event",
        description: "Admin override",
        location: "Admin controlled",
        category: "educational",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events/evt-10")
        .set("Cookie", cookie)
        .type("form")
        .send(updateData);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events/evt-10");
    });

    it("organizer can only edit their own events", async () => {
      const event1 = makeEvent({
        id: "evt-11",
        organizerId: "user-staff",
      });
      const event2 = makeEvent({
        id: "evt-12",
        organizerId: "user-admin",
      });
      const app = buildAppWithEvents([event1, event2]);
      const cookie = await loginAs(app, "staff@app.test");

      // Can edit own event
      const updateData = {
        title: "Updated Own Event",
        description: "Should work",
        location: "Location",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res1 = await request(app)
        .post("/events/evt-11")
        .set("Cookie", cookie)
        .type("form")
        .send(updateData);

      expect(res1.status).toBe(302);

      // Cannot edit someone else's event
      const res2 = await request(app)
        .post("/events/evt-12")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      expect(res2.status).toBe(403);
    });

    it("re-renders edit form with error message on validation error", async () => {
      const event = makeEvent({
        id: "evt-13",
        title: "Original Title",
        description: "Original description",
        organizerId: "user-staff",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      const updateData = {
        title: "Attempted New Title",
        description: "Attempted new description",
        location: "New location",
        category: "social",
        startTime: "2026-06-01T18:00",
        endTime: "2026-06-01T10:00", // Invalid: ends before start
      };

      const res = await request(app)
        .post("/events/evt-13")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(updateData);

      // Form re-renders with error message and current event data
      expect(res.status).toBe(400);
      expect(res.text).toContain("Event end time must be after start time");
      expect(res.text).toContain("Edit Event");
    });

    it("can remove capacity by setting it to empty string", async () => {
      const event = makeEvent({
        id: "evt-14",
        capacity: 100,
        organizerId: "user-staff",
      });
      const app = buildAppWithEvents([event]);
      const cookie = await loginAs(app, "staff@app.test");

      const updateData = {
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        startTime: event.startTime.toISOString().slice(0, 16),
        endTime: event.endTime.toISOString().slice(0, 16),
        capacity: "", // Remove capacity
      };

      const res = await request(app)
        .post("/events/evt-14")
        .set("Cookie", cookie)
        .type("form")
        .send(updateData);

      expect(res.status).toBe(302);
    });
  });
});

describe("GET /events/:id/edit — Event Edit Form", () => {
  it("returns 200 and renders edit form for event organizer", async () => {
    const event = makeEvent({
      id: "evt-15",
      organizerId: "user-staff",
    });
    const app = buildAppWithEvents([event]);
    const cookie = await loginAs(app, "staff@app.test");

    const res = await request(app)
      .get("/events/evt-15/edit")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Edit Event");
  });

  it("returns 200 and renders edit form for admin (any event)", async () => {
    const event = makeEvent({
      id: "evt-16",
      organizerId: "user-staff", // owned by staff
    });
    const app = buildAppWithEvents([event]);
    const cookie = await loginAs(app, "admin@app.test"); // admin can edit

    const res = await request(app)
      .get("/events/evt-16/edit")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Edit Event");
  });

  it("returns 403 when non-organizer/non-admin tries to access edit form", async () => {
    const event = makeEvent({
      id: "evt-17",
      organizerId: "user-admin",
    });
    const app = buildAppWithEvents([event]);
    const cookie = await loginAs(app, "staff@app.test"); // different user

    const res = await request(app)
      .get("/events/evt-17/edit")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
  });

  it("returns 404 when event does not exist", async () => {
    const app = buildAppWithEvents([]);
    const cookie = await loginAs(app, "admin@app.test");

    const res = await request(app)
      .get("/events/evt-nonexistent/edit")
      .set("Cookie", cookie);

    expect(res.status).toBe(404);
  });

  it("redirects unauthenticated users to login", async () => {
    const event = makeEvent({ id: "evt-18" });
    const app = buildAppWithEvents([event]);

    const res = await request(app).get("/events/evt-18/edit");

    // Auth middleware redirects unauthenticated GET requests to login
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });
});
