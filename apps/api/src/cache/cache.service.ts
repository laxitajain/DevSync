import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logMiss(key, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      this.logMiss(key, error);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logMiss(keys.join(","), error);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          `${prefix}*`,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length) {
          await this.redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      this.logMiss(prefix, error);
    }
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) {
      return hit;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  private logMiss(key: string, error: unknown) {
    this.logger.warn(
      `Cache operation skipped for ${key}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

