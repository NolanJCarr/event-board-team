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

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);

  // RSVP wiring
  const rsvpRepository = CreateInMemoryRSVPRepository();
  const rsvpService = CreateRSVPService(rsvpRepository);
  const rsvpController = CreateRSVPController(rsvpService, resolvedLogger);

  return CreateApp(authController, rsvpController, resolvedLogger);
}
