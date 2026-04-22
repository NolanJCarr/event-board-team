import { Event, IEventWithCounts } from "../events/Event";
import { EventError, UnauthorizedError } from "../events/errors";
import { IEventRepository } from "../events/EventRepository";
import { IRSVPRepository } from "../repository/RSVPRepository";
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
  }): Promise<Result<DashboardOutput, EventError>>;
}

export function CreateDashboardService(
  eventRepo: IEventRepository,
  rsvpRepo: IRSVPRepository,
): IDashboardService {
  return {
    async getOrganizerEvents({ userId, role }) {
      if (!userId) {
        return Err(UnauthorizedError("Authentication required to view dashboard."));
      }

      if (role !== "admin" && role !== "staff") {
        return Err(UnauthorizedError("Only organizers can view the dashboard."));
      }

      const events =
        role === "admin"
          ? await eventRepo.findAll()
          : await eventRepo.findByOrganizerId(userId);

      const withCounts: IEventWithCounts[] = await Promise.all(
        events.map(async (event) => {
          const countResult = await rsvpRepo.countAttendees(event.id);
          const attendeeCount = countResult.ok ? countResult.value : 0;
          return { ...event, attendeeCount };
        }),
      );

      const draft = withCounts.filter((e) => e.status === "draft");
      const published = withCounts.filter((e) => e.status === "published");
      const pastOrCancelled = withCounts.filter(
        (e) => e.status === "cancelled" || e.status === "past",
      );

      return Ok({ draft, published, pastOrCancelled });
    },
  };
}
