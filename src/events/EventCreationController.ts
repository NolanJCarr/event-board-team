import type { Request, Response } from "express";
import type { EventService } from "./EventService";
import type { ILoggingService } from "../service/LoggingService";
import { touchAppSession, type AppSessionStore } from "../session/AppSession";

export interface IEventCreationController {
  showCreateForm(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  createEvent(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

class EventCreationController implements IEventCreationController {
  constructor(
    private readonly eventService: EventService,
    private readonly logger: ILoggingService,
  ) {}

  async showCreateForm(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    res.render("events/new", {
      session,
      pageError: null,
      formData: {}
    });
  }

  async createEvent(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    const userId = session.authenticatedUser?.userId;

    if (!userId) {
      this.logger.warn("createEvent called without authenticated user");
      res.status(401).render("partials/error", {
        message: "You must be logged in to create events.",
        layout: false,
      });
      return;
    }

    const { title, description, location, category, startTime, endTime, capacity } = req.body;

    // Parse datetime-local inputs to Date objects
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    // Parse capacity (optional)
    const parsedCapacity = capacity ? Number.parseInt(capacity, 10) : undefined;

    const result = await this.eventService.createEvent({
      title,
      description,
      location,
      category,
      startTime: startDateTime,
      endTime: endDateTime,
      capacity: parsedCapacity,
      organizerId: userId,
    });

    if (result.ok === false) {
      this.logger.warn(`createEvent failed: ${result.value.message}`);

      let statusCode = 400;
      if (result.value.name === "UnauthorizedError") statusCode = 403;

      const errorData = {
        session,
        pageError: result.value.message,
        formData: req.body,
      };

      // HTMX request: return partial form with error
      if (req.get("HX-Request") === "true") {
        return void res.status(statusCode).render("events/partials/create-form", { ...errorData, layout: false });
      }

      // Regular request: return full page
      res.status(statusCode).render("events/new", errorData);
      return;
    }

    this.logger.info(`Event created successfully: ${result.value.id}`);

    // HTMX request: return success partial
    if (req.get("HX-Request") === "true") {
      return void res.render("events/partials/create-success", {
        event: result.value,
        session,
        layout: false,
      });
    }

    // Regular request: redirect to events list
    res.redirect("/events");
  }
}

export function CreateEventCreationController(
  eventService: EventService,
  logger: ILoggingService,
): IEventCreationController {
  return new EventCreationController(eventService, logger);
}
