import { EventEmitter } from 'events';
import { LogLevel, SystemLog } from '../../shared/types.js';
import { dbService } from '../database/db.js';

class SystemLogger extends EventEmitter {
  private logsMemory: SystemLog[] = [];
  private maxInMemory = 500;

  log(level: LogLevel, component: string, message: string, metadata?: Record<string, any>): SystemLog {
    const logItem: SystemLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      level,
      component,
      message,
      metadata,
    };

    this.logsMemory.unshift(logItem);
    if (this.logsMemory.length > this.maxInMemory) {
      this.logsMemory.pop();
    }

    try {
      dbService.saveLog(logItem);
    } catch (e) {
      // Fallback
    }

    this.emit('log', logItem);
    return logItem;
  }

  info(component: string, message: string, metadata?: Record<string, any>): SystemLog {
    return this.log('INFO', component, message, metadata);
  }

  warn(component: string, message: string, metadata?: Record<string, any>): SystemLog {
    return this.log('WARNING', component, message, metadata);
  }

  error(component: string, message: string, metadata?: Record<string, any>): SystemLog {
    return this.log('ERROR', component, message, metadata);
  }

  debug(component: string, message: string, metadata?: Record<string, any>): SystemLog {
    return this.log('DEBUG', component, message, metadata);
  }

  getLogs(limit = 200, levelFilter?: LogLevel, search?: string): SystemLog[] {
    let logs = this.logsMemory;
    if (logs.length === 0) {
      logs = dbService.getLogs(limit);
    }

    if (levelFilter) {
      logs = logs.filter((l) => l.level === levelFilter);
    }

    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.component.toLowerCase().includes(q)
      );
    }

    return logs.slice(0, limit);
  }
}

export const logger = new SystemLogger();
