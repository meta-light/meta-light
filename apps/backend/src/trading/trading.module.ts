import { Module } from '@nestjs/common';
import { TradingService } from './trading.service.js';

@Module({
  providers: [TradingService],
})
export class TradingModule {}
