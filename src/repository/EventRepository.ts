import { Ok, Err, type Result} from "../lib/result";
import type { PrismaClient } from "@prisma/client";

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

export type EventError =
| { name : "EventNotFoundError"; message: string}
| { name: "InvalidInputError"; message: string}
| { name: "UnauthorizedError"; message: string}
| {name: "InvalidStateError"; message: string}

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

export interface GetEventsFilter {
    category?: string;
    timeframe?: "all" | "week" | "weekend";
    searchQuery?: string;
}

export interface IEventRepository {
    getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>>;
}

class PrismaEventRepository implements IEventRepository{
    constructor (private readonly prisma: PrismaClient){}
    async getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>>{
        try{
            const now = new Date();

            let startRange: Date | undefined;
            let endRange: Date | undefined;

            if (filter.timeframe === "week"){
                startRange = now;
                endRange = new Date(now);
                endRange.setDate(endRange.getDate() + 7);
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

            const events = await this.prisma.event.findMany({
                where: {
                  status: "published",
                  startTime: {
                    gte: startRange ?? now,
                    ...(endRange ? { lte: endRange } : {}),
                  },
                  ...(filter.category ? { category: filter.category } : {}),
                  ...(filter.searchQuery
                    ? {
                        OR: [
                          { title: { contains: filter.searchQuery } },
                          { description: { contains: filter.searchQuery } },
                          { location: { contains: filter.searchQuery } },
                        ],
                      }
                    : {}),
                },
                orderBy: { startTime: "asc" },
              });
        
              return Ok(events);
            } catch (e) {
              return Err(InvalidInputError("Failed to query events."));
            }
          }
        }
        
        export function CreateEventRepository(prisma: PrismaClient): IEventRepository {
          return new PrismaEventRepository(prisma);
        }