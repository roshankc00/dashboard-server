import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIX: z.string().default("urlcheck"),
  BATCH_LIST_CACHE_TTL_SEC: z.coerce.number().int().positive().default(30),
  URL_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  MAX_URLS_PER_BATCH: z.coerce.number().int().positive().max(2000).default(500),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    console.error("Invalid environment variables:", issues);
    process.exit(1);
  }
  return parsed.data;
}
