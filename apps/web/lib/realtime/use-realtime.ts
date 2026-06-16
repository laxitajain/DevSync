"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query/hooks";
import type { NotificationPayload } from "../types";
import { useSocket } from "./socket-provider";

type PresencePayload = { workspaceId: string; onlineUserIds: string[] };
type TypingPayload = {
  taskId: string;
  userId: string;
  email: string;
  isTyping: boolean;
};

/** Joins a workspace room and tracks which member ids are currently online. */
export function useWorkspacePresence(workspaceId?: string) {
  const socket = useSocket();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!socket || !workspaceId) {
      return;
    }

    const join = () => socket.emit("workspace:join", { workspaceId });
    const onPresence = (payload: PresencePayload) => {
      if (payload.workspaceId === workspaceId) {
        setOnlineUserIds(payload.onlineUserIds);
      }
    };

    socket.on("connect", join);
    socket.on("presence:updated", onPresence);
    if (socket.connected) {
      join();
    }

    return () => {
      socket.emit("workspace:leave", { workspaceId });
      socket.off("connect", join);
      socket.off("presence:updated", onPresence);
    };
  }, [socket, workspaceId]);

  return onlineUserIds;
}

/**
 * Wires a board view to realtime: joins the project room (and workspace room for
 * presence), invalidates the cached board/task on any task or comment event, and
 * surfaces per-task typing indicators.
 */
export function useBoardRealtime(params: {
  boardId: string;
  projectId?: string;
  workspaceId?: string;
}) {
  const { boardId, projectId, workspaceId } = params;
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typing, setTyping] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!socket || !projectId) {
      return;
    }

    const join = () => {
      socket.emit("project:join", { projectId });
      if (workspaceId) {
        socket.emit("workspace:join", { workspaceId });
      }
    };

    const invalidateBoard = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.board(boardId) });

    const onComment = (payload: { taskId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(payload.taskId) });
      invalidateBoard();
    };

    const onPresence = (payload: PresencePayload) => {
      if (payload.workspaceId === workspaceId) {
        setOnlineUserIds(payload.onlineUserIds);
      }
    };

    const onTyping = (payload: TypingPayload) => {
      setTyping((current) => {
        const others = (current[payload.taskId] ?? []).filter(
          (email) => email !== payload.email
        );
        return {
          ...current,
          [payload.taskId]: payload.isTyping ? [...others, payload.email] : others
        };
      });
    };

    socket.on("connect", join);
    socket.on("task:created", invalidateBoard);
    socket.on("task:updated", invalidateBoard);
    socket.on("task:moved", invalidateBoard);
    socket.on("task:deleted", invalidateBoard);
    socket.on("comment:created", onComment);
    socket.on("presence:updated", onPresence);
    socket.on("comment:typing", onTyping);
    if (socket.connected) {
      join();
    }

    return () => {
      socket.emit("project:leave", { projectId });
      if (workspaceId) {
        socket.emit("workspace:leave", { workspaceId });
      }
      socket.off("connect", join);
      socket.off("task:created", invalidateBoard);
      socket.off("task:updated", invalidateBoard);
      socket.off("task:moved", invalidateBoard);
      socket.off("task:deleted", invalidateBoard);
      socket.off("comment:created", onComment);
      socket.off("presence:updated", onPresence);
      socket.off("comment:typing", onTyping);
    };
  }, [socket, boardId, projectId, workspaceId, queryClient]);

  return { onlineUserIds, typing };
}

/** Subscribes to the current user's personal notification channel. */
export function useNotifications() {
  const socket = useSocket();
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onNotification = (payload: NotificationPayload) => {
      setNotifications((current) => [payload, ...current].slice(0, 20));
    };
    socket.on("notification:new", onNotification);
    return () => {
      socket.off("notification:new", onNotification);
    };
  }, [socket]);

  return notifications;
}
