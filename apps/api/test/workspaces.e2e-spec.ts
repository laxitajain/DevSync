import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { resetDatabase } from "./utils/database";
import { bearer, registerUser, TestUser } from "./utils/auth";
import { PrismaService } from "../src/prisma/prisma.service";

const WORKSPACES = "/api/workspaces";

describe("Workspaces + RBAC (e2e)", () => {
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

  const server = () => app.getHttpServer();

  const createWorkspace = (actor: TestUser, name = "Acme Inc") =>
    request(server()).post(WORKSPACES).set(...bearer(actor.accessToken)).send({ name });

  /** Creates a workspace owned by `owner` and returns its id. */
  const newWorkspace = async (owner: TestUser, name?: string) => {
    const res = await createWorkspace(owner, name).expect(201);
    return res.body.id as string;
  };

  /** Invites `email`, then accepts as `invitee`, returning their member id. */
  const addMember = async (
    workspaceId: string,
    inviter: TestUser,
    invitee: TestUser,
    role: "ADMIN" | "MEMBER" | "VIEWER"
  ) => {
    const invite = await request(server())
      .post(`${WORKSPACES}/${workspaceId}/invites`)
      .set(...bearer(inviter.accessToken))
      .send({ email: invitee.email, role })
      .expect(201);

    const accepted = await request(server())
      .post(`${WORKSPACES}/invites/${invite.body.token}/accept`)
      .set(...bearer(invitee.accessToken))
      .expect(200);

    return accepted.body.id as string;
  };

  describe("creation & listing", () => {
    it("creates a workspace with the caller as OWNER and a slug", async () => {
      const owner = await registerUser(app);
      const res = await createWorkspace(owner, "My Cool Team!").expect(201);

      expect(res.body).toMatchObject({ name: "My Cool Team!", role: "OWNER" });
      expect(res.body.slug).toBe("my-cool-team");
    });

    it("only lists workspaces the user belongs to", async () => {
      const alice = await registerUser(app);
      const bob = await registerUser(app);
      await createWorkspace(alice, "Alice Co").expect(201);

      const aliceList = await request(server())
        .get(WORKSPACES)
        .set(...bearer(alice.accessToken))
        .expect(200);
      expect(aliceList.body).toHaveLength(1);

      const bobList = await request(server())
        .get(WORKSPACES)
        .set(...bearer(bob.accessToken))
        .expect(200);
      expect(bobList.body).toHaveLength(0);
    });

    it("rejects unauthenticated creation with 401", async () => {
      await request(server()).post(WORKSPACES).send({ name: "Nope" }).expect(401);
    });

    it("rejects invalid names with 400", async () => {
      const owner = await registerUser(app);
      await createWorkspace(owner, "x").expect(400);
    });
  });

  describe("tenant isolation", () => {
    it("returns 404 (not 403) when a non-member reads a workspace", async () => {
      const owner = await registerUser(app);
      const outsider = await registerUser(app);
      const workspaceId = await newWorkspace(owner);

      await request(server())
        .get(`${WORKSPACES}/${workspaceId}`)
        .set(...bearer(outsider.accessToken))
        .expect(404);
    });

    it("lets a member read the workspace with its members", async () => {
      const owner = await registerUser(app);
      const workspaceId = await newWorkspace(owner);

      const res = await request(server())
        .get(`${WORKSPACES}/${workspaceId}`)
        .set(...bearer(owner.accessToken))
        .expect(200);

      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0]).toMatchObject({ role: "OWNER" });
    });
  });

  describe("invites", () => {
    it("lets an OWNER invite and the invitee accept", async () => {
      const owner = await registerUser(app);
      const invitee = await registerUser(app);
      const workspaceId = await newWorkspace(owner);

      const invite = await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(owner.accessToken))
        .send({ email: invitee.email, role: "MEMBER" })
        .expect(201);

      expect(invite.body.token).toEqual(expect.any(String));
      expect(invite.body.invite.tokenHash).toBeUndefined();

      await request(server())
        .post(`${WORKSPACES}/invites/${invite.body.token}/accept`)
        .set(...bearer(invitee.accessToken))
        .expect(200);

      const view = await request(server())
        .get(`${WORKSPACES}/${workspaceId}`)
        .set(...bearer(invitee.accessToken))
        .expect(200);
      expect(view.body.members).toHaveLength(2);
    });

    it("forbids a MEMBER from inviting (insufficient role)", async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const target = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      await addMember(workspaceId, owner, member, "MEMBER");

      await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(member.accessToken))
        .send({ email: target.email, role: "MEMBER" })
        .expect(403);
    });

    it("forbids an ADMIN from inviting another ADMIN (no lateral escalation)", async () => {
      const owner = await registerUser(app);
      const admin = await registerUser(app);
      const target = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      await addMember(workspaceId, owner, admin, "ADMIN");

      await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(admin.accessToken))
        .send({ email: target.email, role: "ADMIN" })
        .expect(403);

      // ...but the same ADMIN may invite a MEMBER.
      await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(admin.accessToken))
        .send({ email: target.email, role: "MEMBER" })
        .expect(201);
    });

    it("rejects inviting someone as OWNER with 400", async () => {
      const owner = await registerUser(app);
      const target = await registerUser(app);
      const workspaceId = await newWorkspace(owner);

      await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(owner.accessToken))
        .send({ email: target.email, role: "OWNER" })
        .expect(400);
    });

    it("rejects inviting an existing member with 409", async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      await addMember(workspaceId, owner, member, "MEMBER");

      await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(owner.accessToken))
        .send({ email: member.email, role: "MEMBER" })
        .expect(409);
    });

    it("rejects accepting an invite issued for a different email with 403", async () => {
      const owner = await registerUser(app);
      const invitee = await registerUser(app);
      const wrongUser = await registerUser(app);
      const workspaceId = await newWorkspace(owner);

      const invite = await request(server())
        .post(`${WORKSPACES}/${workspaceId}/invites`)
        .set(...bearer(owner.accessToken))
        .send({ email: invitee.email, role: "MEMBER" })
        .expect(201);

      await request(server())
        .post(`${WORKSPACES}/invites/${invite.body.token}/accept`)
        .set(...bearer(wrongUser.accessToken))
        .expect(403);
    });

    it("rejects an unknown invite token with 400", async () => {
      const user = await registerUser(app);
      await request(server())
        .post(`${WORKSPACES}/invites/${"a".repeat(96)}/accept`)
        .set(...bearer(user.accessToken))
        .expect(400);
    });
  });

  describe("changing member roles", () => {
    it("lets an OWNER promote a MEMBER to ADMIN", async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      const memberId = await addMember(workspaceId, owner, member, "MEMBER");

      const res = await request(server())
        .patch(`${WORKSPACES}/${workspaceId}/members/${memberId}/role`)
        .set(...bearer(owner.accessToken))
        .send({ role: "ADMIN" })
        .expect(200);

      expect(res.body.role).toBe("ADMIN");
    });

    it("forbids an ADMIN from changing another ADMIN's role", async () => {
      const owner = await registerUser(app);
      const admin1 = await registerUser(app);
      const admin2 = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      await addMember(workspaceId, owner, admin1, "ADMIN");
      const admin2Id = await addMember(workspaceId, owner, admin2, "ADMIN");

      await request(server())
        .patch(`${WORKSPACES}/${workspaceId}/members/${admin2Id}/role`)
        .set(...bearer(admin1.accessToken))
        .send({ role: "MEMBER" })
        .expect(403);
    });

    it("rejects setting a role to OWNER with 400", async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      const memberId = await addMember(workspaceId, owner, member, "MEMBER");

      await request(server())
        .patch(`${WORKSPACES}/${workspaceId}/members/${memberId}/role`)
        .set(...bearer(owner.accessToken))
        .send({ role: "OWNER" })
        .expect(400);
    });

    it("rejects changing your own role with 400", async () => {
      const owner = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      const ownerMember = await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId, userId: owner.user.id }
      });

      await request(server())
        .patch(`${WORKSPACES}/${workspaceId}/members/${ownerMember.id}/role`)
        .set(...bearer(owner.accessToken))
        .send({ role: "ADMIN" })
        .expect(400);
    });

    it("returns 404 for a member that is not in the workspace", async () => {
      const owner = await registerUser(app);
      const workspaceId = await newWorkspace(owner);

      await request(server())
        .patch(`${WORKSPACES}/${workspaceId}/members/${"nonexistent-id"}/role`)
        .set(...bearer(owner.accessToken))
        .send({ role: "MEMBER" })
        .expect(404);
    });
  });

  describe("removing members", () => {
    it("lets an OWNER remove a MEMBER", async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      const memberId = await addMember(workspaceId, owner, member, "MEMBER");

      await request(server())
        .delete(`${WORKSPACES}/${workspaceId}/members/${memberId}`)
        .set(...bearer(owner.accessToken))
        .expect(200);

      const view = await request(server())
        .get(`${WORKSPACES}/${workspaceId}`)
        .set(...bearer(owner.accessToken))
        .expect(200);
      expect(view.body.members).toHaveLength(1);
    });

    it("forbids an ADMIN from removing the OWNER", async () => {
      const owner = await registerUser(app);
      const admin = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      await addMember(workspaceId, owner, admin, "ADMIN");
      const ownerMember = await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId, userId: owner.user.id }
      });

      await request(server())
        .delete(`${WORKSPACES}/${workspaceId}/members/${ownerMember.id}`)
        .set(...bearer(admin.accessToken))
        .expect(403);
    });

    it("rejects removing yourself with 400", async () => {
      const owner = await registerUser(app);
      const workspaceId = await newWorkspace(owner);
      const ownerMember = await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId, userId: owner.user.id }
      });

      await request(server())
        .delete(`${WORKSPACES}/${workspaceId}/members/${ownerMember.id}`)
        .set(...bearer(owner.accessToken))
        .expect(400);
    });
  });
});
