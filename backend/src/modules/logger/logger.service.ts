import type { ConfigService } from '../config';
import { nowIso } from '../../common/utils/date';
import { formatJsonLog } from './formats/json.format';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogMetadata = Record<string, unknown>;

/**
 * Responsibility: Structured JSON logging to stdout/stderr.
 * Injectable into every service. Business code must never call console.log.
 */
export class LoggerService {
  public constructor(
    private readonly config: ConfigService,
    private readonly context = 'App',
  ) {}

  /**
   * Creates a child logger with a fixed context name (module or class).
   */
  public child(context: string): LoggerService {
    return new LoggerService(this.config, context);
  }

  /**
   * Logs at DEBUG level.
   */
  public debug(message: string, metadata: LogMetadata = {}): void {
    this.write('debug', message, metadata);
  }

  /**
   * Logs at INFO level.
   */
  public info(message: string, metadata: LogMetadata = {}): void {
    this.write('info', message, metadata);
  }

  /**
   * Logs at WARN level.
   */
  public warn(message: string, metadata: LogMetadata = {}): void {
    this.write('warn', message, metadata);
  }

  /**
   * Logs at ERROR level.
   */
  public error(message: string, metadata: LogMetadata = {}): void {
    this.write('error', message, metadata);
  }

  private write(level: LogLevel, message: string, metadata: LogMetadata): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.logLevel]) {
      return;
    }

    const entry = {
      timestamp: nowIso(),
      level: level.toUpperCase(),
      message,
      context: this.context,
      service: this.config.appName,
      ...metadata,
    };

    const line = `${formatJsonLog(entry)}\n`;

    if (level === 'error') {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }
}
