import { CreateAdminUserService } from "../../src/auth/AdminUserService";
import { CreateInMemoryUserRepository } from "../../src/repository/InMemoryUserRepository";
import { CreatePasswordHasher } from "../../src/auth/PasswordHasher";

describe("AdminUserService", () => {
  it("creates a new hashed user and lists it without exposing the password hash", async () => {
    const users = CreateInMemoryUserRepository();
    const service = CreateAdminUserService(users, CreatePasswordHasher());

    const created = await service.createUser({
      displayName: "Taylor Tester",
      email: "taylor@app.test",
      password: "password123",
      role: "staff",
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.email).toBe("taylor@app.test");
      expect(created.value.role).toBe("staff");
      expect("passwordHash" in created.value).toBe(false);
    }

    const listed = await service.listUsers();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.some((user) => user.email === "taylor@app.test")).toBe(true);
    }
  });

  it("prevents the current admin from deleting their own account", async () => {
    const users = CreateInMemoryUserRepository();
    const service = CreateAdminUserService(users, CreatePasswordHasher());

    const result = await service.deleteUser("user-admin", "user-admin");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.message).toBe("Admin users cannot remove their own account.");
    }
  });
});
