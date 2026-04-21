import type { Result} from "../lib/result";
// Below defines what an event object looks like. It matches exactly with the database schema. 
export interface Event{
    id: string;
    title: string;
    description: string;
    location: string;
    category: string;
    startTime: Date;
    endTime: Date;
    capacity?: number | null;
    status: string;
    organizerId: string;
    createdAt: Date;
}
// Below are the errors our app can return. Instead of our code crashing, it can return one of these named errors.
export type EventError =
| { name: "EventNotFoundError"; message: string }
| { name: "InvalidInputError"; message: string }
// The next 3 errors below were added during Spring 2. These erros make it so the app returns a clear error describing what went wrong.
// Although the category is a dropdown, the user could bypass this and type directly into the url. This is what this InvalidCategoryError is for.
| { name: "InvalidCategoryError"; message: string }
// Although the time frame is a dropdown, the user could bypass this and type directly into the url. This is what this InvalidTimeframeError is for.
| { name: "InvalidTimeframeError"; message: string }
// This is returned when the search query is too long or if it only contains whitespace.
| { name: "InvalidSearchError"; message: string }
| { name: "UnauthorizedError"; message: string }
| { name: "InvalidStateError"; message: string }
// Factory functions create objects for you instead of typing the whole object everytime.
export const EventNotFoundError = (message: string): EventError => ({
    name: "EventNotFoundError",
    message,
})

export const InvalidInputError = (message: string): EventError => ({
    name: "InvalidInputError",
    message,
})

export const UnauthorizedError = (message: string): EventError => ({
    name: "UnauthorizedError",
    message,
})

export const InvalidStateError = (message: string): EventError => ({
    name: "InvalidStateError",
    message,
})
// I added the next three errors in Sprint 2, as described above. 
export const InvalidCategoryError = (message: string): EventError => ({
    name: "InvalidCategoryError",
    message,
  })
  
  
  export const InvalidTimeframeError = (message: string): EventError => ({
    name: "InvalidTimeframeError",
    message,
  })
  
  export const InvalidSearchError = (message: string): EventError => ({
    name: "InvalidSearchError",
    message,
  })
  
// This describes the filters someone can pass while searing for an event. ? means that all three of these filters are optional.
export interface GetEventsFilter {
    category?: string;
    timeframe?: "all" | "week" | "weekend";
    searchQuery?: string;
}
// This says that any repository built must have a getEvents function.
export interface IEventRepository {
    getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>>;
}

