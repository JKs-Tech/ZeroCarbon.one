import { z } from 'zod';

/**
 * Zod schema for fail-fast environment validation at boot.
 * Architecture.md is the source of truth for variable names.
 * Phase 2 loads foundation-required vars; auth/AI/OCR vars arrive in later phases.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1).default('zerocarbon-backend'),
  APP_VERSION: z.string().min(1).default('1.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1).default('zerocarbon'),

  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  BULLMQ_PREFIX: z.string().min(1).default('zc'),
  /** Parallel jobs per worker. Keep low — OCR (Tesseract) is CPU-heavy and can starve lock renewals. */
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  QUEUE_BACKOFF_MS: z.coerce.number().int().nonnegative().default(2000),
  /**
   * BullMQ job lock duration (ms). Must cover OCR + multi-step AI comfortably.
   * @see https://docs.bullmq.io/guide/workers/stalled-jobs
   */
  QUEUE_LOCK_DURATION_MS: z.coerce.number().int().positive().default(900_000),
  /** How often BullMQ checks for expired locks (ms). */
  QUEUE_STALLED_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  /**
   * How many times a job may stall before permanent failure.
   * Default raised above BullMQ's 1 so worker restarts during long OCR/AI do not kill jobs.
   */
  QUEUE_MAX_STALLED_COUNT: z.coerce.number().int().positive().default(5),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20_000),

  BODY_JSON_LIMIT: z.string().min(1).default('1mb'),
  BODY_URLENCODED_LIMIT: z.string().min(1).default('1mb'),
  /** Phase 4 preferred name; falls back to UPLOAD_MAX_BYTES when unset. */
  MAX_UPLOAD_SIZE: z.coerce.number().int().positive().optional(),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10_485_760),
  MAX_FILES_PER_UPLOAD: z.coerce.number().int().positive().max(25).default(20),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().min(1).default('./uploads'),

  TRUST_PROXY: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((value) => value === 'true' || value === '1'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  HEALTH_MONGO_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  HEALTH_REDIS_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),

  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // --- OCR (Phase 6) ---
  OCR_TIMEOUT: z.coerce.number().int().positive().default(120_000),
  OCR_LANGUAGE: z.string().min(1).default('eng'),
  OCR_MIN_TEXT_LENGTH: z.coerce.number().int().nonnegative().default(80),
  /** Alias used in Architecture.md */
  OCR_PDF_TEXT_MIN_CHARS: z.coerce.number().int().nonnegative().optional(),
  OCR_QUALITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  TEMP_DIRECTORY: z.string().min(1).default('./tmp/ocr'),
  /** Default 200 DPI — clearer OCR for scanned utility bills than 150. */
  OCR_PDF_RASTER_DPI: z.coerce.number().int().positive().default(200),
  /** Re-rasterize / re-OCR when Tesseract avg confidence is below this (0–100). */
  OCR_CONFIDENCE_RETRY_THRESHOLD: z.coerce.number().min(0).max(100).default(55),
  /** DPI used for the confidence retry pass. */
  OCR_RETRY_RASTER_DPI: z.coerce.number().int().positive().default(300),

  // --- AI (Phase 7) ---
  AI_PROVIDER: z
    .enum(['openai', 'ollama', 'claude', 'gemini', 'mistral', 'llama', 'azure-openai'])
    .default('openai'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().min(1).default('gpt-5-nano'),
  OPENAI_BASE_URL: z.string().optional().default(''),
  /** Assignment name; Architecture alias AI_TIMEOUT_MS also accepted. */
  OPENAI_TIMEOUT: z.coerce.number().int().positive().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  /** Assignment name; Architecture alias AI_MAX_RETRIES also accepted. */
  MAX_AI_RETRIES: z.coerce.number().int().nonnegative().optional(),
  AI_MAX_RETRIES: z.coerce.number().int().nonnegative().optional(),
  /**
   * Sampling temperature for non-reasoning models only.
   * GPT-5 family (gpt-5-nano) does not support custom temperature — omit in API calls.
   */
  TEMPERATURE: z.coerce.number().min(0).max(2).default(1),
  /**
   * GPT-5 Responses API reasoning effort.
   * @see https://platform.openai.com/docs/guides/reasoning
   * low = better recall on dense/noisy OCR without full reasoning cost.
   */
  OPENAI_REASONING_EFFORT: z
    .enum(['minimal', 'low', 'medium', 'high'])
    .default('low'),
  /**
   * Responses API max_output_tokens. GPT-5 reasoning tokens count against this budget —
   * keep high enough for reasoning + full field JSON on large bills.
   */
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(8192),
  /**
   * When true, pass page images to OpenAI for extraction on scanned/image bills
   * (or when OCR confidence is low) so amounts and labels are recovered from pixels.
   */
  AI_VISION_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((value) => value === 'true' || value === '1'),

  // --- Validation (Phase 8) ---
  MAX_ALLOWED_AMOUNT: z.coerce.number().positive().default(10_000_000),
  MAX_ALLOWED_CONSUMPTION: z.coerce.number().positive().default(1_000_000),
  MAX_ALLOWED_QUANTITY: z.coerce.number().positive().default(1_000_000),
  ENABLE_DUPLICATE_CHECK: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((value) => value === 'true' || value === '1'),
}).superRefine((env, ctx) => {
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OPENAI_API_KEY'],
      message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
    });
  }
});

export type EnvVars = z.infer<typeof envSchema>;
