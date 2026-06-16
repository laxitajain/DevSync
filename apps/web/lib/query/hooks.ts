"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  boardsApi,
  projectsApi,
  tasksApi,
  workspacesApi
} from "../api/endpoints";
import type { Role, TaskPriority } from "../types";

export const queryKeys = {
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  projects: (workspaceId: string) => ["projects", workspaceId] as const,
  board: (boardId: string) => ["board", boardId] as const,
  task: (taskId: string) => ["task", taskId] as const
};

export function useWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: workspacesApi.list });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId),
    enabled: Boolean(workspaceId)
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => workspacesApi.create({ name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces })
  });
}

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.projects(workspaceId),
    queryFn: () => projectsApi.listByWorkspace(workspaceId),
    enabled: Boolean(workspaceId)
  });
}

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key: string; description?: string }) =>
      projectsApi.create(workspaceId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects(workspaceId) })
  });
}

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: queryKeys.board(boardId),
    queryFn: () => boardsApi.get(boardId),
    enabled: Boolean(boardId)
  });
}

export function useCreateTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string;
      columnId?: string;
      priority?: TaskPriority;
      dueAt?: string;
      assigneeIds?: string[];
    }) => boardsApi.createTask(boardId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.board(boardId) })
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.task(taskId ?? "none"),
    queryFn: () => tasksApi.get(taskId as string),
    enabled: Boolean(taskId)
  });
}

export function useUpdateTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      body
    }: {
      taskId: string;
      body: Parameters<typeof tasksApi.update>[1];
    }) => tasksApi.update(taskId, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.board(boardId) });
      qc.invalidateQueries({ queryKey: queryKeys.task(variables.taskId) });
    }
  });
}

export function useDeleteTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.remove(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.board(boardId) })
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => tasksApi.addComment(taskId, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.task(taskId) })
  });
}

export function useInviteMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: Role }) =>
      workspacesApi.invite(workspaceId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) })
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Role }) =>
      workspacesApi.updateMemberRole(workspaceId, memberId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) })
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => workspacesApi.removeMember(workspaceId, memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) })
  });
}
