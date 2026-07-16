import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/response';
import type { AppRequest } from '../../common/types/api.types';
import type { DocumentsService } from './documents.service';

/**
 * HTTP adapter for document list/detail (Architecture Appendix A).
 */
export class DocumentsController {
  public constructor(private readonly documentsService: DocumentsService) {}

  /**
   * GET /api/v1/documents
   */
  public async list(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const result = await this.documentsService.listDocuments(
      appReq.user!,
      req.query.page,
      req.query.limit,
      req.query.status,
    );

    ApiResponse.success(
      res,
      { documents: result.documents, counts: result.counts },
      {
        message: 'Documents retrieved',
        requestId: appReq.requestId,
        pagination: result.pagination,
      },
    );
  }

  /**
   * GET /api/v1/documents/:id/pages
   */
  public async listPages(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const documents = await this.documentsService.listPageDocuments(
      req.params.id,
      appReq.user!,
    );

    ApiResponse.success(res, { documents }, {
      message: 'Page documents retrieved',
      requestId: appReq.requestId,
    });
  }

  /**
   * GET /api/v1/documents/:id
   */
  public async getById(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const document = await this.documentsService.getDocument(req.params.id, appReq.user!);

    ApiResponse.success(res, { document }, {
      message: 'Document retrieved',
      requestId: appReq.requestId,
    });
  }

  /**
   * POST /api/v1/documents/:id/reprocess — retry FAILED documents.
   */
  public async reprocess(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const document = await this.documentsService.reprocessDocument(
      req.params.id,
      appReq.user!,
    );

    ApiResponse.success(res, { document }, {
      message: 'Document requeued for processing',
      requestId: appReq.requestId,
    });
  }
}
