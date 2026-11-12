import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service.js';

@Module({
  providers: [PortfolioService],
})
export class PortfolioModule {}
