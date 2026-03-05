import { EventEmitter } from 'eventemitter3';

// Event map - defines all event types and their payloads
export interface EventMap {
  // Stream events
  'stream:start': { messageId: string };
  'stream:delta': { index: number; text: string };
  'stream:stop': { stopReason: string; usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number } };

  // Tool events
  'tool:start': { toolName: string; toolUseId: string; input: unknown };
  'tool:end': { toolName: string; toolUseId: string; result: unknown; durationMs: number };
  'tool:error': { toolName: string; error: Error };
  'tool:permission': { toolName: string; decision: string };

  // Agent loop events
  'agent:state_change': { from: string; to: string };
  'agent:turn_start': { turnIndex: number };
  'agent:turn_end': { turnIndex: number; tokenCount: number };

  // Compaction events
  'compaction:start': { messageCount: number; tokenCount: number };
  'compaction:end': { removedMessages: number; savedTokens: number; retainedAnchors?: number; newMessageCount?: number };
  'compaction:warning': { usage: number; threshold: number };

  // Session events
  'session:created': { sessionId: string };
  'session:resumed': { sessionId: string };
  'session:saved': { sessionId: string };

  // Resource events
  'resource:memory_warning': { usageMb: number; limitMb: number };
  'resource:cleanup': { type: string; count: number };

  // Cache metrics
  'cache:metrics': { hitRate: number; readTokens: number; creationTokens: number };

  // UI events
  'ui:render': { component: string };
  'ui:input': { type: string; value: string };

  // Hook events (generic)
  'hook:fired': { event: string; hookName: string };
  'hook:blocked': { event: string; hookName: string; reason: string };
}

export class EventBus {
  private emitter = new EventEmitter();

  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.emitter.emit(event, data);
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  listenerCount(event: keyof EventMap): number {
    return this.emitter.listenerCount(event);
  }

  dispose(): void {
    this.emitter.removeAllListeners();
  }
}
