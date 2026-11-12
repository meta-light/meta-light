import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import cron from 'node-cron';
import { enabled, load, runSafe } from '../common/run.js';

@Injectable()
export class PortfolioService implements OnModuleInit {
  private readonly logger = new Logger(PortfolioService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_PORTFOLIO')) return;
    const { connectDatabase } = await load<{
      connectDatabase: () => Promise<void>;
    }>(import.meta.url, '../database/client.ts');
    const { initTelegram } = await load<{ initTelegram: () => Promise<void> }>(
      import.meta.url,
      '../utils/telegram/index.ts',
    );
    const { seedWallets, runPortfolioTask } = await load<{
      seedWallets: () => Promise<void>;
      runPortfolioTask: () => Promise<void>;
    }>(import.meta.url, './index.ts');
    await connectDatabase();
    await initTelegram();
    await seedWallets();
    await runPortfolioTask();
    cron.schedule('0 8 * * *', () => runSafe('portfolio', runPortfolioTask), {
      timezone: 'America/Chicago',
    });
    this.logger.log('Portfolio service enabled');
  }
}
