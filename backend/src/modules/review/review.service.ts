import type { LoggerService } from '../logger';
import type { DocumentsRepository, DocumentRecord, PublicDocument } from '../documents';
import { DocumentProcessingStatus } from '../documents';
import { Role } from '../../common/constants';
import {
  ForbiddenException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';
import type { AuthenticatedUser } from '../../common/types/api.types';
import { AuditAction } from './audit/audit.constants';
import type { AuditLogRepository } from './audit/audit-log.repository';
import type { UpdateReviewDto } from './dto/update-review.dto';

/** Fields that must never be edited via the review update API. */
const NON_EDITABLE_FIELD_KEYS = new Set([
  'ocr',
  'text',
  'classification',
  'vendor',
  'confidence',
  'documentType',
  'document_type',
  'validation',
  'approval',
  'approvedFields',
  'userId',
  'processingStatus',
  'mimeType',
  'fileSize',
  'storagePath',
  'originalFileName',
  'storedFileName',
  'jobId',
  'failureReason',
  'provider',
  'model',
  'rawResponse',
  'reasoningSummary',
]);

export interface ReviewPayload {
  document: {
    id: string;
    userId: string;
    originalFileName: string;
    storedFileName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    processingStatus: string;
    parentUploadId?: string;
    pageNumber?: number;
    totalPages?: number;
    uploadTimestamp: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  ocr: PublicDocument['ocr'];
  extraction: PublicDocument['extraction'];
  classification: PublicDocument['classification'];
  vendor: PublicDocument['vendor'];
  validation: PublicDocument['validation'];
  editableFields: Record<string, string | number | null>;
  originalExtractionFields?: Record<string, string | number | null>;
  approvalStatus: 'WAITING_FOR_REVIEW' | 'APPROVED' | 'NOT_READY';
  approval?: PublicDocument['approval'];
  approvedFields?: PublicDocument['approvedFields'];
}

/**
 * Human Review & Approval — edit extracted fields and approve once.
 */
export class ReviewService {
  public constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * GET review payload for a document the user may access.
   */
  public async getReview(documentId: string, actor: AuthenticatedUser): Promise<ReviewPayload> {
    const startedAt = Date.now();
    const document = await this.loadAuthorizedDocument(documentId, actor);

    this.logger.info('Review Opened', {
      documentId,
      userId: actor.id,
      status: document.processingStatus,
      durationMs: Date.now() - startedAt,
    });

    return this.toReviewPayload(document);
  }

  /**
   * PUT — update only extracted business fields while WAITING_FOR_REVIEW.
   */
  public async updateReview(
    documentId: string,
    actor: AuthenticatedUser,
    dto: UpdateReviewDto,
  ): Promise<ReviewPayload> {
    const document = await this.loadAuthorizedDocument(documentId, actor);
    this.assertEditable(document);

    if (!document.extraction) {
      throw new ValidationException('Document has no extraction to edit', [
        { code: 'VALIDATION_ERROR', message: 'Extraction is missing', field: 'extraction' },
      ]);
    }

    const forbiddenKeys = Object.keys(dto.fields).filter((key) =>
      NON_EDITABLE_FIELD_KEYS.has(key) || key.includes('.'),
    );

    if (forbiddenKeys.length > 0) {
      throw new ValidationException('One or more fields are not editable', [
        {
          code: 'VALIDATION_ERROR',
          message: `Non-editable field(s): ${forbiddenKeys.join(', ')}`,
          field: 'fields',
        },
      ]);
    }

    const currentFields: Record<string, string | number | null> = {
      ...(document.extraction.fields ?? {}),
    };
    const auditEntries: Array<{
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    for (const [fieldName, newRaw] of Object.entries(dto.fields)) {
      const oldRaw = currentFields[fieldName] ?? null;
      const oldValue = serializeValue(oldRaw);
      const newValue = serializeValue(newRaw);

      if (oldValue === newValue) {
        continue;
      }

      currentFields[fieldName] = newRaw;
      auditEntries.push({ fieldName, oldValue, newValue });

      this.logger.info('Field Updated', {
        documentId,
        userId: actor.id,
        fieldName,
      });
    }

    if (auditEntries.length === 0) {
      return this.toReviewPayload(document);
    }

    const updated = await this.documentsRepository.updateExtractedFields(
      documentId,
      currentFields,
    );

    if (!updated) {
      throw new NotFoundException('Document not found');
    }

    await this.auditLogRepository.createMany(
      auditEntries.map((entry) => ({
        documentId,
        userId: actor.id,
        action: AuditAction.EDIT,
        fieldName: entry.fieldName,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      })),
    );

    return this.toReviewPayload(updated);
  }

  /**
   * POST approve — once, while WAITING_FOR_REVIEW.
   */
  public async approve(documentId: string, actor: AuthenticatedUser): Promise<ReviewPayload> {
    const startedAt = Date.now();
    const document = await this.loadAuthorizedDocument(documentId, actor);

    this.logger.info('Approval Started', {
      documentId,
      userId: actor.id,
    });

    if (document.processingStatus === DocumentProcessingStatus.APPROVED) {
      throw new ValidationException('Document is already approved', [
        {
          code: 'VALIDATION_ERROR',
          message: 'Already approved documents cannot be approved again',
          field: 'processingStatus',
        },
      ]);
    }

    if (document.processingStatus !== DocumentProcessingStatus.WAITING_FOR_REVIEW) {
      throw new ValidationException('Document is not waiting for review', [
        {
          code: 'VALIDATION_ERROR',
          message: `Expected WAITING_FOR_REVIEW, got ${document.processingStatus}`,
          field: 'processingStatus',
        },
      ]);
    }

    if (!document.extraction?.fields) {
      throw new ValidationException('Cannot approve document without extracted fields', [
        { code: 'VALIDATION_ERROR', message: 'Extraction fields are missing', field: 'extraction' },
      ]);
    }

    const approvedAt = new Date();
    const approvedFields = { ...document.extraction.fields };

    const updated = await this.documentsRepository.approveDocument(documentId, {
      approvedFields,
      approvedBy: actor.id,
      approvedAt,
    });

    if (!updated) {
      throw new NotFoundException('Document not found');
    }

    await this.auditLogRepository.create({
      documentId,
      userId: actor.id,
      action: AuditAction.APPROVED,
      timestamp: approvedAt,
    });

    this.logger.info('Approval Completed', {
      documentId,
      userId: actor.id,
      durationMs: Date.now() - startedAt,
    });

    return this.toReviewPayload(updated);
  }

  private async loadAuthorizedDocument(
    documentId: string,
    actor: AuthenticatedUser,
  ): Promise<DocumentRecord> {
    const document = await this.documentsRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertCanAccess(document, actor);
    return document;
  }

  private assertCanAccess(document: DocumentRecord, actor: AuthenticatedUser): void {
    if (actor.role === Role.ADMIN) {
      return;
    }

    if (document.userId.toString() !== actor.id) {
      throw new ForbiddenException('You can only review your own documents');
    }
  }

  private assertEditable(document: DocumentRecord): void {
    if (document.processingStatus === DocumentProcessingStatus.APPROVED) {
      throw new ValidationException('Approved documents cannot be modified', [
        {
          code: 'VALIDATION_ERROR',
          message: 'Document is immutable after approval',
          field: 'processingStatus',
        },
      ]);
    }

    if (document.processingStatus !== DocumentProcessingStatus.WAITING_FOR_REVIEW) {
      throw new ValidationException('Document is not available for review edits', [
        {
          code: 'VALIDATION_ERROR',
          message: `Expected WAITING_FOR_REVIEW, got ${document.processingStatus}`,
          field: 'processingStatus',
        },
      ]);
    }
  }

  private toReviewPayload(document: DocumentRecord): ReviewPayload {
    const publicDoc = this.documentsRepository.toPublic(document);
    const editableFields = { ...(document.extraction?.fields ?? {}) };

    let approvalStatus: ReviewPayload['approvalStatus'] = 'NOT_READY';
    if (document.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW) {
      approvalStatus = 'WAITING_FOR_REVIEW';
    } else if (document.processingStatus === DocumentProcessingStatus.APPROVED) {
      approvalStatus = 'APPROVED';
    }

    return {
      document: {
        id: publicDoc.id,
        userId: publicDoc.userId,
        originalFileName: publicDoc.originalFileName,
        storedFileName: publicDoc.storedFileName,
        storagePath: publicDoc.storagePath,
        mimeType: publicDoc.mimeType,
        fileSize: publicDoc.fileSize,
        processingStatus: publicDoc.processingStatus,
        parentUploadId: publicDoc.parentUploadId,
        pageNumber: publicDoc.pageNumber,
        totalPages: publicDoc.totalPages,
        uploadTimestamp: publicDoc.uploadTimestamp,
        createdAt: publicDoc.createdAt,
        updatedAt: publicDoc.updatedAt,
      },
      ocr: publicDoc.ocr,
      extraction: publicDoc.extraction,
      classification: publicDoc.classification,
      vendor: publicDoc.vendor,
      validation: publicDoc.validation,
      editableFields,
      originalExtractionFields: document.extraction?.originalFields
        ? { ...document.extraction.originalFields }
        : undefined,
      approvalStatus,
      approval: publicDoc.approval,
      approvedFields: publicDoc.approvedFields,
    };
  }
}

function serializeValue(value: string | number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}
