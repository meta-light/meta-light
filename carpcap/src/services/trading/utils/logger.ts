import { EventEmitter } from 'events';  // need to move this to /src/

export enum LogLevel {DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, CRITICAL = 4}
export interface LogEntry {timestamp: Date; level: LogLevel; category: string; message: string; data?: any; sessionId?: string; chain?: string; mode?: string;}
export interface LoggerConfig {minLevel: LogLevel; enableConsole: boolean; enableQueue: boolean; maxQueueSize: number; flushInterval: number; enableTimestamps: boolean; enableColors: boolean; categories?: string[];}

export class Logger extends EventEmitter {
  private static instance: Logger;
  private config: LoggerConfig;
  private logQueue: LogEntry[] = [];
  private isProcessing = false;
  private flushTimer?: NodeJS.Timeout;
  private sessionId?: string;
  private readonly levelNames = {[LogLevel.DEBUG]: 'DEBUG', [LogLevel.INFO]: 'INFO', [LogLevel.WARN]: 'WARN', [LogLevel.ERROR]: 'ERROR', [LogLevel.CRITICAL]: 'CRITICAL'};
  private readonly levelColors = {[LogLevel.DEBUG]: '\x1b[36m', [LogLevel.INFO]: '\x1b[32m', [LogLevel.WARN]: '\x1b[33m', [LogLevel.ERROR]: '\x1b[31m', [LogLevel.CRITICAL]: '\x1b[35m'};

  private constructor(config: Partial<LoggerConfig> = {}) {
    super();
    this.config = {minLevel: LogLevel.INFO, enableConsole: true, enableQueue: true, maxQueueSize: 1000, flushInterval: 100, enableTimestamps: false, enableColors: true, categories: [], ...config};
    if (this.config.enableQueue) {this.startFlushTimer();}
  }

  public static getInstance(config?: Partial<LoggerConfig>): Logger {if (!Logger.instance) {Logger.instance = new Logger(config);} return Logger.instance;}
  public setSessionId(sessionId: string): void {this.sessionId = sessionId;}

  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.enableQueue && !this.flushTimer) {this.startFlushTimer();} 
    else if (!this.config.enableQueue && this.flushTimer) {this.stopFlushTimer();}
  }

  public debug(category: string, message: string, data?: any, chain?: string, mode?: string): void {this.log(LogLevel.DEBUG, category, message, data, chain, mode);}
  public info(category: string, message: string, data?: any, chain?: string, mode?: string): void {this.log(LogLevel.INFO, category, message, data, chain, mode);}
  public warn(category: string, message: string, data?: any, chain?: string, mode?: string): void {this.log(LogLevel.WARN, category, message, data, chain, mode);}
  public error(category: string, message: string, data?: any, chain?: string, mode?: string): void {this.log(LogLevel.ERROR, category, message, data, chain, mode);}
  public critical(category: string, message: string, data?: any, chain?: string, mode?: string): void {this.log(LogLevel.CRITICAL, category, message, data, chain, mode);}
  public trading(message: string, data?: any, chain?: string, mode?: string): void {this.info('TRADING', message, data, chain, mode);}
  public price(message: string, data?: any, chain?: string, mode?: string): void {this.info('PRICE', message, data, chain, mode);}
  public signals(message: string, data?: any, chain?: string, mode?: string): void {this.info('SIGNALS', message, data, chain, mode);}
  public database(message: string, data?: any, chain?: string, mode?: string): void {this.info('DATABASE', message, data, chain, mode);}
  public discord(message: string, data?: any, chain?: string, mode?: string): void {this.info('DISCORD', message, data, chain, mode);}
  public jupiter(message: string, data?: any, chain?: string, mode?: string): void {this.info('JUPITER', message, data, chain, mode);}
  public deserialize(message: string, data?: any, chain?: string, mode?: string): void {this.info('DESERIALIZE', message, data, chain, mode);}
  public chain(message: string, data?: any, chain?: string, mode?: string): void {this.info('CHAIN', message, data, chain, mode);}
  public bot(message: string, data?: any, chain?: string, mode?: string): void {this.info('BOT', message, data, chain, mode);}

  private log(level: LogLevel, category: string, message: string, data?: any, chain?: string, mode?: string): void {
    if (level < this.config.minLevel) return;
    const logEntry: LogEntry = {timestamp: new Date(), level, category, message, data, sessionId: this.sessionId, chain, mode};
    this.emit('log', logEntry);
    if (this.config.enableQueue) {this.addToQueue(logEntry);}
    if (this.config.enableConsole) {this.outputToConsole(logEntry);}
  }

  private addToQueue(entry: LogEntry): void {this.logQueue.push(entry); if (this.logQueue.length > this.config.maxQueueSize) {this.logQueue.shift();}}

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) return;
    this.isProcessing = true;
    while (this.logQueue.length > 0) {const entry = this.logQueue.shift(); if (entry) {this.outputToConsole(entry); await new Promise(resolve => setTimeout(resolve, 1));}}
    this.isProcessing = false;
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = this.config.enableTimestamps ? `[${entry.timestamp.toISOString()}]` : '';
    const levelName = this.levelNames[entry.level];
    const levelColor = this.config.enableColors ? this.levelColors[entry.level] : '';
    const resetColor = this.config.enableColors ? '\x1b[0m' : '';
    const chainPrefix = entry.chain ? `[${entry.chain.toUpperCase()}]` : '';
    const modePrefix = entry.mode ? `[${entry.mode.toUpperCase()}]` : '';
    const sessionPrefix = entry.sessionId ? `[${entry.sessionId}]` : '';
    const prefix = [timestamp, levelColor, levelName, resetColor, chainPrefix, modePrefix, sessionPrefix, `[${entry.category}]`].filter(Boolean).join(' ');
    const mainMessage = `${prefix} ${entry.message}`;
    switch (entry.level) {
      case LogLevel.DEBUG: console.debug(mainMessage, entry.data || ''); break;
      case LogLevel.INFO: console.log(mainMessage, entry.data || ''); break;
      case LogLevel.WARN: console.warn(mainMessage, entry.data || ''); break;
      case LogLevel.ERROR: console.error(mainMessage, entry.data || ''); break;
      case LogLevel.CRITICAL: console.error(mainMessage, entry.data || ''); break;
    }
  }

  private startFlushTimer(): void {this.flushTimer = setInterval(() => {this.processQueue();}, this.config.flushInterval);}
  private stopFlushTimer(): void {if (this.flushTimer) {clearInterval(this.flushTimer); this.flushTimer = undefined;}}
  public getQueueSize(): number {return this.logQueue.length;}
  public getQueue(): LogEntry[] {return [...this.logQueue];}
  public clearQueue(): void {this.logQueue = [];}
  public async flush(): Promise<void> {await this.processQueue();}
  public destroy(): void {this.stopFlushTimer(); this.clearQueue(); this.removeAllListeners();}
}

export const logger = Logger.getInstance();

export const log = {
  debug: (category: string, message: string, data?: any, chain?: string, mode?: string) => logger.debug(category, message, data, chain, mode),
  info: (category: string, message: string, data?: any, chain?: string, mode?: string) => logger.info(category, message, data, chain, mode),
  warn: (category: string, message: string, data?: any, chain?: string, mode?: string) => logger.warn(category, message, data, chain, mode),
  error: (category: string, message: string, data?: any, chain?: string, mode?: string) => logger.error(category, message, data, chain, mode),
  critical: (category: string, message: string, data?: any, chain?: string, mode?: string) => logger.critical(category, message, data, chain, mode),
  trading: (message: string, data?: any, chain?: string, mode?: string) => logger.trading(message, data, chain, mode),
  price: (message: string, data?: any, chain?: string, mode?: string) => logger.price(message, data, chain, mode),
  signals: (message: string, data?: any, chain?: string, mode?: string) => logger.signals(message, data, chain, mode),
  database: (message: string, data?: any, chain?: string, mode?: string) => logger.database(message, data, chain, mode),
  discord: (message: string, data?: any, chain?: string, mode?: string) => logger.discord(message, data, chain, mode),
  jupiter: (message: string, data?: any, chain?: string, mode?: string) => logger.jupiter(message, data, chain, mode),
  deserialize: (message: string, data?: any, chain?: string, mode?: string) => logger.deserialize(message, data, chain, mode),
  chain: (message: string, data?: any, chain?: string, mode?: string) => logger.chain(message, data, chain, mode),
  bot: (message: string, data?: any, chain?: string, mode?: string) => logger.bot(message, data, chain, mode)
}; 