import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { NotificationJobPayload, QueueName } from "../jobs.constants";

@Processor(QueueName.Notifications)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<NotificationJobPayload>) {
    // Notification persistence/read-state arrives later. For M7, this processor
    // proves durable delivery can happen outside the request path.
    this.logger.log(
      `Notification ${job.data.type} delivered to ${job.data.userId} for task ${job.data.taskId}`
    );
  }
}

