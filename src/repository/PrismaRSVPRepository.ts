import type { PrismaClient } from "@prisma/client";
import { Ok, Err, type Result } from "../lib/result";
import { UnexpectedDependencyError, type RSVPError } from "../rsvp/errors";
import type { IRSVPRepository, RSVPRecord, RSVPStatus } from "./RSVPRepository";

class PrismaRSVPRepository implements IRSVPRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Capacity lives on the Event row — setCapacity is a no-op kept for interface compatibility.
  async setCapacity(_eventId: string, _capacity: number): Promise<Result<void, RSVPError>> {
    return Ok(undefined);
  }

  async getCapacity(eventId: string): Promise<Result<number | null, RSVPError>> {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { capacity: true },
      });
      return Ok(event?.capacity ?? null);
    } catch {
      return Err(UnexpectedDependencyError("Failed to read event capacity."));
    }
  }

  async findRSVP(userId: string, eventId: string): Promise<Result<RSVPRecord | null, RSVPError>> {
    try {
      const row = await this.prisma.rSVP.findFirst({ where: { userId, eventId } });
      return Ok(row ? this.toDomain(row) : null);
    } catch {
      return Err(UnexpectedDependencyError("Failed to find RSVP record."));
    }
  }

  async findAllByUser(userId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    try {
      const rows = await this.prisma.rSVP.findMany({ where: { userId } });
      return Ok(rows.map((r) => this.toDomain(r)));
    } catch {
      return Err(UnexpectedDependencyError("Failed to fetch RSVPs for user."));
    }
  }

  async saveRSVP(record: RSVPRecord): Promise<Result<RSVPRecord, RSVPError>> {
    try {
      // Enforce one RSVP per (userId, eventId): update if present, otherwise create.
      const existing = await this.prisma.rSVP.findFirst({
        where: { userId: record.userId, eventId: record.eventId },
      });
      const saved = existing
        ? await this.prisma.rSVP.update({
            where: { id: existing.id },
            data: { status: record.status, createdAt: record.createdAt },
          })
        : await this.prisma.rSVP.create({
            data: {
              id: record.id,
              userId: record.userId,
              eventId: record.eventId,
              status: record.status,
              createdAt: record.createdAt,
            },
          });
      return Ok(this.toDomain(saved));
    } catch {
      return Err(UnexpectedDependencyError("Failed to save RSVP record."));
    }
  }

  async countAttendees(eventId: string): Promise<Result<number, RSVPError>> {
    try {
      const count = await this.prisma.rSVP.count({ where: { eventId, status: "going" } });
      return Ok(count);
    } catch {
      return Err(UnexpectedDependencyError("Failed to count attendees."));
    }
  }

  async updateStatus(
    userId: string,
    eventId: string,
    status: RSVPStatus,
  ): Promise<Result<RSVPRecord | null, RSVPError>> {
    try {
      const existing = await this.prisma.rSVP.findFirst({ where: { userId, eventId } });
      if (!existing) return Ok(null);
      const updated = await this.prisma.rSVP.update({
        where: { id: existing.id },
        data: { status },
      });
      return Ok(this.toDomain(updated));
    } catch {
      return Err(UnexpectedDependencyError("Failed to update RSVP status."));
    }
  }

  async findAllByEvent(eventId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    try {
      const rows = await this.prisma.rSVP.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
      });
      return Ok(rows.map((r) => this.toDomain(r)));
    } catch {
      return Err(UnexpectedDependencyError("Failed to list RSVPs by event."));
    }
  }

  // Waitlist membership is the set of RSVP rows with status="waitlisted", ordered by createdAt.
  // saveRSVP with that status puts a user on the waitlist; saveRSVP with another status removes them.
  // These methods stay no-ops to honor the interface; ordering/promotion is handled below.
  async addToWaitlist(_userId: string, _eventId: string): Promise<Result<void, RSVPError>> {
    return Ok(undefined);
  }

  async removeFromWaitlist(_userId: string, _eventId: string): Promise<Result<void, RSVPError>> {
    return Ok(undefined);
  }

  async shiftWaitlist(eventId: string): Promise<Result<string | null, RSVPError>> {
    try {
      const next = await this.prisma.rSVP.findFirst({
        where: { eventId, status: "waitlisted" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      return Ok(next?.userId ?? null);
    } catch {
      return Err(UnexpectedDependencyError("Failed to shift waitlist."));
    }
  }

  async getWaitlistPosition(userId: string, eventId: string): Promise<Result<number | null, RSVPError>> {
    try {
      const own = await this.prisma.rSVP.findFirst({
        where: { userId, eventId, status: "waitlisted" },
        select: { createdAt: true },
      });
      if (!own) return Ok(null);
      const earlier = await this.prisma.rSVP.count({
        where: { eventId, status: "waitlisted", createdAt: { lt: own.createdAt } },
      });
      return Ok(earlier + 1);
    } catch {
      return Err(UnexpectedDependencyError("Failed to compute waitlist position."));
    }
  }
  
  async cancelAndPromote(
    userId:string,
    eventId: string
  ): Promise<Result<{ promotedUserId: string|null}, RSVPError>> {
    try{
      const result = await this.prisma.$transaction(async (tx)=> {
        const existing = await tx.rSVP.findFirst({
          where: {userId, eventId, status: "going"},
        });
        if (!existing){
          return { promotedUserId: null};
        }
        await tx.rSVP.update({
          where: {id:existing.id},
          data: {status: "cancelled"},
        });
        const next = await tx.rSVP.findFirst({
          where: { eventId, status: "waitlisted"},
          orderBy: { createdAt: "asc"},
        });
        if (next){
          await tx.rSVP.update({
            where: { id: next.id},
            data: {status: "going"},
          });
          return { promotedUserId: next.userId};
        }
        return { promotedUserId: null};
      });
      return Ok(result);
    } catch{
      return Err(UnexpectedDependencyError("Failed to cancel and promote."));
    }
  }

  private toDomain(row: { id: string; userId: string; eventId: string; status: string; createdAt: Date | string }): RSVPRecord {
    return {
      id: row.id,
      userId: row.userId,
      eventId: row.eventId,
      status: row.status as RSVPStatus,
      createdAt: new Date(row.createdAt),
    };
  }
}

export function CreatePrismaRSVPRepository(prisma: PrismaClient): IRSVPRepository {
  return new PrismaRSVPRepository(prisma);
}
