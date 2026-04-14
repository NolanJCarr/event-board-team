import { IEvent } from "./Event";
import { EventError, EventNotFoundError, UnauthorizedError } from "./errors";
import { IEventRepository } from "./EventRepository";
import { Result, Ok, Err } from "../lib/result";

export interface IEventService {
  getEventById(input: {
    eventId: string;
    userId: string;
    role: string;
  }): Result<IEvent, EventError>;
}

export function CreateEventService(eventRepo: IEventRepository): IEventService {
  return {
    getEventById({ eventId, userId, role }) {
      const event = eventRepo.findById(eventId);

      if (!event) {
        return Err(EventNotFoundError(`Event with id "${eventId}" not found`));
      }

      if (event.status === "draft") {
        const isOrganizer = userId === event.organizerId;
        const isPrivileged = role === "admin" || role === "staff";

        if (!isOrganizer && !isPrivileged) {
          return Err(UnauthorizedError("You do not have permission to view this draft event"));
        }
      }

      return Ok(event);
    },
  };
}
