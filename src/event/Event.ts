export type EventStatus = "draft" | "published" | "cancelled" | "past";

export interface IEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  startTime: Date;
  endTime: Date;
  capacity?: number;
  status: EventStatus;
  organizerId: string;
}

export interface IEventWithCounts extends IEvent {
  attendeeCount: number; // count of RSVPs with status "going"
}
