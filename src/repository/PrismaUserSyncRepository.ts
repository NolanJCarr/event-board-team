import type { PrismaClient } from "@prisma/client";
import type { IUserRepository } from "./UserRepository";
import type { IUserRecord } from "../auth/User";
import type { AuthError } from "../auth/errors";
import type { Result } from "../lib/result";

// Delegates all auth reads/writes to an inner repository, but also writes
// new users into the Prisma User table so the RSVP.userId FK constraint is satisfied.
export class PrismaUserSyncRepository implements IUserRepository {
  constructor(
    private readonly inner: IUserRepository,
    private readonly prisma: PrismaClient,
  ) {}

  findByEmail(email: string): Promise<Result<IUserRecord | null, AuthError>> {
    return this.inner.findByEmail(email);
  }

  findById(id: string): Promise<Result<IUserRecord | null, AuthError>> {
    return this.inner.findById(id);
  }

  listUsers(): Promise<Result<IUserRecord[], AuthError>> {
    return this.inner.listUsers();
  }

  async createUser(user: IUserRecord): Promise<Result<IUserRecord, AuthError>> {
    const result = await this.inner.createUser(user);
    if (result.ok) {
      await this.prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: { id: user.id, email: user.email, displayName: user.displayName },
      });
    }
    return result;
  }

  deleteUser(id: string): Promise<Result<boolean, AuthError>> {
    return this.inner.deleteUser(id);
  }
}
