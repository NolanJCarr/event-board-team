import type { RSVPStatus } from "../repository/RSVPRepository";

export interface AttendeeEntry {
  userId: string;
  displayName: string;
  status: RSVPStatus;
  rsvpedAt: Date; // maps to RSVPRecord.createdAt
}


export interface AttendeeList {
  attending: AttendeeEntry[];
  waitlisted: AttendeeEntry[];
  cancelled: AttendeeEntry[];
}