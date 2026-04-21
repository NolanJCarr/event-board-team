import { type Result, Ok, Err } from "../lib/result";
import {
  UnauthorizedError,
  EventNotFoundError,
  UnexpectedDependencyError,
  type RSVPError,
} from "../rsvp/errors";
import type { IRSVPRepository, RSVPRecord } from "../repository/RSVPRepository";
import type { IEventRepository, Event } from "../events/EventRepository";
import type { UserRole } from "../auth/User";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** The status a member ends up in after a successful toggle. Matches the team contract. */
export type RSVPOutcome = "going" | "waitlisted" | "cancelled";

export interface RSVPActor {
  userId: string;
  role: UserRole;
}

export interface RSVPWithEvent {
  rsvp: RSVPRecord;
  event: Event;
}

export interface MyRSVPsDashboard {
  /** Active RSVPs (going/waitlisted) for events that haven't started yet, sorted soonest first. */
  upcoming: RSVPWithEvent[];
  /** Cancelled RSVPs or RSVPs for events that have already started, sorted most recent first. */
  pastAndCancelled: RSVPWithEvent[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IRSVPService {
  /**
   * Register an event and its max capacity so the service can enforce limits.
   * Sprint 3: removed — capacity will come from Prisma directly.
   */
  registerEvent(eventId: string, capacity: number): Promise<Result<void, RSVPError>>;

  /**
   * Toggle a member's RSVP for an event.
   *
   * Handles all three cases internally based on current state:
   *   - No existing record   → new RSVP ("going" or "waitlisted")
   *   - Active RSVP          → cancel it ("cancelled"); promotes first waitlisted if going
   *   - Cancelled RSVP       → reactivate ("going" or "waitlisted")
   *
   * Rejects organizers (staff) and admins.
   */
  toggleRSVP(actor: RSVPActor, eventId: string): Promise<Result<RSVPOutcome, RSVPError>>;

  /**
   * Return the authenticated user's RSVP dashboard, grouped into upcoming and
   * past/cancelled sections. Only accessible to members (role "user").
   */
  getMyRSVPs(actor: RSVPActor, now?: Date): Promise<Result<MyRSVPsDashboard, RSVPError>>;
}

class RSVPService implements IRSVPService {
  constructor(
    private readonly repository: IRSVPRepository,
    private readonly eventRepository: IEventRepository,
  ) {}

  async registerEvent(eventId: string, capacity: number): Promise<Result<void, RSVPError>> {
    return this.repository.setCapacity(eventId, capacity);
  }

  async toggleRSVP(actor: RSVPActor, eventId: string): Promise<Result<RSVPOutcome, RSVPError>> {
    if (actor.role === "admin" || actor.role === "staff") {
      return Err(UnauthorizedError("Only members can RSVP to events."));
    }

    const capacityResult = await this.repository.getCapacity(eventId);

    if (capacityResult.ok === false) {
      // Checks if the capacity of the event was retreived successfully
      return Err(UnexpectedDependencyError(capacityResult.value.message));
    }
    if (capacityResult.value === null) {
      //Another check to ensure the capacity was retreived correctly
      return Err(EventNotFoundError(`Event ${eventId} not found.`));
    }

    const existingResult = await this.repository.findRSVP(actor.userId, eventId);
    if (existingResult.ok === false) {
      //Checking if the person is allready RSVP'd for the eventID
      return Err(UnexpectedDependencyError(existingResult.value.message));
    }

    const existing = existingResult.value;

    if (existing === null) {
      // Path for a brand new RSVP because there will be no existing data for the connection.
      return this.createRSVP(actor.userId, eventId, capacityResult.value);
    }

    if (existing.status === "going" || existing.status === "waitlisted") {
      // for the instance of if they allready are active for the RSVP it cancels it 
      return this.cancelRSVP(existing, eventId);
    }
    //this means they previously had a active RSVP and now it will be reactivated/created.
    return this.createRSVP(actor.userId, eventId, capacityResult.value);
  }

  private async createRSVP(userId: string, eventId: string, capacity: number,): Promise<Result<RSVPOutcome, RSVPError>> {
    const countResult = await this.repository.countAttendees(eventId);
    if (countResult.ok === false) {
      return Err(UnexpectedDependencyError(countResult.value.message));
    }

    // Decides if they are going to be waitlisted or not if they are full.
    const outcome: RSVPOutcome = countResult.value < capacity ? "going" : "waitlisted";

    const record: RSVPRecord = {
      id: userId + ":" + eventId + ":" + Date.now(),
      userId: userId,
      eventId: eventId,
      status: outcome,
      createdAt: new Date(),
    };

    const saveResult = await this.repository.saveRSVP(record);
    if (saveResult.ok === false) {
      return Err(UnexpectedDependencyError(saveResult.value.message));
    }

    if (outcome === "waitlisted") {
      //Adds people from a full event to the ordered a ordered array of other waitlisted people.
      const waitlistResult = await this.repository.addToWaitlist(userId, eventId);
      if (waitlistResult.ok === false) {
        return Err(UnexpectedDependencyError(waitlistResult.value.message));
      }
    }

    return Ok(outcome);
  }

  private async cancelRSVP(existing: RSVPRecord, eventId: string): Promise<Result<RSVPOutcome, RSVPError>> {
    const wasGoing = existing.status === "going";

    const saveResult = await this.repository.saveRSVP({ ...existing, status: "cancelled" });
    if (saveResult.ok === false) {
      return Err(UnexpectedDependencyError(saveResult.value.message));
    }

    //Path for when they where gonna go so now people have to be moved FORWARD.
    if (wasGoing) {
      const shiftResult = await this.repository.shiftWaitlist(eventId);
      // POPS the top person off the waitlist for this event and changes them to "going"
      if (shiftResult.ok === false) {
        return Err(UnexpectedDependencyError(shiftResult.value.message));
      }
      const nextUserId = shiftResult.value;

      if (nextUserId !== null) {
        const promotedResult = await this.repository.findRSVP(nextUserId, eventId);
        if (promotedResult.ok === false) {
          await this.repository.addToWaitlist(nextUserId, eventId);
          return Err(UnexpectedDependencyError(promotedResult.value.message));
        }
        if (promotedResult.value !== null) {
          //This is where they are updated to going to the event
          const promoteResult = await this.repository.saveRSVP({...promotedResult.value,status: "going",});
          if (promoteResult.ok === false) {
            await this.repository.addToWaitlist(nextUserId, eventId);
            return Err(UnexpectedDependencyError(promoteResult.value.message));
          }
        }
      }
    } 
    else {
      //For if the person was on waitlsit for the event its a easy remove
      const removeResult = await this.repository.removeFromWaitlist(existing.userId, eventId);
      if (removeResult.ok === false) {
        return Err(UnexpectedDependencyError(removeResult.value.message));
      }
    }
    const outcome: RSVPOutcome = "cancelled";
    return Ok(outcome);
  }

  //THIS for feature 2 gets all the RSVPd events that must be rendered.
  async getMyRSVPs(actor: RSVPActor, now: Date = new Date()): Promise<Result<MyRSVPsDashboard, RSVPError>> {
    if (actor.role === "admin" || actor.role === "staff") {
      return Err(UnauthorizedError("Only members can view their RSVP dashboard."));
    }

    const recordsResult = await this.repository.findAllByUser(actor.userId);
    if (recordsResult.ok === false) {
      return Err(UnexpectedDependencyError(recordsResult.value.message));
    }

    const upcoming: RSVPWithEvent[] = [];
    const pastAndCancelled: RSVPWithEvent[] = [];

    for (const rsvp of recordsResult.value) {
      const event = await this.eventRepository.findById(rsvp.eventId);
      // Skip RSVPs whose event no longer exists (data consistency guard)
      if (!event) continue;

      const isActiveStatus = rsvp.status === "going" || rsvp.status === "waitlisted";
      const isFuture = event.startTime > now;

      // CHECKS WHICH CATEGORY THE EVENT FALLS UNDER MUST BE CURRENT AND EITHER GOING OR WAITLIST
      if (isActiveStatus && isFuture) {
        upcoming.push({ rsvp, event });
      } 
      else {
        pastAndCancelled.push({ rsvp, event });
      }
    }

    //Also sorts based off what is comign sooner using a HOF.
    upcoming.sort((a, b) => a.event.startTime.getTime() - b.event.startTime.getTime());
    pastAndCancelled.sort((a, b) => b.event.startTime.getTime() - a.event.startTime.getTime());

    return Ok({ upcoming, pastAndCancelled });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function CreateRSVPService(
  repository: IRSVPRepository,
  eventRepository: IEventRepository,
): IRSVPService {
  return new RSVPService(repository, eventRepository);
}
