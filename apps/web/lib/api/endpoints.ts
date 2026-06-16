import { apiRequest } from "./client";
import type {
  AuthResponse,
  Board,
  Comment,
  Project,
  Role,
  Task,
  TaskDetail,
  TaskPriority,
  Workspace,
  WorkspaceDetail,
  WorkspaceMember
} from "../types";

export const authApi = {
  register: (body: { email: string; password: string; name?: string }) =>
    apiRequest<AuthResponse>("/auth/register", { method: "POST", body, auth: false }),
  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>("/auth/login", { method: "POST", body, auth: false }),
  logout: (refreshToken: string) =>
    apiRequest<{ success: boolean }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
      auth: false
    })
};

export const workspacesApi = {
  list: () => apiRequest<Workspace[]>("/workspaces"),
  create: (body: { name: string }) =>
    apiRequest<Workspace>("/workspaces", { method: "POST", body }),
  get: (workspaceId: string) =>
    apiRequest<WorkspaceDetail>(`/workspaces/${workspaceId}`),
  invite: (workspaceId: string, body: { email: string; role: Role }) =>
    apiRequest<{ invite: unknown; token: string }>(`/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body
    }),
  acceptInvite: (token: string) =>
    apiRequest<WorkspaceMember>(`/workspaces/invites/${token}/accept`, { method: "POST" }),
  updateMemberRole: (workspaceId: string, memberId: string, role: Role) =>
    apiRequest<WorkspaceMember>(
      `/workspaces/${workspaceId}/members/${memberId}/role`,
      { method: "PATCH", body: { role } }
    ),
  removeMember: (workspaceId: string, memberId: string) =>
    apiRequest<{ success: boolean }>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: "DELETE"
    })
};

export const projectsApi = {
  listByWorkspace: (workspaceId: string) =>
    apiRequest<Project[]>(`/workspaces/${workspaceId}/projects`),
  create: (workspaceId: string, body: { name: string; key: string; description?: string }) =>
    apiRequest<Project>(`/workspaces/${workspaceId}/projects`, { method: "POST", body })
};

export const boardsApi = {
  get: (boardId: string) => apiRequest<Board>(`/boards/${boardId}`),
  createTask: (
    boardId: string,
    body: {
      title: string;
      description?: string;
      columnId?: string;
      priority?: TaskPriority;
      dueAt?: string;
      assigneeIds?: string[];
    }
  ) => apiRequest<Task>(`/boards/${boardId}/tasks`, { method: "POST", body })
};

export const tasksApi = {
  get: (taskId: string) => apiRequest<TaskDetail>(`/tasks/${taskId}`),
  update: (
    taskId: string,
    body: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      dueAt: string;
      columnId: string;
      position: number;
      assigneeIds: string[];
    }>
  ) => apiRequest<Task>(`/tasks/${taskId}`, { method: "PATCH", body }),
  remove: (taskId: string) =>
    apiRequest<{ success: boolean }>(`/tasks/${taskId}`, { method: "DELETE" }),
  addComment: (taskId: string, body: { body: string }) =>
    apiRequest<Comment>(`/tasks/${taskId}/comments`, { method: "POST", body })
};
