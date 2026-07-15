import { mkdir, unlink, access, stat, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { createUuid } from '../../../common/utils/uuid';
import type { LoggerService } from '../../logger';
import type {
  StorageFileMetadata,
  StorageProvider,
  StoreFileInput,
  StoredFileResult,
} from './storage-adapter.interface';

/**
 * Responsibility: Persist uploads on the local filesystem.
 * Paths are UUID-based and organized as `{year}/{month}/{uuid}{ext}` under a configured root.
 * No other module should import this class directly — use StorageService.
 */
export class LocalStorageProvider implements StorageProvider {
  public constructor(
    private readonly rootDirectory: string,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Writes buffer to year/month/uuid.ext under the configured root.
   */
  public async store(input: StoreFileInput): Promise<StoredFileResult> {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storedFileName = `${createUuid()}${input.extension}`;
    const relativeDir = path.posix.join(year, month);
    const storagePath = path.posix.join(relativeDir, storedFileName);

    const absoluteDir = this.resolveSafe(relativeDir);
    const absoluteFile = this.resolveSafe(storagePath);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(absoluteFile, input.buffer);

    this.logger.debug('File stored locally', {
      storagePath,
      size: input.buffer.length,
      mimeType: input.mimeType,
    });

    return {
      storedFileName,
      storagePath,
      size: input.buffer.length,
      mimeType: input.mimeType,
    };
  }

  /**
   * Reads stored file bytes from a safe path under the root.
   */
  public async read(storagePath: string): Promise<Buffer> {
    const absoluteFile = this.resolveSafe(storagePath);
    return readFile(absoluteFile);
  }

  /**
   * Deletes a file if present. Missing files are ignored.
   */
  public async delete(storagePath: string): Promise<void> {
    const absoluteFile = this.resolveSafe(storagePath);

    try {
      await unlink(absoluteFile);
      this.logger.debug('Local file deleted', { storagePath });
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }

      throw error;
    }
  }

  /**
   * Checks whether a stored file exists.
   */
  public async exists(storagePath: string): Promise<boolean> {
    const absoluteFile = this.resolveSafe(storagePath);

    try {
      await access(absoluteFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns size metadata for a stored file.
   */
  public async getMetadata(storagePath: string): Promise<StorageFileMetadata> {
    const absoluteFile = this.resolveSafe(storagePath);

    try {
      const info = await stat(absoluteFile);
      return {
        storagePath,
        size: info.size,
        exists: true,
      };
    } catch {
      return {
        storagePath,
        size: 0,
        exists: false,
      };
    }
  }

  /**
   * Resolves a relative storage path under the root and blocks path traversal.
   */
  private resolveSafe(relativePath: string): string {
    const normalized = path
      .normalize(relativePath)
      .replace(/^(\.\.(\/|\\|$))+/, '')
      .replace(/^[/\\]+/, '');

    const absoluteRoot = path.resolve(this.rootDirectory);
    const absoluteTarget = path.resolve(absoluteRoot, normalized);

    if (
      absoluteTarget !== absoluteRoot &&
      !absoluteTarget.startsWith(absoluteRoot + path.sep)
    ) {
      throw new Error('Invalid storage path — path traversal detected');
    }

    return absoluteTarget;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'ENOENT'
  );
}
