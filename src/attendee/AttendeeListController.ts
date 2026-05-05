import type { Request, Response } from "express";
import type { IAttendeeListService } from "../service/AttendeeListService";
import type { AttendeeListError } from "./errors";
import type { ILoggingService } from "../service/LoggingService";
import { getAuthenticatedUser, type AppSessionStore } from "../session/AppSession";
import type { UserRole } from "../auth/User";
import { touchAppSession } from "../session/AppSession";

// ── Public interface ──────────────────────────────────────────────────────────

export interface IAttendeeListController {
  /**
   * GET /events/:eventId/attendees
   *
   * Renders the attendee list partial for the organizer's event detail page.
   * Session store is passed per-call (mirrors RSVPController.toggleRSVP).
   */
  getAttendeeList(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

class AttendeeListController implements IAttendeeListController {
  constructor(
    private readonly attendeeListService: IAttendeeListService,
    private readonly logger: ILoggingService,
  ) {}

  /**
   * Translates domain errors into HTTP status codes.
   * Keeps the same `error.name` switch pattern as RSVPController.mapErrorStatus
   * so the two controllers are consistent when read side-by-side.
   */
  private mapErrorStatus(error: AttendeeListError): number {
    if (error.name === "AttendeeListForbiddenError") return 403;
    if (error.name === "AttendeeListNotFoundError") return 404;
    if (error.name === "AttendeeListUserLookupError") return 500;
    // Exhaustiveness guard — TypeScript narrows `error` to `never` here
    // if all union members are handled above.
    const _exhaustive: never = error;
    return 500;
  }

  async getAttendeeList(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    // ── 1. Require an authenticated session ───────────────────────────────────
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }

    // ── 2. Validate route param ───────────────────────────────────────────────
    const eventId = typeof req.params.eventId === "string" ? req.params.eventId : "";
    if (!eventId) {
      res.status(400).render("partials/error", {
        message: "Missing event ID.",
        layout: false,
      });
      return;
    }

    // ── 3. Build caller identity (same shape RSVPController builds `actor`) ───
    const caller = {
      userId: currentUser.userId,
      role: currentUser.role as UserRole,
    };

    // ── 4. Delegate to service ────────────────────────────────────────────────
    const result = await this.attendeeListService.getAttendeeList(eventId, caller);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      this.logger.warn(
        `Attendee list fetch failed for user ${caller.userId} ` +
          `on event ${eventId}: ${result.value.message}`,
      );
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(
      `User ${caller.userId} viewed attendee list for event ${eventId} ` +
        `(going: ${result.value.attending.length}, ` +
        `waitlisted: ${result.value.waitlisted.length}, ` +
        `cancelled: ${result.value.cancelled.length})`,
    );

    
   const session = touchAppSession(store);
   res.render("events/attendees", {
    attendees: result.value,
    session,
    layout: false,
  });
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function CreateAttendeeListController(
  attendeeListService: IAttendeeListService,
  logger: ILoggingService,
): IAttendeeListController {
  return new AttendeeListController(attendeeListService, logger);
}