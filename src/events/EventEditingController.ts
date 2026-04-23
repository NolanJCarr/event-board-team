import type { Request, Response } from "express";
import type { EventService } from "./EventService";
import type { Event } from "./Event";
import type { ILoggingService } from "../service/LoggingService";
import type { IDashboardService } from "../event/DashboardService";
import { touchAppSession, type AppSessionStore } from "../session/AppSession";

export interface IEventEditingController {
  showEditForm(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  updateEvent(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  cancelEvent(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  publishEvent(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

// Dashboard rows set hx-target to "event-row-<eventId>" so we can detect
// that a status-transition request originated from the dashboard and render
// an inline row fragment instead of the full event-detail partial.
function isDashboardRowRequest(req: Request): boolean {
  const target = req.get("HX-Target");
  return typeof target === "string" && target.startsWith("event-row-");
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

class EventEditingController implements IEventEditingController {
  constructor(
    private readonly eventService: EventService,
    private readonly logger: ILoggingService,
    private readonly dashboardService: IDashboardService,
  ) {}

  private async renderTransitionSuccess(
    req: Request,
    res: Response,
    session: ReturnType<typeof touchAppSession>,
    updated: Event,
  ): Promise<void> {
    if (req.get("HX-Request") === "true") {
      if (isDashboardRowRequest(req)) {
        const rowResult = await this.dashboardService.getEventRow(updated.id);
        if (rowResult.ok === false) {
          res.status(500).render("partials/error", {
            message: rowResult.value.message,
            layout: false,
          });
          return;
        }
        res.render("partials/dashboard-row", {
          event: rowResult.value,
          layout: false,
        });
        return;
      }
      res.render("event/partials/event-detail", {
        event: updated,
        session,
        layout: false,
      });
      return;
    }
    res.redirect(`/events/${updated.id}`);
  }

  async showEditForm(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    const userId = session.authenticatedUser?.userId;
    const role = session.authenticatedUser?.role;
    const eventId = typeof req.params.id === "string" ? req.params.id : "";

    if (!userId || !role) {
      this.logger.warn("showEditForm called without authenticated user");
      res.status(401).render("partials/error", {
        message: "You must be logged in to edit events.",
        layout: false,
      });
      return;
    }

    if (!eventId) {
      this.logger.warn("showEditForm called without event ID");
      res.status(400).render("partials/error", {
        message: "Event ID is required.",
        layout: false,
      });
      return;
    }

    const eventResult = await this.eventService["eventRepository"].findById(eventId);

    if (!eventResult) {
      this.logger.warn(`Event not found: ${eventId}`);
      res.status(404).render("partials/error", {
        message: "Event not found.",
        layout: false,
      });
      return;
    }

    const isOrganizer = eventResult.organizerId === userId;
    const isAdmin = role === "admin";

    if (!isOrganizer && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to access edit form for event ${eventId} without permission`);
      res.status(403).render("partials/error", {
        message: "You do not have permission to edit this event.",
        layout: false,
      });
      return;
    }

    const viewData = {
      session,
      event: eventResult,
      startTimeFormatted: formatDateTimeLocal(eventResult.startTime),
      endTimeFormatted: formatDateTimeLocal(eventResult.endTime),
      pageError: null,
    };

    if (req.get("HX-Request") === "true") {
      return void res.render("event/partials/edit-form", { ...viewData, layout: false });
    }
    res.render("events/edit", viewData);
  }

  async updateEvent(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    const session = touchAppSession(store);
    const userId = session.authenticatedUser?.userId;
    const role = session.authenticatedUser?.role;
    const eventId = typeof req.params.id === "string" ? req.params.id : "";

    if (!userId || !role) {
      this.logger.warn("updateEvent called without authenticated user");
      res.status(401).render("partials/error", {
        message: "You must be logged in to update events.",
        layout: false,
      });
      return;
    }

    if (!eventId) {
      this.logger.warn("updateEvent called without event ID");
      res.status(400).render("partials/error", {
        message: "Event ID is required.",
        layout: false,
      });
      return;
    }

    const { title, description, location, category, startTime, endTime, capacity } = req.body;

    const updates: Partial<Event> = {};
    if (title !== undefined && typeof title === "string") updates.title = title;
    if (description !== undefined && typeof description === "string") updates.description = description;
    if (location !== undefined && typeof location === "string") updates.location = location;
    if (category !== undefined && typeof category === "string") updates.category = category as any;
    if (startTime !== undefined && typeof startTime === "string") updates.startTime = new Date(startTime);
    if (endTime !== undefined && typeof endTime === "string") updates.endTime = new Date(endTime);
    if (capacity !== undefined && capacity !== "") {
      const parsedCapacity = typeof capacity === "string" ? Number.parseInt(capacity, 10) : capacity;
      if (!Number.isNaN(parsedCapacity)) {
        updates.capacity = parsedCapacity;
      }
    }

    const result = await this.eventService.updateEvent({ eventId, updates, userId, role });

    if (result.ok === false) {
      this.logger.warn(`updateEvent failed: ${result.value.message}`);

      let statusCode = 400;
      if (result.value.name === "EventNotFoundError") statusCode = 404;
      else if (result.value.name === "UnauthorizedError") statusCode = 403;
      else if (result.value.name === "InvalidStateError") statusCode = 409;

      const eventResult = await this.eventService["eventRepository"].findById(eventId);
      if (!eventResult) {
        res.status(404).render("partials/error", { message: "Event not found.", layout: false });
        return;
      }

      const errorData = {
        session,
        event: eventResult,
        startTimeFormatted: formatDateTimeLocal(eventResult.startTime),
        endTimeFormatted: formatDateTimeLocal(eventResult.endTime),
        pageError: result.value.message,
      };

      if (req.get("HX-Request") === "true") {
        return void res.status(statusCode).render("event/partials/edit-form", { ...errorData, layout: false });
      }
      res.status(statusCode).render("events/edit", errorData);
      return;
    }

    this.logger.info(`Event updated successfully: ${result.value.id}`);

    if (req.get("HX-Request") === "true") {
      return void res.render("event/partials/event-detail", {
        event: result.value,
        session,
        layout: false,
      });
    }
    res.redirect(`/events/${result.value.id}`);
  }

  async cancelEvent(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    await this.transitionStatus(req, res, store, "cancelled", "cancel");
  }

  async publishEvent(req: Request, res: Response, store: AppSessionStore): Promise<void> {
    await this.transitionStatus(req, res, store, "published", "publish");
  }

  private async transitionStatus(
    req: Request,
    res: Response,
    store: AppSessionStore,
    target: "published" | "cancelled",
    verb: string,
  ): Promise<void> {
    const session = touchAppSession(store);
    const userId = session.authenticatedUser?.userId;
    const role = session.authenticatedUser?.role;
    const eventId = typeof req.params.id === "string" ? req.params.id : "";

    if (!userId || !role) {
      res.status(401).render("partials/error", {
        message: `You must be logged in to ${verb} events.`,
        layout: false,
      });
      return;
    }

    const result = await this.eventService.updateEvent({
      eventId,
      updates: { status: target },
      userId,
      role,
    });

    if (result.ok === false) {
      this.logger.warn(`${verb}Event failed: ${result.value.message}`);
      let statusCode = 400;
      if (result.value.name === "EventNotFoundError") statusCode = 404;
      else if (result.value.name === "UnauthorizedError") statusCode = 403;
      else if (result.value.name === "InvalidStateError") statusCode = 409;

      res.status(statusCode).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(`Event ${target}: ${result.value.id}`);
    await this.renderTransitionSuccess(req, res, session, result.value);
  }
}

export function CreateEventEditingController(
  eventService: EventService,
  logger: ILoggingService,
  dashboardService: IDashboardService,
): IEventEditingController {
  return new EventEditingController(eventService, logger, dashboardService);
}
