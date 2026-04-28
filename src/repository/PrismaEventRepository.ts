import type { PrismaClient } from "@prisma/client";
import type { IEventRepository } from "../events/EventRepository";
import type { Event } from "../events/Event";

export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(event: Omit<Event, "id" | "createdAt" | "updatedAt">): Promise<Event> {
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
    return this.toDomain(created);
  }

  async findById(id: string): Promise<Event | null> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    return event ? this.toDomain(event) : null;
  }

  async findAll(): Promise<Event[]> {
    const events = await this.prisma.event.findMany();
    return events.map((e) => this.toDomain(e));
  }

  async update(id: string, updates: Partial<Event>): Promise<Event | null> {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates;
    const updated = await this.prisma.event.update({ where: { id }, data: safeUpdates });
    return this.toDomain(updated);
  }

  async findByOrganizerId(organizerId: string): Promise<Event[]> {
    const events = await this.prisma.event.findMany({ where: { organizerId } });
    return events.map((e) => this.toDomain(e));
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
