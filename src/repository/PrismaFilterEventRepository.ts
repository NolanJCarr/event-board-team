import { PrismaClient } from "@prisma/client";
import { Ok, Err, type Result } from "../lib/result";
import {
  InvalidInputError,
  type Event,
  type EventError,
  type GetEventsFilter,
  type IEventRepository,
} from "./EventRepository";

/**
 * Prisma-backed implementation of the filter-based IEventRepository.
 * Replicates the semantics of InMemoryEventRepository.getEvents exactly:
 *   - status === "published"
 *   - timeframe (all | week | weekend) — same date math
 *   - category equality
 *   - case-insensitive substring search on title/description/location
 *   - sorted ascending by startTime
 *
 * Note: SQLite (the current Prisma datasource) does not support
 * `mode: "insensitive"` on string filters. To preserve exact case-insensitive
 * substring semantics from the in-memory implementation, the search filter is
 * applied in JS after the where-clause-driven query.
 */
export class PrismaFilterEventRepository implements IEventRepository {
  constructor(private prisma: PrismaClient) {}

  async getEvents(
    filter: GetEventsFilter,
  ): Promise<Result<Event[], EventError>> {
    const now = new Date();
    let startRange: Date | undefined;
    let endRange: Date | undefined;

    if (filter.timeframe === "week") {
      startRange = now;
      endRange = new Date(now);
      endRange.setDate(endRange.getDate() + 7);
    } else if (filter.timeframe === "weekend") {
      const day = now.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7 || 7;
      startRange = new Date(now);
      startRange.setDate(now.getDate() + daysUntilSaturday);
      startRange.setHours(0, 0, 0, 0);
      endRange = new Date(startRange);
      endRange.setDate(startRange.getDate() + 1);
      endRange.setHours(23, 59, 59, 999);
    }

    const where: Record<string, unknown> = { 
      status: "published",
      startTime: { gte: now }
    };
    if (filter.category) {
      where.category = filter.category;
    }
    if (startRange || endRange) {
      const startTime: Record<string, Date> = {};
      if (startRange) startTime.gte = startRange;
      if (endRange) startTime.lte = endRange;
      where.startTime = startTime;
    }

    try {
      const rows = await this.prisma.event.findMany({
        where,
        orderBy: { startTime: "asc" },
      });

      let results = rows.map((r) => this.toDomain(r));

      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        results = results.filter(
          (event) =>
            event.title.toLowerCase().includes(q) ||
            event.description.toLowerCase().includes(q) ||
            event.location.toLowerCase().includes(q),
        );
      }

      return Ok(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Err(InvalidInputError(`Failed to fetch events: ${message}`));
    }
  }

  async findById(
    eventId: string,
  ): Promise<Result<Event | null, EventError>> {
    try {
      const row = await this.prisma.event.findUnique({ where: { id: eventId } });
      return Ok(row ? this.toDomain(row) : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Err(InvalidInputError(`Failed to fetch event: ${message}`));
    }
  }

  private toDomain(prismaEvent: any): Event {
    return {
      id: prismaEvent.id,
      title: prismaEvent.title,
      description: prismaEvent.description,
      location: prismaEvent.location,
      category: prismaEvent.category,
      startTime: new Date(prismaEvent.startTime),
      endTime: new Date(prismaEvent.endTime),
      capacity: prismaEvent.capacity ?? null,
      status: prismaEvent.status,
      organizerId: prismaEvent.organizerId,
      createdAt: new Date(prismaEvent.createdAt),
    };
  }
}
