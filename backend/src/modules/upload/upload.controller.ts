import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/response';
import type { AppRequest } from '../../common/types/api.types';
import type { UploadService } from './upload.service';

/**
 * Responsibility: Thin HTTP adapter for document upload endpoints.
 */
export class UploadController {
  public constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/v1/documents/upload — single file (`file` field).
   */
  public async uploadSingle(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const document = await this.uploadService.uploadSingle(appReq.user!.id, req.file);

    ApiResponse.success(
      res,
      {
        document: {
          id: document.id,
          originalFileName: document.originalFileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          processingStatus: document.processingStatus,
          createdAt: document.createdAt,
        },
      },
      {
        message: 'File uploaded successfully',
        statusCode: 201,
        requestId: appReq.requestId,
      },
    );
  }

  /**
   * POST /api/v1/documents/uploads — multiple files (`files` field).
   */
  public async uploadMany(req: Request, res: Response): Promise<void> {
    const appReq = req as AppRequest;
    const files = req.files as Express.Multer.File[] | undefined;
    const documents = await this.uploadService.uploadMany(appReq.user!.id, files);

    ApiResponse.success(
      res,
      {
        documents: documents.map((document) => ({
          id: document.id,
          originalFileName: document.originalFileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          processingStatus: document.processingStatus,
          createdAt: document.createdAt,
        })),
      },
      {
        message: 'Files uploaded successfully',
        statusCode: 201,
        requestId: appReq.requestId,
      },
    );
  }
}
