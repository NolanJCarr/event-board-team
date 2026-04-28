import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./repository/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateDashboardService } from "./event/DashboardService";
import { CreateRSVPService } from "./service/RSVPService";
import { CreateRSVPController } from "./rsvp/RSVPController";
import { CreatePrismaRSVPRepository } from "./repository/PrismaRSVPRepository";
// Prisma setup
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaEventRepository } from "./repository/PrismaEventRepository";
import type { Event as CRUDEvent } from "./events/Event";
// Filter event repo — used by EventService (getEvents with category/timeframe/search)
import { InMemoryEventRepository as FilterEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./events/EventController";
import { CreateAttendeeListController} from "./attendee/AttendeeListController";
import { CreateAttendeeListService} from "./service/AttendeeListService"
import { CreateEventCreationController } from "./events/EventCreationController";
import { CreateEventEditingController } from "./events/EventEditingController";
// CRUD EventService — used for event creation and editing (features 1 & 3)
import { EventService } from "./events/EventService";
// Shared event repository — single source of truth for all event data
import type { IEventRepository as FilterRepoInterface } from "./repository/EventRepository";

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
    category: "technology",
    startTime: new Date("2026-04-01T18:00:00"),
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

  // Prisma client initialization with better-sqlite3 adapter
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  // Shared event repository — now using Prisma for persistence
  const sharedEventRepository = new PrismaEventRepository(prisma);

  // RSVP wiring — capacity now comes from Event.capacity in Prisma, no separate seeding.
  const rsvpRepository = CreatePrismaRSVPRepository(prisma);
  const rsvpService = CreateRSVPService(rsvpRepository, sharedEventRepository);
  const rsvpController = CreateRSVPController(rsvpService, resolvedLogger);

  // Dashboard wiring
  const dashboardService = CreateDashboardService(sharedEventRepository, rsvpRepository);

  // Filter event repo uses demo events for now (search/filter features owned by other team members)
  const filterEventRepository = new FilterEventRepository();
  filterEventRepository.seed(DEMO_EVENTS);

  // Event services
  const crudEventService = new EventService(sharedEventRepository);
  const filterEventService = CreateEventService(filterEventRepository);

  // Controllers
  const eventController = CreateEventController(filterEventService, resolvedLogger);
  const eventCreationController = CreateEventCreationController(crudEventService, resolvedLogger);
  const eventEditingController = CreateEventEditingController(crudEventService, resolvedLogger, dashboardService);
  const attendeeListService = CreateAttendeeListService(sharedEventRepository, rsvpRepository, authUsers);
  const attendeeListController = CreateAttendeeListController(attendeeListService, resolvedLogger);

  return CreateApp(
    authController,
    rsvpController,
    eventController,
    attendeeListController,
    eventCreationController,
    eventEditingController,
    resolvedLogger,
    crudEventService,
    dashboardService,
  );
}
