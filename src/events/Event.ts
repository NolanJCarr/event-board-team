export type EventStatus = "draft" | "published" | "cancelled" | "past";

export type EventCategory =
  | "social"
  | "educational"
  | "volunteer"
  | "sports"
  | "arts"
  | "tech"
  | "other";

export interface AppEvent {
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
