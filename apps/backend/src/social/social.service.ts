import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import cron from 'node-cron';
import { enabled, load, runSafe } from '../common/run.js';

@Injectable()
export class SocialService implements OnModuleInit {
  private readonly logger = new Logger(SocialService.name);

  async onModuleInit() {
    const tweets = enabled('ENABLE_TWEETS');
    const social = enabled('ENABLE_SOCIAL');
    if (!tweets && !social) return;
    const { connectDatabase } = await load<{
      connectDatabase: () => Promise<void>;
    }>(import.meta.url, '../database/client.ts');
    const { initTelegram } = await load<{ initTelegram: () => Promise<void> }>(
      import.meta.url,
      '../utils/telegram/index.ts',
    );
    await connectDatabase();
    await initTelegram();
    if (tweets) {
      const { ingest0xMetaLightTweets } = await load<{
        ingest0xMetaLightTweets: () => Promise<void>;
      }>(import.meta.url, './utils.ts');
      cron.schedule(
        '0 */4 * * *',
        () => runSafe('tweets', ingest0xMetaLightTweets),
        {
          timezone: 'America/Chicago',
        },
      );
    }
    if (social) {
      const { runSocialV2 } = await load<{ runSocialV2: () => Promise<void> }>(
        import.meta.url,
        './index.ts',
      );
      cron.schedule('0 9 * * *', () => runSafe('social', runSocialV2), {
        timezone: 'America/Chicago',
      });
    }
    this.logger.log('Social service enabled');
  }
}
