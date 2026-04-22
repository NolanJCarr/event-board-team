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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fully composed Express app backed by in-memory repositories.
 * Mirrors src/composition.ts but for testing.
 */
function buildApp(): Express {
  const logger = CreateLoggingService();

  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, logger);

  const sharedEventRepository = new InMemoryEventRepository();
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

describe("POST /events — Event Creation", () => {
  describe("Happy path", () => {
    it("creates a new event with valid input and returns 302 redirect (full page submission)", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Spring Hackathon 2026",
        description: "A 24-hour coding competition for students",
        location: "Campus Center Room 101",
        category: "technology",
        startTime: "2026-06-01T09:00",
        endTime: "2026-06-02T09:00",
        capacity: "100",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .type("form")
        .send(eventData);

      // Full page submission should redirect to /events
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events");
    });

    it("creates a new event with valid input and returns 200 with success partial (HTMX submission)", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "staff@app.test");

      const eventData = {
        title: "Community Cleanup Day",
        description: "Help clean up the local park",
        location: "Central Park",
        category: "volunteer",
        startTime: "2026-05-15T10:00",
        endTime: "2026-05-15T14:00",
        capacity: "50",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      // HTMX submission should return success partial
      expect(res.status).toBe(200);
      expect(res.text).toContain("Event Created Successfully");
      expect(res.text).toContain("Community Cleanup Day");
    });

    it("creates a new event without capacity (unlimited)", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Open Mic Night",
        description: "All are welcome to perform or watch",
        location: "Student Union",
        category: "arts",
        startTime: "2026-06-10T19:00",
        endTime: "2026-06-10T22:00",
        // capacity omitted - should be unlimited
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .type("form")
        .send(eventData);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events");
    });
  });

  describe("Domain errors", () => {
    it("returns 400 InvalidInputError when title is missing", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        // title missing
        description: "Event without a title",
        location: "Somewhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("Title is required");
    });

    it("returns 400 InvalidInputError when description is missing", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Event Without Description",
        // description missing
        location: "Somewhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("Description is required");
    });

    it("returns 400 InvalidInputError when end time is before start time", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Time Paradox Event",
        description: "This event ends before it starts",
        location: "Somewhere",
        category: "social",
        startTime: "2026-06-01T18:00",
        endTime: "2026-06-01T10:00", // ends before it starts
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("Event end time must be after start time");
    });

    it("returns 400 InvalidInputError when category is invalid", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Invalid Category Event",
        description: "Testing invalid category",
        location: "Somewhere",
        category: "invalid-category",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("Invalid category");
    });

    it("returns 400 InvalidInputError when capacity is less than 1", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Zero Capacity Event",
        description: "Event with invalid capacity",
        location: "Nowhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
        capacity: "0",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      expect(res.status).toBe(400);
      expect(res.text).toContain("Capacity must be at least 1");
    });

    it("returns 401 when user is not authenticated", async () => {
      const app = buildApp();

      const eventData = {
        title: "Unauthorized Event",
        description: "Created without login",
        location: "Somewhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .type("form")
        .send(eventData);

      // Controller returns 401 for unauthenticated POST requests
      expect(res.status).toBe(401);
    });

    it("blocks regular user (non-staff/admin) from creating event", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "user@app.test");

      const eventData = {
        title: "Regular User Event",
        description: "Regular users cannot create events",
        location: "Somewhere",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      // Role middleware blocks non-staff/admin users
      expect(res.status).toBe(403);
    });
  });

  describe("Edge cases", () => {
    it("creates event with maximum length title (200 characters)", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const maxLengthTitle = "A".repeat(200);

      const eventData = {
        title: maxLengthTitle,
        description: "Testing maximum title length",
        location: "Test Location",
        category: "social",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .type("form")
        .send(eventData);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events");
    });

    it("creates event with maximum length description (2000 characters)", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const maxLengthDescription = "B".repeat(2000);

      const eventData = {
        title: "Max Description Event",
        description: maxLengthDescription,
        location: "Test Location",
        category: "educational",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .type("form")
        .send(eventData);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events");
    });

    it("creates event with capacity exactly 1", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "staff@app.test");

      const eventData = {
        title: "One-on-One Mentoring",
        description: "Individual mentoring session",
        location: "Office 205",
        category: "educational",
        startTime: "2026-06-01T14:00",
        endTime: "2026-06-01T15:00",
        capacity: "1",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .type("form")
        .send(eventData);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events");
    });

    it("staff user can create events (not just admin)", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "staff@app.test");

      const eventData = {
        title: "Staff Created Event",
        description: "Created by a staff member",
        location: "Conference Room",
        category: "educational",
        startTime: "2026-06-01T10:00",
        endTime: "2026-06-01T12:00",
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .type("form")
        .send(eventData);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/events");
    });

    it("preserves form data on validation error", async () => {
      const app = buildApp();
      const cookie = await loginAs(app, "admin@app.test");

      const eventData = {
        title: "Test Event",
        description: "Test description",
        location: "Test location",
        category: "social",
        startTime: "2026-06-01T18:00",
        endTime: "2026-06-01T10:00", // Invalid: ends before start
      };

      const res = await request(app)
        .post("/events")
        .set("Cookie", cookie)
        .set("HX-Request", "true")
        .type("form")
        .send(eventData);

      expect(res.status).toBe(400);
      // Form should preserve the submitted data
      expect(res.text).toContain("Test Event");
      expect(res.text).toContain("Test description");
      expect(res.text).toContain("Test location");
    });
  });
});

describe("GET /events/new — Event Creation Form", () => {
  it("returns 200 and renders the form for authenticated staff", async () => {
    const app = buildApp();
    const cookie = await loginAs(app, "staff@app.test");

    const res = await request(app)
      .get("/events/new")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Create New Event");
    // Form uses HTMX, not traditional action attribute
    expect(res.text).toContain('hx-post="/events"');
  });

  it("returns 200 and renders the form for authenticated admin", async () => {
    const app = buildApp();
    const cookie = await loginAs(app, "admin@app.test");

    const res = await request(app)
      .get("/events/new")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Create New Event");
  });

  it("redirects unauthenticated users to login", async () => {
    const app = buildApp();

    const res = await request(app).get("/events/new");

    // Auth middleware redirects to login
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("returns 403 for regular users (non-staff/admin)", async () => {
    const app = buildApp();
    const cookie = await loginAs(app, "user@app.test");

    const res = await request(app)
      .get("/events/new")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
  });
});
