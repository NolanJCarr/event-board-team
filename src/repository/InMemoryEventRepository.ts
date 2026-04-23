import { Ok, type Result } from "../lib/result";
import type { Event, EventError, GetEventsFilter, IEventRepository } from "./EventRepository";

export class InMemoryEventRepository implements IEventRepository {
  private events: Map<string, Event> = new Map();
  private crudRepo?: { getAllEvents(): Event[] };

  seed(events: Event[]): void {
    for (const event of events) {
      this.events.set(event.id, event);
    }
  }

  /**
   * Seed from a CRUD repository instead of using our own data store.
   * This makes the filter repository delegate to the shared CRUD repo.
   */
  seedFromCrudRepo(crudRepo: { getAllEvents(): Event[] }): void {
    this.crudRepo = crudRepo;
  }

  async getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>> {
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

    // Use CRUD repository if available, otherwise use own data store
    const allEvents = this.crudRepo ? this.crudRepo.getAllEvents() : Array.from(this.events.values());

    let results = allEvents.filter(
      (event) => event.status === "published",
    );

    if (startRange) {
      results = results.filter((event) => event.startTime >= startRange!);
    }
    if (endRange) {
      results = results.filter((event) => event.startTime <= endRange!);
    }
    if (filter.category) {
      results = results.filter((event) => event.category === filter.category);
    }
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      results = results.filter(
        (event) =>
          event.title.toLowerCase().includes(q) ||
          event.description.toLowerCase().includes(q) ||
          event.location.toLowerCase().includes(q),
      );
    }

    results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return Ok(results);
  }

  async findById(eventId: string): Promise<Result<Event | null, EventError>> {
    const allEvents = this.crudRepo ? this.crudRepo.getAllEvents() : Array.from(this.events.values());
    return Ok(allEvents.find(e => e.id === eventId) ?? null);
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}
