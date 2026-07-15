import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import type {
  StorageFileMetadata,
  StorageProvider,
  StoreFileInput,
  StoredFileResult,
} from './adapters/storage-adapter.interface';
import { LocalStorageProvider } from './adapters/local.adapter';

/**
 * Responsibility: Resolve the active StorageProvider and expose store/delete/exists/getMetadata.
 * Upload and Documents modules depend on this service — never on LocalStorageProvider.
 */
export class StorageService implements StorageProvider {
  private readonly provider: StorageProvider;

  public constructor(config: ConfigService, logger: LoggerService) {
    const storageLogger = logger.child('Storage');
    const driver = config.storage.driver;

    if (driver === 'local') {
      this.provider = new LocalStorageProvider(config.storage.localPath, storageLogger);
      storageLogger.info('Storage driver initialized', {
        driver,
        localPath: config.storage.localPath,
      });
      return;
    }

    // Future: s3 | azure | gcs — fail fast until implemented.
    throw new Error(
      `Unsupported STORAGE_DRIVER "${driver}". Phase 4 supports "local" only.`,
    );
  }

  /**
   * Stores a file via the active provider.
   */
  public store(input: StoreFileInput): Promise<StoredFileResult> {
    return this.provider.store(input);
  }

  /**
   * Reads a stored file via the active provider.
   */
  public read(storagePath: string): Promise<Buffer> {
    return this.provider.read(storagePath);
  }

  /**
   * Deletes a stored file via the active provider.
   */
  public delete(storagePath: string): Promise<void> {
    return this.provider.delete(storagePath);
  }

  /**
   * Checks existence via the active provider.
   */
  public exists(storagePath: string): Promise<boolean> {
    return this.provider.exists(storagePath);
  }

  /**
   * Reads metadata via the active provider.
   */
  public getMetadata(storagePath: string): Promise<StorageFileMetadata> {
    return this.provider.getMetadata(storagePath);
  }
}
