import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../env.ts';

interface WSClient {
  ws: WebSocket;
  userId?: string;
  role?: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, WSClient>();

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    maxPayload: 1024 * 1024, // 1MB max message
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientId = crypto.randomUUID();
    const client: WSClient = {
      ws,
      subscriptions: new Set(),
    };

    // Token authentication
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        client.userId = decoded.sub;
        client.role = decoded.role;
      } catch {
        // Token invalid, continue as anonymous
      }
    }

    clients.set(clientId, client);

    // Send welcome message
    sendToClient(ws, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(clientId, client, message);
      } catch (error) {
        sendToClient(ws, {
          type: 'error',
          message: 'Invalid message format',
        });
      }
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(clientId);
    });

    ws.on('error', () => {
      clearInterval(heartbeat);
      clients.delete(clientId);
    });
  });

  return wss;
}

function handleMessage(clientId: string, client: WSClient, message: any) {
  switch (message.type) {
    case 'subscribe':
      if (message.channels && Array.isArray(message.channels)) {
        message.channels.forEach((channel: string) => {
          client.subscriptions.add(channel);
        });
        sendToClient(client.ws, {
          type: 'subscribed',
          channels: Array.from(client.subscriptions),
        });
      }
      break;

    case 'unsubscribe':
      if (message.channels && Array.isArray(message.channels)) {
        message.channels.forEach((channel: string) => {
          client.subscriptions.delete(channel);
        });
      }
      break;

    case 'ping':
      sendToClient(client.ws, { type: 'pong', timestamp: Date.now() });
      break;
  }
}

function sendToClient(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Broadcast to all clients subscribed to a channel
export function broadcast(channel: string, event: string, data: any) {
  const message = JSON.stringify({
    type: 'event',
    channel,
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients.values()) {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

// Send to specific user
export function sendToUser(userId: string, event: string, data: any) {
  const message = JSON.stringify({
    type: 'event',
    channel: 'user',
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients.values()) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

// Get connected client count
export function getClientCount(): number {
  return clients.size;
}

// Get active subscriptions
export function getActiveSubscriptions(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const client of clients.values()) {
    for (const channel of client.subscriptions) {
      counts[channel] = (counts[channel] || 0) + 1;
    }
  }
  return counts;
}
