import type { Express, Request, Response } from 'express';

import { randomUUID } from 'crypto';

export type SSEClient = {
  id: string;
  res: Response;
};

const clients = new Map<string, SSEClient>();

export function setupSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');
}

export function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function broadcastSSE(event: string, data: unknown) {
  for (const client of clients.values()) {
    sendSSE(client.res, event, data);
  }
}

export function attachSseEndpoint(app: Express) {
  app.get('/sse', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Type', 'text/event-stream');

    const clientId = randomUUID();
    clients.set(clientId, { id: clientId, res });

    setupSSE(res);
    sendSSE(res, 'ping', { ts: Date.now() });

    const keepAlive = setInterval(() => {
      if (res.writableEnded) return;
      sendSSE(res, 'ping', { ts: Date.now() });
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(clientId);
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  });
}

