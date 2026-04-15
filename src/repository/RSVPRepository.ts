import type { Result } from "../lib/result";
import type { RSVPError } from "../rsvp/errors";

export type RSVPStatus = "going" | "waitlisted" | "cancelled";

export interface RSVPRecord {
  id: string;
  userId: string;
  eventId: string;
  status: RSVPStatus;
  createdAt: Date;
}

export interface IRSVPRepository {
  // ── Event capacity (Sprint 1 stand-in; replaced by Prisma query in Sprint 3) ──
  setCapacity(eventId: string, capacity: number): Promise<Result<void, RSVPError>>;
  getCapacity(eventId: string): Promise<Result<number | null, RSVPError>>;

  // ── RSVP records ─────────────────────────────────────────────────────────────
  findRSVP(userId: string, eventId: string): Promise<Result<RSVPRecord | null, RSVPError>>;
  findAllByUser(userId: string): Promise<Result<RSVPRecord[], RSVPError>>;
  saveRSVP(record: RSVPRecord): Promise<Result<RSVPRecord, RSVPError>>;
  countAttendees(eventId: string): Promise<Result<number, RSVPError>>;

  // ── Waitlist (ordered by insertion time) ─────────────────────────────────────
  addToWaitlist(userId: string, eventId: string): Promise<Result<void, RSVPError>>;
  removeFromWaitlist(userId: string, eventId: string): Promise<Result<void, RSVPError>>;
  /** Removes and returns the first userId on the waitlist, or null if empty. */
  shiftWaitlist(eventId: string): Promise<Result<string | null, RSVPError>>;
  getWaitlistPosition(userId: string, eventId: string,): Promise<Result<number | null, RSVPError>>;
  cancelAndPromote(cancellerRecord: RSVPRecord, eventId:string,): Promise<Result<RSVPRecord | null, RSVPError>>;
}
