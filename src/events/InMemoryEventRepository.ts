import type { AppEvent } from "./Event";
import type { IEventRepository } from "./EventRepository";

export class InMemoryEventRepository implements IEventRepository {
  private readonly events: Map<string, AppEvent> = new Map();

  /** Seed events for testing. */
  seed(events: AppEvent[]): void {
    for (const event of events) {
      this.events.set(event.id, event);
    }
  }

  async findById(id: string): Promise<AppEvent | null> {
    return this.events.get(id) ?? null;
  }
}

export function CreateInMemoryEventRepository(): IEventRepository & { seed(events: AppEvent[]): void } {
  return new InMemoryEventRepository();
}
