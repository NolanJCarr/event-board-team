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
| { name : "EventNotFoundError"; message: string}
| { name: "InvalidInputError"; message: string}
| { name: "UnauthorizedError"; message: string}
| {name: "InvalidStateError"; message: string}
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

