import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";

const PRESENCE_TTL_SECONDS = 120;

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async add(workspaceId: string, userId: string) {
    try {
      const key = this.key(workspaceId);
      await this.redis.hincrby(key, userId, 1);
      await this.redis.expire(key, PRESENCE_TTL_SECONDS);
    } catch (error) {
      this.log("add", error);
    }
  }

  async remove(workspaceId: string, userId: string) {
    try {
      const key = this.key(workspaceId);
      const next = await this.redis.hincrby(key, userId, -1);
      if (next <= 0) {
        await this.redis.hdel(key, userId);
      }
      await this.redis.expire(key, PRESENCE_TTL_SECONDS);
    } catch (error) {
      this.log("remove", error);
    }
  }

  async onlineUserIds(workspaceId: string) {
    try {
      return this.redis.hkeys(this.key(workspaceId));
    } catch (error) {
      this.log("online", error);
      return [];
    }
  }

  private key(workspaceId: string) {
    return `presence:ws:${workspaceId}`;
  }

  private log(action: string, error: unknown) {
    this.logger.warn(
      `Presence ${action} skipped: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

