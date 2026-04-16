import type { Result } from "../lib/result";
import { Ok, Err } from "../lib/result";
import type { Event, CreateEventInput, UpdateEventInput, EventCategory } from "./Event";
import type { IEventRepository } from "./EventRepository";
import { InvalidInputError, UnauthorizedError, EventNotFoundError, InvalidStateError, type EventError } from "./errors";

const VALID_CATEGORIES: EventCategory[] = [
  "social",
  "educational",
  "volunteer",
  "sports",
  "arts",
  "tech",
  "other",
];

export class EventService {
  constructor(private readonly eventRepository: IEventRepository) {}

  async createEvent(
    input: CreateEventInput
  ): Promise<Result<Event, EventError>> {
    // Validate required fields
    const validationError = this.validateEventInput(input);
    if (validationError) {
      return Err(validationError);
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(input.category as EventCategory)) {
      return Err(
        InvalidInputError(
          `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
        )
      );
    }

    // Validate time range
    if (input.endTime <= input.startTime) {
      return Err(
        InvalidInputError("Event end time must be after start time")
      );
    }

    // Validate capacity if provided
    if (input.capacity !== undefined && input.capacity < 1) {
      return Err(InvalidInputError("Capacity must be at least 1"));
    }

    // Create the event with draft status
    const event = await this.eventRepository.create({
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      category: input.category as EventCategory,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity: input.capacity,
      status: "draft",
      organizerId: input.organizerId,
    });

    return Ok(event);
  }

  private validateEventInput(
    input: CreateEventInput
  ): EventError | null {
    // Title validation
    if (!input.title || input.title.trim().length === 0) {
      return InvalidInputError("Title is required");
    }
    if (input.title.trim().length > 200) {
      return InvalidInputError("Title must be 200 characters or less");
    }

    // Description validation
    if (!input.description || input.description.trim().length === 0) {
      return InvalidInputError("Description is required");
    }
    if (input.description.trim().length > 2000) {
      return InvalidInputError(
        "Description must be 2000 characters or less"
      );
    }

    // Location validation
    if (!input.location || input.location.trim().length === 0) {
      return InvalidInputError("Location is required");
    }
    if (input.location.trim().length > 200) {
      return InvalidInputError("Location must be 200 characters or less");
    }

    // Category validation
    if (!input.category || input.category.trim().length === 0) {
      return InvalidInputError("Category is required");
    }

    // Date validation
    if (!input.startTime || !(input.startTime instanceof Date)) {
      return InvalidInputError("Valid start time is required");
    }
    if (!input.endTime || !(input.endTime instanceof Date)) {
      return InvalidInputError("Valid end time is required");
    }

    // Organizer validation
    if (!input.organizerId || input.organizerId.trim().length === 0) {
      return InvalidInputError("Organizer ID is required");
    }

    return null;
  }

  async updateEvent(
    input: UpdateEventInput
  ): Promise<Result<Event, EventError>> {
    // Check if event exists
    const event = await this.eventRepository.findById(input.eventId);
    if (!event) {
      return Err(EventNotFoundError("Event not found"));
    }

    // Check authorization: user must be the organizer OR an admin
    const isOrganizer = event.organizerId === input.userId;
    const isAdmin = input.role === "admin";

    if (!isOrganizer && !isAdmin) {
      return Err(
        UnauthorizedError("You do not have permission to edit this event")
      );
    }

    // Check event state: cannot edit cancelled or past events
    if (event.status === "cancelled") {
      return Err(
        InvalidStateError("Cannot edit a cancelled event")
      );
    }
    if (event.status === "past") {
      return Err(
        InvalidStateError("Cannot edit a past event")
      );
    }

    // Validate updates if they exist
    const updates = input.updates;

    // Title validation
    if (updates.title !== undefined) {
      if (updates.title.trim().length === 0) {
        return Err(InvalidInputError("Title cannot be empty"));
      }
      if (updates.title.trim().length > 200) {
        return Err(InvalidInputError("Title must be 200 characters or less"));
      }
    }

    // Description validation
    if (updates.description !== undefined) {
      if (updates.description.trim().length === 0) {
        return Err(InvalidInputError("Description cannot be empty"));
      }
      if (updates.description.trim().length > 2000) {
        return Err(
          InvalidInputError("Description must be 2000 characters or less")
        );
      }
    }

    // Location validation
    if (updates.location !== undefined) {
      if (updates.location.trim().length === 0) {
        return Err(InvalidInputError("Location cannot be empty"));
      }
      if (updates.location.trim().length > 200) {
        return Err(InvalidInputError("Location must be 200 characters or less"));
      }
    }

    // Category validation
    if (updates.category !== undefined) {
      if (!VALID_CATEGORIES.includes(updates.category)) {
        return Err(
          InvalidInputError(
            `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
          )
        );
      }
    }

    // Capacity validation
    if (updates.capacity !== undefined && updates.capacity < 1) {
      return Err(InvalidInputError("Capacity must be at least 1"));
    }

    // Time validation: need to consider both new and existing times
    const finalStartTime = updates.startTime ?? event.startTime;
    const finalEndTime = updates.endTime ?? event.endTime;

    if (finalEndTime <= finalStartTime) {
      return Err(
        InvalidInputError("Event end time must be after start time")
      );
    }

    // Trim string fields before updating
    const sanitizedUpdates: Partial<Event> = {};
    if (updates.title !== undefined) sanitizedUpdates.title = updates.title.trim();
    if (updates.description !== undefined) sanitizedUpdates.description = updates.description.trim();
    if (updates.location !== undefined) sanitizedUpdates.location = updates.location.trim();
    if (updates.category !== undefined) sanitizedUpdates.category = updates.category;
    if (updates.startTime !== undefined) sanitizedUpdates.startTime = updates.startTime;
    if (updates.endTime !== undefined) sanitizedUpdates.endTime = updates.endTime;
    if (updates.capacity !== undefined) sanitizedUpdates.capacity = updates.capacity;
    if (updates.status !== undefined) sanitizedUpdates.status = updates.status;

    // Update the event
    const updatedEvent = await this.eventRepository.update(
      input.eventId,
      sanitizedUpdates
    );

    if (!updatedEvent) {
      return Err(EventNotFoundError("Event not found during update"));
    }

    return Ok(updatedEvent);
  }
}
