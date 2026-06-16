import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { JobsService } from "./jobs.service";
import { QueueName } from "./jobs.constants";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
          maxRetriesPerRequest: null
        }
      })
    }),
    BullModule.registerQueue(
      { name: QueueName.Email },
      { name: QueueName.Notifications },
      { name: QueueName.Activity },
      { name: QueueName.Maintenance }
    )
  ],
  providers: [JobsService],
  exports: [JobsService, BullModule]
})
export class JobsModule {}

