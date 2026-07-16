import type { LoggerService } from '../logger';
import type {
  DocumentListStatusFilter,
  DocumentStatusCounts,
  DocumentsRepository,
  PublicDocument,
} from '../documents';
import { DocumentProcessingStatus } from '../documents';
import type { QueueService } from '../queue';
import { Role } from '../../common/constants';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../../common/exceptions';
import { buildPaginationMeta, parsePagination, toSkipTake } from '../../common/utils';
import type { AuthenticatedUser } from '../../common/types/api.types';

const STATUS_FILTERS = new Set<DocumentListStatusFilter>([
  'all',
  'processing',
  'review',
  'approved',
  'failed',
]);

function parseStatusFilter(raw: unknown): DocumentListStatusFilter {
  if (typeof raw === 'string' && STATUS_FILTERS.has(raw as DocumentListStatusFilter)) {
    return raw as DocumentListStatusFilter;
  }
  return 'all';
}

/**
 * Document query APIs for dashboards (Architecture Appendix A).
 */
export class DocumentsService {
  public constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Lists documents scoped by role (USER: own, ADMIN: all) with pagination + status filter.
   */
  public async listDocuments(
    actor: AuthenticatedUser,
    pageRaw: unknown,
    limitRaw: unknown,
    statusRaw: unknown,
  ): Promise<{
    documents: PublicDocument[];
    counts: DocumentStatusCounts;
    pagination: ReturnType<typeof buildPaginationMeta>;
  }> {
    const pagination = parsePagination(pageRaw, limitRaw);
    const statusFilter = parseStatusFilter(statusRaw);
    const { skip, limit } = toSkipTake(pagination);

    const [records, total, counts] = await Promise.all([
      this.documentsRepository.findForActor(actor, { skip, limit, statusFilter }),
      this.documentsRepository.countForActor(actor, statusFilter),
      this.documentsRepository.countGroupsForActor(actor),
    ]);

    const parentIds = records
      .filter((doc) => doc.isUploadContainer)
      .map((doc) => doc._id.toString());
    const childSummaries = await this.documentsRepository.aggregateChildStatusSummaries(parentIds);

    let documents = records.map((doc) => {
      if (!doc.isUploadContainer) {
        return this.documentsRepository.toPublic(doc);
      }

      const aggregate = childSummaries.get(doc._id.toString());
      return this.documentsRepository.toPublic(doc, {
        pageDocumentCount: aggregate?.count ?? doc.totalPages ?? 0,
        childStatusSummary: aggregate?.summary,
      });
    });

    if (statusFilter === 'review') {
      documents = documents.filter((doc) => {
        if (doc.isUploadContainer) {
          return (doc.childStatusSummary?.review ?? 0) > 0;
        }
        return doc.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW;
      });
    } else if (statusFilter === 'approved') {
      documents = documents.filter((doc) => {
        if (doc.isUploadContainer) {
          const count = doc.pageDocumentCount ?? 0;
          return count > 0 && doc.childStatusSummary?.approved === count;
        }
        return doc.processingStatus === DocumentProcessingStatus.APPROVED;
      });
    } else if (statusFilter === 'failed') {
      documents = documents.filter((doc) => {
        if (doc.isUploadContainer) {
          return (
            doc.processingStatus === DocumentProcessingStatus.FAILED ||
            (doc.childStatusSummary?.failed ?? 0) > 0
          );
        }
        return doc.processingStatus === DocumentProcessingStatus.FAILED;
      });
    } else if (statusFilter === 'processing') {
      documents = documents.filter((doc) => {
        if (doc.isUploadContainer) {
          return (
            doc.processingStatus === DocumentProcessingStatus.SPLITTING ||
            (doc.childStatusSummary?.processing ?? 0) > 0
          );
        }
        return ![
          DocumentProcessingStatus.WAITING_FOR_REVIEW,
          DocumentProcessingStatus.APPROVED,
          DocumentProcessingStatus.FAILED,
          DocumentProcessingStatus.SPLIT_COMPLETE,
        ].includes(doc.processingStatus as typeof DocumentProcessingStatus.WAITING_FOR_REVIEW);
      });
    }

    this.logger.info('Documents listed', {
      userId: actor.id,
      role: actor.role,
      statusFilter,
      count: records.length,
      total,
      page: pagination.page,
    });

    return {
      documents,
      counts,
      pagination: buildPaginationMeta(pagination, total),
    };
  }

  /**
   * Returns child page documents for a parent upload container.
   */
  public async listPageDocuments(
    parentUploadId: string,
    actor: AuthenticatedUser,
  ): Promise<PublicDocument[]> {
    const parent = await this.documentsRepository.findById(parentUploadId);

    if (!parent) {
      throw new NotFoundException('Document not found');
    }

    if (actor.role !== Role.ADMIN && parent.userId.toString() !== actor.id) {
      throw new ForbiddenException('You can only access your own documents');
    }

    if (!parent.isUploadContainer) {
      throw new NotFoundException('Document is not a multi-page upload container');
    }

    const children = await this.documentsRepository.findChildrenByParentId(parentUploadId);

    return children.map((child) => this.documentsRepository.toPublic(child));
  }

  /**
   * Returns one document if the actor is owner or admin.
   */
  public async getDocument(documentId: string, actor: AuthenticatedUser): Promise<PublicDocument> {
    const document = await this.documentsRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (actor.role !== Role.ADMIN && document.userId.toString() !== actor.id) {
      throw new ForbiddenException('You can only access your own documents');
    }

    return this.documentsRepository.toPublic(document);
  }

  /**
   * Re-enqueues a FAILED document through the full OCR → AI → Validation pipeline.
   */
  public async reprocessDocument(
    documentId: string,
    actor: AuthenticatedUser,
  ): Promise<PublicDocument> {
    const document = await this.documentsRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (actor.role !== Role.ADMIN && document.userId.toString() !== actor.id) {
      throw new ForbiddenException('You can only reprocess your own documents');
    }

    if (document.processingStatus !== DocumentProcessingStatus.FAILED) {
      throw new ConflictException(
        `Only FAILED documents can be reprocessed (current: ${document.processingStatus})`,
      );
    }

    const priorJobId = document.jobId ?? documentId;
    await this.queueService.removeJob(priorJobId);
    if (priorJobId !== documentId) {
      await this.queueService.removeJob(documentId);
    }

    await this.documentsRepository.updateStatus(documentId, {
      processingStatus: DocumentProcessingStatus.QUEUED,
      jobId: documentId,
      failureReason: null,
    });

    const jobId = await this.queueService.enqueueProcessDocument({
      documentId,
      userId: document.userId.toString(),
      uploadedAt: document.uploadTimestamp.toISOString(),
    }, {
      jobId: documentId,
    });

    this.logger.info('Document requeued for processing', {
      documentId,
      userId: actor.id,
      jobId,
    });

    const updated = await this.documentsRepository.findById(documentId);
    if (!updated) {
      throw new NotFoundException('Document not found after requeue');
    }

    return this.documentsRepository.toPublic(updated);
  }
}
