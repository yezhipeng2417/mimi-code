import { type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import type { EventBus } from './event-bus.js';

export class TempFileRegistry {
  private files = new Set<string>();
  private registered = false;

  track(path: string): void {
    this.files.add(path);
    if (!this.registered) {
      this.registerSignalHandlers();
      this.registered = true;
    }
  }

  untrack(path: string): void {
    this.files.delete(path);
  }

  get trackedCount(): number {
    return this.files.size;
  }

  async cleanupAll(): Promise<void> {
    for (const f of this.files) {
      try {
        await fsPromises.rm(f, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    this.files.clear();
  }

  private cleanupSync(): void {
    for (const f of this.files) {
      try {
        fs.rmSync(f, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  private registerSignalHandlers(): void {
    process.on('exit', () => this.cleanupSync());
  }
}

export class ChildProcessTracker {
  private processes = new Set<ChildProcess>();

  track(proc: ChildProcess): ChildProcess {
    this.processes.add(proc);
    proc.on('exit', () => this.processes.delete(proc));
    return proc;
  }

  async killAll(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    for (const proc of this.processes) {
      try {
        if (!proc.killed) {
          proc.kill(signal);
        }
      } catch {
        // ignore
      }
    }
    this.processes.clear();
  }

  get trackedCount(): number {
    return this.processes.size;
  }
}

export class BoundedCache<K, V> {
  private map = new Map<K, V>();
  private accessOrder: K[] = [];

  constructor(private maxSize: number) {}

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      // Update existing
      this.map.set(key, value);
      this.touchAccess(key);
      return;
    }
    if (this.map.size >= this.maxSize) {
      const evictKey = this.accessOrder.shift();
      if (evictKey !== undefined) {
        this.map.delete(evictKey);
      }
    }
    this.map.set(key, value);
    this.accessOrder.push(key);
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.touchAccess(key);
    }
    return value;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.map.size;
  }

  private touchAccess(key: K): void {
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: cache manager needs to hold any cache type
type AnyCache = { clear(): void };

class CacheManager {
  private caches = new Map<string, AnyCache>();

  register(name: string, cache: AnyCache): void {
    this.caches.set(name, cache);
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }
}

export class ResourceManager {
  private cleanups: (() => void | Promise<void>)[] = [];
  readonly tempFiles = new TempFileRegistry();
  readonly childProcesses = new ChildProcessTracker();
  private cacheManager = new CacheManager();

  onCleanup(fn: () => void | Promise<void>): void {
    this.cleanups.push(fn);
  }

  trackTempFile(path: string): string {
    this.tempFiles.track(path);
    return path;
  }

  trackProcess(proc: ChildProcess): ChildProcess {
    return this.childProcesses.track(proc);
  }

  createCache<K, V>(name: string, maxSize: number): BoundedCache<K, V> {
    const cache = new BoundedCache<K, V>(maxSize);
    this.cacheManager.register(name, cache);
    return cache;
  }

  async dispose(): Promise<void> {
    for (const fn of this.cleanups.reverse()) {
      try {
        await fn();
      } catch {
        // never throw during cleanup
      }
    }
    await this.tempFiles.cleanupAll();
    await this.childProcesses.killAll();
    this.cacheManager.clearAll();
    this.cleanups = [];
  }
}

export class MemoryMonitor {
  private intervalId?: ReturnType<typeof setInterval>;

  start(budgetMb: number, eventBus: EventBus): void {
    this.intervalId = setInterval(() => {
      const usage = process.memoryUsage();
      const heapMb = usage.heapUsed / 1024 / 1024;

      if (heapMb > budgetMb * 0.85) {
        eventBus.emit('resource:memory_warning', {
          usageMb: Math.round(heapMb * 100) / 100,
          limitMb: budgetMb,
        });
        if (global.gc) {
          global.gc();
        }
      }
    }, 30_000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
