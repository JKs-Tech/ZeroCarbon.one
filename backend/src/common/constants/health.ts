/**
 * Health component status values.
 */
export const HealthStatus = {
  UP: 'up',
  DOWN: 'down',
  DEGRADED: 'degraded',
} as const;

export type HealthStatusValue = (typeof HealthStatus)[keyof typeof HealthStatus];

/**
 * Overall application readiness.
 */
export const AppReadiness = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
} as const;

export type AppReadinessValue = (typeof AppReadiness)[keyof typeof AppReadiness];
