import { Module } from '@nestjs/common';
import { RentalsService } from './rentals.service.js';

@Module({
  providers: [RentalsService],
})
export class RentalsModule {}
