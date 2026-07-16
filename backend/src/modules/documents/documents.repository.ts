import { Types } from 'mongoose';
import {
  DocumentModel,
  toPublicDocument,
  type ChildStatusSummary,
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
  parentUploadId?: string;
  pageNumber?: number;
  totalPages?: number;
  isUploadContainer?: boolean;
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
    const payload: Record<string, unknown> = {
      ...data,
      userId: new Types.ObjectId(data.userId),
      uploadTimestamp: data.uploadTimestamp ?? new Date(),
    };

    if (data.parentUploadId) {
      payload.parentUploadId = new Types.ObjectId(data.parentUploadId);
    }

    return DocumentModel.create(payload);
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
    const extraction = {
      ...artifacts.extraction,
      originalFields: { ...artifacts.extraction.fields },
    };

    return DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          classification: artifacts.classification,
          vendor: artifacts.vendor,
          extraction,
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
   * Finds child page documents for a parent upload, ordered by page number.
   */
  public async findChildrenByParentId(parentUploadId: string): Promise<DocumentRecord[]> {
    return DocumentModel.find({ parentUploadId: new Types.ObjectId(parentUploadId) })
      .sort({ pageNumber: 1 })
      .exec();
  }

  /**
   * Aggregates child status counts for parent upload containers.
   */
  public async aggregateChildStatusSummaries(
    parentIds: string[],
  ): Promise<Map<string, { count: number; summary: ChildStatusSummary }>> {
    const result = new Map<string, { count: number; summary: ChildStatusSummary }>();

    if (parentIds.length === 0) {
      return result;
    }

    const objectIds = parentIds.map((id) => new Types.ObjectId(id));
    const rows = await DocumentModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
      processing: number;
      review: number;
      approved: number;
      failed: number;
    }>([
      { $match: { parentUploadId: { $in: objectIds } } },
      {
        $group: {
          _id: '$parentUploadId',
          count: { $sum: 1 },
          processing: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$processingStatus', DocumentProcessingStatus.WAITING_FOR_REVIEW] },
                    { $ne: ['$processingStatus', DocumentProcessingStatus.APPROVED] },
                    { $ne: ['$processingStatus', DocumentProcessingStatus.FAILED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          review: {
            $sum: {
              $cond: [
                { $eq: ['$processingStatus', DocumentProcessingStatus.WAITING_FOR_REVIEW] },
                1,
                0,
              ],
            },
          },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$processingStatus', DocumentProcessingStatus.APPROVED] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$processingStatus', DocumentProcessingStatus.FAILED] }, 1, 0],
            },
          },
        },
      },
    ]).exec();

    for (const row of rows) {
      result.set(String(row._id), {
        count: row.count,
        summary: {
          processing: row.processing,
          review: row.review,
          approved: row.approved,
          failed: row.failed,
        },
      });
    }

    return result;
  }

  /**
   * Lists documents for a user, or all documents for ADMIN.
   */
  public async findForActor(
    actor: { id: string; role: string },
    options: { skip: number; limit: number; statusFilter?: DocumentListStatusFilter },
  ): Promise<DocumentRecord[]> {
    const filter = this.buildActorFilter(actor, options.statusFilter);
    filter.parentUploadId = { $exists: false };

    return DocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .exec();
  }

  /**
   * Counts documents visible to the actor (optionally by status group).
   * Top-level only — excludes child page documents.
   */
  public async countForActor(
    actor: { id: string; role: string },
    statusFilter: DocumentListStatusFilter = 'all',
  ): Promise<number> {
    const filter = this.buildActorFilter(actor, statusFilter);
    filter.parentUploadId = { $exists: false };
    return DocumentModel.countDocuments(filter).exec();
  }

  /**
   * Status-group counts for dashboard chips (scoped by role).
   * Counts child page documents for pipeline statuses; top-level for all.
   */
  public async countGroupsForActor(actor: { id: string; role: string }): Promise<DocumentStatusCounts> {
    const userFilter =
      actor.role === 'ADMIN' ? {} : { userId: new Types.ObjectId(actor.id) };

    const [all, processing, review, approved, failed] = await Promise.all([
      DocumentModel.countDocuments({
        ...userFilter,
        parentUploadId: { $exists: false },
      }).exec(),
      DocumentModel.countDocuments({
        ...userFilter,
        $or: [
          { parentUploadId: { $exists: true }, processingStatus: { $nin: this.terminalStatuses() } },
          {
            parentUploadId: { $exists: false },
            processingStatus: {
              $in: [
                DocumentProcessingStatus.SPLITTING,
                DocumentProcessingStatus.UPLOADED,
                DocumentProcessingStatus.QUEUED,
                DocumentProcessingStatus.PROCESSING,
                DocumentProcessingStatus.OCR_PROCESSING,
                DocumentProcessingStatus.OCR_COMPLETED,
                DocumentProcessingStatus.AI_PROCESSING,
                DocumentProcessingStatus.AI_COMPLETED,
                DocumentProcessingStatus.VALIDATING,
                DocumentProcessingStatus.VALIDATION_COMPLETED,
              ],
            },
          },
        ],
      }).exec(),
      DocumentModel.countDocuments({
        ...userFilter,
        parentUploadId: { $exists: true },
        processingStatus: DocumentProcessingStatus.WAITING_FOR_REVIEW,
      }).exec(),
      DocumentModel.countDocuments({
        ...userFilter,
        parentUploadId: { $exists: true },
        processingStatus: DocumentProcessingStatus.APPROVED,
      }).exec(),
      DocumentModel.countDocuments({
        ...userFilter,
        parentUploadId: { $exists: true },
        processingStatus: DocumentProcessingStatus.FAILED,
      }).exec(),
    ]);

    return { all, processing, review, approved, failed };
  }

  private terminalStatuses(): DocumentProcessingStatusValue[] {
    return [
      DocumentProcessingStatus.WAITING_FOR_REVIEW,
      DocumentProcessingStatus.APPROVED,
      DocumentProcessingStatus.FAILED,
    ];
  }

  private buildActorFilter(
    actor: { id: string; role: string },
    statusFilter: DocumentListStatusFilter = 'all',
  ): Record<string, unknown> {
    const filter: Record<string, unknown> =
      actor.role === 'ADMIN' ? {} : { userId: new Types.ObjectId(actor.id) };

    if (statusFilter === 'processing') {
      filter.$or = [
        {
          parentUploadId: { $exists: true },
          processingStatus: {
            $nin: [
              DocumentProcessingStatus.WAITING_FOR_REVIEW,
              DocumentProcessingStatus.APPROVED,
              DocumentProcessingStatus.FAILED,
            ],
          },
        },
        {
          parentUploadId: { $exists: false },
          processingStatus: {
            $in: [
              DocumentProcessingStatus.SPLITTING,
              DocumentProcessingStatus.UPLOADED,
              DocumentProcessingStatus.QUEUED,
              DocumentProcessingStatus.PROCESSING,
              DocumentProcessingStatus.OCR_PROCESSING,
              DocumentProcessingStatus.OCR_COMPLETED,
              DocumentProcessingStatus.AI_PROCESSING,
              DocumentProcessingStatus.AI_COMPLETED,
              DocumentProcessingStatus.VALIDATING,
              DocumentProcessingStatus.VALIDATION_COMPLETED,
            ],
          },
        },
      ];
    } else if (statusFilter === 'review') {
      filter.$or = [
        {
          parentUploadId: { $exists: false },
          isUploadContainer: { $ne: true },
          processingStatus: DocumentProcessingStatus.WAITING_FOR_REVIEW,
        },
        {
          isUploadContainer: true,
          processingStatus: DocumentProcessingStatus.SPLIT_COMPLETE,
        },
      ];
    } else if (statusFilter === 'approved') {
      filter.$or = [
        {
          parentUploadId: { $exists: false },
          isUploadContainer: { $ne: true },
          processingStatus: DocumentProcessingStatus.APPROVED,
        },
        {
          isUploadContainer: true,
          processingStatus: DocumentProcessingStatus.SPLIT_COMPLETE,
        },
      ];
    } else if (statusFilter === 'failed') {
      filter.$or = [
        {
          parentUploadId: { $exists: false },
          isUploadContainer: { $ne: true },
          processingStatus: DocumentProcessingStatus.FAILED,
        },
        { isUploadContainer: true, processingStatus: DocumentProcessingStatus.FAILED },
      ];
    }

    return filter;
  }

  /**
   * Maps a document record to the public DTO.
   */
  public toPublic(
    doc: DocumentRecord,
    extras?: { pageDocumentCount?: number; childStatusSummary?: ChildStatusSummary },
  ): PublicDocument {
    return toPublicDocument(doc, extras);
  }
}
