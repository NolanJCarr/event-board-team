import { IEvent, IEventWithCounts } from "./Event";
import { EventError, UnauthorizedError } from "./errors";
import { IEventRepository } from "./EventRepository";
import { IRSVPRepository } from "./RSVPRepository";
import { Result, Ok, Err } from "../lib/result";

export interface DashboardOutput {
  draft: IEventWithCounts[];
  published: IEventWithCounts[];
  pastOrCancelled: IEventWithCounts[];
}

export interface IDashboardService {
  getOrganizerEvents(input: {
    userId: string;
    role: string;
  }): Result<DashboardOutput, EventError>;
}

export function CreateDashboardService(
  eventRepo: IEventRepository,
  rsvpRepo: IRSVPRepository,
): IDashboardService {
  return {
    getOrganizerEvents({ userId, role }) {
      if (!userId) {
        return Err(UnauthorizedError("Authentication required to view dashboard."));
      }

      const events = eventRepo.findByOrganizerId(userId);

      const withCounts: IEventWithCounts[] = events.map((event) => {
        const rsvps = rsvpRepo.findByEventId(event.id);
        const attendeeCount = rsvps.filter((r) => r.status === "going").length;
        return { ...event, attendeeCount };
      });

      const draft = withCounts.filter((e) => e.status === "draft");
      const published = withCounts.filter((e) => e.status === "published");
      const pastOrCancelled = withCounts.filter(
        (e) => e.status === "cancelled" || e.status === "past",
      );

      return Ok({ draft, published, pastOrCancelled });
    },
  };
}
