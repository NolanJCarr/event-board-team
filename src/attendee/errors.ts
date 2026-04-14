/**
 * Mirrors the shape of RSVPError so mapErrorStatus can follow the
 * same `error.name` pattern used in RSVPController.
 */
export class AttendeeListNotFoundError extends Error {
  readonly name = "AttendeeListNotFoundError" as const;
  constructor(public readonly eventId: string) {
    super(`Event '${eventId}' not found.`);
  }
}

export class AttendeeListForbiddenError extends Error {
  readonly name = "AttendeeListForbiddenError" as const;
  constructor() {
    super("Only the event organizer or an admin may view the attendee list.");
  }
}

export class AttendeeListUserLookupError extends Error {
  readonly name = "AttendeeListUserLookupError" as const;
  constructor(public readonly userId: string) {
    super(`Could not resolve attendee with ID '${userId}'.`);
  }
}

export type AttendeeListError =
  | AttendeeListNotFoundError
  | AttendeeListForbiddenError
  | AttendeeListUserLookupError;