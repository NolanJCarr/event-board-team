import type { Request, Response } from "express";
import type { IEventService } from "../service/EventService";
import type { ILoggingService } from "../service/LoggingService";
import { touchAppSession, type AppSessionStore } from "../session/AppSession";


export interface IEventController {
  showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  showEventsPartial(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  async showEvents(req: Request, res: Response, store: AppSessionStore): Promise<void> {
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