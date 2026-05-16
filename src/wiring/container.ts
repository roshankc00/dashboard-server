import type { BatchService } from "../services/batchService";
import type Redis from "ioredis";

export const appContainer: {
  batchService?: BatchService;
  redisHealth?: Redis;
} = {};
