/**
 * Tests for SessionStore — SQLite-backed session persistence.
 *
 * Uses in-memory SQLite databases for fast, isolated tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SessionStore } from '../session-store.js';
import type { Message } from '../types.js';

let store: SessionStore;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mimi-session-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  store = new SessionStore(dbPath);
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Session CRUD ─────────────────────────────────────────────────────

describe('Session CRUD', () => {
  it('creates a session with generated id', () => {
    const session = store.createSession('/test/project', 'claude-sonnet-4-6');
    expect(session.id).toBeTruthy();
    expect(session.projectPath).toBe('/test/project');
    expect(session.model).toBe('claude-sonnet-4-6');
    expect(session.status).toBe('active');
    expect(session.tokenCount).toBe(0);
    expect(session.costUsd).toBe(0);
  });

  it('creates a session with custom title', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6', 'My Session');
    expect(session.title).toBe('My Session');
  });

  it('defaults title to Untitled', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    expect(session.title).toBe('Untitled');
  });

  it('retrieves a session by id', () => {
    const created = store.createSession('/test', 'claude-opus-4-6');
    const retrieved = store.getSession(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.model).toBe('claude-opus-4-6');
  });

  it('returns undefined for nonexistent session', () => {
    const result = store.getSession('nonexistent-id');
    expect(result).toBeUndefined();
  });

  it('lists sessions for a project, filtered by project path', () => {
    store.createSession('/proj-a', 'claude-sonnet-4-6', 'First');
    store.createSession('/proj-a', 'claude-sonnet-4-6', 'Second');
    store.createSession('/proj-b', 'claude-sonnet-4-6', 'Other');

    const sessions = store.listSessions('/proj-a');
    expect(sessions).toHaveLength(2);
    const titles = sessions.map((s) => s.title);
    expect(titles).toContain('First');
    expect(titles).toContain('Second');

    // Other project's sessions are not included
    const otherSessions = store.listSessions('/proj-b');
    expect(otherSessions).toHaveLength(1);
    expect(otherSessions[0]!.title).toBe('Other');
  });

  it('respects list limit', () => {
    for (let i = 0; i < 5; i++) {
      store.createSession('/proj', 'claude-sonnet-4-6', `Session ${i}`);
    }
    const sessions = store.listSessions('/proj', 3);
    expect(sessions).toHaveLength(3);
  });

  it('updates session fields', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    store.updateSession(session.id, {
      title: 'Renamed',
      status: 'completed',
      tokenCount: 1500,
      costUsd: 0.05,
    });

    const updated = store.getSession(session.id);
    expect(updated!.title).toBe('Renamed');
    expect(updated!.status).toBe('completed');
    expect(updated!.tokenCount).toBe(1500);
    expect(updated!.costUsd).toBeCloseTo(0.05);
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(session.updatedAt);
  });

  it('gets the last active session for a project', () => {
    const s1 = store.createSession('/proj', 'claude-sonnet-4-6', 'Old');
    const s2 = store.createSession('/proj', 'claude-sonnet-4-6', 'New');

    // Bump s2 so it's "newer", then archive it
    store.updateSession(s2.id, { status: 'archived' });

    // s1 should be the last non-archived session
    const last = store.getLastSession('/proj');
    expect(last).toBeDefined();
    expect(last!.id).toBe(s1.id);
  });

  it('deletes a session', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    store.deleteSession(session.id);
    expect(store.getSession(session.id)).toBeUndefined();
  });
});

// ── Messages ─────────────────────────────────────────────────────────

describe('Messages', () => {
  it('saves and retrieves messages in order', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');

    const userMsg: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }],
    };
    const assistantMsg: Message = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi there!' }],
    };

    store.saveMessage(session.id, userMsg);
    store.saveMessage(session.id, assistantMsg);

    const messages = store.getMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content[0]).toEqual({ type: 'text', text: 'Hello' });
    expect(messages[1]!.role).toBe('assistant');
  });

  it('preserves message metadata', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    const msg: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'test' }],
      metadata: { anchor: true, turnIndex: 3 },
    };

    store.saveMessage(session.id, msg);
    const retrieved = store.getMessages(session.id);
    expect(retrieved[0]!.metadata).toEqual({ anchor: true, turnIndex: 3 });
  });

  it('returns empty array for sessions with no messages', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    expect(store.getMessages(session.id)).toEqual([]);
  });

  it('returns the message row id from saveMessage', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    const id = store.saveMessage(session.id, {
      role: 'user',
      content: [{ type: 'text', text: 'test' }],
    });
    expect(id).toBeGreaterThan(0);
  });
});

// ── Tool Results ─────────────────────────────────────────────────────

describe('Tool Results', () => {
  it('saves tool results without errors', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    // Should not throw
    store.saveToolResult(
      session.id,
      null,
      'Bash',
      'tool_use_1',
      { command: 'ls' },
      [{ type: 'text', text: 'file1.ts\nfile2.ts' }],
      false,
      150,
    );
  });

  it('saves error tool results', () => {
    const session = store.createSession('/test', 'claude-sonnet-4-6');
    store.saveToolResult(
      session.id,
      null,
      'Write',
      'tool_use_2',
      { file_path: '/etc/passwd' },
      [{ type: 'text', text: 'Permission denied' }],
      true,
      10,
    );
  });
});

// ── Permissions ──────────────────────────────────────────────────────

describe('Permissions', () => {
  it('saves and retrieves allow permission', () => {
    store.savePermission('/proj', 'Bash', 'allow');
    const result = store.getPermission('/proj', 'Bash');
    expect(result).toBeDefined();
    expect(result!.decision).toBe('allow');
  });

  it('saves and retrieves deny permission', () => {
    store.savePermission('/proj', 'Write', 'deny');
    const result = store.getPermission('/proj', 'Write');
    expect(result).toBeDefined();
    expect(result!.decision).toBe('deny');
  });

  it('returns undefined for missing permission', () => {
    const result = store.getPermission('/proj', 'Unknown');
    expect(result).toBeUndefined();
  });

  it('upserts on conflict (same project + tool + pattern)', () => {
    store.savePermission('/proj', 'Bash', 'allow');
    store.savePermission('/proj', 'Bash', 'deny');
    const result = store.getPermission('/proj', 'Bash');
    expect(result!.decision).toBe('deny');
  });

  it('distinguishes by pattern', () => {
    store.savePermission('/proj', 'Write', 'allow', '/safe/*');
    store.savePermission('/proj', 'Write', 'deny', '/dangerous/*');

    const safe = store.getPermission('/proj', 'Write', '/safe/*');
    expect(safe!.decision).toBe('allow');

    const dangerous = store.getPermission('/proj', 'Write', '/dangerous/*');
    expect(dangerous!.decision).toBe('deny');
  });

  it('clears all permissions for a project', () => {
    store.savePermission('/proj', 'Bash', 'allow');
    store.savePermission('/proj', 'Write', 'allow');
    store.clearPermissions('/proj');

    expect(store.getPermission('/proj', 'Bash')).toBeUndefined();
    expect(store.getPermission('/proj', 'Write')).toBeUndefined();
  });

  it('handles expired permissions', () => {
    // Save a permission that expired in the past
    store.savePermission('/proj', 'Bash', 'allow', undefined, Date.now() - 10000);

    const result = store.getPermission('/proj', 'Bash');
    // Should be cleaned up and return undefined
    expect(result).toBeUndefined();
  });

  it('keeps non-expired permissions', () => {
    store.savePermission('/proj', 'Bash', 'allow', undefined, Date.now() + 60000);
    const result = store.getPermission('/proj', 'Bash');
    expect(result).toBeDefined();
    expect(result!.decision).toBe('allow');
  });
});
