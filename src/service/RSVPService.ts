export interface IRSVPService {
    newAttendance(person_id: string): "waitlisted" | "attending" | "full";
    removeAttendance(person_id: string): void;
    reactivateAttendance(person_id: string): void;
  }