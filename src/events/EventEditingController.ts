import type { Request, Response } from "express";
import type { EventService } from "./EventService";
import type { Event } from "./Event";
import type { ILoggingService } from "../service/LoggingService";
import { touchAppSession, type AppSessionStore } from "../session/AppSession";

export interface IEventEditingController {
  showEditForm(req: Request, res: Response, store: AppSessionStore): Promise<void>;
  updateEvent(req: Request, res: Response, store: AppSessionStore): Promise<void>;
}

class EventEditingController implements IEventEditingController {
  constructor(
    private readonly eventService: EventService,
    private readonly logger: ILoggingService,
  ) {}

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

    // Fetch the event - we'll check permissions in the service layer when they submit
    // But we should at least verify the event exists and they have permission to view the edit form
    const result = await this.eventService.updateEvent({
      eventId,
      updates: {}, // Empty updates - just to check permissions
      userId,
      role,
    });

    // Actually, let's use the repository directly to get the event
    // We need to check if the user can see the edit form
    // For now, let's just fetch and check permissions manually
    const eventResult = await this.eventService["eventRepository"].findById(eventId);

    if (!eventResult) {
      this.logger.warn(`Event not found: ${eventId}`);
      res.status(404).render("partials/error", {
        message: "Event not found.",
        layout: false,
      });
      return;
    }

    // Check if user has permission to edit
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

    // Format dates for datetime-local input (YYYY-MM-DDTHH:MM format)
    const formatDateTimeLocal = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    res.render("events/edit", {
      session,
      event: eventResult,
      startTimeFormatted: formatDateTimeLocal(eventResult.startTime),
      endTimeFormatted: formatDateTimeLocal(eventResult.endTime),
      pageError: null,
    });
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

    // Build the updates object - only include fields that were provided
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

    const result = await this.eventService.updateEvent({
      eventId,
      updates,
      userId,
      role,
    });

    if (result.ok === false) {
      this.logger.warn(`updateEvent failed: ${result.value.message}`);

      // Map error types to HTTP status codes
      let statusCode = 400;
      if (result.value.name === "EventNotFoundError") {
        statusCode = 404;
      } else if (result.value.name === "UnauthorizedError") {
        statusCode = 403;
      } else if (result.value.name === "InvalidStateError") {
        statusCode = 409;
      }

      // Re-render the edit form with the error
      // We need to fetch the event again to populate the form
      const eventResult = await this.eventService["eventRepository"].findById(eventId);

      if (!eventResult) {
        res.status(404).render("partials/error", {
          message: "Event not found.",
          layout: false,
        });
        return;
      }

      const formatDateTimeLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      res.status(statusCode).render("events/edit", {
        session,
        event: eventResult,
        startTimeFormatted: formatDateTimeLocal(eventResult.startTime),
        endTimeFormatted: formatDateTimeLocal(eventResult.endTime),
        pageError: result.value.message,
      });
      return;
    }

    this.logger.info(`Event updated successfully: ${result.value.id}`);
    // Redirect to the event detail page (Dylan's feature)
    res.redirect(`/events/${result.value.id}`);
  }
}

export function CreateEventEditingController(
  eventService: EventService,
  logger: ILoggingService,
): IEventEditingController {
  return new EventEditingController(eventService, logger);
}
