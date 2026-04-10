import { Ok, Err, type Result } from "../lib/result";
import {
  InvalidInputError,
  type EventError,
  type GetEventsFilter,
  type IEventRepository,
  type Event,
} from "../repository/EventRepository";

export interface IEventService {
  getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>>;
}

class EventService implements IEventService {
  constructor(private readonly eventRepository: IEventRepository) {}

  async getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>> {
    const validTimeframes = ["all", "week", "weekend", undefined];
    if (!validTimeframes.includes(filter.timeframe)) {
      return Err(InvalidInputError("Invalid timeframe value."));
    }

    if (filter.searchQuery !== undefined && filter.searchQuery.trim().length > 200) {
      return Err(InvalidInputError("Search query is too long."));
    }

    return this.eventRepository.getEvents(filter);
  }
}

export function CreateEventService(eventRepository: IEventRepository): IEventService {
  return new EventService(eventRepository);
}