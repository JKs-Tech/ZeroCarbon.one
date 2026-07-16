import path from 'path';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import type { StorageService } from '../storage';
import type { DocumentsRepository } from '../documents';
import { DocumentProcessingStatus } from '../documents';
import type { QueueService } from '../queue';
import { AllowedUploadExtension, AllowedUploadMime } from '../../common/constants';
import { ImageConverterService } from '../ocr/image-converter.service';

export interface SplitUploadResult {
  parentUploadId: string;
  created: number;
  failed: number;
  childDocumentIds: string[];
}

/**
 * Splits a multi-page PDF parent upload into independent page documents.
 * Each page is stored as PNG and enqueued for the standard OCR → AI pipeline.
 */
export class PdfSplitService {
  private readonly imageConverter: ImageConverterService;

  public constructor(
    private readonly storageService: StorageService,
    private readonly documentsRepository: DocumentsRepository,
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
    config: ConfigService,
  ) {
    this.imageConverter = new ImageConverterService(config, logger.child('PdfSplit'));
  }

  /**
   * Reads parent PDF, rasterizes pages, creates child documents, enqueues processing jobs.
   */
  public async splitAndEnqueue(parentUploadId: string): Promise<SplitUploadResult> {
    const startedAt = Date.now();
    const parent = await this.documentsRepository.findById(parentUploadId);

    if (!parent) {
      throw new Error(`Parent upload not found: ${parentUploadId}`);
    }

    if (!parent.isUploadContainer) {
      throw new Error(`Document is not an upload container: ${parentUploadId}`);
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.storageService.read(parent.storagePath);
    } catch (error) {
      throw new Error(
        `Unable to read parent PDF: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    let workDir = '';
    let imagePaths: string[] = [];

    try {
      const converted = await this.imageConverter.convertPdfToImages(pdfBuffer);
      workDir = converted.workDir;
      imagePaths = converted.imagePaths;
    } catch (error) {
      throw new Error(
        `PDF split failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    const totalPages = imagePaths.length;
    const baseName = path.basename(parent.originalFileName, path.extname(parent.originalFileName));
    const userId = parent.userId.toString();
    const uploadedAt = parent.uploadTimestamp.toISOString();

    const prepared: Array<{
      documentId: string;
      pageNumber: number;
    }> = [];
    let failed = 0;

    try {
      for (let index = 0; index < imagePaths.length; index += 1) {
        const pageNumber = index + 1;
        const imagePath = imagePaths[index];

        try {
          const imageBuffer = await this.imageConverter.readImage(imagePath);
          const stored = await this.storageService.store({
            buffer: imageBuffer,
            mimeType: AllowedUploadMime.PNG,
            extension: AllowedUploadExtension.PNG,
          });

          const record = await this.documentsRepository.create({
            userId,
            originalFileName: `${baseName} — Page ${pageNumber}`,
            storedFileName: stored.storedFileName,
            storagePath: stored.storagePath,
            mimeType: AllowedUploadMime.PNG,
            fileSize: stored.size,
            processingStatus: DocumentProcessingStatus.UPLOADED,
            parentUploadId,
            pageNumber,
            totalPages,
            isUploadContainer: false,
          });

          prepared.push({
            documentId: record._id.toString(),
            pageNumber,
          });
        } catch (error) {
          failed += 1;
          this.logger.warn('Page split failed — continuing with remaining pages', {
            parentUploadId,
            pageNumber,
            error: error instanceof Error ? error.message : 'unknown',
          });

          try {
            const failedRecord = await this.documentsRepository.create({
              userId,
              originalFileName: `${baseName} — Page ${pageNumber}`,
              storedFileName: `failed-page-${pageNumber}`,
              storagePath: parent.storagePath,
              mimeType: AllowedUploadMime.PNG,
              fileSize: 1,
              processingStatus: DocumentProcessingStatus.FAILED,
              parentUploadId,
              pageNumber,
              totalPages,
              isUploadContainer: false,
            });

            await this.documentsRepository.updateStatus(failedRecord._id.toString(), {
              processingStatus: DocumentProcessingStatus.FAILED,
              failureReason: `Page split failed: ${
                error instanceof Error ? error.message : 'unknown'
              }`.slice(0, 2000),
            });
          } catch (createError) {
            this.logger.error('Failed to persist failed page document', {
              parentUploadId,
              pageNumber,
              error: createError instanceof Error ? createError.message : 'unknown',
            });
          }
        }
      }

      if (prepared.length > 0) {
        try {
          await this.queueService.enqueueProcessDocuments(
            prepared.map((item) => ({
              documentId: item.documentId,
              userId,
              uploadedAt,
            })),
          );
        } catch (error) {
          await Promise.all(
            prepared.map((item) =>
              this.documentsRepository
                .updateStatus(item.documentId, {
                  processingStatus: DocumentProcessingStatus.FAILED,
                  failureReason:
                    error instanceof Error
                      ? `Queue enqueue failed: ${error.message}`.slice(0, 2000)
                      : 'Queue enqueue failed',
                })
                .catch(() => undefined),
            ),
          );
          throw error;
        }

        for (const item of prepared) {
          await this.documentsRepository.updateStatus(item.documentId, {
            processingStatus: DocumentProcessingStatus.QUEUED,
            jobId: item.documentId,
            failureReason: null,
          });
        }
      }

      await this.documentsRepository.updateStatus(parentUploadId, {
        processingStatus: DocumentProcessingStatus.SPLIT_COMPLETE,
        jobId: `split-${parentUploadId}`,
        failureReason: null,
      });

      if (parent.totalPages !== totalPages) {
        await this.documentsRepository.findById(parentUploadId).then(async (doc) => {
          if (doc) {
            doc.totalPages = totalPages;
            await doc.save();
          }
        });
      }

      this.logger.info('PDF split completed', {
        parentUploadId,
        totalPages,
        created: prepared.length,
        failed,
        durationMs: Date.now() - startedAt,
      });

      return {
        parentUploadId,
        created: prepared.length,
        failed,
        childDocumentIds: prepared.map((item) => item.documentId),
      };
    } finally {
      if (workDir) {
        await this.imageConverter.cleanup(workDir);
      }
    }
  }
}
