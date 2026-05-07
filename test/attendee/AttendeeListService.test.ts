import { CreateAttendeeListService } from "../../src/service/AttendeeListService";
import { CreateAttendeeListController } from "../../src/attendee/AttendeeListController";
import { CreateInMemoryRSVPRepository } from "../../src/repository/InMemoryRSVPRepository";
import {Ok} from "../../src/lib/result";
import express from "express";
import request from "supertest";

// ── In-memory repositories ───────────────────────────────────────────

class InMemoryEventRepo {
  constructor(private readonly event: any) {}

  async findById(id: string) {
    return this.event.id === id ? this.event : null;
  }
}

class InMemoryUserRepo {
  constructor(private readonly users: Record<string, any>) {}

  async findById(id: string) {
    const user = this.users[id];
    if (!user) {
      throw new Error("User not found");
    }
    return Ok(user);
  }
}

// ── Fake logger ─────────────────────────────────────────────────────

const logger = {
  info() {},
  warn() {},
  error() {},
};

// ── Helper app factory ──────────────────────────────────────────────

function createApp({
  event,
  rsvps,
  users,
}: {
  event: any;
  rsvps: any[];
  users: Record<string, any>;
}) {
    const app = express();
    const eventRepo = new InMemoryEventRepo(event);
    const userRepo = new InMemoryUserRepo(users);
    const rsvpRepo = CreateInMemoryRSVPRepository();   
    
    for (const rsvp of rsvps) {
      rsvpRepo.saveRSVP({
        ...rsvp,
        eventId: event.id,
      });
    }

  const service = CreateAttendeeListService(
    eventRepo as any,
    rsvpRepo as any,
    userRepo as any,
  );

  const controller = CreateAttendeeListController(
    service,
    logger as any,
  );

  app.get("/events/:eventId/attendees", async (req, res) => {
  const fakeStore = {
    app: {
      browserId: "browser-1",
      browserLabel: "Browser TEST",
      visitCount: 1,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      authenticatedUser: {
        userId: "user1",
        email: "user1@example.com",
        displayName: "Organizer",
        role: "user",
        signedInAt: new Date().toISOString(),
      },
    },
  };

  
  res.render = (view: string, data: any) => {
    res.status(200).send(JSON.stringify(data.attendees));
    return res;
  };

  await controller.getAttendeeList(req, res, fakeStore as any);
});

  return app;
}

// ── Tests ───────────────────────────────────────────────────────────

test("returns attendee list for organizer", async () => {
  const app = createApp({
    event: {
      id: "event1",
      organizerId: "user1",
    },
    rsvps: [
      {
        userId: "u1",
        status: "going",
        createdAt: new Date("2024-03-05"),
      },
    ],
    users: {
      u1: {
        id: "u1",
        displayName: "Alice",
      },
    },
  });

  const res = await request(app)
    .get("/events/event1/attendees");

  expect(res.status).toBe(200);
  expect(res.text).toContain("Alice");
});

test("rejects non-organizer", async () => {
  const eventRepo = new InMemoryEventRepo({
    id: "event1",
    organizerId: "owner",
  });

  const rsvpRepo = CreateInMemoryRSVPRepository();
  const userRepo = new InMemoryUserRepo({});

  const service = CreateAttendeeListService(
    eventRepo as any,
    rsvpRepo as any,
    userRepo as any,
  );

  const result = await service.getAttendeeList("event1", {
    userId: "randomUser",
    role: "user",
  });

  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(result.value.name).toBe("AttendeeListForbiddenError");
  }
});

test("groups attendees by status", async () => {
  const eventRepo = new InMemoryEventRepo({
    id: "event1",
    organizerId: "user1",
  });

  const userRepo = new InMemoryUserRepo({
    u1: { id: "u1", displayName: "u1" },
    u2: { id: "u2", displayName: "u2" },
    u3: { id: "u3", displayName: "u3" },
  });

  const rsvpRepo = CreateInMemoryRSVPRepository();
  
  await rsvpRepo.saveRSVP({
    id: "rsvp1",
    userId: "u1" ,
    eventId: "event1" ,
    status: "going" ,
    createdAt: new Date() ,
  });

  await rsvpRepo.saveRSVP({
    id: "rsvp2",
    userId: "u2" ,
    eventId: "event1" ,
    status: "waitlisted" ,
    createdAt: new Date() ,
  });

  await rsvpRepo.saveRSVP({
    id: "rsvp3",
    userId: "u3" ,
    eventId: "event1" ,
    status: "cancelled" ,
    createdAt: new Date() ,
  });

  const service = CreateAttendeeListService(
    eventRepo as any,
    rsvpRepo as any,
    userRepo as any,
  );

  const result = await service.getAttendeeList("event1", {
    userId: "user1",
    role: "user",
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected success");
  }

  expect(result.value.attending.length).toBe(1);
  expect(result.value.waitlisted.length).toBe(1);
  expect(result.value.cancelled.length).toBe(1);
});

test("sorts attendees by RSVP time ascending", async () => {
  const eventRepo = new InMemoryEventRepo({
    id: "event1",
    organizerId: "user1",
  });

const userRepo = new InMemoryUserRepo({
    u1: { id: "u1", displayName: "u1" },
    u2: { id: "u2", displayName: "u2" },
});

const rsvpRepo = CreateInMemoryRSVPRepository();

const older = new Date("2024-04-01T10:00:00.000Z");
const newer = new Date("2024-05-05T10:00:00.000Z");

await rsvpRepo.saveRSVP({
    id: "rsvp1",
    userId: "u1",
    eventId: "event1",
    status: "going",
    createdAt: newer,
});

await rsvpRepo.saveRSVP({
    id: "rsvp2",
    userId: "u2",
    eventId: "event1",
    status: "going",
    createdAt: older,
    });


  const service = CreateAttendeeListService(
    eventRepo as any,
    rsvpRepo as any,
    userRepo as any,
  );

  const result = await service.getAttendeeList("event1", {
    userId: "user1",
    role: "admin",
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected success");
  }

  expect(result.value.attending[0].userId).toBe("u2");
  expect(result.value.attending[1].userId).toBe("u1");
});