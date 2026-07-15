import type { ConfigService } from '../config';
import { AppReadiness, HealthStatus } from '../../common/constants';
import { uptimeSeconds, nowIso } from '../../common/utils/date';
import { MongoHealthIndicator, type IndicatorResult } from './indicators/mongo.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { QueueHealthIndicator } from './indicators/queue.indicator';
import type { DatabaseService } from '../database';
import type { RedisService } from '../redis';
import type { QueueService } from '../queue';

export interface HealthReport {
  status: string;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
  application: {
    status: string;
    name: string;
  };
  mongo: IndicatorResult;
  redis: IndicatorResult;
  queue: IndicatorResult & { details?: Record<string, unknown> };
}

/**
 * Responsibility: Aggregate dependency health into a single report for GET /health.
 */
export class HealthService {
  private readonly mongoIndicator: MongoHealthIndicator;
  private readonly redisIndicator: RedisHealthIndicator;
  private readonly queueIndicator: QueueHealthIndicator;

  public constructor(
    private readonly config: ConfigService,
    database: DatabaseService,
    redis: RedisService,
    queue: QueueService,
  ) {
    this.mongoIndicator = new MongoHealthIndicator(database);
    this.redisIndicator = new RedisHealthIndicator(redis);
    this.queueIndicator = new QueueHealthIndicator(queue);
  }

  /**
   * Runs all indicators and computes overall readiness.
   */
  public async getHealth(): Promise<HealthReport> {
    const [mongo, redis, queue] = await Promise.all([
      this.mongoIndicator.check(),
      this.redisIndicator.check(),
      this.queueIndicator.check(),
    ]);

    const dependenciesUp =
      mongo.status === HealthStatus.UP &&
      redis.status === HealthStatus.UP &&
      (queue.status === HealthStatus.UP || queue.status === HealthStatus.DEGRADED);

    const status = dependenciesUp ? AppReadiness.HEALTHY : AppReadiness.UNHEALTHY;

    return {
      status,
      version: this.config.appVersion,
      environment: this.config.env,
      uptime: uptimeSeconds(),
      timestamp: nowIso(),
      application: {
        status: HealthStatus.UP,
        name: this.config.appName,
      },
      mongo,
      redis,
      queue,
    };
  }
}
