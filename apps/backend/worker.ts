import { DurableObject } from 'cloudflare:workers';
import { DAILY_JOBS, FAST_JOBS, HOURLY_JOBS, runJobs } from './src/collect/collectors';
import { ensureRecorder } from './src/database/recorder';
import type { Sql } from './src/database/sql';

const PORT = 3000;
const SLEEP_AFTER_MS = 60_000;

interface Env {
  BACKEND: DurableObjectNamespace<BackendContainer>;
  DB: D1Database;
  [key: string]: unknown;
}

const FAST_CRON = '*/5 * * * *';
const HOURLY_CRON = '7 * * * *';
const PAPER_CRON = '30 12 * * *';
const DAILY_CRON = '0 14 * * *';
const CRON_JOBS = { [FAST_CRON]: FAST_JOBS, [HOURLY_CRON]: HOURLY_JOBS, [DAILY_CRON]: DAILY_JOBS };

function d1Sql(db: D1Database): Sql {
  return {
    async run(query, params = []) {
      await db.prepare(query).bind(...params).run();
    },
    async all<T>(query: string, params: unknown[] = []): Promise<T[]> {
      return (await db.prepare(query).bind(...params).all<T>()).results;
    },
  };
}

function containerEnv(env: Env): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') vars[key] = value;
  }
  vars.PORT = String(PORT);
  return vars;
}

export class BackendContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  async fetch(request: Request): Promise<Response> {
    this.starting ??= this.start().finally(() => {
      this.starting = undefined;
    });
    await this.starting;
    const url = new URL(request.url);
    url.protocol = 'http:';
    url.host = 'container';
    const forwarded = new Request(url, request);
    forwarded.headers.delete('host');
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private async start(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: 'lite',
        enableInternet: true,
        env: containerEnv(this.env),
      });
    }
    await container.setInactivityTimeout(SLEEP_AFTER_MS);
    const port = container.getTcpPort(PORT);
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await port.fetch('http://container/', {
          signal: AbortSignal.timeout(1000),
        });
        await response.body?.cancel();
        if (response.ok) return;
      } catch {
        // Nest is still booting.
      }
      await scheduler.wait(200);
    }
    throw new Error('Backend container did not become ready');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/internal/')) return new Response('Not found', { status: 404 });
    return env.BACKEND.getByName('backend').fetch(request);
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === PAPER_CRON) {
      const res = await env.BACKEND.getByName('backend').fetch('http://container/internal/paper', { method: 'POST' });
      const body = await res.text();
      console.log(`paper ${res.status}: ${body.slice(0, 2000)}`);
      if (!res.ok) throw new Error(`paper run failed: ${res.status}`);
      return;
    }
    const sql = d1Sql(env.DB);
    await ensureRecorder(sql);
    const jobs = CRON_JOBS[controller.cron] ?? {};
    const results = await runJobs(sql, jobs, controller.scheduledTime);
    for (const r of results) console.log(`${r.ok ? 'ok' : 'FAIL'} ${r.job} ${r.rows} rows ${r.ms}ms ${r.error ?? ''}`);
  },
};
