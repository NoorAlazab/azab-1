/**
 * Structured logging utility for QA CaseForge
 * Replaces console.log with proper logging that can be configured per environment
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    // In production, only log warn and error by default
    this.minLevel = this.isProduction ? 'warn' : 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;

    if (this.isProduction) {
      // JSON format for production (easier to parse in log aggregators)
      return JSON.stringify(entry);
    } else {
      // Human-readable format for development
      const parts = [`[${timestamp}]`, `[${level.toUpperCase()}]`, message];

      if (context && Object.keys(context).length > 0) {
        parts.push(JSON.stringify(context, null, 2));
      }

      if (error) {
        parts.push(`Error: ${error.message}`);
        if (error.stack) {
          parts.push(error.stack);
        }
      }

      return parts.join(' ');
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    const formatted = this.formatEntry(entry);

    // Output to appropriate console method
    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext) {
    if (errorOrContext instanceof Error) {
      this.log('error', message, context, errorOrContext);
    } else {
      this.log('error', message, errorOrContext);
    }
  }

  // Specialized methods for common patterns
  apiRequest(method: string, path: string, context?: LogContext) {
    this.info(`API ${method} ${path}`, context);
  }

  apiError(method: string, path: string, error: Error, context?: LogContext) {
    this.error(`API ${method} ${path} failed`, error, context);
  }

  dbQuery(operation: string, model: string, context?: LogContext) {
    this.debug(`DB ${operation} ${model}`, context);
  }

  authEvent(event: string, userId?: string, context?: LogContext) {
    this.info(`Auth: ${event}`, { ...context, userId });
  }

  aiRequest(provider: string, model: string, context?: LogContext) {
    this.info(`AI request to ${provider}/${model}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type-safe logging functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) =>
    logger.error(message, errorOrContext, context),

  // Convenience methods
  api: {
    request: (method: string, path: string, context?: LogContext) =>
      logger.apiRequest(method, path, context),
    error: (method: string, path: string, error: Error, context?: LogContext) =>
      logger.apiError(method, path, error, context),
  },
  db: (operation: string, model: string, context?: LogContext) =>
    logger.dbQuery(operation, model, context),
  auth: (event: string, userId?: string, context?: LogContext) =>
    logger.authEvent(event, userId, context),
  ai: (provider: string, model: string, context?: LogContext) =>
    logger.aiRequest(provider, model, context),
};
