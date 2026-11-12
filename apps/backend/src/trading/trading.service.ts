import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { enabled, load } from '../common/run.js';

@Injectable()
export class TradingService implements OnModuleInit {
  private readonly logger = new Logger(TradingService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_TRADING')) return;
    const { connectDatabase } = await load<{
      connectDatabase: () => Promise<void>;
    }>(import.meta.url, '../database/client.ts');
    const { initTelegram } = await load<{ initTelegram: () => Promise<void> }>(
      import.meta.url,
      '../utils/telegram/index.ts',
    );
    const { startTradingBot } = await load<{
      startTradingBot: () => Promise<void>;
    }>(import.meta.url, './index.ts');
    await connectDatabase();
    await initTelegram();
    await startTradingBot();
    this.logger.log('Trading service enabled');
  }
}
