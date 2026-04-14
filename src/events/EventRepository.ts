export type { AppEvent } from "./Event";
import type { AppEvent } from "./Event";

/**
 * Persistence contract for events.
 * Feature 7 (My RSVPs Dashboard) uses findById.
 * Features 1/2/3/5 (Haamed/Dylan) will extend this interface with create, update, etc.
 */
export interface IEventRepository {
  findById(id: string): Promise<AppEvent | null>;
}
