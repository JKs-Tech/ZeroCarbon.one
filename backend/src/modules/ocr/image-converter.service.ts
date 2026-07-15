import { mkdir, mkdtemp, rm, writeFile, readdir, readFile } from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import { createUuid } from '../../common/utils/uuid';

const execFileAsync = promisify(execFile);

/**
 * Responsibility: Convert PDF pages into temporary PNG images for Tesseract.
 * Uses Poppler `pdftoppm` (available via Homebrew) — equivalent to pdf2pic,
 * without GraphicsMagick / pdf.js worker version friction.
 * Always cleans the temporary working directory.
 */
export class ImageConverterService {
  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Renders each PDF page to a PNG file under a unique temp directory.
   * Caller must invoke cleanup() when finished.
   */
  public async convertPdfToImages(pdfBuffer: Buffer): Promise<{
    workDir: string;
    imagePaths: string[];
  }> {
    const baseTemp = path.resolve(this.config.ocr.tempDirectory);
    await mkdir(baseTemp, { recursive: true });

    const workDir = await mkdtemp(path.join(baseTemp, `ocr-${createUuid()}-`));

    try {
      const pdfPath = path.join(workDir, 'source.pdf');
      await writeFile(pdfPath, pdfBuffer);

      const outputPrefix = path.join(workDir, 'page');
      await execFileAsync(
        'pdftoppm',
        ['-png', '-r', String(this.config.ocr.pdfRasterDpi), pdfPath, outputPrefix],
        { timeout: this.config.ocr.timeoutMs },
      );

      const files = await readdir(workDir);
      const imagePaths = files
        .filter((name) => /^page-\d+\.png$/i.test(name) || /^page\d+\.png$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((name) => path.join(workDir, name));

      if (imagePaths.length === 0) {
        throw new Error('PDF conversion produced no pages (is pdftoppm installed?)');
      }

      this.logger.info('PDF converted to images', {
        pageCount: imagePaths.length,
        workDir,
        engine: 'pdftoppm',
      });

      return { workDir, imagePaths };
    } catch (error) {
      await this.cleanup(workDir);
      const message = error instanceof Error ? error.message : 'unknown';
      throw new Error(`PDF image conversion failed: ${message}`);
    }
  }

  /**
   * Writes an already-uploaded image buffer into a temp file for OCR.
   */
  public async materializeImageBuffer(
    buffer: Buffer,
    extension: '.png' | '.jpg' | '.jpeg',
  ): Promise<{ workDir: string; imagePaths: string[] }> {
    const baseTemp = path.resolve(this.config.ocr.tempDirectory);
    await mkdir(baseTemp, { recursive: true });
    const workDir = await mkdtemp(path.join(baseTemp, `ocr-img-${createUuid()}-`));
    const imagePath = path.join(workDir, `source${extension}`);
    await writeFile(imagePath, buffer);
    return { workDir, imagePaths: [imagePath] };
  }

  /**
   * Recursively deletes a temporary working directory (best-effort).
   */
  public async cleanup(workDir: string): Promise<void> {
    try {
      await rm(workDir, { recursive: true, force: true });
      this.logger.debug('OCR temp directory cleaned', { workDir });
    } catch (error) {
      this.logger.warn('Failed to clean OCR temp directory', {
        workDir,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  /**
   * Reads an image file as buffer.
   */
  public async readImage(imagePath: string): Promise<Buffer> {
    return readFile(imagePath);
  }
}
