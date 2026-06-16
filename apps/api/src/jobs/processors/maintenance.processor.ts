import { Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import {
  JobName,
  MaintenanceJobPayload,
  QueueName,
  defaultJobOptions
} from "../jobs.constants";

@Processor(QueueName.Maintenance)
export class MaintenanceProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.Maintenance)
    private readonly maintenanceQueue: Queue<MaintenanceJobPayload>
  ) {
    super();
  }

  async onModuleInit() {
    await this.maintenanceQueue.add(
      JobName.CleanupExpired,
      {},
      {
        ...defaultJobOptions,
        jobId: "maintenance-cleanup-expired",
        repeat: { pattern: "*/10 * * * *" }
      }
    );
  }

  async process(job: Job<MaintenanceJobPayload>) {
    if (job.name !== JobName.CleanupExpired) {
      this.logger.warn(`Unknown maintenance job: ${job.name}`);
      return;
    }

    const now = new Date();
    const [invites, refreshTokens] = await Promise.all([
      this.prisma.workspaceInvite.deleteMany({
        where: { acceptedAt: null, expiresAt: { lt: now } }
      }),
      this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: now },
          revokedAt: { not: null }
        }
      })
    ]);

    this.logger.log(
      `Cleaned ${invites.count} expired invites and ${refreshTokens.count} refresh tokens`
    );
  }
}

