import { describe, it, expect } from 'vitest';
import { BoundedCache } from '../resource-manager.js';

describe('BoundedCache', () => {
  it('stores and retrieves values', () => {
    const cache = new BoundedCache<string, number>(10);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const cache = new BoundedCache<string, number>(10);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts oldest entries when capacity exceeded', () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('d')).toBe(4);
  });

  it('clear removes all entries', () => {
    const cache = new BoundedCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('reports correct size', () => {
    const cache = new BoundedCache<string, number>(10);
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });
});
