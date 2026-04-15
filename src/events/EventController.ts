import type { Request, Response } from "express";
import type { IEventService } from "../service/EventService";
import type { ILoggingService } from "../service/LoggingService";
import { touchAppSession, type AppSessionStore, getAuthenticatedUser } from "../session/AppSession";
import type { EventService } from "./EventService";

export interface IEventController {
  showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  showCreateForm(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  createEvent(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}
// This is a dependency injection.
class EventController implements IEventController {
  constructor(
    private readonly filterEventService: IEventService,
    private readonly crudEventService: EventService,
    private readonly logger: ILoggingService,
  ) {}

  async showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    // This reads the category from the url. It is undefined if nothing was typed. 
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    // This reads the timeframe from the url. It is undefined if nothing was typed. 
    const timeframe = req.query.timeframe;
    // This reads the search query from the url. It is undefined if nothing was typed.
    const searchQuery = typeof req.query.search === "string" ? req.query.search : undefined;
    // This makes sure that the timeframe is an allowed value. It is treated as undefined if it is not valid. 
    const validTimeframe =
      timeframe === "week" || timeframe === "weekend" || timeframe === "all"
        ? timeframe
        : undefined;
    // This asks the service for events using the filters.
    const result = await this.filterEventService.getEvents({
      category,
      timeframe: validTimeframe,
      searchQuery,
    });
    // An error page is shown if something went wrong
    if (result.ok === false) {
      this.logger.warn(`getEvents failed: ${result.value.message}`);
      res.status(400).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }
    // If it worked, the events are sent to the ejs template. The filter values are also sent back so the form stayed filled in.
    this.logger.info(`getEvents returned ${result.value.length} events`);
    res.render("events/index", {
      events: result.value,
      category: category ?? "",
      timeframe: validTimeframe ?? "all",
      searchQuery: searchQuery ?? "",
      session,
    });
  }

  async showCreateForm(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    this.logger.info("GET /events/new");

    res.render("events/new", {
      session,
      pageError: null,
    });
  }

  async createEvent(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.status(401).render("partials/error", {
        message: "You must be logged in to create an event",
        layout: false,
      });
      return;
    }

    // Parse form data
    const title = typeof req.body.title === "string" ? req.body.title : "";
    const description = typeof req.body.description === "string" ? req.body.description : "";
    const location = typeof req.body.location === "string" ? req.body.location : "";
    const category = typeof req.body.category === "string" ? req.body.category : "";
    const startTimeStr = typeof req.body.startTime === "string" ? req.body.startTime : "";
    const endTimeStr = typeof req.body.endTime === "string" ? req.body.endTime : "";
    const capacityStr = typeof req.body.capacity === "string" ? req.body.capacity : "";

    // Parse dates
    const startTime = startTimeStr ? new Date(startTimeStr) : new Date();
    const endTime = endTimeStr ? new Date(endTimeStr) : new Date();
    const capacity = capacityStr ? parseInt(capacityStr, 10) : undefined;

    // Call service
    const result = await this.crudEventService.createEvent({
      title,
      description,
      location,
      category,
      startTime,
      endTime,
      capacity,
      organizerId: user.userId,
    });

    // Handle error
    if (result.ok === false) {
      this.logger.warn(`createEvent failed: ${result.value.message}`);
      res.status(400).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    // Success - redirect to event list or event detail page
    this.logger.info(`Event created: ${result.value.id}`);
    res.redirect("/events");
  }
}

export function CreateEventController(
  filterEventService: IEventService,
  crudEventService: EventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(filterEventService, crudEventService, logger);
}