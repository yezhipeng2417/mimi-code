import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus.js';

describe('EventBus', () => {
  it('emits and receives events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('stream:delta', handler);
    bus.emit('stream:delta', { index: 0, text: 'hello' });
    expect(handler).toHaveBeenCalledWith({ index: 0, text: 'hello' });
  });

  it('supports multiple listeners', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('stream:start', a);
    bus.on('stream:start', b);
    bus.emit('stream:start', { messageId: 'msg_1' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('removes a listener with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('stream:stop', handler);
    bus.off('stream:stop', handler);
    bus.emit('stream:stop', { stopReason: 'end_turn' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires only once', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('agent:state_change', handler);
    bus.emit('agent:state_change', { from: 'IDLE', to: 'STREAMING' });
    bus.emit('agent:state_change', { from: 'STREAMING', to: 'IDLE' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispose removes all listeners', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('stream:delta', handler);
    bus.dispose();
    bus.emit('stream:delta', { index: 0, text: 'test' });
    expect(handler).not.toHaveBeenCalled();
  });
});
