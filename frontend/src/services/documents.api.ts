import { apiClient } from './api.client';
import { UPLOAD_BATCH_SIZE, UPLOAD_PARALLEL_BATCHES } from '../constants';
import type { ApiSuccess, DocumentSummary } from '../types/api';

export interface UploadDocumentResult {
  id: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  processingStatus: string;
  createdAt: string;
}

export type DocumentStatusFilter =
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

export interface DocumentListResult {
  documents: DocumentSummary[];
  counts: DocumentStatusCounts;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BulkUploadProgress {
  /** 0–100 across the entire selection */
  percent: number;
  completedFiles: number;
  totalFiles: number;
  failedFiles: number;
  phase: 'uploading' | 'finalizing' | 'done';
  message: string;
}

export interface BulkUploadResult {
  documents: UploadDocumentResult[];
  failed: Array<{ fileName: string; error: string }>;
}

function chunkFiles<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(runners);
  return results;
}

export const documentsApi = {
  async list(
    page = 1,
    limit = 12,
    status: DocumentStatusFilter = 'all',
  ): Promise<DocumentListResult> {
    const { data } = await apiClient.get<
      ApiSuccess<{ documents: DocumentSummary[]; counts: DocumentStatusCounts }>
    >('/documents', {
      params: { page, limit, status },
    });
    return {
      documents: data.data.documents,
      counts: data.data.counts ?? {
        all: data.meta.total ?? 0,
        processing: 0,
        review: 0,
        approved: 0,
        failed: 0,
      },
      page: data.meta.page ?? page,
      limit: data.meta.limit ?? limit,
      total: data.meta.total ?? data.data.documents.length,
      totalPages: data.meta.totalPages ?? 1,
    };
  },

  async getById(id: string): Promise<DocumentSummary> {
    const { data } = await apiClient.get<ApiSuccess<{ document: DocumentSummary }>>(
      `/documents/${id}`,
    );
    return data.data.document;
  },

  async reprocess(id: string): Promise<DocumentSummary> {
    const { data } = await apiClient.post<ApiSuccess<{ document: DocumentSummary }>>(
      `/documents/${id}/reprocess`,
    );
    return data.data.document;
  },

  async uploadSingle(
    file: File,
    onUploadProgress?: (percent: number) => void,
  ): Promise<UploadDocumentResult> {
    const form = new FormData();
    form.append('file', file);

    const { data } = await apiClient.post<ApiSuccess<{ document: UploadDocumentResult }>>(
      '/documents/upload',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!onUploadProgress) {
            return;
          }
          if (!event.total) {
            onUploadProgress(Math.min(95, Math.round((event.loaded / Math.max(file.size, 1)) * 100)));
            return;
          }
          onUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        },
      },
    );
    onUploadProgress?.(100);
    return data.data.document;
  },

  async uploadMany(
    files: File[],
    onUploadProgress?: (percent: number) => void,
  ): Promise<UploadDocumentResult[]> {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    const { data } = await apiClient.post<ApiSuccess<{ documents: UploadDocumentResult[] }>>(
      '/documents/uploads',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!onUploadProgress) {
            return;
          }
          if (!event.total) {
            onUploadProgress(
              Math.min(95, Math.round((event.loaded / Math.max(totalBytes, 1)) * 100)),
            );
            return;
          }
          onUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        },
      },
    );
    onUploadProgress?.(100);
    return data.data.documents;
  },

  /**
   * Uploads any volume of files by chunking into safe HTTP batches.
   * Safe for thousands of files without loading them all into one request.
   */
  async uploadBulk(
    files: File[],
    onProgress?: (progress: BulkUploadProgress) => void,
  ): Promise<BulkUploadResult> {
    const totalFiles = files.length;
    if (totalFiles === 0) {
      return { documents: [], failed: [] };
    }

    if (totalFiles === 1) {
      onProgress?.({
        percent: 0,
        completedFiles: 0,
        totalFiles,
        failedFiles: 0,
        phase: 'uploading',
        message: 'Uploading 1 file…',
      });
      const document = await this.uploadSingle(files[0], (percent) => {
        onProgress?.({
          percent,
          completedFiles: percent >= 100 ? 1 : 0,
          totalFiles: 1,
          failedFiles: 0,
          phase: 'uploading',
          message: `Uploading… ${percent}%`,
        });
      });
      onProgress?.({
        percent: 100,
        completedFiles: 1,
        totalFiles: 1,
        failedFiles: 0,
        phase: 'done',
        message: 'Upload complete — queued for OCR',
      });
      return { documents: [document], failed: [] };
    }

    const batches = chunkFiles(files, UPLOAD_BATCH_SIZE);
    const documents: UploadDocumentResult[] = [];
    const failed: Array<{ fileName: string; error: string }> = [];
    let completedFiles = 0;

    const report = (phase: BulkUploadProgress['phase'], message: string) => {
      const percent = Math.min(
        100,
        Math.round(((completedFiles + failed.length) / totalFiles) * 100),
      );
      onProgress?.({
        percent,
        completedFiles,
        totalFiles,
        failedFiles: failed.length,
        phase,
        message,
      });
    };

    report('uploading', `Uploading 0 of ${totalFiles} files…`);

    await mapPool(batches, UPLOAD_PARALLEL_BATCHES, async (batch) => {
      try {
        if (batch.length === 1) {
          const document = await this.uploadSingle(batch[0]);
          documents.push(document);
          completedFiles += 1;
        } else {
          const uploaded = await this.uploadMany(batch);
          documents.push(...uploaded);
          completedFiles += uploaded.length;
        }
        report(
          'uploading',
          `Uploaded ${completedFiles} of ${totalFiles} files…`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        // Retry batch one-by-one so a single bad file does not drop the whole chunk.
        for (const file of batch) {
          try {
            const document = await this.uploadSingle(file);
            documents.push(document);
            completedFiles += 1;
            report(
              'uploading',
              `Uploaded ${completedFiles} of ${totalFiles} files…`,
            );
          } catch (fileError) {
            failed.push({
              fileName: file.name,
              error: fileError instanceof Error ? fileError.message : message,
            });
            report(
              'uploading',
              `Uploaded ${completedFiles} of ${totalFiles} (${failed.length} failed)…`,
            );
          }
        }
      }
    });

    report(
      'done',
      failed.length === 0
        ? `Uploaded ${completedFiles} files — queued for OCR / AI`
        : `Uploaded ${completedFiles} files (${failed.length} failed)`,
    );

    return { documents, failed };
  },
};
