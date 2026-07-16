import { config as loadDotenv } from 'dotenv';
import { envSchema, type EnvVars } from './schemas/env.schema';

export interface AppConfig {
  env: EnvVars['NODE_ENV'];
  port: number;
  appName: string;
  appVersion: string;
  logLevel: EnvVars['LOG_LEVEL'];
  mongo: {
    uri: string;
    dbName: string;
  };
  redis: {
    host: string;
    port: number;
    password: string | undefined;
  };
  queue: {
    prefix: string;
    concurrency: number;
    maxAttempts: number;
    backoffMs: number;
    lockDurationMs: number;
    stalledIntervalMs: number;
    maxStalledCount: number;
  };
  security: {
    corsOrigin: string | string[];
    rateLimitWindowMs: number;
    rateLimitMax: number;
    bodyJsonLimit: string;
    bodyUrlencodedLimit: string;
    uploadMaxBytes: number;
    trustProxy: boolean;
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptSaltRounds: number;
    authRateLimitWindowMs: number;
    authRateLimitMax: number;
  };
  storage: {
    driver: 'local' | 's3';
    localPath: string;
    maxUploadBytes: number;
    maxFilesPerUpload: number;
  };
  ocr: {
    timeoutMs: number;
    language: string;
    minTextLength: number;
    qualityThreshold: number;
    tempDirectory: string;
    pdfRasterDpi: number;
    confidenceRetryThreshold: number;
    retryRasterDpi: number;
  };
  ai: {
    provider: EnvVars['AI_PROVIDER'];
    /** Unused for GPT-5 reasoning models (kept for non-reasoning providers / docs). */
    temperature: number;
    /** GPT-5 `reasoning.effort` for Responses API. */
    reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
    maxOutputTokens: number;
    maxRetries: number;
    visionEnabled: boolean;
    openai: {
      apiKey: string;
      model: string;
      timeoutMs: number;
      baseUrl: string | undefined;
    };
  };
  validation: {
    maxAllowedAmount: number;
    maxAllowedConsumption: number;
    maxAllowedQuantity: number;
    enableDuplicateCheck: boolean;
  };
  health: {
    mongoTimeoutMs: number;
    redisTimeoutMs: number;
  };
  shutdownTimeoutMs: number;
}

/**
 * Responsibility: Load, validate, and expose typed application configuration once.
 * The only module allowed to read process.env.
 */
export class ConfigService {
  private static instance: ConfigService | undefined;

  private readonly config: AppConfig;

  private constructor(env: EnvVars) {
    this.config = ConfigService.mapEnv(env);
  }

  /**
   * Loads dotenv (if present), validates environment, and returns the singleton.
   * Throws immediately when required variables are missing or invalid.
   */
  public static load(): ConfigService {
    if (ConfigService.instance) {
      return ConfigService.instance;
    }

    loadDotenv();

    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid environment configuration: ${details}`);
    }

    ConfigService.instance = new ConfigService(parsed.data);
    return ConfigService.instance;
  }

  /**
   * Returns the shared ConfigService instance.
   * Must call load() first during bootstrap.
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      throw new Error('ConfigService has not been loaded. Call ConfigService.load() first.');
    }

    return ConfigService.instance;
  }

  /**
   * Resets singleton — intended for tests only.
   */
  public static resetForTests(): void {
    ConfigService.instance = undefined;
  }

  /** Full immutable config snapshot. */
  public get all(): Readonly<AppConfig> {
    return this.config;
  }

  public get env(): AppConfig['env'] {
    return this.config.env;
  }

  public get port(): number {
    return this.config.port;
  }

  public get appName(): string {
    return this.config.appName;
  }

  public get appVersion(): string {
    return this.config.appVersion;
  }

  public get logLevel(): AppConfig['logLevel'] {
    return this.config.logLevel;
  }

  public get mongo(): AppConfig['mongo'] {
    return this.config.mongo;
  }

  public get redis(): AppConfig['redis'] {
    return this.config.redis;
  }

  public get queue(): AppConfig['queue'] {
    return this.config.queue;
  }

  public get security(): AppConfig['security'] {
    return this.config.security;
  }

  public get health(): AppConfig['health'] {
    return this.config.health;
  }

  public get storage(): AppConfig['storage'] {
    return this.config.storage;
  }

  public get ocr(): AppConfig['ocr'] {
    return this.config.ocr;
  }

  public get ai(): AppConfig['ai'] {
    return this.config.ai;
  }

  public get validation(): AppConfig['validation'] {
    return this.config.validation;
  }

  public get shutdownTimeoutMs(): number {
    return this.config.shutdownTimeoutMs;
  }

  public get isProduction(): boolean {
    return this.config.env === 'production';
  }

  private static mapEnv(env: EnvVars): AppConfig {
    const corsOrigin = env.CORS_ORIGIN.includes(',')
      ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
      : env.CORS_ORIGIN;

    return {
      env: env.NODE_ENV,
      port: env.PORT,
      appName: env.APP_NAME,
      appVersion: env.APP_VERSION,
      logLevel: env.LOG_LEVEL,
      mongo: {
        uri: env.MONGODB_URI,
        dbName: env.MONGODB_DB_NAME,
      },
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD ? env.REDIS_PASSWORD : undefined,
      },
      queue: {
        prefix: env.BULLMQ_PREFIX,
        concurrency: env.QUEUE_CONCURRENCY,
        maxAttempts: env.QUEUE_MAX_ATTEMPTS,
        backoffMs: env.QUEUE_BACKOFF_MS,
        lockDurationMs: env.QUEUE_LOCK_DURATION_MS,
        stalledIntervalMs: env.QUEUE_STALLED_INTERVAL_MS,
        maxStalledCount: env.QUEUE_MAX_STALLED_COUNT,
      },
      security: {
        corsOrigin,
        rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
        rateLimitMax: env.RATE_LIMIT_MAX,
        bodyJsonLimit: env.BODY_JSON_LIMIT,
        bodyUrlencodedLimit: env.BODY_URLENCODED_LIMIT,
        uploadMaxBytes: env.MAX_UPLOAD_SIZE ?? env.UPLOAD_MAX_BYTES,
        trustProxy: env.TRUST_PROXY,
        jwtSecret: env.JWT_SECRET,
        jwtExpiresIn: env.JWT_EXPIRES_IN,
        bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
        authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
        authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
      },
      storage: {
        driver: env.STORAGE_DRIVER,
        localPath: env.STORAGE_LOCAL_PATH,
        maxUploadBytes: env.MAX_UPLOAD_SIZE ?? env.UPLOAD_MAX_BYTES,
        maxFilesPerUpload: env.MAX_FILES_PER_UPLOAD,
      },
      ocr: {
        timeoutMs: env.OCR_TIMEOUT,
        language: env.OCR_LANGUAGE,
        minTextLength: env.OCR_PDF_TEXT_MIN_CHARS ?? env.OCR_MIN_TEXT_LENGTH,
        qualityThreshold: env.OCR_QUALITY_THRESHOLD,
        tempDirectory: env.TEMP_DIRECTORY,
        pdfRasterDpi: env.OCR_PDF_RASTER_DPI,
        confidenceRetryThreshold: env.OCR_CONFIDENCE_RETRY_THRESHOLD,
        retryRasterDpi: env.OCR_RETRY_RASTER_DPI,
      },
      ai: {
        provider: env.AI_PROVIDER,
        temperature: env.TEMPERATURE,
        reasoningEffort: env.OPENAI_REASONING_EFFORT,
        maxOutputTokens: env.MAX_OUTPUT_TOKENS,
        maxRetries: env.MAX_AI_RETRIES ?? env.AI_MAX_RETRIES ?? 2,
        visionEnabled: env.AI_VISION_ENABLED,
        openai: {
          apiKey: env.OPENAI_API_KEY,
          model: env.OPENAI_MODEL,
          timeoutMs: env.OPENAI_TIMEOUT ?? env.AI_TIMEOUT_MS ?? 120_000,
          baseUrl: env.OPENAI_BASE_URL ? env.OPENAI_BASE_URL : undefined,
        },
      },
      validation: {
        maxAllowedAmount: env.MAX_ALLOWED_AMOUNT,
        maxAllowedConsumption: env.MAX_ALLOWED_CONSUMPTION,
        maxAllowedQuantity: env.MAX_ALLOWED_QUANTITY,
        enableDuplicateCheck: env.ENABLE_DUPLICATE_CHECK,
      },
      health: {
        mongoTimeoutMs: env.HEALTH_MONGO_TIMEOUT_MS,
        redisTimeoutMs: env.HEALTH_REDIS_TIMEOUT_MS,
      },
      shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    };
  }
}
