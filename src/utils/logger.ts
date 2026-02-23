import { Logger } from '../types';

export class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(prefix: string = 'BrowserAgent') {
    this.prefix = prefix;
  }

  spawn(subPrefix: string): ConsoleLogger {
    return new ConsoleLogger(`${this.prefix}:${subPrefix}`);
  }

  info(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] [INFO] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}] [ERROR] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}] [WARN] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.prefix}] [DEBUG] ${message}`, ...args);
  }

  success(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] [SUCCESS] ✅ ${message}`, ...args);
  }
}
