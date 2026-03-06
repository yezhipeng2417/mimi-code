/**
 * SessionStore — SQLite-backed session persistence.
 *
 * Solves Claude Code's permission persistence problem (#4 pain point)
 * and provides structured storage instead of unbounded .claude.json (#9).
 *
 * Schema: sessions, messages, tool_results, permissions tables.
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ContentBlock,
  Message,
  PermissionDecision,
  SessionInfo,
  ToolResultContent,
} from './types.js';

// ─── Database paths ────────────────────────────────────────────────────────

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjectDbPath(projectPath: string): string {
  const dbDir = path.join(projectPath, '.mimi');
  ensureDir(dbDir);
  return path.join(dbDir, 'sessions.db');
}

function getGlobalDbPath(): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
  const dbDir = path.join(home, '.mimi');
  ensureDir(dbDir);
  return path.join(dbDir, 'sessions.db');
}

// ─── Schema ────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    project_path  TEXT NOT NULL,
    title         TEXT NOT NULL DEFAULT 'Untitled',
    model         TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    token_count   INTEGER NOT NULL DEFAULT 0,
    cost_usd      REAL NOT NULL DEFAULT 0.0,
    status        TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active', 'completed', 'archived'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    metadata    TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS tool_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message_id   INTEGER REFERENCES messages(id),
    tool_name    TEXT NOT NULL,
    tool_use_id  TEXT NOT NULL,
    input        TEXT NOT NULL,
    output       TEXT NOT NULL,
    is_error     INTEGER NOT NULL DEFAULT 0,
    duration_ms  INTEGER,
    created_at   INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_path TEXT NOT NULL,
    tool_name    TEXT NOT NULL,
    pattern      TEXT,
    decision     TEXT NOT NULL CHECK(decision IN ('allow', 'deny')),
    source       TEXT NOT NULL DEFAULT 'user'
      CHECK(source IN ('rule', 'persistent', 'user')),
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER,
    UNIQUE(project_path, tool_name, pattern)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_tool_results_session ON tool_results(session_id);
  CREATE INDEX IF NOT EXISTS idx_permissions_project ON permissions(project_path, tool_name);
  CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path, status);
`;

// ─── SessionStore ──────────────────────────────────────────────────────────

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA_SQL);
  }

  /**
   * Create a SessionStore for a specific project.
   */
  static forProject(projectPath: string): SessionStore {
    return new SessionStore(getProjectDbPath(projectPath));
  }

  /**
   * Create a global SessionStore (for cross-project data).
   */
  static global(): SessionStore {
    return new SessionStore(getGlobalDbPath());
  }

  // ── Session CRUD ───────────────────────────────────────────────────────

  createSession(projectPath: string, model: string, title?: string): SessionInfo {
    const now = Date.now();
    const id = randomUUID();

    this.db.prepare(`
      INSERT INTO sessions (id, project_path, title, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectPath, title ?? 'Untitled', model, now, now);

    return {
      id,
      projectPath,
      title: title ?? 'Untitled',
      model,
      createdAt: now,
      updatedAt: now,
      tokenCount: 0,
      costUsd: 0,
      status: 'active',
    };
  }

  getSession(id: string): SessionInfo | undefined {
    const row = this.db.prepare(`
      SELECT id, project_path, title, model, created_at, updated_at,
             token_count, cost_usd, status
      FROM sessions WHERE id = ?
    `).get(id) as SessionRow | undefined;

    return row ? rowToSessionInfo(row) : undefined;
  }

  listSessions(projectPath: string, limit = 20): SessionInfo[] {
    const rows = this.db.prepare(`
      SELECT id, project_path, title, model, created_at, updated_at,
             token_count, cost_usd, status
      FROM sessions
      WHERE project_path = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(projectPath, limit) as SessionRow[];

    return rows.map(rowToSessionInfo);
  }

  updateSession(id: string, updates: Partial<Pick<SessionInfo, 'title' | 'status' | 'tokenCount' | 'costUsd'>>): void {
    const sets: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [Date.now()];

    if (updates.title !== undefined) {
      sets.push('title = ?');
      values.push(updates.title);
    }
    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.tokenCount !== undefined) {
      sets.push('token_count = ?');
      values.push(updates.tokenCount);
    }
    if (updates.costUsd !== undefined) {
      sets.push('cost_usd = ?');
      values.push(updates.costUsd);
    }

    values.push(id);
    this.db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  /**
   * Get the most recently updated active session for a project.
   */
  getLastSession(projectPath: string): SessionInfo | undefined {
    const row = this.db.prepare(`
      SELECT id, project_path, title, model, created_at, updated_at,
             token_count, cost_usd, status
      FROM sessions
      WHERE project_path = ? AND status IN ('active', 'completed')
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(projectPath) as SessionRow | undefined;

    return row ? rowToSessionInfo(row) : undefined;
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // ── Messages ───────────────────────────────────────────────────────────

  saveMessage(sessionId: string, message: Message, tokenCount = 0): number {
    const result = this.db.prepare(`
      INSERT INTO messages (session_id, role, content, token_count, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      message.role,
      JSON.stringify(message.content),
      tokenCount,
      Date.now(),
      message.metadata ? JSON.stringify(message.metadata) : null,
    );

    return Number(result.lastInsertRowid);
  }

  getMessages(sessionId: string): Message[] {
    const rows = this.db.prepare(`
      SELECT role, content, metadata FROM messages
      WHERE session_id = ?
      ORDER BY id ASC
    `).all(sessionId) as MessageRow[];

    return rows.map((row) => ({
      role: row.role as Message['role'],
      content: JSON.parse(row.content) as ContentBlock[],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  // ── Tool Results ───────────────────────────────────────────────────────

  saveToolResult(
    sessionId: string,
    messageId: number | null,
    toolName: string,
    toolUseId: string,
    input: unknown,
    output: ToolResultContent[],
    isError: boolean,
    durationMs?: number,
  ): void {
    this.db.prepare(`
      INSERT INTO tool_results
        (session_id, message_id, tool_name, tool_use_id, input, output, is_error, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      messageId,
      toolName,
      toolUseId,
      JSON.stringify(input),
      JSON.stringify(output),
      isError ? 1 : 0,
      durationMs ?? null,
      Date.now(),
    );
  }

  // ── Permissions (persistent "always allow") ────────────────────────────

  savePermission(
    projectPath: string,
    toolName: string,
    decision: 'allow' | 'deny',
    pattern?: string,
    expiresAt?: number,
  ): void {
    this.db.prepare(`
      INSERT INTO permissions (project_path, tool_name, pattern, decision, source, created_at, expires_at)
      VALUES (?, ?, ?, ?, 'persistent', ?, ?)
      ON CONFLICT(project_path, tool_name, pattern) DO UPDATE
        SET decision = excluded.decision, created_at = excluded.created_at, expires_at = excluded.expires_at
    `).run(projectPath, toolName, pattern ?? '', decision, Date.now(), expiresAt ?? null);
  }

  getPermission(projectPath: string, toolName: string, pattern?: string): PermissionDecision | undefined {
    const effectivePattern = pattern ?? '';

    const row = this.db.prepare(`
      SELECT decision, source, expires_at FROM permissions
      WHERE project_path = ? AND tool_name = ? AND pattern = ?
      LIMIT 1
    `).get(projectPath, toolName, effectivePattern) as { decision: string; source: string; expires_at: number | null } | undefined;

    if (!row) return undefined;

    if (row.expires_at && row.expires_at < Date.now()) {
      // Expired — remove and return undefined
      this.db.prepare(`
        DELETE FROM permissions
        WHERE project_path = ? AND tool_name = ? AND pattern = ? AND expires_at < ?
      `).run(projectPath, toolName, effectivePattern, Date.now());
      return undefined;
    }

    if (row.decision === 'allow') {
      return {
        decision: 'allow',
        source: row.source as 'rule' | 'persistent' | 'user',
      };
    }
    return {
      decision: 'deny',
      reason: `Denied by persistent rule (source: ${row.source})`,
    };
  }

  clearPermissions(projectPath: string): void {
    this.db.prepare(`DELETE FROM permissions WHERE project_path = ?`).run(projectPath);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  dispose(): void {
    this.close();
  }
}

// ─── Internal row types ────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  project_path: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
  token_count: number;
  cost_usd: number;
  status: string;
}

interface MessageRow {
  role: string;
  content: string;
  metadata: string | null;
}

function rowToSessionInfo(row: SessionRow): SessionInfo {
  return {
    id: row.id,
    projectPath: row.project_path,
    title: row.title,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tokenCount: row.token_count,
    costUsd: row.cost_usd,
    status: row.status as SessionInfo['status'],
  };
}
