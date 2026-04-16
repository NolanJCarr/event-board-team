import type { Request, Response } from "express";
import type { IEventService } from "../service/EventService";
import type { ILoggingService } from "../service/LoggingService";
import { touchAppSession, type AppSessionStore } from "../session/AppSession";

export interface IEventController {
  showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}
// This is a dependency injection.
class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
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
    const result = await this.eventService.getEvents({
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
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}