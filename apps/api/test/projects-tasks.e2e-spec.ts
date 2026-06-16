import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/test-app";
import { resetDatabase } from "./utils/database";
import { bearer, registerUser, TestUser } from "./utils/auth";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Projects, boards, and tasks (e2e)", () => {
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
    const workspace = await request(server())
      .post("/api/workspaces")
      .set(...bearer(owner.accessToken))
      .send({ name: "Acme Product" })
      .expect(201);

    return workspace.body.id as string;
  }

  async function createProjectWithBoard(owner: TestUser, workspaceId: string) {
    const project = await request(server())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .send({ name: "Engineering", key: "ENG" })
      .expect(201);

    const projects = await request(server())
      .get(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    return {
      projectId: project.body.id as string,
      boardId: projects.body[0].boards[0].id as string
    };
  }

  async function getBoard(actor: TestUser, boardId: string) {
    return request(server())
      .get(`/api/boards/${boardId}`)
      .set(...bearer(actor.accessToken))
      .expect(200);
  }

  async function createTask(actor: TestUser, boardId: string, body: Record<string, unknown>) {
    return request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(actor.accessToken))
      .send(body)
      .expect(201);
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

  it("serves cached workspace summary/dashboard data and invalidates after writes", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);

    const initialSummary = await request(server())
      .get(`/api/workspaces/${workspaceId}/summary`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(initialSummary.body).toMatchObject({
      projectCount: 0,
      memberCount: 1,
      openTaskCount: 0
    });

    const { boardId } = await createProjectWithBoard(owner, workspaceId);
    await createTask(owner, boardId, { title: "Cache freshness" });

    const freshSummary = await request(server())
      .get(`/api/workspaces/${workspaceId}/summary`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(freshSummary.body).toMatchObject({
      projectCount: 1,
      memberCount: 1,
      openTaskCount: 1
    });

    const dashboard = await request(server())
      .get(`/api/workspaces/${workspaceId}/dashboard`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(dashboard.body.tasksByPriority).toEqual(
      expect.arrayContaining([{ priority: "MEDIUM", count: 1 }])
    );
    expect(dashboard.body.tasksByColumn).toEqual(
      expect.arrayContaining([{ columnName: "To Do", count: 1, columnId: expect.any(String) }])
    );
    expect(dashboard.body.recentActivityCount).toBeGreaterThanOrEqual(2);
  });

  it("creates a project with a default board and ordered default columns", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProjectWithBoard(owner, workspaceId);

    const board = await request(server())
      .get(`/api/boards/${boardId}`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    expect(board.body.columns.map((column: { name: string }) => column.name)).toEqual([
      "To Do",
      "In Progress",
      "Done"
    ]);
    expect(board.body.columns.map((column: { position: number }) => column.position)).toEqual([
      1000,
      2000,
      3000
    ]);
  });

  it("creates tasks at the end of a column and can move a task to the top", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProjectWithBoard(owner, workspaceId);

    const first = await request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(owner.accessToken))
      .send({ title: "First task" })
      .expect(201);

    const second = await request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(owner.accessToken))
      .send({ title: "Second task" })
      .expect(201);

    expect(first.body.position).toBe(1000);
    expect(second.body.position).toBe(2000);

    await request(server())
      .patch(`/api/tasks/${second.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ position: 0 })
      .expect(200);

    const board = await request(server())
      .get(`/api/boards/${boardId}`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    const taskTitles = board.body.columns[0].tasks.map((task: { title: string }) => task.title);
    expect(taskTitles).toEqual(["Second task", "First task"]);
  });

  it("records task creation, moves, and comments in task activity", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProjectWithBoard(owner, workspaceId);

    const task = await request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(owner.accessToken))
      .send({ title: "Trace me" })
      .expect(201);

    await request(server())
      .patch(`/api/tasks/${task.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ title: "Trace me, updated" })
      .expect(200);

    await request(server())
      .post(`/api/tasks/${task.body.id}/comments`)
      .set(...bearer(owner.accessToken))
      .send({ body: "Looks good." })
      .expect(201);

    const activity = await request(server())
      .get(`/api/tasks/${task.body.id}/activity`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    expect(activity.body.items.map((entry: { action: string }) => entry.action)).toEqual([
      "comment.created",
      "task.updated",
      "task.created"
    ]);
    expect(activity.body.nextCursor).toBeNull();
  });

  it("enforces flat-route tenant isolation and role-based writes", async () => {
    const owner = await registerUser(app);
    const viewer = await registerUser(app);
    const outsider = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await addMember(owner, workspaceId, viewer, "VIEWER");
    const { boardId } = await createProjectWithBoard(owner, workspaceId);

    await request(server())
      .get(`/api/boards/${boardId}`)
      .set(...bearer(outsider.accessToken))
      .expect(404);

    await getBoard(viewer, boardId);

    await request(server())
      .post(`/api/boards/${boardId}/tasks`)
      .set(...bearer(viewer.accessToken))
      .send({ title: "Viewer cannot write" })
      .expect(403);
  });

  it("allows a MEMBER to create, update, comment on, and delete tasks", async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await addMember(owner, workspaceId, member, "MEMBER");
    const { boardId } = await createProjectWithBoard(owner, workspaceId);

    const task = await createTask(member, boardId, { title: "Member task" });

    const updated = await request(server())
      .patch(`/api/tasks/${task.body.id}`)
      .set(...bearer(member.accessToken))
      .send({ title: "Member task updated", priority: "HIGH" })
      .expect(200);

    expect(updated.body).toMatchObject({ title: "Member task updated", priority: "HIGH" });

    await request(server())
      .post(`/api/tasks/${task.body.id}/comments`)
      .set(...bearer(member.accessToken))
      .send({ body: "Done from member." })
      .expect(201);

    await request(server())
      .delete(`/api/tasks/${task.body.id}`)
      .set(...bearer(member.accessToken))
      .expect(200);
  });

  it("rejects duplicate project keys within the same workspace", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await createProjectWithBoard(owner, workspaceId);

    await request(server())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set(...bearer(owner.accessToken))
      .send({ name: "Engineering Two", key: "ENG" })
      .expect(409);
  });

  it("moves a task across columns and preserves ordered board output", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProjectWithBoard(owner, workspaceId);
    const board = await getBoard(owner, boardId);
    const [todo, inProgress] = board.body.columns;

    const task = await createTask(owner, boardId, { title: "Move me" });

    const moved = await request(server())
      .patch(`/api/tasks/${task.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ columnId: inProgress.id, position: 0 })
      .expect(200);

    expect(moved.body.columnId).toBe(inProgress.id);

    const nextBoard = await getBoard(owner, boardId);
    expect(nextBoard.body.columns.find((column: { id: string }) => column.id === todo.id).tasks).toEqual([]);
    expect(
      nextBoard.body.columns
        .find((column: { id: string }) => column.id === inProgress.id)
        .tasks.map((item: { title: string }) => item.title)
    ).toEqual(["Move me"]);
  });

  it("replaces assignees and rejects non-workspace assignees", async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const outsider = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await addMember(owner, workspaceId, member, "MEMBER");
    const { boardId } = await createProjectWithBoard(owner, workspaceId);

    const task = await createTask(owner, boardId, {
      title: "Assigned task",
      assigneeIds: [member.user.id]
    });

    expect(task.body.assignees.map((assignee: { userId: string }) => assignee.userId)).toEqual([
      member.user.id
    ]);

    await request(server())
      .patch(`/api/tasks/${task.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ assigneeIds: [outsider.user.id] })
      .expect(400);

    const unassigned = await request(server())
      .patch(`/api/tasks/${task.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ assigneeIds: [] })
      .expect(200);

    expect(unassigned.body.assignees).toHaveLength(0);
  });

  it("deletes tasks and cascades comments while keeping a deletion activity snapshot", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProjectWithBoard(owner, workspaceId);
    const task = await createTask(owner, boardId, { title: "Delete me" });

    await request(server())
      .post(`/api/tasks/${task.body.id}/comments`)
      .set(...bearer(owner.accessToken))
      .send({ body: "This should cascade." })
      .expect(201);

    await request(server())
      .delete(`/api/tasks/${task.body.id}`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    expect(await prisma.task.findUnique({ where: { id: task.body.id } })).toBeNull();
    expect(await prisma.taskComment.count({ where: { taskId: task.body.id } })).toBe(0);

    const deleted = await prisma.activityLog.findFirstOrThrow({
      where: { action: "task.deleted" }
    });
    expect(deleted.metadata).toMatchObject({ taskId: task.body.id, title: "Delete me" });
  });

  it("paginates task activity newest-first", async () => {
    const owner = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    const { boardId } = await createProjectWithBoard(owner, workspaceId);
    const task = await createTask(owner, boardId, { title: "Activity pages" });

    await request(server())
      .patch(`/api/tasks/${task.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ title: "Activity pages 1" })
      .expect(200);
    await request(server())
      .post(`/api/tasks/${task.body.id}/comments`)
      .set(...bearer(owner.accessToken))
      .send({ body: "first comment" })
      .expect(201);

    const firstPage = await request(server())
      .get(`/api/tasks/${task.body.id}/activity?limit=2`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(server())
      .get(`/api/tasks/${task.body.id}/activity?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set(...bearer(owner.accessToken))
      .expect(200);

    const actions = [...firstPage.body.items, ...secondPage.body.items].map(
      (entry: { action: string }) => entry.action
    );
    expect(actions).toEqual(["comment.created", "task.updated", "task.created"]);
  });

  it("paginates and filters project tasks without duplicates", async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const workspaceId = await createWorkspace(owner);
    await addMember(owner, workspaceId, member, "MEMBER");
    const { projectId, boardId } = await createProjectWithBoard(owner, workspaceId);
    const board = await getBoard(owner, boardId);
    const [todo, inProgress] = board.body.columns;

    await createTask(owner, boardId, {
      title: "Alpha urgent task",
      priority: "URGENT",
      dueAt: "2030-01-03T00:00:00.000Z",
      assigneeIds: [member.user.id]
    });
    await createTask(owner, boardId, {
      title: "Beta normal task",
      priority: "LOW",
      dueAt: "2030-01-01T00:00:00.000Z"
    });
    const gamma = await createTask(owner, boardId, {
      title: "Gamma urgent task",
      priority: "URGENT",
      dueAt: "2030-01-02T00:00:00.000Z"
    });

    await request(server())
      .patch(`/api/tasks/${gamma.body.id}`)
      .set(...bearer(owner.accessToken))
      .send({ columnId: inProgress.id, position: 0 })
      .expect(200);

    const firstPage = await request(server())
      .get(`/api/projects/${projectId}/tasks?limit=2`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    const secondPage = await request(server())
      .get(`/api/projects/${projectId}/tasks?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    const ids = [...firstPage.body.items, ...secondPage.body.items].map(
      (task: { id: string }) => task.id
    );
    expect(new Set(ids).size).toBe(3);

    const urgent = await request(server())
      .get(`/api/projects/${projectId}/tasks?priority=URGENT`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(urgent.body.items.map((task: { title: string }) => task.title).sort()).toEqual([
      "Alpha urgent task",
      "Gamma urgent task"
    ]);

    const byColumn = await request(server())
      .get(`/api/projects/${projectId}/tasks?columnId=${todo.id}`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(byColumn.body.items.map((task: { title: string }) => task.title).sort()).toEqual([
      "Alpha urgent task",
      "Beta normal task"
    ]);

    const assigned = await request(server())
      .get(`/api/projects/${projectId}/tasks?assigneeId=${member.user.id}`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(assigned.body.items.map((task: { title: string }) => task.title)).toEqual([
      "Alpha urgent task"
    ]);

    const searched = await request(server())
      .get(`/api/projects/${projectId}/tasks?q=gamma`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(searched.body.items.map((task: { title: string }) => task.title)).toEqual([
      "Gamma urgent task"
    ]);

    const byDueDate = await request(server())
      .get(`/api/projects/${projectId}/tasks?sort=dueAt`)
      .set(...bearer(owner.accessToken))
      .expect(200);
    expect(byDueDate.body.items.map((task: { title: string }) => task.title)).toEqual([
      "Beta normal task",
      "Gamma urgent task",
      "Alpha urgent task"
    ]);
  });
});
