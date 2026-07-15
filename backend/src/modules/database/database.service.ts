import mongoose from 'mongoose';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';

/**
 * Responsibility: Manage the singleton Mongoose connection lifecycle.
 * No schemas in Phase 2 — connection and health only.
 */
export class DatabaseService {
  private isConnecting = false;

  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Establishes the MongoDB connection with reconnect behavior.
   */
  public async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const { uri, dbName } = this.config.mongo;

    try {
      mongoose.set('strictQuery', true);

      mongoose.connection.on('connected', () => {
        this.logger.info('MongoDB connected', { dbName });
      });

      mongoose.connection.on('disconnected', () => {
        this.logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        this.logger.info('MongoDB reconnected');
      });

      mongoose.connection.on('error', (error: Error) => {
        this.logger.error('MongoDB connection error', {
          error: error.message,
        });
      });

      await mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: this.config.health.mongoTimeoutMs,
        maxPoolSize: 20,
        minPoolSize: 2,
        retryWrites: true,
      });
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Gracefully closes the MongoDB connection.
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected() && mongoose.connection.readyState === 0) {
      return;
    }

    await mongoose.connection.close();
    this.logger.info('MongoDB connection closed');
  }

  /**
   * Returns true when Mongoose reports a ready connection.
   */
  public isConnected(): boolean {
    // 1 = connected
    return mongoose.connection.readyState === 1;
  }

  /**
   * Lightweight ping for health checks.
   */
  public async ping(): Promise<boolean> {
    if (!this.isConnected() || !mongoose.connection.db) {
      return false;
    }

    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      this.logger.warn('MongoDB ping failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }
}
