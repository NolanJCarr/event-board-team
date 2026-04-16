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

    const { title, description, location, category, startDate, startTime, endDate, endTime, capacity } = req.body;

    // Parse dates
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

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
      res.status(400).render("events/new", {
        session,
        pageError: result.value.message,
        formData: req.body,
      });
      return;
    }

    this.logger.info(`Event created successfully: ${result.value.id}`);
    res.redirect("/events");
  }
}

export function CreateEventCreationController(
  eventService: EventService,
  logger: ILoggingService,
): IEventCreationController {
  return new EventCreationController(eventService, logger);
}
