export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export class EventNotFoundError extends Error {
  constructor(message: string = "Event not found") {
    super(message);
    this.name = "EventNotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = "You do not have permission to perform this action") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export type EventError = InvalidInputError | EventNotFoundError | UnauthorizedError | InvalidStateError;
