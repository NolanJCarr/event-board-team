import type { Request, Response } from "express";
import type { IEventService } from "../service/EventService";
import type { ILoggingService } from "../service/LoggingService";
import { touchAppSession, type AppSessionStore } from "../session/AppSession";


export interface IEventController {
  showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  // showEventsPartial was added in Sprint 2 to handle HTMX. It will return only the results section of a page instead of a full page rerender.
  showEventsPartial(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  async showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    // This reads the category from the url; nothing was given if it is undefined.
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    // This reads the timeframe from the url; nothing was given if it is undefined.
    const timeframe = req.query.timeframe;
    // This reads the search query from the url; nothing was given if it is undefined.
    const searchQuery = typeof req.query.search === "string" ? req.query.search : undefined;
    const validTimeframe =
      timeframe === "week" || timeframe === "weekend" || timeframe === "all"
        ? timeframe
        : undefined;
      // Events are being found using the filters.  
    const result = await this.eventService.getEvents({
      category,
      timeframe: validTimeframe,
      searchQuery,
    });
    if (result.ok === false) {
      this.logger.warn(`getEvents failed: ${result.value.message}`);
      res.status(400).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }
    this.logger.info(`getEvents returned ${result.value.length} events`);
    res.render("events/index", {
      events: result.value,
      category: category ?? "",
      timeframe: validTimeframe ?? "all",
      searchQuery: searchQuery ?? "",
      session,
    });
  }
// This new method in Sprint 2 handles HTMX. HTMX calls /events/results instead of /events to only return the results page instead of the whole page.
  async showEventsPartial(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);

    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const timeframe = req.query.timeframe;
    const searchQuery = typeof req.query.search === "string" ? req.query.search : undefined;

    const validTimeframe =
      timeframe === "week" || timeframe === "weekend" || timeframe === "all"
        ? timeframe
        : undefined;

    const result = await this.eventService.getEvents({
      category,
      timeframe: validTimeframe,
      searchQuery,
    });

    if (result.ok === false) {
      this.logger.warn(`getEvents partial failed: ${result.value.message}`);
      res.status(400).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`getEvents partial returned ${result.value.length} events`);
    // layout: false means a partial view is returned. HTMX takes the response and swaps it into #events-results div without reloading anything.
    res.render("events/_results", {
      events: result.value,
      session,
      layout: false,
    });
  }
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}