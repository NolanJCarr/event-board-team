import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryEventRepository } from "./event/InMemoryEventRepository";
import { CreateEventService } from "./event/EventService";
import { CreateInMemoryRSVPRepository } from "./event/InMemoryRSVPRepository";
import { CreateDashboardService } from "./event/DashboardService";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);

  // Event service wiring
  const eventRepo = CreateInMemoryEventRepository();
  const eventService = CreateEventService(eventRepo);

  // Dashboard wiring
  const rsvpRepo = CreateInMemoryRSVPRepository();
  const dashboardService = CreateDashboardService(eventRepo, rsvpRepo);

  return CreateApp(authController, resolvedLogger, eventService, dashboardService);
}
