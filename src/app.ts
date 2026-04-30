import path from "node:path";
import express, { Request, RequestHandler, Response } from "express";
import session from "express-session";
import Layouts from "express-ejs-layouts";
import { IAuthController } from "./auth/AuthController";
import {
  AuthenticationRequired,
  AuthorizationRequired,
} from "./auth/errors";
import type { UserRole } from "./auth/User";
import { IApp } from "./contracts";
import type { IRSVPController } from "./rsvp/RSVPController";
import type { IRSVPService, RSVPOutcome } from "./service/RSVPService";
import {
  getAuthenticatedUser,
  isAuthenticatedSession,
  AppSessionStore,
  recordPageView,
  touchAppSession,
} from "./session/AppSession";
import { ILoggingService } from "./service/LoggingService";
import type { IEventService } from "./events/EventService";
import { IDashboardService } from "./event/DashboardService";
import type { EventError } from "./events/errors";
import { IEventController } from "./events/EventController";
import { IAttendeeListController } from "./attendee/AttendeeListController";
import { IEventCreationController } from "./events/EventCreationController";
import { IEventEditingController } from "./events/EventEditingController";

type AsyncRequestHandler = RequestHandler;

function asyncHandler(fn: AsyncRequestHandler) {
  return function wrapped(req: Request, res: Response, next: (value?: unknown) => void) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sessionStore(req: Request): AppSessionStore {
  return req.session as AppSessionStore;
}

class ExpressApp implements IApp {
  private readonly app: express.Express;

  constructor(
    private readonly authController: IAuthController,
    // eventController was added so the app can have access to the events feature.
    private readonly rsvpController: IRSVPController,
    private readonly rsvpService: IRSVPService,
    private readonly eventController: IEventController,
    private readonly attendeeListController: IAttendeeListController,
    private readonly eventCreationController: IEventCreationController,
    private readonly eventEditingController: IEventEditingController,
    private readonly logger: ILoggingService,
    private readonly eventService: IEventService,
    private readonly dashboardService: IDashboardService,
  ) {
    this.app = express();
    this.registerMiddleware();
    this.registerTemplating();
    this.registerRoutes();
  }

  private registerMiddleware(): void {
    // Serve static files from src/static (create this directory to add your own assets)
    this.app.use(express.static(path.join(process.cwd(), "src/static")));
    this.app.use(
      session({
        name: "app.sid",
        secret: process.env.SESSION_SECRET ?? "project-starter-demo-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: "lax",
        },
      }),
    );
    this.app.use(Layouts);
    this.app.use(express.urlencoded({ extended: true }));
  }

  private registerTemplating(): void {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(process.cwd(), "src/views"));
    this.app.set("layout", "layouts/base");
  }

  private isHtmxRequest(req: Request): boolean {
    return req.get("HX-Request") === "true";
  }

  /**
   * Middleware helper: returns true if the request is from an authenticated user.
   * If the user is not authenticated, it handles the response (redirect or 401).
   */
  private requireAuthenticated(req: Request, res: Response): boolean {
    const store = sessionStore(req);
    touchAppSession(store);

    if (getAuthenticatedUser(store)) {
      return true;
    }

    this.logger.warn("Blocked unauthenticated request to a protected route");
    if (this.isHtmxRequest(req) || req.method !== "GET") {
      res.status(401).render("partials/error", {
        message: AuthenticationRequired("Please log in to continue.").message,
        layout: false,
      });
      return false;
    }

    res.redirect("/login");
    return false;
  }

  /**
   * Middleware helper: returns true if the authenticated user has one of the
   * allowed roles. Calls requireAuthenticated first, so unauthenticated
   * requests are handled automatically.
   */
  private requireRole(
    req: Request,
    res: Response,
    allowedRoles: UserRole[],
    message: string,
  ): boolean {
    if (!this.requireAuthenticated(req, res)) {
      return false;
    }

    const currentUser = getAuthenticatedUser(sessionStore(req));
    if (currentUser && allowedRoles.includes(currentUser.role)) {
      return true;
    }

    this.logger.warn(
      `Blocked unauthorized request for role ${currentUser?.role ?? "unknown"}`,
    );
    res.status(403).render("partials/error", {
      message: AuthorizationRequired(message).message,
      layout: false,
    });
    return false;
  }

  private registerRoutes(): void {
    // ── Public routes ────────────────────────────────────────────────

    this.app.get(
      "/",
      asyncHandler(async (req, res) => {
        this.logger.info("GET /");
        const store = sessionStore(req);
        res.redirect(isAuthenticatedSession(store) ? "/home" : "/login");
      }),
    );

    this.app.get(
      "/login",
      asyncHandler(async (req, res) => {
        const store = sessionStore(req);
        const browserSession = recordPageView(store);

        if (getAuthenticatedUser(store)) {
          res.redirect("/home");
          return;
        }

        await this.authController.showLogin(res, browserSession);
      }),
    );

    this.app.post(
      "/login",
      asyncHandler(async (req, res) => {
        const email = typeof req.body.email === "string" ? req.body.email : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";
        await this.authController.loginFromForm(res, email, password, sessionStore(req));
      }),
    );

    this.app.post(
      "/logout",
      asyncHandler(async (req, res) => {
        await this.authController.logoutFromForm(res, sessionStore(req));
      }),
    );

    // ── Admin routes ─────────────────────────────────────────────────

    this.app.get(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.authController.showAdminUsers(res, browserSession);
      }),
    );

    this.app.post(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const roleValue = typeof req.body.role === "string" ? req.body.role : "user";
        const role: UserRole =
          roleValue === "admin" || roleValue === "staff" || roleValue === "user"
            ? roleValue
            : "user";

        await this.authController.createUserFromForm(
          res,
          {
            email: typeof req.body.email === "string" ? req.body.email : "",
            displayName:
              typeof req.body.displayName === "string" ? req.body.displayName : "",
            password: typeof req.body.password === "string" ? req.body.password : "",
            role,
          },
          touchAppSession(sessionStore(req)),
        );
      }),
    );

    this.app.post(
      "/admin/users/:id/delete",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const session = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req));
        if (!currentUser) {
          res.status(401).render("partials/error", {
            message: AuthenticationRequired("Please log in to continue.").message,
            layout: false,
          });
          return;
        }

        await this.authController.deleteUserFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          currentUser.userId,
          session,
        );
      }),
    );

    // ── Events routes ────────────────────────────────────────────────

    this.app.get(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        // A user must be logged in to see the events.
        // It is handed to the event controller for the rest.
        await this.eventController.showEvents(req, res, sessionStore(req));
      }),
    );

    this.app.get(
      "/events/results",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.eventController.showEventsPartial(req, res, sessionStore(req));
  }),
);
    this.app.get(
      "/events/new",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin", "staff"], "Only organizers can create events.")) {
          return;
        }
        await this.eventCreationController.showCreateForm(req, res, sessionStore(req));
      }),
    );

    this.app.get(
      "/events/:id",
      asyncHandler(async (req, res) => {
        this.logger.info(`GET /events/${req.params.id}`);
        const store = sessionStore(req);
        const browserSession = recordPageView(store);
        const user = getAuthenticatedUser(store);

        const result = await this.eventService.getEventById({
          eventId: typeof req.params.id === "string" ? req.params.id : "",
          userId: user?.userId ?? "",
          role: user?.role ?? "",
        });

        if (!result.ok) {
          const error = result.value as EventError;
          const statusMap: Record<string, number> = {
            EventNotFoundError: 404,
            UnauthorizedError: 403,
            InvalidInputError: 400,
            InvalidStateError: 409,
          };
          const status = statusMap[error.name] ?? 500;
          res.status(status).render("event/detail", {
            session: browserSession,
            event: null,
            pageError: error.message,
            rsvpStatus: null,
          });
          return;
        }

        let rsvpStatus: RSVPOutcome | null = null;
        if (user?.role === "user") {
          const statusResult = await this.rsvpService.getStatusForEvent(
            { userId: user.userId, role: "user" },
            typeof req.params.id === "string" ? req.params.id : "",
          );
          if (statusResult.ok) {
            rsvpStatus = statusResult.value;
          } else {
            this.logger.warn(`getStatusForEvent failed for user ${user.userId}: ${(statusResult.value as any).message}`);
          }
        }

        if (this.isHtmxRequest(req)) {
          return res.render("event/partials/event-detail", {
            event: result.value,
            session: browserSession,
            layout: false,
          });
        }

        res.render("event/detail", {
          session: browserSession,
          event: result.value,
          pageError: null,
          rsvpStatus,
        });
      }),
    );

    this.app.post(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin", "staff"], "Only organizers can create events.")) {
          return;
        }
        await this.eventCreationController.createEvent(req, res, sessionStore(req));
      }),
    );

    this.app.get(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin", "staff"], "Only organizers can edit events.")) {
          return;
        }
        await this.eventEditingController.showEditForm(req, res, sessionStore(req));
      }),
    );

    this.app.post(
      "/events/:id",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin", "staff"], "Only organizers can edit events.")) {
          return;
        }
        await this.eventEditingController.updateEvent(req, res, sessionStore(req));
      }),
    );

    this.app.post(
      "/events/:id/cancel",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin", "staff"], "Only organizers can cancel events.")) {
          return;
        }
        await this.eventEditingController.cancelEvent(req, res, sessionStore(req));
      }),
    );

    this.app.post(
      "/events/:id/publish",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin", "staff"], "Only organizers can publish events.")) {
          return;
        }
        await this.eventEditingController.publishEvent(req, res, sessionStore(req));
      }),
    );

    this.app.get(
      "/events/:eventId/attendees",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.attendeeListController.getAttendeeList(req, res, sessionStore(req));
      }),
    );

    // ── Dashboard ────────────────────────────────────────────────────

    this.app.get(
      "/dashboard",
      asyncHandler(async (req, res) => {
        this.logger.info("GET /dashboard");
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const store = sessionStore(req);
        const browserSession = recordPageView(store);
        const user = getAuthenticatedUser(store);

        const result = await this.dashboardService.getOrganizerEvents({
          userId: user?.userId ?? "",
          role: user?.role ?? "",
        });

        if (result.ok === false) {
          const error = result.value;
          const status = error.name === "UnauthorizedError" ? 403 : 500;
          if (this.isHtmxRequest(req)) {
            res.status(status).render("partials/error", {
              message: error.message,
              layout: false,
            });
          } else {
            res.status(status).render("dashboard", {
              session: browserSession,
              dashboard: null,
              pageError: error.message,
            });
          }
          return;
        }

        if (this.isHtmxRequest(req)) {
          res.render("partials/dashboard", {
            dashboard: result.value,
            layout: false,
          });
        } else {
          res.render("dashboard", {
            session: browserSession,
            dashboard: result.value,
            pageError: null,
          });
        }
      }),
    );

    // ── Authenticated home page ──────────────────────────────────────
    // TODO: Replace this placeholder with your project's main page.

    this.app.get(
      "/home",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        this.logger.info(`GET /home for ${browserSession.browserLabel}`);
        res.render("home", { session: browserSession, pageError: null });
      }),
    );

    // ── RSVP routes ──────────────────────────────────────────────────

    this.app.get(
      "/my-rsvps",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.rsvpController.showMyRSVPs(req, res, sessionStore(req));
      }),
    );

    this.app.post(
      "/events/:eventId/rsvp",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.rsvpController.toggleRSVP(req, res, sessionStore(req));
      }),
    );

    // ── Error handler ────────────────────────────────────────────────

    this.app.use((err: unknown, _req: Request, res: Response, _next: (value?: unknown) => void) => {
      const message = err instanceof Error ? err.message : "Unexpected server error.";
      this.logger.error(message);
      res.status(500).render("partials/error", {
        message: "Unexpected server error.",
        layout: false,
      });
    });
  }

  getExpressApp(): express.Express {
    return this.app;
  }
}

export function CreateApp(
  authController: IAuthController,
  rsvpController: IRSVPController,
  rsvpService: IRSVPService,
  eventController: IEventController,
  attendeeListController: IAttendeeListController,
  eventCreationController: IEventCreationController,
  eventEditingController: IEventEditingController,
  logger: ILoggingService,
  eventService: IEventService,
  dashboardService: IDashboardService,
): IApp {
  return new ExpressApp(authController, rsvpController, rsvpService, eventController, attendeeListController, eventCreationController, eventEditingController, logger, eventService, dashboardService);
}
