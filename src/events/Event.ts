export type EventStatus = "draft" | "published" | "cancelled" | "past";

export type EventCategory = "social" | "educational" | "volunteer" | "sports" | "arts" | "technology" | "other";

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  startTime: Date;
  endTime: Date;
  capacity?: number;
  status: EventStatus;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  startTime: Date;
  endTime: Date;
  capacity?: number;
  organizerId: string;
}

export interface UpdateEventInput {
  eventId: string;
  updates: Partial<Omit<Event, "id" | "organizerId" | "createdAt" | "updatedAt">>;
  userId: string;
  role: string;
}

export interface IEventWithCounts extends Event {
  attendeeCount: number; // count of RSVPs with status "going"
}
