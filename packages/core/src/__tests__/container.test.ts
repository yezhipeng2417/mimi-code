import { describe, it, expect } from 'vitest';
import { createToken, ServiceContainer } from '../container.js';

describe('createToken', () => {
  it('creates a token with a unique symbol id', () => {
    const token = createToken<string>('Test');
    expect(typeof token.id).toBe('symbol');
  });

  it('creates tokens with distinct ids', () => {
    const a = createToken<string>('A');
    const b = createToken<string>('B');
    expect(a.id).not.toBe(b.id);
  });
});

describe('ServiceContainer', () => {
  it('registers and resolves a value', () => {
    const container = new ServiceContainer();
    const token = createToken<string>('greeting');
    container.registerValue(token, 'hello');
    expect(container.resolve(token)).toBe('hello');
  });

  it('registers and resolves a factory (lazy singleton)', () => {
    const container = new ServiceContainer();
    const token = createToken<{ count: number }>('counter');
    let callCount = 0;
    container.register(token, () => {
      callCount++;
      return { count: callCount };
    });

    const first = container.resolve(token);
    const second = container.resolve(token);
    expect(first).toBe(second); // same instance
    expect(callCount).toBe(1); // factory called once
    expect(first.count).toBe(1);
  });

  it('throws for unregistered tokens', () => {
    const container = new ServiceContainer();
    const token = createToken<string>('missing');
    expect(() => container.resolve(token)).toThrow('No registration found');
  });

  it('has() returns true for registered, false otherwise', () => {
    const container = new ServiceContainer();
    const token = createToken<number>('num');
    expect(container.has(token)).toBe(false);
    container.registerValue(token, 42);
    expect(container.has(token)).toBe(true);
  });

  it('child container inherits from parent', () => {
    const parent = new ServiceContainer();
    const token = createToken<string>('shared');
    parent.registerValue(token, 'from-parent');

    const child = parent.createChild();
    expect(child.resolve(token)).toBe('from-parent');
  });

  it('child container can override parent registrations', () => {
    const parent = new ServiceContainer();
    const token = createToken<string>('val');
    parent.registerValue(token, 'parent');

    const child = parent.createChild();
    child.registerValue(token, 'child');
    expect(child.resolve(token)).toBe('child');
    expect(parent.resolve(token)).toBe('parent');
  });

  it('dispose cleans up singletons with dispose method', async () => {
    const container = new ServiceContainer();
    let disposed = false;
    const token = createToken<{ dispose: () => void }>('disposable');
    container.registerValue(token, {
      dispose: () => { disposed = true; },
    });

    await container.dispose();
    expect(disposed).toBe(true);
  });
});
