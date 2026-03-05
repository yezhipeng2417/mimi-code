/**
 * SSE Transport — Connects to MCP servers over HTTP with Server-Sent Events.
 *
 * Protocol (MCP spec 2024-11-05):
 *   1. Client GETs the SSE endpoint → receives an event stream
 *   2. Server sends an `endpoint` event with the POST URL for requests
 *   3. Client POSTs JSON-RPC requests to that endpoint
 *   4. Server sends JSON-RPC responses as SSE `message` events
 */

import { EventEmitter } from 'node:events';
import type { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, McpTransport } from './transport.js';

export interface SseTransportOptions {
  /** SSE endpoint URL (e.g., http://localhost:3000/sse) */
  url: string;
  /** Optional authorization headers */
  headers?: Record<string, string>;
  /** Connection timeout in ms (default: 10000) */
  connectTimeout?: number;
  /** Request timeout in ms (default: 30000) */
  requestTimeout?: number;
}

export class SseTransport implements McpTransport {
  private options: SseTransportOptions;
  private postEndpoint: string | null = null;
  private abortController: AbortController | null = null;
  private pendingRequests = new Map<
    number | string,
    { resolve: (response: JsonRpcResponse) => void; reject: (error: Error) => void }
  >();
  private notificationHandlers: Array<(notification: JsonRpcNotification) => void> = [];
  private emitter = new EventEmitter();
  private connected = false;

  constructor(options: SseTransportOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    const connectTimeout = this.options.connectTimeout ?? 10_000;
    this.abortController = new AbortController();

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`SSE connection timeout after ${connectTimeout}ms`));
        this.abortController?.abort();
      }, connectTimeout);

      this.connectSse()
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.postEndpoint) {
      throw new Error('SSE transport not started or endpoint not received');
    }

    const requestTimeout = this.options.requestTimeout ?? 30_000;

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error(`MCP SSE request timed out: ${message.method}`));
        }
      }, requestTimeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.options.headers,
      };

      fetch(this.postEndpoint!, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: this.abortController?.signal,
      })
        .then((res) => {
          if (!res.ok) {
            clearTimeout(timer);
            this.pendingRequests.delete(message.id);
            reject(new Error(`MCP SSE POST failed: ${res.status} ${res.statusText}`));
          }
          // Response comes via SSE, not from the POST response body
        })
        .catch((err) => {
          clearTimeout(timer);
          this.pendingRequests.delete(message.id);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandlers.push(handler);
  }

  async close(): Promise<void> {
    this.connected = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Reject all pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('SSE transport closed'));
    }
    this.pendingRequests.clear();
  }

  onError(handler: (error: Error) => void): void {
    this.emitter.on('error', handler);
  }

  onClose(handler: () => void): void {
    this.emitter.on('close', handler);
  }

  // ── Private ─────────────────────────────────────────────────────────

  private async connectSse(): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      ...this.options.headers,
    };

    const response = await fetch(this.options.url, {
      headers,
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('SSE response has no body');
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Set up connected state — we resolve when we get the endpoint event
    const endpointPromise = new Promise<void>((resolve, reject) => {
      const endpointTimeout = setTimeout(() => {
        reject(new Error('Timed out waiting for SSE endpoint event'));
      }, 10_000);

      this.emitter.once('endpoint', () => {
        clearTimeout(endpointTimeout);
        resolve();
      });

      this.emitter.once('error', (err: Error) => {
        clearTimeout(endpointTimeout);
        reject(err);
      });
    });

    // Start reading the stream in background
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const events = this.parseSseEvents(buffer);
          buffer = events.remaining;

          for (const event of events.parsed) {
            this.handleSseEvent(event);
          }
        }
      } catch (err) {
        if (this.connected) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.emitter.emit('error', error);
        }
      } finally {
        this.connected = false;
        this.emitter.emit('close');
      }
    };

    // Start reading in background (don't await)
    readLoop();

    // Wait for the endpoint event
    await endpointPromise;
    this.connected = true;
  }

  private parseSseEvents(buffer: string): {
    parsed: Array<{ event?: string; data: string }>;
    remaining: string;
  } {
    const parsed: Array<{ event?: string; data: string }> = [];
    const lines = buffer.split('\n');
    let currentEvent: string | undefined;
    let currentData: string[] = [];
    let lastCompleteIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (line === '' || line === '\r') {
        // Empty line = event boundary
        if (currentData.length > 0) {
          parsed.push({
            event: currentEvent,
            data: currentData.join('\n'),
          });
          currentEvent = undefined;
          currentData = [];
        }
        lastCompleteIdx = i;
        continue;
      }

      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
        lastCompleteIdx = i;
      } else if (line.startsWith('data:')) {
        currentData.push(line.slice(5).trim());
        lastCompleteIdx = i;
      } else if (line.startsWith('id:') || line.startsWith('retry:')) {
        // Ignore id and retry fields
        lastCompleteIdx = i;
      }
    }

    // Keep incomplete data in buffer
    const remaining = lastCompleteIdx < lines.length - 1
      ? lines.slice(lastCompleteIdx + 1).join('\n')
      : '';

    return { parsed, remaining };
  }

  private handleSseEvent(event: { event?: string; data: string }): void {
    if (event.event === 'endpoint') {
      // Server is telling us where to POST requests
      // The data may be a relative or absolute URL
      const endpoint = event.data;
      if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        this.postEndpoint = endpoint;
      } else {
        // Relative URL — resolve against the SSE URL
        const base = new URL(this.options.url);
        this.postEndpoint = new URL(endpoint, base).toString();
      }
      this.emitter.emit('endpoint', this.postEndpoint);
      return;
    }

    // Default event type is 'message' — contains JSON-RPC
    if (!event.event || event.event === 'message') {
      try {
        const message = JSON.parse(event.data) as JsonRpcResponse | JsonRpcNotification;

        if ('id' in message && message.id !== undefined) {
          // Response to a pending request
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            pending.resolve(message as JsonRpcResponse);
          }
        } else {
          // Notification
          for (const handler of this.notificationHandlers) {
            handler(message as JsonRpcNotification);
          }
        }
      } catch {
        // Invalid JSON — skip
      }
    }
  }
}
