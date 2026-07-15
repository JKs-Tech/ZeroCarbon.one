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

    this.logger.info('Documents listed', {
      userId: actor.id,
      role: actor.role,
      statusFilter,
      count: records.length,
      total,
      page: pagination.page,
    });

    return {
      documents: records.map((doc) => this.documentsRepository.toPublic(doc)),
      counts,
      pagination: buildPaginationMeta(pagination, total),
    };
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
