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
// Filter event repo — used by EventService (getEvents with category/timeframe/search)
import { CreateInMemoryEventRepository as CreateFilterEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./events/EventController";

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

  // RSVP wiring
  const rsvpRepository = CreateInMemoryRSVPRepository();
  const rsvpService = CreateRSVPService(rsvpRepository, crudEventRepository);
  const rsvpController = CreateRSVPController(rsvpService, resolvedLogger);

  // Event wiring — filter repo powers the search/category/timeframe feature
  const filterEventRepository = CreateFilterEventRepository();
  const eventService = CreateEventService(filterEventRepository);
  const eventController = CreateEventController(eventService, resolvedLogger);

  return CreateApp(authController, rsvpController, eventController, resolvedLogger);
}
