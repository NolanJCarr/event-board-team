import { randomUUID } from "node:crypto";
import { Err, Ok, type Result } from "../lib/result";
import type { IPasswordHasher } from "./PasswordHasher";
import {
  ProtectedUserOperation,
  UnexpectedDependencyError,
  UserAlreadyExists,
  UserNotFound,
  ValidationError,
  type AuthError,
} from "./errors";
import { toUserSummary, type IUserSummary, type UserRole } from "./User";
import type { IUserRepository } from "../repository/UserRepository";

export interface CreateUserInput {
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
}

export interface IAdminUserService {
  listUsers(): Promise<Result<IUserSummary[], AuthError>>;
  createUser(input: CreateUserInput): Promise<Result<IUserSummary, AuthError>>;
  deleteUser(id: string, actingUserId: string): Promise<Result<void, AuthError>>;
}

class AdminUserService implements IAdminUserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async listUsers(): Promise<Result<IUserSummary[], AuthError>> {
    const result = await this.users.listUsers();
    if (result.ok === false) {
      return Err(UnexpectedDependencyError(result.value.message));
    }

    return Ok(result.value.map(toUserSummary));
  }

  async createUser(input: CreateUserInput): Promise<Result<IUserSummary, AuthError>> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const password = input.password;

    if (!displayName) {
      return Err(ValidationError("Display name is required."));
    }

    if (!email) {
      return Err(ValidationError("Email is required."));
    }

    if (!email.includes("@")) {
      return Err(ValidationError("Email must look like an email address."));
    }

    if (password.trim().length < 8) {
      return Err(ValidationError("Password must be at least 8 characters."));
    }

    const existingUser = await this.users.findByEmail(email);
    if (existingUser.ok === false) {
      return Err(UnexpectedDependencyError(existingUser.value.message));
    }

    if (existingUser.value) {
      return Err(UserAlreadyExists("A user with that email already exists."));
    }

    const createResult = await this.users.createUser({
      id: randomUUID(),
      email,
      displayName,
      role: input.role,
      passwordHash: this.passwordHasher.hash(password),
    });

    if (createResult.ok === false) {
      return Err(UnexpectedDependencyError(createResult.value.message));
    }

    return Ok(toUserSummary(createResult.value));
  }

  async deleteUser(id: string, actingUserId: string): Promise<Result<void, AuthError>> {
    if (!id.trim()) {
      return Err(ValidationError("User ID is required."));
    }

    if (id === actingUserId) {
      return Err(ProtectedUserOperation("Admin users cannot remove their own account."));
    }

    const existingUser = await this.users.findById(id);
    if (existingUser.ok === false) {
      return Err(UnexpectedDependencyError(existingUser.value.message));
    }

    if (!existingUser.value) {
      return Err(UserNotFound("User not found."));
    }

    const deleteResult = await this.users.deleteUser(id);
    if (deleteResult.ok === false) {
      return Err(UnexpectedDependencyError(deleteResult.value.message));
    }

    if (!deleteResult.value) {
      return Err(UserNotFound("User not found."));
    }

    return Ok(undefined);
  }
}

export function CreateAdminUserService(
  users: IUserRepository,
  passwordHasher: IPasswordHasher,
): IAdminUserService {
  return new AdminUserService(users, passwordHasher);
}
