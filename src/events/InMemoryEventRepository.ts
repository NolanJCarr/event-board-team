import type { Event } from "./Event";
import type { IEventRepository } from "./EventRepository";

export class InMemoryEventRepository implements IEventRepository {
  private events: Map<string, Event> = new Map();
  private idCounter = 1;

  /** Seed events directly for testing. */
  seed(events: Event[]): void {
    for (const event of events) {
      this.events.set(event.id, event);
    }
  }

  async create(event: Omit<Event, "id" | "createdAt" | "updatedAt">): Promise<Event> {
    const id = `evt_${this.idCounter++}`;
    const now = new Date();

    const newEvent: Event = {
      ...event,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.events.set(id, newEvent);
    return newEvent;
  }

  async findById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }

  async findAll(): Promise<Event[]> {
    return Array.from(this.events.values());
  }

  async update(id: string, updates: Partial<Event>): Promise<Event | null> {
    const event = this.events.get(id);
    if (!event) {
      return null;
    }

    const updatedEvent: Event = {
      ...event,
      ...updates,
      id: event.id, // Ensure ID cannot be changed
      organizerId: event.organizerId, // Ensure organizer cannot be changed
      createdAt: event.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date(),
    };

    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async findByOrganizerId(organizerId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      (event) => event.organizerId === organizerId
    );
  }

  /**
   * Get all events from the repository (for filter/search features).
   * This allows the CRUD repository to also serve filtering needs.
   */
  getAllEvents(): Event[] {
    return Array.from(this.events.values());
  }
}
