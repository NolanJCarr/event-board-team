import { IEvent } from "./Event";

export interface IEventRepository {
  findById(eventId: string): IEvent | undefined;
  findByOrganizerId(organizerId: string): IEvent[];
}
