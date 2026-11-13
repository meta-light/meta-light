import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { enabled } from '../env';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_TELEGRAM')) return;
    const { initTelegram } = await import('@meta-light/utils/telegram');
    await initTelegram();
    this.logger.log('Telegram service enabled');
  }
}
