import type { Result } from "../lib/result";
import { Ok, Err } from "../lib/result";
import type { Event, CreateEventInput, EventCategory } from "./Event";
import type { IEventRepository } from "./EventRepository";
import { InvalidInputError, UnauthorizedError } from "./errors";

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
  ): Promise<Result<Event, InvalidInputError | UnauthorizedError>> {
    // Validate required fields
    const validationError = this.validateEventInput(input);
    if (validationError) {
      return Err(validationError);
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(input.category as EventCategory)) {
      return Err(
        new InvalidInputError(
          `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
        )
      );
    }

    // Validate time range
    if (input.endTime <= input.startTime) {
      return Err(
        new InvalidInputError("Event end time must be after start time")
      );
    }

    // Validate capacity if provided
    if (input.capacity !== undefined && input.capacity < 1) {
      return Err(new InvalidInputError("Capacity must be at least 1"));
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
  ): InvalidInputError | null {
    // Title validation
    if (!input.title || input.title.trim().length === 0) {
      return new InvalidInputError("Title is required");
    }
    if (input.title.trim().length > 200) {
      return new InvalidInputError("Title must be 200 characters or less");
    }

    // Description validation
    if (!input.description || input.description.trim().length === 0) {
      return new InvalidInputError("Description is required");
    }
    if (input.description.trim().length > 2000) {
      return new InvalidInputError(
        "Description must be 2000 characters or less"
      );
    }

    // Location validation
    if (!input.location || input.location.trim().length === 0) {
      return new InvalidInputError("Location is required");
    }
    if (input.location.trim().length > 200) {
      return new InvalidInputError("Location must be 200 characters or less");
    }

    // Category validation
    if (!input.category || input.category.trim().length === 0) {
      return new InvalidInputError("Category is required");
    }

    // Date validation
    if (!input.startTime || !(input.startTime instanceof Date)) {
      return new InvalidInputError("Valid start time is required");
    }
    if (!input.endTime || !(input.endTime instanceof Date)) {
      return new InvalidInputError("Valid end time is required");
    }

    // Organizer validation
    if (!input.organizerId || input.organizerId.trim().length === 0) {
      return new InvalidInputError("Organizer ID is required");
    }

    return null;
  }
}
