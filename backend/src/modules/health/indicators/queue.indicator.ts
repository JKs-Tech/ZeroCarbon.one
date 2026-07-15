import type { QueueService } from '../../queue';
import { HealthStatus } from '../../../common/constants';
import type { IndicatorResult } from './mongo.indicator';

/**
 * Responsibility: Probe BullMQ DocumentProcessingQueue readiness for GET /health.
 */
export class QueueHealthIndicator {
  public constructor(private readonly queue: QueueService) {}

  /**
   * Reports queue connectivity, worker presence, and job counts.
   */
  public async check(): Promise<IndicatorResult & { details?: Record<string, unknown> }> {
    const started = Date.now();

    try {
      const snapshot = await this.queue.getHealthSnapshot();
      const latencyMs = Date.now() - started;

      if (!snapshot.connected || !snapshot.initialized) {
        return {
          status: HealthStatus.DOWN,
          latencyMs,
          message: 'Queue not connected',
          details: { ...snapshot },
        };
      }

      const workersOnline = snapshot.connectedWorkers > 0 || snapshot.registeredWorkers > 0;

      return {
        status: workersOnline ? HealthStatus.UP : HealthStatus.DEGRADED,
        latencyMs,
        message: workersOnline
          ? undefined
          : 'Queue connected but no workers are online — document processing will stall',
        details: {
          queueConnected: snapshot.connected,
          workerRunning: snapshot.workerRunning,
          connectedWorkers: snapshot.connectedWorkers,
          registeredWorkers: snapshot.registeredWorkers,
          queueName: snapshot.queueName,
          pendingJobs: snapshot.pendingJobs,
          activeJobs: snapshot.activeJobs,
          completedJobs: snapshot.completedJobs,
          failedJobs: snapshot.failedJobs,
          delayedJobs: snapshot.delayedJobs,
          prefix: snapshot.prefix,
        },
      };
    } catch (error) {
      return {
        status: HealthStatus.DOWN,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Queue health check failed',
      };
    }
  }
}
