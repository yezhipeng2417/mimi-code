/**
 * UsageTracker — Accumulates token usage and costs from streaming events.
 *
 * Listens to `stream:stop` events, computes per-model costs,
 * and emits cumulative `usage:update` events for the UI.
 */

import type { EventBus } from './event-bus.js';

export interface ModelPricing {
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  cachedInputPricePerMToken: number;
}

/** Default pricing table (per million tokens). */
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': { inputPricePerMToken: 15, outputPricePerMToken: 75, cachedInputPricePerMToken: 1.875 },
  'claude-sonnet-4-6': { inputPricePerMToken: 3, outputPricePerMToken: 15, cachedInputPricePerMToken: 0.375 },
  'claude-haiku-4-5-20251001': { inputPricePerMToken: 0.8, outputPricePerMToken: 4, cachedInputPricePerMToken: 0.1 },
};

export class UsageTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCacheReadTokens = 0;
  private totalCacheCreationTokens = 0;
  private totalCostUsd = 0;
  private pricing: ModelPricing;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, model: string, customPricing?: ModelPricing) {
    this.eventBus = eventBus;
    this.pricing = customPricing ?? DEFAULT_PRICING[model] ?? DEFAULT_PRICING['claude-sonnet-4-6']!;

    this.eventBus.on('stream:stop', (data) => {
      if (!data.usage) return;

      const { inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens } = data.usage;

      this.totalInputTokens += inputTokens;
      this.totalOutputTokens += outputTokens;
      this.totalCacheReadTokens += cacheReadInputTokens ?? 0;
      this.totalCacheCreationTokens += cacheCreationInputTokens ?? 0;

      // Compute cost for this turn
      const cachedTokens = cacheReadInputTokens ?? 0;
      const uncachedInputTokens = Math.max(0, inputTokens - cachedTokens);
      const turnCost =
        (uncachedInputTokens / 1_000_000) * this.pricing.inputPricePerMToken +
        (cachedTokens / 1_000_000) * this.pricing.cachedInputPricePerMToken +
        (outputTokens / 1_000_000) * this.pricing.outputPricePerMToken;

      this.totalCostUsd += turnCost;

      // Compute overall cache hit rate
      const totalCacheTokens = this.totalCacheReadTokens + this.totalCacheCreationTokens;
      const cacheHitRate = totalCacheTokens > 0
        ? this.totalCacheReadTokens / totalCacheTokens
        : 0;

      this.eventBus.emit('usage:update', {
        totalInputTokens: this.totalInputTokens,
        totalOutputTokens: this.totalOutputTokens,
        totalCostUsd: this.totalCostUsd,
        cacheHitRate,
      });
    });
  }

  get snapshot() {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCostUsd: this.totalCostUsd,
      totalCacheReadTokens: this.totalCacheReadTokens,
      totalCacheCreationTokens: this.totalCacheCreationTokens,
    };
  }
}
