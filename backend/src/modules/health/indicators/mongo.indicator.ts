import type { DatabaseService } from '../../database';
import { HealthStatus, type HealthStatusValue } from '../../../common/constants';

export interface IndicatorResult {
  status: HealthStatusValue;
  latencyMs?: number;
  message?: string;
}

/**
 * Responsibility: Probe MongoDB readiness for the health module.
 */
export class MongoHealthIndicator {
  public constructor(private readonly database: DatabaseService) {}

  /**
   * Pings MongoDB and reports up/down with latency.
   */
  public async check(): Promise<IndicatorResult> {
    const started = Date.now();
    const ok = await this.database.ping();
    const latencyMs = Date.now() - started;

    if (!ok) {
      return {
        status: HealthStatus.DOWN,
        latencyMs,
        message: 'MongoDB ping failed',
      };
    }

    return {
      status: HealthStatus.UP,
      latencyMs,
    };
  }
}
