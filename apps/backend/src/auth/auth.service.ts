import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { enabled, load } from '../common/run.js';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  async onModuleInit() {
    if (!enabled('ENABLE_REMOTE_AUTH')) return;
    const { bootstrapRemoteAuth } = await load<{
      bootstrapRemoteAuth: () => Promise<void>;
    }>(import.meta.url, '../utils/ai/openai-oauth.ts');
    await bootstrapRemoteAuth();
    this.logger.log('Remote auth enabled');
  }
}
