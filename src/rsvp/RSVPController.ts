import type { Request, Response } from "express";
import type { IRSVPService } from "../service/RSVPService";
import type { RSVPError } from "./errors";
import type { ILoggingService } from "../service/LoggingService";
import { getAuthenticatedUser, type AppSessionStore } from "../session/AppSession";
import type { UserRole } from "../auth/User";

export interface IRSVPController {
  toggleRSVP(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  showMyRSVPs(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

class RSVPController implements IRSVPController {
  constructor(
    private readonly rsvpService: IRSVPService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: RSVPError): number {
    if (error.name === "UnauthorizedError") return 403;
    if (error.name === "EventNotFoundError") return 404;
    if (error.name === "InvalidStateError") return 409;
    return 500;
  }

  async toggleRSVP(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", {
        message: "Please log in to continue.",
        layout: false,
      });
      return;
    }
    const eventId = typeof req.params.eventId === "string" ? req.params.eventId : "";
    if (!eventId) {
      res.status(400).render("partials/error", {
        message: "Missing event ID.",
        layout: false,
      });
      return;
    }
    const person = {
      userId: currentUser.userId,
      role: currentUser.role as UserRole,
    };

    const result = await this.rsvpService.toggleRSVP(person, eventId);
    
    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      this.logger.warn(`RSVP toggle failed for user ${person.userId}: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }
    this.logger.info(`User ${person.userId} toggled RSVP on event ${eventId}: ${result.value}`);
    if (req.get("HX-Request") === "true") {
      const fromDashboard = (req.get("HX-Current-URL") ?? "").includes("/my-rsvps");
      if (fromDashboard) {
        res.status(200).send("");
        return;
      }
      return res.render("event/partials/rsvp-feedback", {
        rsvpStatus: result.value,
        layout: false,
      });
    }
    res.redirect(`/events/${eventId}`);
  }

  async showMyRSVPs(_req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const currentUser = getAuthenticatedUser(store);
    if (!currentUser) {
      res.status(401).render("partials/error", { message: "Please log in to continue.", layout: false });
      return;
    }

    const actor = { userId: currentUser.userId, role: currentUser.role as UserRole };
    const result = await this.rsvpService.getMyRSVPs(actor);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      this.logger.warn(`getMyRSVPs failed for user ${actor.userId}: ${result.value.message}`);
      res.status(status).render("partials/error", { message: result.value.message, layout: false });
      return;
    }

    this.logger.info(`getMyRSVPs for user ${actor.userId}: ${result.value.upcoming.length} upcoming, ${result.value.pastAndCancelled.length} past/cancelled`);
    res.render("rsvp/dashboard", { dashboard: result.value, session: store.app });
  }
}

export function CreateRSVPController(
  rsvpService: IRSVPService,
  logger: ILoggingService,
): IRSVPController {
  return new RSVPController(rsvpService, logger);
}
