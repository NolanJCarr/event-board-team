import { Ok, Err, type Result} from "../lib/result";
import type { PrismaClient } from "@prisma/client";
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

class PrismaEventRepository implements IEventRepository{
    constructor (private readonly prisma: PrismaClient){}
    async getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>>{
        try{
            //Current date and time
            const now = new Date();
            // Date boundaries are used for filtering
            let startRange: Date | undefined;
            let endRange: Date | undefined;
            // If the timeframe is week, events will be found in the next 7 days. 
            if (filter.timeframe === "week"){
                startRange = now;
                endRange = new Date(now);
                endRange.setDate(endRange.getDate() + 7);
            // If the timeframe is weekend, it finds Saturday and Sunday
            } else if (filter.timeframe === "weekend"){
                const day = now.getDay();
                const daysUntilSaturday = (6- day + 7) % 7 || 7;
                startRange = new Date(now);
                startRange.setDate(now.getDate() + daysUntilSaturday);
                startRange.setHours(0,0,0,0);
                endRange = new Date(startRange);
                endRange.setDate(startRange.getDate() + 1)
                endRange.setHours(23,59,59,999);
            }
            // published events are only shown, not drafts
            const events = await this.prisma.event.findMany({
                where: {
                  status: "published",
                  // The event must start right now or before the range end
                  startTime: {
                    gte: startRange ?? now,
                    ...(endRange ? { lte: endRange } : {}),
                  },
                  // If a category was passed, only show the events that are in that category.
                  ...(filter.category ? { category: filter.category } : {}),
                  ...(filter.searchQuery
                    ? {
                      // // If search was used, look for events with that word in the title, description or location
                        OR: [
                          { title: { contains: filter.searchQuery } },
                          { description: { contains: filter.searchQuery } },
                          { location: { contains: filter.searchQuery } },
                        ],
                      }
                    : {}),
                },
                // show the soonest events first
                orderBy: { startTime: "asc" },
              });
              // If it worked, the list of events can be returned
              return Ok(events);
              // If something went wrong, an error can be thrown.
            } catch (e) {
              return Err(InvalidInputError("Failed to query events."));
            }
          }
        }
        
        export function CreateEventRepository(prisma: PrismaClient): IEventRepository {
          return new PrismaEventRepository(prisma);
        }