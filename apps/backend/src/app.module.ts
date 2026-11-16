import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaperController } from './paper/paper.controller';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    TelegramModule,
  ],
  controllers: [AppController, PaperController],
  providers: [AppService],
})
export class AppModule {}
