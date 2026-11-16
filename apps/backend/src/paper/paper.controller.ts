import { Controller, HttpCode, Post } from '@nestjs/common';
import { restSql } from '../database/client';
import { ensureRecorder } from '../database/recorder';
import { runPaper } from '../trading/paper';
import { setStore, sqlStore } from '../trading/store';

@Controller('internal')
export class PaperController {
  private running: Promise<unknown> | null = null;

  @Post('paper')
  @HttpCode(200)
  async paper(): Promise<unknown> {
    this.running ??= (async () => {
      const sql = restSql();
      await ensureRecorder(sql);
      setStore(sqlStore(sql));
      return runPaper(sql, Date.now(), (m) => console.log(m));
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
}
