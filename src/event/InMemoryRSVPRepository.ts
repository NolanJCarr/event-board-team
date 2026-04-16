import type { IRSVP } from "./RSVP";
import type { IRSVPRepository } from "./RSVPRepository";

const DEMO_RSVPS: IRSVP[] = [
  // evt-001: Community Garden Cleanup (capacity 30)
  { userId: "user-admin", eventId: "evt-001", status: "going" },
  { userId: "user-staff", eventId: "evt-001", status: "going" },
  { userId: "user-reader", eventId: "evt-001", status: "cancelled" },

  // evt-002: Local Art Walk (no capacity limit)
  { userId: "user-admin", eventId: "evt-002", status: "going" },
  { userId: "user-staff", eventId: "evt-002", status: "going" },
  { userId: "user-reader", eventId: "evt-002", status: "going" },

  // evt-003: Neighbourhood Book Swap (capacity 50)
  { userId: "user-admin", eventId: "evt-003", status: "going" },
  { userId: "user-staff", eventId: "evt-003", status: "waitlisted" },
  { userId: "user-reader", eventId: "evt-003", status: "going" },

  // evt-004: Evening Jazz in the Park (capacity 200)
  { userId: "user-admin", eventId: "evt-004", status: "going" },
  { userId: "user-staff", eventId: "evt-004", status: "going" },
  { userId: "user-reader", eventId: "evt-004", status: "waitlisted" },
];

class InMemoryRSVPRepository implements IRSVPRepository {
  constructor(private readonly rsvps: IRSVP[]) {}

  findByEventId(eventId: string): IRSVP[] {
    return this.rsvps.filter((rsvp) => rsvp.eventId === eventId);
  }
}

export function CreateInMemoryRSVPRepository(): IRSVPRepository {
  return new InMemoryRSVPRepository([...DEMO_RSVPS]);
}
