import type { Result } from "../lib/result";
import { Ok, Err } from "../lib/result";
import type { IEventRepository } from "../events/EventRepository";
import type { IRSVPRepository } from "../repository/RSVPRepository";
import type { IUserRepository } from "../repository/UserRepository";
import type {AttendeeList, AttendeeEntry } from "../attendee/Attendee";
import { 
  AttendeeListError,
  AttendeeListNotFoundError,
  AttendeeListForbiddenError,
  AttendeeListUserLookupError,
} from "../attendee/errors";
import type { RSVPStatus } from "../repository/RSVPRepository";
import type { UserRole } from "../auth/User";

export interface CallerIdentity {
  userId: string;
  role: UserRole;
}

export interface IAttendeeListService {
  getAttendeeList(
    eventId: string,
    caller: CallerIdentity,
  ): Promise<Result<AttendeeList, AttendeeListError>>;
}

class AttendeeListService implements IAttendeeListService {
  constructor(
    private readonly events: IEventRepository,
    private readonly rsvps: IRSVPRepository,
    private readonly users: IUserRepository,
  ) {}

  async getAttendeeList(
    eventId: string,
    caller: CallerIdentity,
  ): Promise<Result<AttendeeList, AttendeeListError>> {
    // ── 1. Load the event ─────────────────────────────────────────────────────
    // IEventRepository.findById returns Event | null with no Result wrapper,
    // so we let the real promise rejection bubble as an unhandled error (the
    // same way the rest of the codebase treats repository throws) and only
    // handle the null / not-found case ourselves.
    const event = await this.events.findById(eventId);

    if (event === null) {
      return Err(new AttendeeListNotFoundError(eventId));
    }

    // ── 2. Authorization ──────────────────────────────────────────────────────
    const isAdmin = caller.role === "admin";
    const isOrganizer = caller.userId === event.organizerId;

    if (!isAdmin && !isOrganizer) {
      return Err(new AttendeeListForbiddenError());
    }

    // ── 3. Fetch RSVPs ────────────────────────────────────────────────────────
    const rsvpResult = await this.rsvps.findAllByEvent(eventId);
        if (rsvpResult.ok === false) {
          return Err(new AttendeeListUserLookupError("(storage failure)"));
        }
        const records = rsvpResult.value;
    // ── 4. Resolve display names, one lookup per unique userId ────────────────
    const nameCache = new Map<string, string>();

    for (const record of records) {
      if (nameCache.has(record.userId)) continue;

      // IUserRepository.findById also returns Result, so we unwrap carefully.
      const userResult = await this.users.findById(record.userId);

      if (userResult.ok === false || userResult.value === null) {
        // A missing user means stale RSVP data. Fail loudly rather than
        // silently dropping an attendee from the organizer's headcount.
        return Err(new AttendeeListUserLookupError(record.userId));
      }

      nameCache.set(record.userId, userResult.value.displayName);
    }

    // ── 5. Bucket by status ───────────────────────────────────────────────────
    const buckets: Record<RSVPStatus, AttendeeEntry[]> = {
      going: [],
      waitlisted: [],
      cancelled: [],
    };

    for (const record of records) {
      buckets[record.status].push({
        userId: record.userId,
        displayName: nameCache.get(record.userId)!,
        status: record.status,
        rsvpedAt: record.createdAt,
      });
    }

    // ── 6. Sort each bucket oldest-first ──────────────────────────────────────
    // ISO-8601 strings are lexicographically ordered, so localeCompare is exact.
    const byRsvpTime = (a: AttendeeEntry, b: AttendeeEntry): number =>
      a.rsvpedAt.getTime() - b.rsvpedAt.getTime();

    return Ok({
      eventId,
      attending: buckets.going.sort(byRsvpTime),
      waitlisted: buckets.waitlisted.sort(byRsvpTime),
      cancelled: buckets.cancelled.sort(byRsvpTime),
    });
  }
}

export function CreateAttendeeListService(
  events: IEventRepository,
  rsvps: IRSVPRepository,
  users: IUserRepository,
): IAttendeeListService {
  return new AttendeeListService(events, rsvps, users);
}