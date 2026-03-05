import { describe, it, expect } from 'vitest';
import { EventBus } from '../event-bus.js';
import { UsageTracker } from '../usage-tracker.js';

describe('UsageTracker', () => {
  function createTracker(model = 'claude-sonnet-4-6') {
    const eventBus = new EventBus();
    const tracker = new UsageTracker(eventBus, model);
    return { eventBus, tracker };
  }

  it('should accumulate token counts from stream:stop events', () => {
    const { eventBus, tracker } = createTracker();

    eventBus.emit('stream:stop', {
      stopReason: 'end_turn',
      usage: { inputTokens: 1000, outputTokens: 500 },
    });

    expect(tracker.snapshot.totalInputTokens).toBe(1000);
    expect(tracker.snapshot.totalOutputTokens).toBe(500);
  });

  it('should accumulate across multiple events', () => {
    const { eventBus, tracker } = createTracker();

    eventBus.emit('stream:stop', {
      stopReason: 'end_turn',
      usage: { inputTokens: 1000, outputTokens: 200 },
    });
    eventBus.emit('stream:stop', {
      stopReason: 'tool_use',
      usage: { inputTokens: 1500, outputTokens: 300 },
    });

    expect(tracker.snapshot.totalInputTokens).toBe(2500);
    expect(tracker.snapshot.totalOutputTokens).toBe(500);
  });

  it('should compute cost based on model pricing', () => {
    const { eventBus, tracker } = createTracker('claude-sonnet-4-6');
    // Sonnet: $3/M input, $15/M output

    eventBus.emit('stream:stop', {
      stopReason: 'end_turn',
      usage: { inputTokens: 1_000_000, outputTokens: 100_000 },
    });

    // Cost = (1M * $3/M) + (100k * $15/M) = $3 + $1.5 = $4.5
    expect(tracker.snapshot.totalCostUsd).toBeCloseTo(4.5, 2);
  });

  it('should account for cache savings in cost', () => {
    const { eventBus, tracker } = createTracker('claude-sonnet-4-6');
    // Sonnet: $3/M input, $0.375/M cached, $15/M output

    eventBus.emit('stream:stop', {
      stopReason: 'end_turn',
      usage: {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheReadInputTokens: 800_000,
        cacheCreationInputTokens: 0,
      },
    });

    // Uncached: 200k input * $3/M = $0.6
    // Cached: 800k * $0.375/M = $0.3
    // Output: 100k * $15/M = $1.5
    // Total: $2.4
    expect(tracker.snapshot.totalCostUsd).toBeCloseTo(2.4, 2);
  });

  it('should emit usage:update event', () => {
    const { eventBus } = createTracker();
    let emitted: unknown = null;

    eventBus.on('usage:update', (data) => { emitted = data; });

    eventBus.emit('stream:stop', {
      stopReason: 'end_turn',
      usage: { inputTokens: 500, outputTokens: 100 },
    });

    expect(emitted).not.toBeNull();
    expect((emitted as { totalInputTokens: number }).totalInputTokens).toBe(500);
  });

  it('should ignore stream:stop without usage data', () => {
    const { eventBus, tracker } = createTracker();

    eventBus.emit('stream:stop', { stopReason: 'end_turn' });

    expect(tracker.snapshot.totalInputTokens).toBe(0);
    expect(tracker.snapshot.totalCostUsd).toBe(0);
  });

  it('should use custom pricing when provided', () => {
    const eventBus = new EventBus();
    const tracker = new UsageTracker(eventBus, 'custom-model', {
      inputPricePerMToken: 10,
      outputPricePerMToken: 30,
      cachedInputPricePerMToken: 1,
    });

    eventBus.emit('stream:stop', {
      stopReason: 'end_turn',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    });

    // Cost = $10 + $30 = $40
    expect(tracker.snapshot.totalCostUsd).toBeCloseTo(40, 2);
  });
});
