import type { Request, Response } from 'express';
import { ApiResponse } from '../../../common/response';
import type { AppRequest } from '../../../common/types/api.types';
import type { HealthService } from '../health.service';
import { AppReadiness } from '../../../common/constants';

/**
 * Responsibility: HTTP adapter for health checks — thin controller, no business logic.
 */
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  /**
   * Handles GET /health (and /api/v1/health).
   */
  public async getHealth(req: Request, res: Response): Promise<void> {
    const report = await this.healthService.getHealth();
    const appReq = req as AppRequest;
    const statusCode = report.status === AppReadiness.HEALTHY ? 200 : 503;

    ApiResponse.success(res, report, {
      message: report.status === AppReadiness.HEALTHY ? 'Service healthy' : 'Service unhealthy',
      statusCode,
      requestId: appReq.requestId,
    });
  }
}
