import { Router } from 'express';
import { asyncHandler } from '../../../common/utils';
import type { HealthController } from '../controllers/health.controller';

/**
 * Builds health routes. Mounted at /health and /api/v1/health.
 */
export function createHealthRouter(controller: HealthController): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      await controller.getHealth(req, res);
    }),
  );

  return router;
}
