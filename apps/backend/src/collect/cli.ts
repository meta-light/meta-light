import { restSql } from '../database/client';
import { ensureRecorder } from '../database/recorder';
import { runPaper } from '../trading/paper';
import { setStore, sqlStore } from '../trading/store';
import { DAILY_JOBS, FAST_JOBS, HOURLY_JOBS, type Job, runJobs } from './collectors';

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'all';
  const sql = restSql();
  await ensureRecorder(sql);
  if (cmd === 'paper') {
    setStore(sqlStore(sql));
    const report = await runPaper(sql, Date.now(), (m) => console.log(m));
    console.log(report ? JSON.stringify(report, null, 2) : 'No successful collector run yet; nothing to paper trade.');
    return;
  }
  const groups: Record<string, Record<string, Job>> = { fast: FAST_JOBS, hourly: HOURLY_JOBS, daily: DAILY_JOBS };
  const jobs = groups[cmd] ?? { ...FAST_JOBS, ...HOURLY_JOBS, ...DAILY_JOBS };
  for (const r of await runJobs(sql, jobs)) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.job.padEnd(20)} ${String(r.rows).padStart(5)} rows ${String(r.ms).padStart(6)}ms ${r.error ?? ''}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
