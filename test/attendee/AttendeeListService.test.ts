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
