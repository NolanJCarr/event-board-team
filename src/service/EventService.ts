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
    // If someone puts in a timeframe that is not allowed, then it throws an error
    if (!validTimeframes.includes(filter.timeframe)) {
      return Err(InvalidInputError("Invalid timeframe value."));
    }
    // If someone types a search query larger than 200 characters, then it throws an error. 
    if (filter.searchQuery !== undefined && filter.searchQuery.trim().length > 200) {
      return Err(InvalidInputError("Search query is too long."));
    }
    // If the filter looks good, it will be passed to the repository and returns whatever it finds
    return this.eventRepository.getEvents(filter);
  }
}

export function CreateEventService(eventRepository: IEventRepository): IEventService {
  return new EventService(eventRepository);
}