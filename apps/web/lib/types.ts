export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt?: string | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  createdAt: string;
  user: AuthUser;
};

export type WorkspaceDetail = {
  id: string;
  name: string;
  slug: string;
  members: WorkspaceMember[];
};

export type ProjectBoardRef = {
  id: string;
  name: string;
  createdAt: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  boards: ProjectBoardRef[];
};

export type TaskAssignee = {
  userId: string;
  user: AuthUser;
};

export type Task = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  priority: TaskPriority;
  dueAt: string | null;
  createdAt: string;
  assignees: TaskAssignee[];
};

export type BoardColumn = {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
};

export type Board = {
  id: string;
  name: string;
  projectId: string;
  project: { id: string; name: string; key: string; workspaceId: string };
  columns: BoardColumn[];
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: AuthUser | null;
};

export type TaskDetail = Task & {
  column: { id: string; name: string; boardId: string };
  comments: Comment[];
};

export type NotificationPayload = {
  type: string;
  taskId: string;
  title: string;
  projectId: string;
};
