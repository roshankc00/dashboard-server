/** Redis pub/sub channel: worker → API processes → Socket.io rooms */
export const WORKER_SOCKET_REDIS_CHANNEL = "urlcheck:socket:v1";

/** BullMQ queue name (prefix applied separately) */
export const URL_CHECK_QUEUE_NAME = "url-check";

/** Redis key for cached batch list JSON */
export const BATCH_LIST_CACHE_KEY = "urlcheck:batch:list:v1";
