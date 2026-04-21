import { CreateAttendeeListService } from "../../src/service/AttendeeListService";
import {Ok} from "../../src/lib/result";

const mockEventRepo = {findById: jest.fn()};

const mockRSVPRepo = {listByEvent: jest.fn()};

const mockUserRepo = {findById: jest.fn()};

const service = CreateAttendeeListService(
    mockEventRepo as any,
    mockRSVPRepo as any,
    mockUserRepo as any
);

//Authorized Access

test("returns attendee list for organizer", async() => {
    mockEventRepo.findById.mockResolvedValue({
        id: "event1",
        organizerId: "user1",
    });
    mockRSVPRepo.listByEvent.mockResolvedValue(
        Ok([
            {userId:"u1", status: "going", createdAt: new Date("2024-03-05")}
        ])
    );
    mockUserRepo.findById.mockResolvedValue(
        Ok({id: "u1", displayName: "Alice"})
    );
    const result = await service.getAttendeeList("event1",{
        userId: "user1",
        role: "user",
    });
    expect(result.ok).toBe(true);
    if (result.ok === false){
        throw new Error("Expected success but got error");
    }
    expect(result.value.attending.length).toBe(1);
});

// Unauthorized Access
test("rejects non-organizer or non-admin", async() =>{
    mockEventRepo.findById.mockResolvedValue({
        id: "event1",
        organizerId:"owner",
    });
    const result = await service.getAttendeeList("event1",{
        userId: "randomUser",
        role: "user",
    });
    expect(result.ok).toBe(false);
    if (!result.ok){
        expect(result.value.name).toBe("AttendeeListForbiddenError");
    }
});

//Grouping
test("groups attendees by status", async() => {
    mockEventRepo.findById.mockResolvedValue({
        id: "event1",
        organizerId: "user1",
    });

    mockRSVPRepo.listByEvent.mockResolvedValue(
        Ok([
            { userId: "u1", status: "going", createdAt: new Date() },
            { userId: "u2", status: "waitlisted", createdAt: new Date() },
            { userId: "u3", status: "cancelled", createdAt: new Date() },
        ])
    );

    mockUserRepo.findById.mockImplementation(({id}) =>
        Ok({id, displayName: id})
    );

    const result = await service.getAttendeeList("event1",{
        userId: "user1",
        role: "user",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
        throw new Error("Expected success but got error");
    }

    expect(result.value.attending.length).toBe(1);
    expect(result.value.waitlisted.length).toBe(1);
    expect(result.value.cancelled.length).toBe(1);
});