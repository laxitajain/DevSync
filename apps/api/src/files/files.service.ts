import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Attachment } from "@devsync/db";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  async addAttachment(
    task: { id: string; projectId: string; project: { workspaceId: string } },
    userId: string,
    file: UploadedFile
  ) {
    const key = `attachments/${task.id}/${randomUUID()}-${this.safeName(file.originalname)}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          taskId: task.id,
          uploaderId: userId,
          key,
          filename: file.originalname,
          contentType: file.mimetype,
          size: file.size
        }
      });

      await tx.activityLog.create({
        data: {
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          actorId: userId,
          action: "attachment.added",
          metadata: { filename: file.originalname, size: file.size }
        }
      });

      return created;
    });

    return this.serialize(attachment);
  }

  async listAttachments(taskId: string) {
    const attachments = await this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      include: { uploader: { select: { id: true, email: true, name: true } } }
    });

    return Promise.all(
      attachments.map(async (attachment) => ({
        ...this.serializeMeta(attachment),
        uploader: attachment.uploader,
        url: await this.storage.getSignedUrl(attachment.key)
      }))
    );
  }

  async deleteAttachment(attachment: Attachment, workspaceId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id: attachment.id } });
      await tx.activityLog.create({
        data: {
          workspaceId,
          taskId: attachment.taskId,
          actorId: userId,
          action: "attachment.removed",
          metadata: { filename: attachment.filename }
        }
      });
    });

    // Best-effort object removal; the row is already gone either way.
    await this.storage.delete(attachment.key).catch(() => undefined);
    return { success: true };
  }

  async setAvatar(userId: string, file: UploadedFile) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true }
    });

    const key = `avatars/${userId}/${randomUUID()}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key }
    });

    if (existing?.avatarKey) {
      await this.storage.delete(existing.avatarKey).catch(() => undefined);
    }

    return { url: await this.storage.getSignedUrl(key) };
  }

  async getAvatarUrl(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true }
    });

    return { url: user?.avatarKey ? await this.storage.getSignedUrl(user.avatarKey) : null };
  }

  private async serialize(attachment: Attachment) {
    return {
      ...this.serializeMeta(attachment),
      url: await this.storage.getSignedUrl(attachment.key)
    };
  }

  private serializeMeta(attachment: Attachment) {
    return {
      id: attachment.id,
      taskId: attachment.taskId,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      createdAt: attachment.createdAt
    };
  }

  private safeName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  }
}
