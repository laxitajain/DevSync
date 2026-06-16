import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { resetDatabase } from "./utils/database";
import { bearer, registerUser, TestUser } from "./utils/auth";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Search (e2e)", () => {
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

  async function createWorkspace(owner: TestUser, name = "Search Co") {
    const res = await request(server())
      .post("/api/workspaces")
      .set(...bearer(owner.accessToken))
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  async function createProject(
    owner: TestUser,
    workspaceId: string,
    body: { name: string; key: string; description?: string }
  ) {
    const project = await request(server())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .send(body)
      .expect(201);

    const projects = await request(server())
      .get(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    const created = projects.body.find((p: { id: string }) => p.id === project.body.id);
    return { projectId: project.body.id as string, boardId: created.boards[0].id as string };
  }

  async function createTask(owner: TestUser, boardId: string, body: Record<string, unknown>) {
    const res = await request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(owner.accessToken))
      .send(body)
      .expect(201);
    return res.body.id as string;
  }

  function searchRequest(actor: TestUser, workspaceId: string, query: Record<string, string>) {
    return request(server())
      .get(`/api/workspaces/${workspaceId}/search`)
      .query(query)
      .set(...bearer(actor.accessToken));
  }

  it("finds matching tasks and excludes non-matching ones, scoped to the workspace", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProject(owner, workspaceId, {
      name: "Platform",
      key: "PLAT"
    });

    await createTask(owner, boardId, {
      title: "Implement OAuth login",
      description: "Support Google and GitHub providers"
    });
    await createTask(owner, boardId, { title: "Unrelated chore" });

    const res = await searchRequest(owner, workspaceId, { q: "oauth", type: "tasks" }).expect(200);

    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({ title: "Implement OAuth login" });
    expect(res.body.tasks[0].rank).toBeGreaterThan(0);
    expect(res.body.comments).toEqual([]);
    expect(res.body.projects).toEqual([]);
  });

  it("searches across tasks, comments, and projects with type=all", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProject(owner, workspaceId, {
      name: "Billing engine",
      key: "BILL",
      description: "Handles invoices"
    });

    const taskId = await createTask(owner, boardId, { title: "Invoice export" });
    await request(server())
      .post(`/api/tasks/${taskId}/comments`)
      .set(...bearer(owner.accessToken))
      .send({ body: "The invoice numbers are off by one" })
      .expect(201);

    const res = await searchRequest(owner, workspaceId, { q: "invoice" }).expect(200);

    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.comments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
    expect(res.body.comments[0]).toMatchObject({ taskId });
  });

  it("does not leak results across workspaces", async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const otherWorkspaceId = await createWorkspace(other, "Other Co");

    const { boardId } = await createProject(owner, workspaceId, {
      name: "Secret",
      key: "SEC"
    });
    await createTask(owner, boardId, { title: "Confidential roadmap" });

    const res = await searchRequest(other, otherWorkspaceId, { q: "confidential" }).expect(200);
    expect(res.body.tasks).toEqual([]);
  });

  it("returns 404 for a non-member searching a workspace", async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const workspaceId = await createWorkspace(owner);

    await searchRequest(outsider, workspaceId, { q: "anything" }).expect(404);
  });

  it("returns empty groups when nothing matches", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await createProject(owner, workspaceId, { name: "Platform", key: "PLAT" });

    const res = await searchRequest(owner, workspaceId, { q: "zzzznomatch" }).expect(200);
    expect(res.body).toMatchObject({ tasks: [], comments: [], projects: [] });
  });

  it("rejects an empty query with 400", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await searchRequest(owner, workspaceId, { q: "" }).expect(400);
  });
});
