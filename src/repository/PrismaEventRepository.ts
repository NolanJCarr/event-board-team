import { Ok, Err, type Result } from "../lib/result";
import { PrismaClient } from "@prisma/client";
import type {
  Event,
  EventError,
  GetEventsFilter,
  IEventRepository,
} from "./EventRepository";
import { InvalidInputError } from "./EventRepository";

export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    event: Omit<Event, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<Event, EventError>> {
    try {
      const created = await this.prisma.event.create({
        data: {
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category,
          startTime: event.startTime,
          endTime: event.endTime,
          capacity: event.capacity,
          status: event.status,
          organizerId: event.organizerId,
        },
      });

      return Ok(this.toDomain(created));
    } catch (e) {
      return Err(InvalidInputError("Failed to create event."));
    }
  }

  async getEvents(
    filter: GetEventsFilter
  ): Promise<Result<Event[], EventError>> {
    try {
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

      const events = await this.prisma.event.findMany({
        where: {
          status: "published",
          startTime: {
            gte: startRange ?? now,
            ...(endRange ? { lte: endRange } : {}),
          },
          ...(filter.category ? { category: filter.category } : {}),
          ...(filter.searchQuery
            ? {
                OR: [
                  {
                    title: {
                      contains: filter.searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    description: {
                      contains: filter.searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    location: {
                      contains: filter.searchQuery,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { startTime: "asc" },
      });

      return Ok(events.map((e) => this.toDomain(e)));
    } catch (e) {
      return Err(
        InvalidInputError("Failed to query events from the database.")
      );
    }
  }

  async findById(
    id: string
  ): Promise<Result<Event | null, EventError>> {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id },
      });

      return Ok(event ? this.toDomain(event) : null);
    } catch (e) {
      return Err(
        InvalidInputError("Failed to find event in the database.")
      );
    }
  }

  async findAll(): Promise<Result<Event[], EventError>> {
    try {
      const events = await this.prisma.event.findMany();
      return Ok(events.map((e) => this.toDomain(e)));
    } catch (e) {
      return Err(
        InvalidInputError("Failed to retrieve events from the database.")
      );
    }
  }

  async update(
    id: string,
    updates: Partial<Event>
  ): Promise<Result<Event | null, EventError>> {
    try {
      const existing = await this.prisma.event.findUnique({
        where: { id },
      });

      if (!existing) {
        return Ok(null);
      }

      const updated = await this.prisma.event.update({
        where: { id },
        data: updates,
      });

      return Ok(this.toDomain(updated));
    } catch (e) {
      return Err(InvalidInputError("Failed to update event."));
    }
  }

  async findByOrganizerId(
    organizerId: string
  ): Promise<Result<Event[], EventError>> {
    try {
      const events = await this.prisma.event.findMany({
        where: { organizerId },
      });

      return Ok(events.map((e) => this.toDomain(e)));
    } catch (e) {
      return Err(
        InvalidInputError("Failed to retrieve organizer events.")
      );
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
      capacity: prismaEvent.capacity ?? undefined,
      status: prismaEvent.status,
      organizerId: prismaEvent.organizerId,
      createdAt: new Date(prismaEvent.createdAt),
      updatedAt: new Date(prismaEvent.updatedAt),
    };
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient
): IEventRepository {
  return new PrismaEventRepository(prisma);
}