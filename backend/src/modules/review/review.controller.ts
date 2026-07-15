import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/response';
import type { AppRequest } from '../../common/types/api.types';
import type { ReviewService } from './review.service';
import type { UpdateReviewDto } from './dto/update-review.dto';

/**
 * Thin HTTP adapter for Human Review & Approval endpoints.
 */
export class ReviewController {
  public constructor(private readonly reviewService: ReviewService) {}

  /**
   * GET /api/v1/documents/:id/review
   */
  public async getReview(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const payload = await this.reviewService.getReview(req.params.id, appReq.user!);

    ApiResponse.success(res, payload, {
      message: 'Review payload loaded',
      requestId: appReq.requestId,
    });
  }

  /**
   * PUT /api/v1/documents/:id/review
   */
  public async updateReview(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const payload = await this.reviewService.updateReview(
      req.params.id,
      appReq.user!,
      req.body as UpdateReviewDto,
    );

    ApiResponse.success(res, payload, {
      message: 'Extracted fields updated',
      requestId: appReq.requestId,
    });
  }

  /**
   * POST /api/v1/documents/:id/approve
   */
  public async approve(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const payload = await this.reviewService.approve(req.params.id, appReq.user!);

    ApiResponse.success(res, payload, {
      message: 'Document approved',
      requestId: appReq.requestId,
    });
  }
}
