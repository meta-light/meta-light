import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { GithubModule } from './github/github.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { RentalsModule } from './rentals/rentals.module.js';
import { SocialModule } from './social/social.module.js';
import { TelegramModule } from './telegram/telegram.module.js';
import { TradingModule } from './trading/trading.module.js';

@Module({
  imports: [
    AuthModule,
    GithubModule,
    PortfolioModule,
    RentalsModule,
    SocialModule,
    TelegramModule,
    TradingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
