import { Module } from "@nestjs/common";
import { AppModule } from "./app.module";
import { JobsProcessorsModule } from "./jobs/jobs-processors.module";

@Module({
  imports: [AppModule, JobsProcessorsModule]
})
export class WorkerModule {}

