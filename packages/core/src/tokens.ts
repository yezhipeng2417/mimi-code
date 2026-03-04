import { createToken } from './container.js';
import type { EventBus } from './event-bus.js';
import type { MemoryMonitor, ResourceManager } from './resource-manager.js';

/**
 * DI tokens for core services.
 * Other packages import these tokens to resolve services from the container.
 */
export const Tokens = {
  EventBus: createToken<EventBus>('EventBus'),
  ResourceManager: createToken<ResourceManager>('ResourceManager'),
  MemoryMonitor: createToken<MemoryMonitor>('MemoryMonitor'),
} as const;
