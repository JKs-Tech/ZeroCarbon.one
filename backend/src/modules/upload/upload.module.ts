/**
 * Upload module wiring (Express composition equivalent of upload.module.ts).
 */
export { UploadService } from './upload.service';
export { UploadController } from './upload.controller';
export { createUploadRouter } from './upload.routes';
export { FileValidator } from './validators/file.validator';
export { UploadField } from './dto/upload-file.dto';
