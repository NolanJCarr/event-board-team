import type { PrismaClient } from "@prisma/client";
import { Ok, Err, type Result } from "../lib/result";
import { UnexpectedDependencyError, type RSVPError } from "../rsvp/errors";
import type { IRSVPRepository, RSVPRecord, RSVPStatus } from "./RSVPRepository";

class PrismaRSVPRepository implements IRSVPRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async setCapacity(_eventId: string, _capacity: number): Promise<Result<void, RSVPError>> {
    return Err(UnexpectedDependencyError("setCapacity not implemented"));
  }

  async getCapacity(_eventId: string): Promise<Result<number | null, RSVPError>> {
    return Err(UnexpectedDependencyError("getCapacity not implemented"));
  }

  async findRSVP(_userId: string, _eventId: string): Promise<Result<RSVPRecord | null, RSVPError>> {
    return Err(UnexpectedDependencyError("findRSVP not implemented"));
  }

  async findAllByUser(_userId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    return Err(UnexpectedDependencyError("findAllByUser not implemented"));
  }

  async saveRSVP(_record: RSVPRecord): Promise<Result<RSVPRecord, RSVPError>> {
    return Err(UnexpectedDependencyError("saveRSVP not implemented"));
  }

  async countAttendees(_eventId: string): Promise<Result<number, RSVPError>> {
    return Err(UnexpectedDependencyError("countAttendees not implemented"));
  }

  async updateStatus(
    _userId: string,
    _eventId: string,
    _status: RSVPStatus,
  ): Promise<Result<RSVPRecord | null, RSVPError>> {
    return Err(UnexpectedDependencyError("updateStatus not implemented"));
  }

  async findAllByEvent(_eventId: string): Promise<Result<RSVPRecord[], RSVPError>> {
    return Err(UnexpectedDependencyError("findAllByEvent not implemented"));
  }

  async addToWaitlist(_userId: string, _eventId: string): Promise<Result<void, RSVPError>> {
    return Err(UnexpectedDependencyError("addToWaitlist not implemented"));
  }

  async removeFromWaitlist(_userId: string, _eventId: string): Promise<Result<void, RSVPError>> {
    return Err(UnexpectedDependencyError("removeFromWaitlist not implemented"));
  }

  async shiftWaitlist(_eventId: string): Promise<Result<string | null, RSVPError>> {
    return Err(UnexpectedDependencyError("shiftWaitlist not implemented"));
  }

  async getWaitlistPosition(_userId: string, _eventId: string): Promise<Result<number | null, RSVPError>> {
    return Err(UnexpectedDependencyError("getWaitlistPosition not implemented"));
  }

  // Suppress unused-prisma warning while methods are scaffolded.
  protected _prismaRef(): PrismaClient {
    return this.prisma;
  }
}

export function CreatePrismaRSVPRepository(prisma: PrismaClient): IRSVPRepository {
  return new PrismaRSVPRepository(prisma);
}
