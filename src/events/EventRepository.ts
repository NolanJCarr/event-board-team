export type { Event } from "./Event";
import type { Event } from "./Event";

export interface IEventRepository {
  create(event: Omit<Event, "id" | "createdAt" | "updatedAt">): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  findAll(): Promise<Event[]>;
  update(id: string, updates: Partial<Event>): Promise<Event | null>;
  findByOrganizerId(organizerId: string): Promise<Event[]>;
}
