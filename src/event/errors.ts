export type EventError =
  | { name: "InvalidInputError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "EventNotFoundError"; message: string }
  | { name: "InvalidStateError"; message: string };

export const InvalidInputError = (message: string): EventError => ({
  name: "InvalidInputError",
  message,
});

export const UnauthorizedError = (message: string): EventError => ({
  name: "UnauthorizedError",
  message,
});

export const EventNotFoundError = (message: string): EventError => ({
  name: "EventNotFoundError",
  message,
});

export const InvalidStateError = (message: string): EventError => ({
  name: "InvalidStateError",
  message,
});
