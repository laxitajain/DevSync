import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { ActivityJobPayload, QueueName } from "../jobs.constants";

@Processor(QueueName.Activity)
export class ActivityProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityProcessor.name);

  async process(job: Job<ActivityJobPayload>) {
    // The transactional activity log remains synchronous by design. This queue
    // is reserved for derived feed/fan-out work that can be retried safely.
    this.logger.log(
      `Processed derived activity job ${job.data.action} for workspace ${job.data.workspaceId}`
    );
  }
}

