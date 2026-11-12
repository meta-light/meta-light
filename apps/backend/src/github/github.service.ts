import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import cron from 'node-cron';
import { enabled, load, runSafe } from '../common/run.js';

@Injectable()
export class GithubService implements OnModuleInit {
  private readonly logger = new Logger(GithubService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_GITHUB')) return;
    const { connectDatabase } = await load<{
      connectDatabase: () => Promise<void>;
    }>(import.meta.url, '../database/client.ts');
    const { initTelegram } = await load<{ initTelegram: () => Promise<void> }>(
      import.meta.url,
      '../utils/telegram/index.ts',
    );
    const { checkGitHubRepos } = await load<{
      checkGitHubRepos: () => Promise<unknown>;
    }>(import.meta.url, './index.ts');
    await connectDatabase();
    await initTelegram();
    cron.schedule(
      '*/30 9-16 * * *',
      () => runSafe('github', checkGitHubRepos),
      {
        timezone: 'America/Chicago',
      },
    );
    this.logger.log('GitHub service enabled');
  }
}
