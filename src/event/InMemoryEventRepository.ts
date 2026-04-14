import type { IEvent } from "./Event";
import type { IEventRepository } from "./EventRepository";

const DEMO_EVENTS: IEvent[] = [
  {
    id: "evt-001",
    title: "Community Garden Cleanup",
    description:
      "Join us for a morning of tidying up the downtown community garden. Gloves and tools provided.",
    location: "Downtown Community Garden, 45 Elm St",
    category: "volunteering",
    startTime: new Date("2026-05-10T09:00:00"),
    endTime: new Date("2026-05-10T12:00:00"),
    capacity: 30,
    status: "published",
    organizerId: "user-staff",
  },
  {
    id: "evt-002",
    title: "Local Art Walk",
    description:
      "Explore local galleries and street art with guided commentary from featured artists.",
    location: "Arts District, Main Street",
    category: "arts",
    startTime: new Date("2026-05-17T14:00:00"),
    endTime: new Date("2026-05-17T17:00:00"),
    status: "published",
    organizerId: "user-admin",
  },
  {
    id: "evt-003",
    title: "Neighbourhood Book Swap",
    description:
      "Bring books you have finished and take home something new. All genres welcome.",
    location: "Public Library, 12 Oak Ave",
    category: "community",
    startTime: new Date("2026-06-01T10:00:00"),
    endTime: new Date("2026-06-01T13:00:00"),
    capacity: 50,
    status: "draft",
    organizerId: "user-staff",
  },
  {
    id: "evt-004",
    title: "Evening Jazz in the Park",
    description:
      "A free outdoor jazz concert featuring local musicians. Bring a blanket and enjoy the evening.",
    location: "Riverside Park Bandshell",
    category: "music",
    startTime: new Date("2026-05-24T18:00:00"),
    endTime: new Date("2026-05-24T21:00:00"),
    capacity: 200,
    status: "published",
    organizerId: "user-admin",
  },
];

class InMemoryEventRepository implements IEventRepository {
  constructor(private readonly events: IEvent[]) {}

  findById(eventId: string): IEvent | undefined {
    return this.events.find((event) => event.id === eventId);
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository([...DEMO_EVENTS]);
}
