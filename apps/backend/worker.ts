import { DurableObject } from 'cloudflare:workers';

const PORT = 3000;
const SLEEP_AFTER_MS = 60_000;

interface Env {
  BACKEND: DurableObjectNamespace<BackendContainer>;
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
        env: { PORT: String(PORT) },
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
    return env.BACKEND.getByName('backend').fetch(request);
  },
};
