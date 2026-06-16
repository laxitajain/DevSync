import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import {
  RealtimeEvent,
  projectRoom,
  userRoom,
  workspaceRoom
} from "./realtime.events";
import { RealtimeService } from "./realtime.service";
import { PresenceService } from "./presence.service";

type SocketData = {
  userId: string;
  email: string;
  workspaces: Set<string>;
};

type AuthedSocket = Socket & { data: SocketData };

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true
  }
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly presence: PresenceService
  ) {}

  afterInit(server: Server) {
    this.realtime.setServer(server);
  }

  async handleConnection(client: AuthedSocket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization?.replace("Bearer ", "") || undefined);

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET", "devsync-access-secret")
      });

      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.workspaces = new Set();
      client.join(userRoom(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const workspaces = client.data?.workspaces;
    if (!workspaces) {
      return;
    }

    for (const workspaceId of workspaces) {
      await this.presence.remove(workspaceId, client.data.userId);
      await this.broadcastPresence(workspaceId);
    }
  }

  @SubscribeMessage("workspace:join")
  async joinWorkspace(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { workspaceId?: string }
  ) {
    const workspaceId = body?.workspaceId;
    if (!workspaceId || !(await this.isMember(client.data.userId, workspaceId))) {
      return { ok: false };
    }

    client.join(workspaceRoom(workspaceId));
    client.data.workspaces.add(workspaceId);
    await this.presence.add(workspaceId, client.data.userId);
    await this.broadcastPresence(workspaceId);
    return { ok: true };
  }

  @SubscribeMessage("workspace:leave")
  async leaveWorkspace(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { workspaceId?: string }
  ) {
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      return { ok: false };
    }

    client.leave(workspaceRoom(workspaceId));
    client.data.workspaces.delete(workspaceId);
    await this.presence.remove(workspaceId, client.data.userId);
    await this.broadcastPresence(workspaceId);
    return { ok: true };
  }

  @SubscribeMessage("project:join")
  async joinProject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { projectId?: string }
  ) {
    const projectId = body?.projectId;
    if (!projectId) {
      return { ok: false };
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true }
    });

    if (!project || !(await this.isMember(client.data.userId, project.workspaceId))) {
      return { ok: false };
    }

    client.join(projectRoom(projectId));
    return { ok: true };
  }

  @SubscribeMessage("project:leave")
  leaveProject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { projectId?: string }
  ) {
    if (body?.projectId) {
      client.leave(projectRoom(body.projectId));
    }
    return { ok: true };
  }

  @SubscribeMessage("comment:typing")
  typing(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { projectId?: string; taskId?: string; isTyping?: boolean }
  ) {
    if (!body?.projectId || !body?.taskId) {
      return { ok: false };
    }

    client.to(projectRoom(body.projectId)).emit(RealtimeEvent.CommentTyping, {
      taskId: body.taskId,
      userId: client.data.userId,
      email: client.data.email,
      isTyping: Boolean(body.isTyping)
    });
    return { ok: true };
  }

  private async isMember(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    return Boolean(membership);
  }

  private async broadcastPresence(workspaceId: string) {
    const onlineUserIds = await this.presence.onlineUserIds(workspaceId);
    this.server.to(workspaceRoom(workspaceId)).emit(RealtimeEvent.PresenceUpdated, {
      workspaceId,
      onlineUserIds
    });
  }
}
