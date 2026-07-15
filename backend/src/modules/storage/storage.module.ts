/**
 * Storage module wiring (Express composition equivalent of storage.module.ts).
 */
export { StorageService } from './storage.service';
export { LocalStorageProvider } from './adapters/local.adapter';
export type {
  StorageProvider,
  StoreFileInput,
  StoredFileResult,
  StorageFileMetadata,
} from './adapters/storage-adapter.interface';
export { S3_ADAPTER_PENDING } from './adapters/s3.adapter';
