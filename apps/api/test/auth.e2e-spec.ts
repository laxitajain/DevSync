import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { resetDatabase } from "./utils/database";
import { PrismaService } from "../src/prisma/prisma.service";

const REGISTER = "/api/auth/register";
const LOGIN = "/api/auth/login";
const REFRESH = "/api/auth/refresh";
const LOGOUT = "/api/auth/logout";
const ME = "/api/auth/me";
const FORGOT = "/api/auth/forgot-password";
const VERIFY = "/api/auth/verify-email";

const validUser = {
  email: "ada@example.com",
  password: "correct-horse-battery",
  name: "Ada Lovelace"
};

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const register = (body: Record<string, unknown> = validUser) =>
    request(app.getHttpServer()).post(REGISTER).send(body);

  describe("POST /auth/register", () => {
    it("creates a user and returns tokens", async () => {
      const res = await register().expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: expect.any(String),
          email: validUser.email,
          name: validUser.name,
          emailVerifiedAt: null
        }
      });
      // Never leak the password hash to clients.
      expect(res.body.user.passwordHash).toBeUndefined();

      const stored = await prisma.user.findUnique({ where: { email: validUser.email } });
      expect(stored).not.toBeNull();
      expect(stored?.passwordHash).not.toEqual(validUser.password);
    });

    it("normalizes the email to lowercase", async () => {
      await register({ ...validUser, email: "ADA@Example.com" }).expect(201);
      const stored = await prisma.user.findUnique({ where: { email: validUser.email } });
      expect(stored).not.toBeNull();
    });

    it("rejects a duplicate email with 409", async () => {
      await register().expect(201);
      await register().expect(409);
    });

    it("rejects invalid payloads with 400", async () => {
      await register({ email: "not-an-email", password: "short" }).expect(400);
      await register({ email: validUser.email }).expect(400);
      await register({ ...validUser, unexpected: "field" }).expect(400);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it("returns 200 with tokens for valid credentials", async () => {
      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({ email: validUser.email, password: validUser.password })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
    });

    it("rejects a wrong password with 401", async () => {
      await request(app.getHttpServer())
        .post(LOGIN)
        .send({ email: validUser.email, password: "wrong-password" })
        .expect(401);
    });

    it("rejects an unknown email with 401", async () => {
      await request(app.getHttpServer())
        .post(LOGIN)
        .send({ email: "nobody@example.com", password: validUser.password })
        .expect(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns the current user with a valid access token", async () => {
      const { body } = await register().expect(201);

      const res = await request(app.getHttpServer())
        .get(ME)
        .set("Authorization", `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ email: validUser.email, name: validUser.name });
    });

    it("rejects requests with no token", async () => {
      await request(app.getHttpServer()).get(ME).expect(401);
    });

    it("rejects requests with a malformed token", async () => {
      await request(app.getHttpServer())
        .get(ME)
        .set("Authorization", "Bearer not-a-real-jwt")
        .expect(401);
    });
  });

  describe("POST /auth/refresh", () => {
    it("rotates the refresh token and invalidates the old one (reuse detection)", async () => {
      const { body } = await register().expect(201);
      const originalRefresh = body.refreshToken;

      const rotated = await request(app.getHttpServer())
        .post(REFRESH)
        .send({ refreshToken: originalRefresh })
        .expect(200);

      expect(rotated.body.refreshToken).toEqual(expect.any(String));
      expect(rotated.body.refreshToken).not.toEqual(originalRefresh);

      // The rotated token works.
      await request(app.getHttpServer())
        .post(REFRESH)
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(200);

      // The original (already-rotated) token is now rejected.
      await request(app.getHttpServer())
        .post(REFRESH)
        .send({ refreshToken: originalRefresh })
        .expect(401);
    });

    it("rejects an unknown (but well-formed) refresh token with 401", async () => {
      await request(app.getHttpServer())
        .post(REFRESH)
        .send({ refreshToken: "a".repeat(96) })
        .expect(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("revokes the refresh token so it can no longer be refreshed", async () => {
      const { body } = await register().expect(201);

      await request(app.getHttpServer())
        .post(LOGOUT)
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      await request(app.getHttpServer())
        .post(REFRESH)
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("returns a generic 200 for an unknown email (no account enumeration)", async () => {
      const res = await request(app.getHttpServer())
        .post(FORGOT)
        .send({ email: "ghost@example.com" })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("returns the same generic response for a real email", async () => {
      await register().expect(201);
      const res = await request(app.getHttpServer())
        .post(FORGOT)
        .send({ email: validUser.email })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /auth/verify-email", () => {
    it("rejects an unknown (but well-formed) verification token with 400", async () => {
      await request(app.getHttpServer())
        .post(VERIFY)
        .send({ token: "b".repeat(96) })
        .expect(400);
    });
  });
});
