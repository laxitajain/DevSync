import { INestApplication } from "@nestjs/common";
import request from "supertest";

export type TestUser = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string | null };
  email: string;
  password: string;
};

let counter = 0;

/**
 * Registers a fresh user through the real auth endpoint and returns their
 * tokens. Each call gets a unique email so multiple actors can coexist in a
 * single test.
 */
export async function registerUser(
  app: INestApplication,
  overrides: { email?: string; password?: string; name?: string } = {}
): Promise<TestUser> {
  counter += 1;
  const email = overrides.email ?? `user-${counter}-${Date.now()}@example.com`;
  const password = overrides.password ?? "correct-horse-battery";
  const name = overrides.name ?? `User ${counter}`;

  const res = await request(app.getHttpServer())
    .post("/api/auth/register")
    .send({ email, password, name })
    .expect(201);

  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    user: res.body.user,
    email,
    password
  };
}

export const bearer = (token: string): [string, string] => ["Authorization", `Bearer ${token}`];
