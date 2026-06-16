import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";
import { projectRoom, userRoom, workspaceRoom } from "./realtime.events";

/**
 * Thin indirection over the Socket.IO server so domain services (tasks,
 * comments, ...) can broadcast without depending on the gateway directly. The
 * gateway injects the live `Server` via `setServer` once it has initialized.
 *
 * Emits are best-effort: if no client has connected yet the server may be
 * unset, and broadcasting is simply skipped.
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToProject(projectId: string, event: string, payload: unknown) {
    this.server?.to(projectRoom(projectId)).emit(event, payload);
  }

  emitToWorkspace(workspaceId: string, event: string, payload: unknown) {
    this.server?.to(workspaceRoom(workspaceId)).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }
}
