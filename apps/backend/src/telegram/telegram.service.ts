import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { enabled, load } from '../common/run.js';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_TELEGRAM')) return;
    const { initTelegram } = await load<{ initTelegram: () => Promise<void> }>(
      import.meta.url,
      '../utils/telegram/index.ts',
    );
    await initTelegram();
    this.logger.log('Telegram service enabled');
  }
}
