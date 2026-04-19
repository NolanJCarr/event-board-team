import { Ok, Err, type Result } from "../lib/result";
import {
  InvalidInputError,
  InvalidTimeframeError,
  InvalidSearchError,
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
      return Err(InvalidTimeframeError("Invalid timeframe value."));
    }
    // If someone types a search query larger than 200 characters, then it throws an error. 
    if (filter.searchQuery !== undefined && filter.searchQuery.trim().length > 200) {
      return Err(InvalidSearchError("Search query is too long."));
    }
    // If something is typed in the search bar, but it is empty after trimming, an error is thrown
    if (filter.searchQuery !== undefined && filter.searchQuery.length > 0 && filter.searchQuery.trim().length === 0) {
      return Err(InvalidSearchError("Search query cannot be empty whitespace."));
    }

    // If the filter looks good, it will be passed to the repository and returns whatever it finds
    return this.eventRepository.getEvents(filter);
  }
}

export function CreateEventService(eventRepository: IEventRepository): IEventService {
  return new EventService(eventRepository);
}