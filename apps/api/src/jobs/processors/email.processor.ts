import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EmailJobPayload, QueueName } from "../jobs.constants";

@Processor(QueueName.Email)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<EmailJobPayload>) {
    // Real provider integration is intentionally later; this keeps the queue
    // boundary in place and makes local development observable.
    this.logger.log(
      `Email queued for ${job.data.to} using template ${job.data.template}`
    );
  }
}

