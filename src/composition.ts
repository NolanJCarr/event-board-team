import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./repository/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateRSVPService } from "./service/RSVPService";
import { CreateRSVPController } from "./rsvp/RSVPController";
import { CreateInMemoryRSVPRepository } from "./repository/InMemoryRSVPRepository";
// CRUD event repo — used by RSVPService (findById) and event creation/editing features
import { InMemoryEventRepository } from "./events/InMemoryEventRepository";
import type { Event as CRUDEvent } from "./events/Event";
// Filter event repo — used by EventService (getEvents with category/timeframe/search)
import { InMemoryEventRepository as FilterEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./events/EventController";

// ---------------------------------------------------------------------------
// Demo seed events — gives the app real data to work with in the browser.
// Both the filter repo (/events page) and the CRUD repo (RSVP dashboard) are
// seeded with the same events so features 4, 6, 7, and 10 all work together.
// ---------------------------------------------------------------------------
const DEMO_EVENTS: CRUDEvent[] = [
  {
    id: "evt_demo_1",
    title: "Tech Meetup Spring 2026",
    description: "Talks on web development, AI tools, and open source contribution. All skill levels welcome.",
    location: "Campus Center Room 101",
    category: "tech",
    startTime: new Date("2026-05-01T18:00:00"),
    endTime: new Date("2026-05-01T20:00:00"),
    capacity: 30,
    status: "published",
    organizerId: "system",
    createdAt: new Date("2026-04-01T00:00:00"),
    updatedAt: new Date("2026-04-01T00:00:00"),
  },
  {
    id: "evt_demo_2",
    title: "Weekend 5K Fun Run",
    description: "A casual run around campus. All paces welcome — bring a friend!",
    location: "Athletic Fields",
    category: "sports",
    startTime: new Date("2026-05-10T09:00:00"),
    endTime: new Date("2026-05-10T11:00:00"),
    capacity: 3,
    status: "published",
    organizerId: "system",
    createdAt: new Date("2026-04-01T00:00:00"),
    updatedAt: new Date("2026-04-01T00:00:00"),
  },
  {
    id: "evt_demo_3",
    title: "Student Art Show",
    description: "An exhibition of student artwork spanning painting, sculpture, and digital media.",
    location: "Fine Arts Gallery",
    category: "arts",
    startTime: new Date("2026-05-20T14:00:00"),
    endTime: new Date("2026-05-20T18:00:00"),
    capacity: 100,
    status: "published",
    organizerId: "system",
    createdAt: new Date("2026-04-01T00:00:00"),
    updatedAt: new Date("2026-04-01T00:00:00"),
  },
  {
    id: "evt_demo_4",
    title: "Volunteer Campus Cleanup",
    description: "Help keep campus beautiful. Gloves and bags provided. T-shirt for all volunteers.",
    location: "Main Quad",
    category: "volunteer",
    startTime: new Date("2026-05-15T10:00:00"),
    endTime: new Date("2026-05-15T13:00:00"),
    capacity: 50,
    status: "published",
    organizerId: "system",
    createdAt: new Date("2026-04-01T00:00:00"),
    updatedAt: new Date("2026-04-01T00:00:00"),
  },
];

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);

  // Event repository — CRUD (findById used by RSVP dashboard; create/update used by event features)
  const crudEventRepository = new InMemoryEventRepository();
  crudEventRepository.seed(DEMO_EVENTS);

  // RSVP wiring
  const rsvpRepository = CreateInMemoryRSVPRepository();
  // Register capacity for each demo event so toggleRSVP knows the limit.
  for (const event of DEMO_EVENTS) {
    void rsvpRepository.setCapacity(event.id, event.capacity ?? 9999);
  }
  const rsvpService = CreateRSVPService(rsvpRepository, crudEventRepository);
  const rsvpController = CreateRSVPController(rsvpService, resolvedLogger);

  // Event wiring — filter repo powers the search/category/timeframe feature
  const filterEventRepository = new FilterEventRepository();
  filterEventRepository.seed(DEMO_EVENTS);
  const eventService = CreateEventService(filterEventRepository);
  const eventController = CreateEventController(eventService, resolvedLogger);

  return CreateApp(authController, rsvpController, eventController, resolvedLogger);
}
