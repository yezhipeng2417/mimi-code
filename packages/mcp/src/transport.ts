/**
 * MCP Transport — Handles communication with MCP servers.
 *
 * Supports stdio and SSE transports per the MCP specification.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * JSON-RPC 2.0 message types.
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * Transport interface for MCP communication.
 */
export interface McpTransport {
  start(): Promise<void>;
  send(message: JsonRpcRequest): Promise<JsonRpcResponse>;
  onNotification(handler: (notification: JsonRpcNotification) => void): void;
  close(): Promise<void>;
}

/**
 * Stdio transport — communicates via stdin/stdout of a child process.
 */
export class StdioTransport implements McpTransport {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<number | string, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();
  private notificationHandlers: Array<(notification: JsonRpcNotification) => void> = [];
  private buffer = '';
  private emitter = new EventEmitter();

  constructor(
    private command: string,
    private args: string[] = [],
    private env?: Record<string, string>,
  ) {}

  async start(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emitter.emit('stderr', data.toString());
    });

    this.process.on('close', (code) => {
      this.emitter.emit('close', code);
      // Reject all pending requests
      for (const [, { reject }] of this.pendingRequests) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });

    this.process.on('error', (error) => {
      this.emitter.emit('error', error);
    });

    // Wait for process to be ready (short delay)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 1000);
      this.process?.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.process?.stdin) {
      throw new Error('MCP transport not started');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });

      const json = JSON.stringify(message);
      const frame = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;

      this.process!.stdin!.write(frame, (err) => {
        if (err) {
          this.pendingRequests.delete(message.id);
          reject(err);
        }
      });

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error(`MCP request timed out: ${message.method}`));
        }
      }, 30_000);
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      // Wait a bit, then force kill
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
        this.process?.on('close', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      this.process = null;
    }
  }

  onStderr(handler: (data: string) => void): void {
    this.emitter.on('stderr', handler);
  }

  onClose(handler: (code: number | null) => void): void {
    this.emitter.on('close', handler);
  }

  // ── Private ─────────────────────────────────────────────────────────

  private processBuffer(): void {
    // Parse Content-Length framed messages
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        // Try line-delimited JSON as fallback
        const lineEnd = this.buffer.indexOf('\n');
        if (lineEnd === -1) break;
        const line = this.buffer.slice(0, lineEnd).trim();
        this.buffer = this.buffer.slice(lineEnd + 1);
        if (line) this.handleMessage(line);
        continue;
      }

      const contentLength = parseInt(match[1]!, 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) break; // Not enough data yet

      const messageStr = this.buffer.slice(messageStart, messageEnd);
      this.buffer = this.buffer.slice(messageEnd);

      this.handleMessage(messageStr);
    }
  }

  private handleMessage(messageStr: string): void {
    try {
      const message = JSON.parse(messageStr) as JsonRpcResponse | JsonRpcNotification;

      if ('id' in message && message.id !== undefined) {
        // Response
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
