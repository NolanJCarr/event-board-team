export type RSVPError =
  | { name: "UnauthorizedError"; message: string }
  | { name: "EventNotFoundError"; message: string }
  | { name: "InvalidStateError"; message: string }
  | { name: "UnexpectedDependencyError"; message: string };

export const UnauthorizedError = (message: string): RSVPError => ({
  name: "UnauthorizedError",
  message,
});

export const EventNotFoundError = (message: string): RSVPError => ({
  name: "EventNotFoundError",
  message,
});

export const InvalidStateError = (message: string): RSVPError => ({
  name: "InvalidStateError",
  message,
});

export const UnexpectedDependencyError = (message: string): RSVPError => ({
  name: "UnexpectedDependencyError",
  message,
});
