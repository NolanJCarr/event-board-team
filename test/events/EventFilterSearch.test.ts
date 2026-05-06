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

function buildApp(events: Event[]): Express {
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
  const attendeeListService = CreateAttendeeListService(sharedEventRepository, rsvpRepository, authUsers);
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

async function loginAs(app: Express, email: string, password = "password123"): Promise<string> {
  const res = await request(app)
    .post("/login")
    .type("form")
    .send({ email, password });
  expect(res.status).toBe(302);
  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sidCookie = cookies.find((c: string) => c.startsWith("app.sid="));
  if (!sidCookie) throw new Error("No app.sid cookie returned from /login");
  return sidCookie.split(";")[0];
}

describe("GET /events — category and search filtering via HTTP", () => {

  it("returns 200 and shows all published events when no filters are applied", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Music Night" }),
      makeEvent({ id: "evt-2", organizerId: "user-staff", title: "Sports Day" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app).get("/events").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Music Night");
    expect(res.text).toContain("Sports Day");
  });

  it("returns only events matching the category filter", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Music Night", category: "arts" }),
      makeEvent({ id: "evt-2", organizerId: "user-staff", title: "Code Sprint", category: "technology" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app).get("/events?category=arts").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Music Night");
    expect(res.text).not.toContain("Code Sprint");
  });

  it("returns only events matching the search query", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Jazz Concert" }),
      makeEvent({ id: "evt-2", organizerId: "user-staff", title: "Art Show" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app).get("/events?search=Jazz").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Jazz Concert");
    expect(res.text).not.toContain("Art Show");
  });

  it("returns no events when search query matches nothing", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Jazz Concert" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app).get("/events?search=zzznomatch").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("No events found");
  });

  it("returns 200 with all events when search query is only whitespace", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Test Event" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app)
      .get("/events?search=   ")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("returns 200 with all events when timeframe is an invalid value", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Test Event" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app)
      .get("/events?timeframe=tomorrow")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("returns only events matching both category and search together", async () => {
    const app = buildApp([
      makeEvent({ id: "evt-1", organizerId: "user-staff", title: "Jazz Night", category: "arts" }),
      makeEvent({ id: "evt-2", organizerId: "user-staff", title: "Jazz Code", category: "technology" }),
    ]);
    const cookie = await loginAs(app, "staff@app.test");
    const res = await request(app)
      .get("/events?search=Jazz&category=arts")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Jazz Night");
    expect(res.text).not.toContain("Jazz Code");
  });

  it("redirects unauthenticated users to login", async () => {
    const app = buildApp([]);
    const res = await request(app).get("/events");
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/login/);
  });
});