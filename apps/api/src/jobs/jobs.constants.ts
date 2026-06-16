import type { Prisma } from "@devsync/db";

export const QueueName = {
  Email: "email",
  Notifications: "notifications",
  Activity: "activity",
  Maintenance: "maintenance"
} as const;

export const JobName = {
  SendEmail: "send-email",
  DeliverNotification: "deliver",
  RecordActivity: "record",
  CleanupExpired: "cleanup-expired"
} as const;

export type EmailJobPayload = {
  to: string;
  template: "verify-email" | "reset-password" | "workspace-invite";
  data: Record<string, string>;
};

export type NotificationJobPayload = {
  userId: string;
  type: string;
  taskId: string;
  title: string;
  projectId: string;
};

export type ActivityJobPayload = {
  workspaceId: string;
  actorId: string;
  action: string;
  projectId?: string;
  taskId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type MaintenanceJobPayload = Record<string, never>;

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: 5000
} as const;

