/**
 * Result of storing a file via StorageProvider.
 */
export interface StoredFileResult {
  /** UUID-based filename including extension (never the original name). */
  storedFileName: string;
  /** Storage key / relative path, e.g. 2026/07/uuid.pdf */
  storagePath: string;
  /** Byte size of stored content. */
  size: number;
  /** Detected/validated MIME type. */
  mimeType: string;
}

/**
 * Metadata returned by getMetadata().
 */
export interface StorageFileMetadata {
  storagePath: string;
  size: number;
  exists: boolean;
}

/**
 * Input for storing a binary upload.
 */
export interface StoreFileInput {
  buffer: Buffer;
  mimeType: string;
  /** Normalized extension including dot, e.g. .pdf */
  extension: string;
}

/**
 * Storage provider abstraction (Architecture: Storage Adapter).
 * Business/upload code depends on this interface only —
 * Local today; S3 / Azure / GCS later without changing UploadService.
 */
export interface StorageProvider {
  /**
   * Persists file bytes and returns storage metadata.
   */
  store(input: StoreFileInput): Promise<StoredFileResult>;

  /**
   * Reads previously stored file bytes.
   */
  read(storagePath: string): Promise<Buffer>;

  /**
   * Deletes a previously stored object by storage path.
   */
  delete(storagePath: string): Promise<void>;

  /**
   * Returns true when the object exists.
   */
  exists(storagePath: string): Promise<boolean>;

  /**
   * Returns lightweight metadata for a stored object.
   */
  getMetadata(storagePath: string): Promise<StorageFileMetadata>;
}
