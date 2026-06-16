import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { resetDatabase } from "./utils/database";
import { bearer, registerUser, TestUser } from "./utils/auth";
import { PrismaService } from "../src/prisma/prisma.service";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
  "hex"
);

describe("Files: attachments + avatars (e2e)", () => {
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

  async function createWorkspace(owner: TestUser) {
    const res = await request(server())
      .post("/api/workspaces")
      .set(...bearer(owner.accessToken))
      .send({ name: "Files Co" })
      .expect(201);
    return res.body.id as string;
  }

  async function createTask(owner: TestUser, workspaceId: string) {
    await request(server())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .send({ name: "Docs", key: "DOC" })
      .expect(201);

    const projects = await request(server())
      .get(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    const boardId = projects.body[0].boards[0].id as string;

    const task = await request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(owner.accessToken))
      .send({ title: "Has attachments" })
      .expect(201);

    return task.body.id as string;
  }

  async function addMember(
    owner: TestUser,
    workspaceId: string,
    invitee: TestUser,
    role: "ADMIN" | "MEMBER" | "VIEWER"
  ) {
    const invite = await request(server())
      .post(`/api/workspaces/${workspaceId}/invites`)
      .set(...bearer(owner.accessToken))
      .send({ email: invitee.email, role })
      .expect(201);

    await request(server())
      .post(`/api/workspaces/invites/${invite.body.token}/accept`)
      .set(...bearer(invitee.accessToken))
      .expect(200);
  }

  it("uploads, lists, and deletes a task attachment", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const taskId = await createTask(owner, workspaceId);

    const uploaded = await request(server())
      .post(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(owner.accessToken))
      .attach("file", PNG, { filename: "diagram.png", contentType: "image/png" })
      .expect(201);

    expect(uploaded.body).toMatchObject({
      filename: "diagram.png",
      contentType: "image/png",
      taskId
    });
    expect(uploaded.body.url).toEqual(expect.any(String));

    const list = await request(server())
      .get(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: uploaded.body.id });
    expect(list.body[0].url).toEqual(expect.any(String));

    await request(server())
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    const afterDelete = await request(server())
      .get(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(afterDelete.body).toHaveLength(0);
  });

  it("stores attachments outside the database (only a key reference is persisted)", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const taskId = await createTask(owner, workspaceId);

    const uploaded = await request(server())
      .post(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(owner.accessToken))
      .attach("file", PNG, { filename: "diagram.png", contentType: "image/png" })
      .expect(201);

    const row = await prisma.attachment.findUniqueOrThrow({
      where: { id: uploaded.body.id }
    });
    expect(row.key).toContain(`attachments/${taskId}/`);
    expect(Object.keys(row)).not.toContain("body");
  });

  it("rejects unsupported file types with 400", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const taskId = await createTask(owner, workspaceId);

    await request(server())
      .post(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(owner.accessToken))
      .attach("file", Buffer.from("malware"), {
        filename: "x.exe",
        contentType: "application/octet-stream"
      })
      .expect(400);
  });

  it("forbids a VIEWER from uploading but allows a MEMBER", async () => {
    const owner = await registerUser(app);
    const viewer = await registerUser(app);
    const member = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const taskId = await createTask(owner, workspaceId);
    await addMember(owner, workspaceId, viewer, "VIEWER");
    await addMember(owner, workspaceId, member, "MEMBER");

    await request(server())
      .post(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(viewer.accessToken))
      .attach("file", PNG, { filename: "v.png", contentType: "image/png" })
      .expect(403);

    await request(server())
      .post(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(member.accessToken))
      .attach("file", PNG, { filename: "m.png", contentType: "image/png" })
      .expect(201);
  });

  it("returns 404 when a non-member uploads to a task", async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const taskId = await createTask(owner, workspaceId);

    await request(server())
      .post(`/api/tasks/${taskId}/attachments`)
      .set(...bearer(outsider.accessToken))
      .attach("file", PNG, { filename: "o.png", contentType: "image/png" })
      .expect(404);
  });

  it("uploads and reads back a profile avatar", async () => {
    const owner = await registerUser(app);

    const empty = await request(server())
      .get("/api/users/me/avatar")
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(empty.body.url).toBeNull();

    const uploaded = await request(server())
      .post("/api/users/me/avatar")
      .set(...bearer(owner.accessToken))
      .attach("file", PNG, { filename: "me.png", contentType: "image/png" })
      .expect(200);
    expect(uploaded.body.url).toEqual(expect.any(String));

    const after = await request(server())
      .get("/api/users/me/avatar")
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(after.body.url).toEqual(expect.any(String));
  });

  it("rejects a non-image avatar with 400", async () => {
    const owner = await registerUser(app);

    await request(server())
      .post("/api/users/me/avatar")
      .set(...bearer(owner.accessToken))
      .attach("file", Buffer.from("%PDF-1.4"), {
        filename: "doc.pdf",
        contentType: "application/pdf"
      })
      .expect(400);
  });
});
