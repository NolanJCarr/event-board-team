import { Ok, Err, type Result} from "../lib/result";
import type { PrismaClient } from "@prisma/client";
import type {Event, EventError, GetEventsFilter, IEventRepository} from "./EventRepository";
import {InvalidInputError} from "./EventRepository";


export class PrismaEventRepository implements IEventRepository {
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
            }

            else if (filter.timeframe === "weekend"){
                const day = now.getDay();
                const daysUntilSaturday = (6-day+7) % 7 || 7;
                startRange = new Date(now)
                startRange.setDate(now.getDate() + daysUntilSaturday);
                startRange.setHours(0,0,0,0)
                endRange = new Date(startRange);
                endRange.setDate(startRange.getDate() + 1)
                endRange.setHours(23,59,59,999)
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
              return Err(InvalidInputError("Failed to query events from the database."));
            }
          }
        
          async findById(eventId: string): Promise<Result<Event | null, EventError>> {
            try {
              const event = await this.prisma.event.findUnique({
                where: { id: eventId },
              });
              return Ok(event);
            } catch (e) {
              return Err(InvalidInputError("Failed to find event in the database."));
            }
          }
        }
        
        export function CreatePrismaEventRepository(prisma: PrismaClient): IEventRepository {
          return new PrismaEventRepository(prisma);
        }