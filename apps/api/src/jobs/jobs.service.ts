import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { JobsOptions, Queue } from "bullmq";
import {
  defaultJobOptions,
  EmailJobPayload,
  JobName,
  NotificationJobPayload,
  QueueName
} from "./jobs.constants";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly disabled = process.env.NODE_ENV === "test";

  constructor(
    @InjectQueue(QueueName.Email) private readonly emailQueue: Queue<EmailJobPayload>,
    @InjectQueue(QueueName.Notifications)
    private readonly notificationsQueue: Queue<NotificationJobPayload>
  ) {}

  async enqueueEmail(payload: EmailJobPayload) {
    await this.addBestEffort(
      this.emailQueue,
      JobName.SendEmail,
      payload,
      this.jobId(["email", payload.template, payload.to, JSON.stringify(payload.data)])
    );
  }

  async enqueueNotification(payload: NotificationJobPayload) {
    await this.addBestEffort(
      this.notificationsQueue,
      JobName.DeliverNotification,
      payload,
      this.jobId(["notification", payload.userId, payload.type, payload.taskId])
    );
  }

  private async addBestEffort<T>(
    queue: Queue<T>,
    jobName: string,
    payload: T,
    jobId: string
  ) {
    if (this.disabled) {
      this.logger.debug(`Skipping queue job in test: ${jobName}`);
      return;
    }

    try {
      await (queue as Queue<unknown>).add(jobName, payload, {
        ...defaultJobOptions,
        jobId
      } satisfies JobsOptions);
    } catch (error) {
      this.logger.warn(
        `Queue job ${jobName} was not enqueued: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  private jobId(parts: string[]) {
    return Buffer.from(parts.join("|")).toString("base64url");
  }
}

