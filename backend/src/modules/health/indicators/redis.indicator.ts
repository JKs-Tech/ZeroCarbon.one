import type { RedisService } from '../../redis';
import { HealthStatus } from '../../../common/constants';
import type { IndicatorResult } from './mongo.indicator';

/**
 * Responsibility: Probe Redis readiness for the health module.
 */
export class RedisHealthIndicator {
  public constructor(private readonly redis: RedisService) {}

  /**
   * Pings Redis and reports up/down with latency.
   */
  public async check(): Promise<IndicatorResult> {
    const started = Date.now();
    const ok = await this.redis.ping();
    const latencyMs = Date.now() - started;

    if (!ok) {
      return {
        status: HealthStatus.DOWN,
        latencyMs,
        message: 'Redis ping failed',
      };
    }

    return {
      status: HealthStatus.UP,
      latencyMs,
    };
  }
}
