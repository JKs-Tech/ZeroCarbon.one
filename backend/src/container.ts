import { ConfigService } from './modules/config';
import { LoggerService } from './modules/logger';
import { DatabaseService } from './modules/database';
import { RedisService } from './modules/redis';
import { QueueService } from './modules/queue';
import { HealthService, HealthController } from './modules/health';
import { UsersRepository, UsersService, UsersController } from './modules/users';
import {
  AuthenticationService,
  AuthenticationController,
  JwtStrategy,
} from './modules/authentication';
import { StorageService } from './modules/storage';
import { DocumentsRepository, DocumentsService, DocumentsController } from './modules/documents';
import { UploadService, UploadController } from './modules/upload';
import { OcrService } from './modules/ocr';
import { AiService } from './modules/ai';
import { ValidationService } from './modules/validation';
import {
  AuditLogRepository,
  ReviewController,
  ReviewService,
} from './modules/review';
import { createAuthenticateMiddleware } from './common/middleware/authenticate.middleware';
import { createAuthorizeMiddleware } from './common/middleware/rbac.middleware';
import type { AuthenticateMiddleware } from './common/middleware/authenticate.middleware';
import type { AuthorizeMiddleware } from './common/middleware/rbac.middleware';

/**
 * Composition root — manual dependency injection container.
 * Creates and wires singleton services for the API process.
 */
export interface AppContainer {
  config: ConfigService;
  logger: LoggerService;
  database: DatabaseService;
  redis: RedisService;
  queue: QueueService;
  healthService: HealthService;
  healthController: HealthController;
  usersRepository: UsersRepository;
  usersService: UsersService;
  usersController: UsersController;
  jwtStrategy: JwtStrategy;
  authenticationService: AuthenticationService;
  authenticationController: AuthenticationController;
  authenticate: AuthenticateMiddleware;
  authorize: AuthorizeMiddleware;
  storageService: StorageService;
  documentsRepository: DocumentsRepository;
  documentsService: DocumentsService;
  documentsController: DocumentsController;
  uploadService: UploadService;
  uploadController: UploadController;
  ocrService: OcrService;
  aiService: AiService;
  validationService: ValidationService;
  auditLogRepository: AuditLogRepository;
  reviewService: ReviewService;
  reviewController: ReviewController;
}

/**
 * Loads configuration and constructs the application dependency graph.
 */
export function createContainer(): AppContainer {
  const config = ConfigService.load();
  const logger = new LoggerService(config, 'Bootstrap');
  const database = new DatabaseService(config, logger.child('Database'));
  const redis = new RedisService(config, logger.child('Redis'));
  const queue = new QueueService(config, logger.child('Queue'));
  const healthService = new HealthService(config, database, redis, queue);
  const healthController = new HealthController(healthService);

  const usersRepository = new UsersRepository();
  const usersService = new UsersService(usersRepository, config, logger.child('Users'));
  const usersController = new UsersController(usersService);

  const jwtStrategy = new JwtStrategy(config);
  const authenticationService = new AuthenticationService(
    usersService,
    jwtStrategy,
    logger.child('Authentication'),
    config.security.jwtExpiresIn,
  );
  const authenticationController = new AuthenticationController(authenticationService);

  const authenticate = createAuthenticateMiddleware(
    jwtStrategy,
    usersService,
    logger,
  );
  const authorize = createAuthorizeMiddleware(logger);

  const storageService = new StorageService(config, logger);
  const documentsRepository = new DocumentsRepository();
  const documentsService = new DocumentsService(
    documentsRepository,
    queue,
    logger.child('Documents'),
  );
  const documentsController = new DocumentsController(documentsService);
  const ocrService = new OcrService(config, logger.child('Ocr'));
  const aiService = new AiService(config, logger.child('Ai'));
  const validationService = new ValidationService(
    config,
    logger.child('Validation'),
    documentsRepository,
  );
  const auditLogRepository = new AuditLogRepository();
  const reviewService = new ReviewService(
    documentsRepository,
    auditLogRepository,
    logger.child('Review'),
  );
  const reviewController = new ReviewController(reviewService);
  const uploadService = new UploadService(
    storageService,
    documentsRepository,
    queue,
    logger.child('Upload'),
    config,
  );
  const uploadController = new UploadController(uploadService);

  return {
    config,
    logger,
    database,
    redis,
    queue,
    healthService,
    healthController,
    usersRepository,
    usersService,
    usersController,
    jwtStrategy,
    authenticationService,
    authenticationController,
    authenticate,
    authorize,
    storageService,
    documentsRepository,
    documentsService,
    documentsController,
    uploadService,
    uploadController,
    ocrService,
    aiService,
    validationService,
    auditLogRepository,
    reviewService,
    reviewController,
  };
}

/**
 * Connects infrastructure dependencies in order.
 */
export async function connectInfrastructure(container: AppContainer): Promise<void> {
  await container.database.connect();
  await container.redis.connect();
  await container.queue.initialize();
}

/**
 * Gracefully disconnects infrastructure in reverse order.
 */
export async function disconnectInfrastructure(container: AppContainer): Promise<void> {
  await container.queue.shutdown();
  await container.redis.disconnect();
  await container.database.disconnect();
}
