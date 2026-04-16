import type { IRSVP } from "./RSVP";

export interface IRSVPRepository {
  findByEventId(eventId: string): IRSVP[];
}
