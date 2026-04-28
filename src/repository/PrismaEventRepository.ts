import { Ok, Err, type Result} from "../lib/result";
import type { PrismaClient } from "@prisma/client";
import type {Event, EventError, GetEventsFilter, IEventRepository} from "./EventRepository";
import {InvalidInputError} from "./EventRepository";


export class PrismaEventRepository implements IEventRepository {
    constructor (private readonly prisma: PrismaClient){}

    async getEvents(filter: GetEventsFilter): Promise<Result<Event[], EventError>>{
        try{
          // The current date and time is found so only upcoming events are shown
            const now = new Date();
            //  The start and end of the date range are held to help the timeframe filter.
            let startRange: Date | undefined;
            let endRange: Date | undefined;

            if (filter.timeframe === "week"){
              // This shows events starting from now through the next 7 days (1 week)
                startRange = now;
                endRange = new Date(now);
                endRange.setDate(endRange.getDate() + 7);
            }

            else if (filter.timeframe === "weekend"){
              // This calculates how many days away the next saturday is 
                const day = now.getDay();
                const daysUntilSaturday = (6-day+7) % 7 || 7;
                // The start range is set to midnight on Saturday
                startRange = new Date(now)
                startRange.setDate(now.getDate() + daysUntilSaturday);
                startRange.setHours(0,0,0,0)
                // The end range is set to the last second of Sunday. 
                endRange = new Date(startRange);
                endRange.setDate(startRange.getDate() + 1)
                endRange.setHours(23,59,59,999)
            }
            // The events in the database that match the filters are queried here
            const events = await this.prisma.event.findMany({
                where: {
                  // Published events are only shown
                  status: "published",
                  startTime: {
                    // gte means on or after, so it only shows events that are happening now or have not happened yet. 
                    gte: startRange ?? now,
                    // lte means on or before so its only applied when a end date exists.
                    ...(endRange ? { lte: endRange } : {}),
                  },
                  // This filter is only applied if a category was selected
                  ...(filter.category ? { category: filter.category } : {}),
                  // If something is typed in the search filter, it looks for the word in the title, description, or location
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
                // Soonest events are shown first!
                orderBy: { startTime: "asc" },
              });
        
              return Ok(events);
            } catch (e) {
              // This prevents a crash, returning a name error is the query fails. 
              return Err(InvalidInputError("Failed to query events from the database."));
            }
          }
        
          async findById(eventId: string): Promise<Result<Event | null, EventError>> {
            try {
              // This allows an event to be searched by an id and will return null if not
              const event = await this.prisma.event.findUnique({
                where: { id: eventId },
              });
              return Ok(event);
            } catch (e) {
              // If the lookup fails, it will return this named error instead of crashing.
              return Err(InvalidInputError("Failed to find event in the database."));
            }
          }
        }
        
        export function CreatePrismaEventRepository(prisma: PrismaClient): IEventRepository {
          return new PrismaEventRepository(prisma);
        }