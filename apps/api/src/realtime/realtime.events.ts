/**
 * Canonical Socket.IO event names and room key helpers. Kept in one place so
 * the gateway, the services that emit, and (mirrored on) the web client all
 * agree on the contract.
 */
export const RealtimeEvent = {
  TaskCreated: "task:created",
  TaskUpdated: "task:updated",
  TaskMoved: "task:moved",
  TaskDeleted: "task:deleted",
  CommentCreated: "comment:created",
  CommentTyping: "comment:typing",
  PresenceUpdated: "presence:updated",
  NotificationNew: "notification:new"
} as const;

export const workspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;
export const projectRoom = (projectId: string) => `project:${projectId}`;
export const userRoom = (userId: string) => `user:${userId}`;
