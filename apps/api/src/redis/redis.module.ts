import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisLifecycleService } from "./redis.service";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger("Redis");
        const client = new Redis(
          config.get<string>("REDIS_URL", "redis://localhost:6379"),
          {
            enableOfflineQueue: process.env.NODE_ENV !== "test",
            lazyConnect: process.env.NODE_ENV === "test",
            maxRetriesPerRequest: 2,
            retryStrategy: (times) => Math.min(times * 100, 2000)
          }
        );

        client.on("error", (error) => logger.error(error.message));
        return client;
      }
    },
    RedisLifecycleService
  ],
  exports: [REDIS_CLIENT]
})
export class RedisModule {}

