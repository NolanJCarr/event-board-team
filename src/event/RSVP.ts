export type RSVPStatus = "going" | "waitlisted" | "cancelled";

export interface IRSVP {
  userId: string;
  eventId: string;
  status: RSVPStatus;
}
