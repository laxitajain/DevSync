import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

@Injectable()
export class RedisLifecycleService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLifecycleService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : "Failed to close Redis connection"
      );
      this.redis.disconnect();
    }
  }
}

