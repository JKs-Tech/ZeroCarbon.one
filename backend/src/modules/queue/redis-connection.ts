import type { ConnectionOptions } from 'bullmq';
import type { ConfigService } from '../config';

/**
 * Builds BullMQ-compatible Redis connection options from typed config.
 */
export function buildRedisConnection(config: ConfigService): ConnectionOptions {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
  };
}
