import type Redis from "ioredis";
import type { Env } from "../config/env";
import { BATCH_LIST_CACHE_KEY } from "../shared/constants";
import type { Logger } from "../lib/logger";

export class BatchListCache {
  constructor(
    private readonly redis: Redis,
    private readonly env: Env,
    private readonly logger: Logger,
  ) {}

  async getCachedList(): Promise<string | null> {
    return this.redis.get(BATCH_LIST_CACHE_KEY);
  }

  async setCachedList(json: string): Promise<void> {
    await this.redis.setex(
      BATCH_LIST_CACHE_KEY,
      this.env.BATCH_LIST_CACHE_TTL_SEC,
      json,
    );
  }

  async invalidate(): Promise<void> {
    const n = await this.redis.del(BATCH_LIST_CACHE_KEY);
    this.logger.debug({ deletedKeys: n }, "batch list cache invalidated");
  }
}
