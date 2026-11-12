import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service.js';

@Module({
  providers: [TelegramService],
})
export class TelegramModule {}
