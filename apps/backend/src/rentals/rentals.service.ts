import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import cron from 'node-cron';
import { enabled, load, runSafe } from '../common/run.js';

@Injectable()
export class RentalsService implements OnModuleInit {
  private readonly logger = new Logger(RentalsService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_RENTALS')) return;
    const { connectDatabase } = await load<{
      connectDatabase: () => Promise<void>;
    }>(import.meta.url, '../database/client.ts');
    const { initTelegram } = await load<{ initTelegram: () => Promise<void> }>(
      import.meta.url,
      '../utils/telegram/index.ts',
    );
    const { runRentalsNotificationTask } = await load<{
      runRentalsNotificationTask: () => Promise<unknown>;
    }>(import.meta.url, './index.ts');
    await connectDatabase();
    await initTelegram();
    cron.schedule(
      '0 7,19 * * *',
      () => runSafe('rentals', runRentalsNotificationTask),
      {
        timezone: 'America/New_York',
      },
    );
    this.logger.log('Rentals service enabled');
  }
}
