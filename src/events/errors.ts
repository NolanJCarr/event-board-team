export interface EventError {
  name: string;
  message: string;
}

export const InvalidInputError = (message: string): EventError => ({
  name: "InvalidInputError",
  message,
});

export const EventNotFoundError = (
  message: string = "Event not found"
): EventError => ({
  name: "EventNotFoundError",
  message,
});

export const UnauthorizedError = (
  message: string = "You do not have permission to perform this action"
): EventError => ({
  name: "UnauthorizedError",
  message,
});

export const InvalidStateError = (message: string): EventError => ({
  name: "InvalidStateError",
  message,
});
