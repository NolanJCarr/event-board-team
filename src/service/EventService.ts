import { Ok, Err, type Result } from "../lib/result";
import {
  InvalidInputError,
  // The two errros belo were added in Sprint 2, replacing the generic InvalidInputError
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
    // In Sprint 2, InvalidInputError was changed to InvalidTimeframeError below. The message was changed to be more descriptive. 
    // This error can be thrown when a user types an invalid timeframe directly in the URL instead of using the dropdown. 
    if (!validTimeframes.includes(filter.timeframe)) {
      return Err(InvalidTimeframeError("Invalid timeframe value. Must be all, week, or weekend."));
    }
    // If someone types a search query larger than 200 characters, then it throws an error. 
    // In Sprint 2, InvalidInputError was changed to InvalidSearchError below. 
    if (filter.searchQuery !== undefined && filter.searchQuery.trim().length > 200) {
      return Err(InvalidSearchError("Search query is too long. Must be under 200 characters."));
    }
    // This checks for whitespace
    // If something is typed in the search bar, but it is empty after trimming, an error is thrown
    // Conditions include if the searchQuery exists, the length is greater than 0, but after removing spaces it is empty.   
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