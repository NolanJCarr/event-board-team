import type { RSVPStatus } from "../repository/RSVPRepository";

// One row in the attendee list: the RSVP record joined with the user's display name.
export interface AttendeeEntry {
  userId: string;
  displayName: string;
  status: RSVPStatus;
  rsvpedAt: Date; // maps to RSVPRecord.createdAt
}

// The full response shape: three buckets, each sorted by rsvpedAt ascending.
export interface GroupedAttendeeList {
  attending: AttendeeEntry[];
  waitlisted: AttendeeEntry[];
  cancelled: AttendeeEntry[];
}