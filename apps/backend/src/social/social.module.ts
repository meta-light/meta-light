import { Module } from '@nestjs/common';
import { SocialService } from './social.service.js';

@Module({
  providers: [SocialService],
})
export class SocialModule {}
