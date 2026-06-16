import { Module } from "@nestjs/common";
import { JobsModule } from "./jobs.module";
import { ActivityProcessor } from "./processors/activity.processor";
import { EmailProcessor } from "./processors/email.processor";
import { MaintenanceProcessor } from "./processors/maintenance.processor";
import { NotificationProcessor } from "./processors/notification.processor";

@Module({
  imports: [JobsModule],
  providers: [
    ActivityProcessor,
    EmailProcessor,
    MaintenanceProcessor,
    NotificationProcessor
  ]
})
export class JobsProcessorsModule {}

