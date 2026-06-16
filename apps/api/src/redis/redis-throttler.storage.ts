import type Redis from "ioredis";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const safeKey = this.sanitize(`${throttlerName}:${key}`);
    const hitsKey = `throttle:${safeKey}:hits`;
    const blockKey = `throttle:${safeKey}:block`;

    const isAlreadyBlocked = (await this.redis.exists(blockKey)) === 1;
    if (isAlreadyBlocked) {
      return {
        totalHits: limit + 1,
        timeToExpire: await this.pttlSeconds(hitsKey),
        isBlocked: true,
        timeToBlockExpire: await this.pttlSeconds(blockKey)
      };
    }

    const totalHits = await this.redis.incr(hitsKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitsKey, ttl);
    }

    const timeToExpire = await this.pttlSeconds(hitsKey);
    if (totalHits > limit) {
      await this.redis.set(blockKey, "1", "PX", blockDuration);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000)
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0
    };
  }

  private async pttlSeconds(key: string) {
    const ttl = await this.redis.pttl(key);
    return ttl > 0 ? Math.ceil(ttl / 1000) : 0;
  }

  private sanitize(value: string) {
    return Buffer.from(value).toString("base64url");
  }
}

