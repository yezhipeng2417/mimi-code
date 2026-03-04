/**
 * Lightweight, typed Dependency Injection container.
 * No decorators, no reflection — just typed factory functions with scoping support.
 */

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * A branded type token for type-safe DI resolution.
 * The phantom type `_type` is never set at runtime; it exists only to carry
 * the TypeScript type through `resolve<T>`.
 */
export interface Token<T> {
  readonly id: symbol;
  readonly _type?: T; // phantom type — never assigned at runtime
}

/**
 * Create a new unique token for a given service type.
 *
 * @example
 * ```ts
 * const LoggerToken = createToken<Logger>('Logger');
 * ```
 */
export function createToken<T>(name: string): Token<T> {
  return { id: Symbol(name) } as Token<T>;
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export class ServiceContainer {
  private factories = new Map<symbol, (container: ServiceContainer) => unknown>();
  private singletons = new Map<symbol, unknown>();
  private parent?: ServiceContainer;

  constructor(parent?: ServiceContainer) {
    this.parent = parent;
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a factory function for a token.
   * The factory is called lazily on the first `resolve` and the result is
   * cached as a singleton within this container scope.
   */
  register<T>(token: Token<T>, factory: (container: ServiceContainer) => T): void {
    this.factories.set(token.id, factory);
  }

  /**
   * Register an already-constructed value for a token.
   * Equivalent to registering a factory that returns a constant, but skips
   * the lazy-creation step entirely.
   */
  registerValue<T>(token: Token<T>, value: T): void {
    this.singletons.set(token.id, value);
  }

  // -------------------------------------------------------------------------
  // Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve a service by token.
   *
   * Resolution order:
   * 1. Local singleton cache (previously resolved or registered via `registerValue`).
   * 2. Local factory — runs the factory, caches the result, returns it.
   * 3. Parent container (enables hierarchical scoping for sub-agents).
   *
   * @throws {Error} if no registration exists for the token in this container
   *   or any ancestor.
   */
  resolve<T>(token: Token<T>): T {
    // 1. Check local singleton cache first
    if (this.singletons.has(token.id)) {
      return this.singletons.get(token.id) as T;
    }

    // 2. Check local factories
    const factory = this.factories.get(token.id);
    if (factory) {
      const instance = factory(this) as T;
      this.singletons.set(token.id, instance);
      return instance;
    }

    // 3. Delegate to parent container
    if (this.parent) {
      return this.parent.resolve(token);
    }

    throw new Error(`No registration found for token: ${token.id.toString()}`);
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Returns `true` if the token is registered in this container or any
   * ancestor container.
   */
  has<T>(token: Token<T>): boolean {
    if (this.singletons.has(token.id) || this.factories.has(token.id)) {
      return true;
    }
    return this.parent?.has(token) ?? false;
  }

  // -------------------------------------------------------------------------
  // Scoping
  // -------------------------------------------------------------------------

  /**
   * Create a child container that inherits all registrations from this one.
   * Services registered on the child do not affect the parent.
   * Useful for per-request or per-sub-agent scoping.
   */
  createChild(): ServiceContainer {
    return new ServiceContainer(this);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Dispose all singleton instances that expose a `dispose` method, then
   * clear all registrations.
   *
   * Disposal errors are silently swallowed so that one failing service never
   * prevents the rest from being cleaned up.
   */
  async dispose(): Promise<void> {
    for (const instance of this.singletons.values()) {
      if (instance && typeof instance === "object") {
        // biome-ignore lint/suspicious/noExplicitAny: disposal duck-typing requires any
        if ("dispose" in instance && typeof (instance as any).dispose === "function") {
          try {
            // biome-ignore lint/suspicious/noExplicitAny: disposal duck-typing requires any
            await (instance as any).dispose();
          } catch {
            // never throw during cleanup
          }
        }
      }
    }
    this.singletons.clear();
    this.factories.clear();
  }
}
