export type EventError =
  | { name: "InvalidInputError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "EventNotFoundError"; message: string }
  | { name: "InvalidStateError"; message: string };

export const InvalidInputError = (message: string): EventError => ({
  name: "InvalidInputError",
  message,
});

export const EventNotFoundError = (
  message = "Event not found"
): EventError => ({
  name: "EventNotFoundError",
  message,
});

export const UnauthorizedError = (
  message = "You do not have permission to perform this action"
): EventError => ({
  name: "UnauthorizedError",
  message,
});

export const InvalidStateError = (message: string): EventError => ({
  name: "InvalidStateError",
  message,
});
