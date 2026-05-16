import Redis from "ioredis";


export function createBullRedis(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
  });
}

export function createCacheRedis(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 20,
  });
}
