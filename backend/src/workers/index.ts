import {
  connectInfrastructure,
  createContainer,
  disconnectInfrastructure,
  type AppContainer,
} from '../container';
import { DocumentProcessingWorker } from '../modules/queue';
import { PdfSplitService } from '../modules/upload';

/**
 * Worker process entrypoint (Architecture: API ≠ Worker).
 *
 * Boots Mongo + Redis + Queue producer health, then starts DocumentProcessingWorker.
 * Phase 9: Worker runs OCR → AI → Validation, then sets WAITING_FOR_REVIEW and stops.
 * Edit/Approve are manual via HTTP APIs.
 *
 * Scale-out: run multiple worker processes against the same Redis queue.
 */
async function bootstrapWorker(): Promise<void> {
  const container = createContainer();
  const { config, logger } = container;
  const workerLogger = logger.child('WorkerProcess');

  process.on('uncaughtException', (error: Error) => {
    workerLogger.error('Uncaught exception in worker — process will exit', {
      message: error.message,
      stack: config.isProduction ? undefined : error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    workerLogger.error('Unhandled rejection in worker — process will exit', {
      reason:
        reason instanceof Error
          ? { message: reason.message, stack: config.isProduction ? undefined : reason.stack }
          : reason,
    });
    process.exit(1);
  });

  await connectInfrastructure(container);

  const pdfSplitService = new PdfSplitService(
    container.storageService,
    container.documentsRepository,
    container.queue,
    workerLogger,
    config,
  );

  const processingWorker = new DocumentProcessingWorker(
    config,
    logger.child('DocumentProcessingWorker'),
    container.documentsRepository,
    container.storageService,
    container.ocrService,
    container.aiService,
    container.validationService,
    pdfSplitService,
  );

  processingWorker.start();
  container.queue.setRegisteredWorkerCount(1);

  workerLogger.info('Worker process started', {
    queue: 'DocumentProcessingQueue',
    concurrency: config.queue.concurrency,
    maxAttempts: config.queue.maxAttempts,
    lockDurationMs: config.queue.lockDurationMs,
    maxStalledCount: config.queue.maxStalledCount,
  });

  registerGracefulShutdown(container, processingWorker, workerLogger);
}

function registerGracefulShutdown(
  container: AppContainer,
  processingWorker: DocumentProcessingWorker,
  logger: AppContainer['logger'],
): void {
  const { config } = container;
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('Worker graceful shutdown started', { signal });

    const forceExitTimer = setTimeout(() => {
      logger.error('Worker graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, config.shutdownTimeoutMs);

    forceExitTimer.unref();

    try {
      // Stop accepting new jobs; finish in-flight work inside BullMQ close.
      await processingWorker.stop();
      container.queue.setRegisteredWorkerCount(0);
      await disconnectInfrastructure(container);
      logger.info('Worker graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Worker shutdown error', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

bootstrapWorker().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Worker bootstrap failed';
  process.stderr.write(`${JSON.stringify({ level: 'ERROR', message })}\n`);
  process.exit(1);
});
