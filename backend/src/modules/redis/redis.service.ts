import Redis from 'ioredis';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';

/**
 * Responsibility: Shared Redis singleton for BullMQ, rate limiting, and health.
 * Exposes a single connection with reconnect strategy and graceful shutdown.
 */
export class RedisService {
  private client: Redis | undefined;

  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Creates and connects the shared Redis client if not already present.
   */
  public async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const { host, port, password } = this.config.redis;

    this.client = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number): number | null => {
        const delay = Math.min(times * 200, 2000);
        this.logger.warn('Redis reconnecting', { attempt: times, delayMs: delay });
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.info('Redis connecting', { host, port });
    });

    this.client.on('ready', () => {
      this.logger.info('Redis ready');
    });

    this.client.on('error', (error: Error) => {
      this.logger.error('Redis error', { error: error.message });
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis reconnecting');
    });

    await this.client.connect();
  }

  /**
   * Returns the shared ioredis client. Connect must be called first.
   */
  public getClient(): Redis {
    if (!this.client) {
      throw new Error('RedisService is not connected. Call connect() first.');
    }

    return this.client;
  }

  /**
   * Gracefully quits the Redis connection.
   */
  public async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.quit();
    this.client = undefined;
    this.logger.info('Redis disconnected');
  }

  /**
   * Returns true when the client exists and status is ready.
   */
  public isReady(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * PING for health checks.
   */
  public async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.warn('Redis ping failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }
}
