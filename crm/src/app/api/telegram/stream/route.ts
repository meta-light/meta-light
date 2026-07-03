import { NextResponse } from 'next/server';
import { registerSseClient, getClient } from '@/lib/telegram/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Ensure client is connected
  try {
    await getClient();
  } catch {}

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(`data: ${data}\n\n`);
      };

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      const unregister = registerSseClient(send);

      // Clean up on disconnect
      const cleanup = () => {
        clearInterval(heartbeat);
        unregister();
      };

      // Store cleanup on controller for cancel
      (controller as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel() {
      (this as { _cleanup?: () => void })._cleanup?.();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
