import { Module } from '@nestjs/common';
import { GithubService } from './github.service.js';

@Module({
  providers: [GithubService],
})
export class GithubModule {}
