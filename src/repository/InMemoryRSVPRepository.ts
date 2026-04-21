import { Ok, Err, type Result } from "../lib/result";
import { UnexpectedDependencyError, type RSVPError } from "../rsvp/errors";
import type { IRSVPRepository, RSVPRecord } from "./RSVPRepository";

class InMemoryRSVPRepository implements IRSVPRepository {
  // keyed by `${userId}:${eventId}`
  private readonly rsvps = new Map<string, RSVPRecord>();
  // eventId -> max capacity
  private readonly capacities = new Map<string, number>();
  // eventId -> ordered list of userIds on the waitlist
  private readonly waitlists = new Map<string, string[]>();

  private recordKey(userId: string, eventId: string): string {
    return `${userId}:${eventId}`;
  }

  async setCapacity(eventId: string, capacity: number): Promise<Result<void, RSVPError>> {
    try {
      this.capacities.set(eventId, capacity);
      if (!this.waitlists.has(eventId)) {
        this.waitlists.set(eventId, []);
      }
      return Ok(undefined);
    } catch {
      return Err(UnexpectedDependencyError("Failed to set event capacity."));
    }
  }

  async getCapacity(eventId: string): Promise<Result<number | null, RSVPError>> {
    try {
      return Ok(this.capacities.get(eventId) ?? null);
    } catch {
      return Err(UnexpectedDependencyError("Failed to read event capacity."));
    }
  }

  async findRSVP(userId: string, eventId: string): Promise<Result<RSVPRecord | null, RSVPError>> {
    try {
      return Ok(this.rsvps.get(this.recordKey(userId, eventId)) ?? null);
    } 
    catch {
      return Err(UnexpectedDependencyError("Failed to find RSVP record."));
    }
  }

  async findAllByUser(userId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    try {
      const records = Array.from(this.rsvps.values()).filter(
        (r) => r.userId === userId,
      );
      return Ok(records);
    } 
    catch {
      return Err(UnexpectedDependencyError("Failed to fetch RSVPs for user."));
    }
  }

  async saveRSVP(record: RSVPRecord): Promise<Result<RSVPRecord, RSVPError>> {
    try {
      this.rsvps.set(this.recordKey(record.userId, record.eventId), record);
      return Ok(record);
    } 
    catch {
      return Err(UnexpectedDependencyError("Failed to save RSVP record."));
    }
  }

  async countAttendees(eventId: string): Promise<Result<number, RSVPError>> {
    try {
      let count = 0;
      for (const record of this.rsvps.values()) {
        if (record.eventId === eventId && record.status === "going") {
          count++;
        }
      }
      return Ok(count);
    } catch {
      return Err(UnexpectedDependencyError("Failed to count attendees."));
    }
  }

  async findAllByEvent(eventId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    try {
    const results = Array.from(this.rsvps.values())
      .filter(r => r.eventId === eventId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return Ok(results);
  } catch {
    return Err(UnexpectedDependencyError("Failed to list RSVPs by event."));
  }
}
  async listByEvent(eventId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    const results: RSVPRecord[] = [];
    for (const record of this.rsvps.values()){
      if (record.eventId === eventId) results.push(record);
    }
    return Ok(results)
  }
  
  async addToWaitlist(userId: string, eventId: string): Promise<Result<void, RSVPError>> {
    try {
      const list = this.waitlists.get(eventId) ?? [];
      if (!list.includes(userId)) {
        list.push(userId);
        this.waitlists.set(eventId, list);
      }
      return Ok(undefined);
    } catch {
      return Err(UnexpectedDependencyError("Failed to add to waitlist."));
    }
  }

  async removeFromWaitlist(userId: string, eventId: string): Promise<Result<void, RSVPError>> {
    try {
      const list = this.waitlists.get(eventId);
      if (list) {
        const idx = list.indexOf(userId);
        if (idx !== -1) list.splice(idx, 1);
      }
      return Ok(undefined);
    } catch {
      return Err(UnexpectedDependencyError("Failed to remove from waitlist."));
    }
  }

  async shiftWaitlist(eventId: string): Promise<Result<string | null, RSVPError>> {
    try {
      const list = this.waitlists.get(eventId);
      if (!list || list.length === 0) return Ok(null);
      return Ok(list.shift()!);
    } 
    catch {
      return Err(UnexpectedDependencyError("Failed to shift waitlist."));
    }
  }
}

export function CreateInMemoryRSVPRepository(): IRSVPRepository {
  return new InMemoryRSVPRepository();
}
