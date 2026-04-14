import { IEvent } from "./Event";

export interface IEventRepository {
  findById(eventId: string): IEvent | undefined;
}
