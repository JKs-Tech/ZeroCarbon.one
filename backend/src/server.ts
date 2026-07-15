import type { Server } from 'http';
import { createApp } from './app';
import {
  connectInfrastructure,
  createContainer,
  disconnectInfrastructure,
  type AppContainer,
} from './container';

/**
 * API process entrypoint.
 * Boots config → infrastructure → HTTP server → graceful shutdown hooks.
 */
async function bootstrap(): Promise<void> {
  const container = createContainer();
  const { config, logger } = container;

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception — process will exit', {
      message: error.message,
      stack: config.isProduction ? undefined : error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection — process will exit', {
      reason:
        reason instanceof Error
          ? { message: reason.message, stack: config.isProduction ? undefined : reason.stack }
          : reason,
    });
    process.exit(1);
  });

  await connectInfrastructure(container);

  const app = createApp(container);
  const server = app.listen(config.port, () => {
    logger.info('API server started', {
      port: config.port,
      env: config.env,
      version: config.appVersion,
    });
  });

  registerGracefulShutdown(server, container);
}

/**
 * Handles SIGTERM/SIGINT with drained connections and infrastructure teardown.
 */
function registerGracefulShutdown(server: Server, container: AppContainer): void {
  const { config, logger } = container;
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('Graceful shutdown started', { signal });

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, config.shutdownTimeoutMs);

    forceExitTimer.unref();

    server.close(async (closeError) => {
      if (closeError) {
        logger.error('Error while closing HTTP server', {
          message: closeError.message,
        });
      }

      try {
        await disconnectInfrastructure(container);
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during infrastructure shutdown', {
          message: error instanceof Error ? error.message : 'unknown',
        });
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

bootstrap().catch((error: unknown) => {
  // Config/logger may have failed — last-resort stderr before exit.
  const message = error instanceof Error ? error.message : 'Bootstrap failed';
  process.stderr.write(`${JSON.stringify({ level: 'ERROR', message })}\n`);
  process.exit(1);
});
