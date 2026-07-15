import { Types } from 'mongoose';
import {
  DocumentModel,
  toPublicDocument,
  type DocumentClassificationArtifact,
  type DocumentExtractionArtifact,
  type DocumentOcrArtifact,
  type DocumentRecord,
  type DocumentValidationArtifact,
  type DocumentVendorArtifact,
  type PublicDocument,
} from './schemas/document.schema';
import {
  DocumentProcessingStatus,
  type DocumentProcessingStatusValue,
} from '../../common/constants';


export interface CreateDocumentRecord {
  userId: string;
  originalFileName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  uploadTimestamp?: Date;
  processingStatus: DocumentProcessingStatusValue;
}

export interface UpdateDocumentStatusInput {
  processingStatus: DocumentProcessingStatusValue;
  jobId?: string;
  failureReason?: string | null;
}

export type DocumentListStatusFilter =
  | 'all'
  | 'processing'
  | 'review'
  | 'approved'
  | 'failed';

export interface DocumentStatusCounts {
  all: number;
  processing: number;
  review: number;
  approved: number;
  failed: number;
}

/**
 * Responsibility: MongoDB persistence for documents.
 */
export class DocumentsRepository {
  /**
   * Inserts a new document metadata record.
   */
  public async create(data: CreateDocumentRecord): Promise<DocumentRecord> {
    return DocumentModel.create({
      ...data,
      userId: new Types.ObjectId(data.userId),
      uploadTimestamp: data.uploadTimestamp ?? new Date(),
    });
  }

  /**
   * Finds a document by id.
   */
  public async findById(id: string): Promise<DocumentRecord | null> {
    return DocumentModel.findById(id).exec();
  }

  /**
   * Updates processing status and optional job/failure metadata.
   */
  public async updateStatus(
    id: string,
    input: UpdateDocumentStatusInput,
  ): Promise<DocumentRecord | null> {
    const update: Record<string, unknown> = {
      processingStatus: input.processingStatus,
    };

    if (input.jobId !== undefined) {
      update.jobId = input.jobId;
    }

    if (input.failureReason === null) {
      return DocumentModel.findByIdAndUpdate(
        id,
        { $set: update, $unset: { failureReason: 1 } },
        { new: true },
      ).exec();
    }

    if (input.failureReason !== undefined) {
      update.failureReason = input.failureReason;
    }

    return DocumentModel.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  }

  /**
   * Persists OCR artifact and advances status (typically OCR_COMPLETED).
   * Does not touch AI artifacts.
   */
  public async saveOcrResult(
    id: string,
    ocr: DocumentOcrArtifact,
    processingStatus: DocumentProcessingStatusValue,
  ): Promise<DocumentRecord | null> {
    return DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ocr,
          processingStatus,
        },
        $unset: { failureReason: 1 },
      },
      { new: true },
    ).exec();
  }

  /**
   * Persists AI agent outputs without overwriting OCR.
   * Advances status to AI_COMPLETED (or caller-provided status).
   */
  public async saveAiResult(
    id: string,
    artifacts: {
      classification: DocumentClassificationArtifact;
      vendor: DocumentVendorArtifact;
      extraction: DocumentExtractionArtifact;
    },
    processingStatus: DocumentProcessingStatusValue,
  ): Promise<DocumentRecord | null> {
    return DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          classification: artifacts.classification,
          vendor: artifacts.vendor,
          extraction: artifacts.extraction,
          processingStatus,
        },
        $unset: { failureReason: 1 },
      },
      { new: true },
    ).exec();
  }

  /**
   * Persists validation artifact without overwriting OCR or AI fields.
   */
  public async saveValidationResult(
    id: string,
    validation: DocumentValidationArtifact,
    processingStatus: DocumentProcessingStatusValue,
  ): Promise<DocumentRecord | null> {
    return DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          validation,
          processingStatus,
        },
        $unset: { failureReason: 1 },
      },
      { new: true },
    ).exec();
  }

  /**
   * Updates only extraction.fields (human review edits).
   */
  public async updateExtractedFields(
    id: string,
    fields: Record<string, string | number | null>,
  ): Promise<DocumentRecord | null> {
    return DocumentModel.findByIdAndUpdate(
      id,
      { $set: { 'extraction.fields': fields } },
      { new: true },
    ).exec();
  }

  /**
   * Approves document once — freezes approvedFields and approval metadata.
   */
  public async approveDocument(
    id: string,
    input: {
      approvedFields: Record<string, string | number | null>;
      approvedBy: string;
      approvedAt: Date;
    },
  ): Promise<DocumentRecord | null> {
    return DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          approvedFields: input.approvedFields,
          approval: {
            approved: true,
            approvedBy: new Types.ObjectId(input.approvedBy),
            approvedAt: input.approvedAt,
          },
          processingStatus: DocumentProcessingStatus.APPROVED,
        },
        $unset: { failureReason: 1 },
      },
      { new: true },
    ).exec();
  }

  /**
   * Finds candidate duplicate documents (warnings only — never reject).
   *
   * Match when:
   * - Same supplier AND same invoice number, OR
   * - Same consumer number AND same billing period
   */
  public async findPotentialDuplicates(
    excludeDocumentId: string,
    criteria: {
      supplier?: string;
      invoiceNumber?: string;
      consumerNumber?: string;
      billingPeriod?: string;
    },
  ): Promise<string[]> {
    const orClauses: Record<string, unknown>[] = [];

    if (criteria.supplier && criteria.invoiceNumber) {
      orClauses.push({
        $and: [
          {
            $or: [
              { 'vendor.name': criteria.supplier },
              { 'extraction.vendor': criteria.supplier },
              { 'extraction.fields.Supplier Name': criteria.supplier },
              { 'extraction.fields.Utility Provider': criteria.supplier },
            ],
          },
          { 'extraction.fields.Invoice Number': criteria.invoiceNumber },
        ],
      });
    }

    if (criteria.consumerNumber && criteria.billingPeriod) {
      orClauses.push({
        $and: [
          { 'extraction.fields.Consumer Number': criteria.consumerNumber },
          { 'extraction.fields.Billing Period': criteria.billingPeriod },
        ],
      });
    }

    if (orClauses.length === 0) {
      return [];
    }

    const filter: Record<string, unknown> = {
      _id: { $ne: new Types.ObjectId(excludeDocumentId) },
      $or: orClauses,
    };

    const docs = await DocumentModel.find(filter)
      .select({ _id: 1 })
      .limit(20)
      .lean()
      .exec();

    return docs.map((doc) => String(doc._id));
  }

  /**
   * Lists documents for a user, or all documents for ADMIN.
   */
  public async findForActor(
    actor: { id: string; role: string },
    options: { skip: number; limit: number; statusFilter?: DocumentListStatusFilter },
  ): Promise<DocumentRecord[]> {
    const filter = this.buildActorFilter(actor, options.statusFilter);

    return DocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .exec();
  }

  /**
   * Counts documents visible to the actor (optionally by status group).
   */
  public async countForActor(
    actor: { id: string; role: string },
    statusFilter: DocumentListStatusFilter = 'all',
  ): Promise<number> {
    return DocumentModel.countDocuments(this.buildActorFilter(actor, statusFilter)).exec();
  }

  /**
   * Status-group counts for dashboard chips (scoped by role).
   */
  public async countGroupsForActor(actor: { id: string; role: string }): Promise<DocumentStatusCounts> {
    const [all, processing, review, approved, failed] = await Promise.all([
      this.countForActor(actor, 'all'),
      this.countForActor(actor, 'processing'),
      this.countForActor(actor, 'review'),
      this.countForActor(actor, 'approved'),
      this.countForActor(actor, 'failed'),
    ]);

    return { all, processing, review, approved, failed };
  }

  private buildActorFilter(
    actor: { id: string; role: string },
    statusFilter: DocumentListStatusFilter = 'all',
  ): Record<string, unknown> {
    const filter: Record<string, unknown> =
      actor.role === 'ADMIN' ? {} : { userId: new Types.ObjectId(actor.id) };

    if (statusFilter === 'processing') {
      filter.processingStatus = {
        $nin: [
          DocumentProcessingStatus.WAITING_FOR_REVIEW,
          DocumentProcessingStatus.APPROVED,
          DocumentProcessingStatus.FAILED,
        ],
      };
    } else if (statusFilter === 'review') {
      filter.processingStatus = DocumentProcessingStatus.WAITING_FOR_REVIEW;
    } else if (statusFilter === 'approved') {
      filter.processingStatus = DocumentProcessingStatus.APPROVED;
    } else if (statusFilter === 'failed') {
      filter.processingStatus = DocumentProcessingStatus.FAILED;
    }

    return filter;
  }

  /**
   * Maps a document record to the public DTO.
   */
  public toPublic(doc: DocumentRecord): PublicDocument {
    return toPublicDocument(doc);
  }
}
