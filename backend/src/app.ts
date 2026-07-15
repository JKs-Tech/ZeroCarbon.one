import express, { type Express } from 'express';
import type { AppContainer } from './container';
import {
  applySecurityMiddleware,
  createErrorHandler,
  createRequestLoggingMiddleware,
  notFoundHandler,
  requestIdMiddleware,
} from './common/middleware';
import { createHealthRouter } from './modules/health';
import { createV1Router } from './routes/v1';
import { ApiPath } from './common/constants';

/**
 * Builds and configures the Express application.
 * Pure setup — listening is handled by server.ts.
 */
export function createApp(container: AppContainer): Express {
  const app = express();
  const { config, logger, healthController } = container;

  applySecurityMiddleware(app, config);

  app.use(requestIdMiddleware);
  app.use(createRequestLoggingMiddleware(logger));

  app.use(
    express.json({
      limit: config.security.bodyJsonLimit,
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: config.security.bodyUrlencodedLimit,
    }),
  );

  app.use(ApiPath.HEALTH, createHealthRouter(healthController));
  app.use(ApiPath.V1, createV1Router(container));

  app.use(notFoundHandler);
  app.use(createErrorHandler(config, logger));

  return app;
}
