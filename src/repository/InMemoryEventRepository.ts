import { Ok, type Result } from "../lib/result";
import type { Event, EventError, GetEventsFilter, IEventRepository } from "./EventRepository";

export class InMemoryEventRepository implements IEventRepository {
  private events: Map<string, Event> = new Map();

  seed(events: Event[]): void {
    for (const event of events) {
      this.events.set(event.id, event);
    }
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

    let results = Array.from(this.events.values()).filter(
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
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}
