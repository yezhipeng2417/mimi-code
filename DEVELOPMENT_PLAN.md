# Mimi Code — Development Plan

```
                     ___
                   /'___\
                  / /  /__
                 | |  /   \
                 | | | 👁️  |    ～chirp!
                 | |  \___/  ⟩
                  \ \___  __/
            ~~~~~~~\____||
           / /^^^\ \    ||
          / / ___ \ \   ||
         / / /   \ \ \  ||
        /_/ /     \_\_\ ||
       |____|     |____|||
          ||         || ~~
          ||         ||
         _||_       _||_
        /____\     /____\


    ╔══════════════════════════════════╗
    ║   🦜  M I M I   C O D E  🦜    ║
    ║   Your Friendly AI Coding CLI   ║
    ╚══════════════════════════════════╝
```

---

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [Architecture Overview](#architecture-overview)
3. [Claude Code Pain Points We Fix](#claude-code-pain-points-we-fix)
4. [White-Label & Distribution System](#white-label--distribution-system)
5. [Phase 0: Foundation](#phase-0-foundation--project-scaffold)
6. [Phase 1: Core Agent Loop](#phase-1-core-agent-loop)
7. [Phase 2: Tool System](#phase-2-tool-system)
8. [Phase 3: Permission & Security](#phase-3-permission--security-system)
9. [Phase 4: Terminal UI](#phase-4-terminal-ui)
10. [Phase 5: MCP Integration](#phase-5-mcp-integration)
11. [Phase 6: Hooks & Skills](#phase-6-hooks--skills-system)
12. [Phase 7: Sub-agents & Teams](#phase-7-sub-agents--teams)
13. [Phase 8: White-Label Engine](#phase-8-white-label-engine)
14. [Phase 9: Distribution & Packaging](#phase-9-distribution--packaging)
15. [Phase 10: Polish & Launch](#phase-10-polish--launch)
16. [Tech Stack Decisions](#tech-stack-decisions)
17. [Compatibility Matrix](#compatibility-matrix)

---

## Vision & Goals

### What is Mimi Code?

Mimi Code is an **open-source**, **white-label-ready** AI coding CLI that reimagines the Claude Code experience with:

1. **Full Claude Code Ecosystem Compatibility** — MCP servers, plugins, skills, hooks, CLAUDE.md — all work seamlessly
2. **White-Label First** — Organizations can rebrand, inject custom system prompts, and redistribute with zero friction
3. **Fix Known Pain Points** — Address the top community complaints from Claude Code's 1600+ issue tracker
4. **Geeky & Cute** — A yellow Quaker parrot 🦜 mascot with beautiful ASCII art throughout
5. **Open Source** — MIT licensed, community-driven, transparent

### Non-Goals (Phase 1)

- We are NOT building our own LLM
- We are NOT competing with Anthropic's business — we're enhancing the developer experience
- We do NOT aim to replicate Claude Code's proprietary OAuth/subscription system

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Mimi Code Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Layer 0: White-Label Engine                │  │
│  │  Brand Config │ Custom Prompts │ Theme Engine │ Distribution  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Layer 1: Terminal UI (Ink + React)          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │  Input    │ │  Output  │ │  Diff    │ │  Permission  │   │  │
│  │  │  Editor   │ │  Stream  │ │  Viewer  │ │  Prompts     │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  │  ╔══════════════════════════════════════════════════════╗    │  │
│  │  ║  🔧 FIX: Incremental renders, NOT full redraws     ║    │  │
│  │  ║  🔧 FIX: Virtual viewport with scroll management   ║    │  │
│  │  ╚══════════════════════════════════════════════════════╝    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                Layer 2: Core Agent Engine                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │  ReAct   │ │  Context │ │  Session  │ │  Prompt      │   │  │
│  │  │  Loop    │ │  Manager │ │  Store    │ │  Assembler   │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  │  ╔══════════════════════════════════════════════════════╗    │  │
│  │  ║  🔧 FIX: Rolling compaction (not wait-til-full)     ║    │  │
│  │  ║  🔧 FIX: Per-project session DB (not flat file)     ║    │  │
│  │  ║  🔧 FIX: Streaming tool execution w/ cancellation   ║    │  │
│  │  ╚══════════════════════════════════════════════════════╝    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                Layer 3: Tool Runtime                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │  Builtin │ │  MCP     │ │  Plugin  │ │  Skill       │   │  │
│  │  │  Tools   │ │  Client  │ │  Loader  │ │  Engine      │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  │  ╔══════════════════════════════════════════════════════╗    │  │
│  │  ║  🔧 FIX: Lazy tool loading (deferred by default)    ║    │  │
│  │  ║  🔧 FIX: Per-tool MCP filtering (enable/disable)    ║    │  │
│  │  ║  🔧 FIX: Temp file cleanup on process exit          ║    │  │
│  │  ╚══════════════════════════════════════════════════════╝    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                Layer 4: Permission & Security                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │  Rule    │ │  Sandbox │ │  Hooks   │ │  Audit       │   │  │
│  │  │  Engine  │ │  Manager │ │  Runtime │ │  Logger      │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  │  ╔══════════════════════════════════════════════════════╗    │  │
│  │  ║  🔧 FIX: "Always allow" is actually persistent      ║    │  │
│  │  ║  🔧 FIX: Clear permission hierarchy enforcement     ║    │  │
│  │  ╚══════════════════════════════════════════════════════╝    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Layer 5: Provider Abstraction                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │ Anthropic│ │  AWS     │ │  GCP     │ │  OpenAI /    │   │  │
│  │  │  Direct  │ │  Bedrock │ │  Vertex  │ │  Compatible  │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Claude Code Pain Points We Fix

Based on analysis of **1,600+ GitHub issues** (30,000+ comments), here are the architectural fixes:

### Critical Fixes (Day 1 Architecture Decisions)

| # | Pain Point | Comments | Our Fix |
|---|-----------|----------|---------|
| 1 | **Terminal flickering / full buffer redraws** | 776 | **Incremental ANSI rendering** — update only changed lines, never full buffer redraws. Virtual viewport with cursor position tracking. |
| 2 | **Memory leaks / OOM crashes** | 300+ | **Strict resource lifecycle** — WeakRef for caches, explicit cleanup on process signals, temp file registry with guaranteed cleanup via `process.on('exit')`. Memory budget per session with automatic GC triggers. |
| 3 | **Context compaction deadlock** | 170+ | **Rolling compaction** — proactive incremental summarization starting at 60% capacity (configurable). Never wait until 95%. Background compaction thread that doesn't block the main loop. |
| 4 | **Permission "Always allow" not sticky** | 100+ | **SQLite-backed permission store** — persistent across sessions, with clear scope rules. When you say "always", we mean always. |
| 5 | **Temp file accumulation** | 101 | **Temp file registry** — every temp file tracked, cleaned on exit via signal handlers (SIGTERM, SIGINT, uncaughtException). Periodic sweep on timer. |
| 6 | **Tool call opacity (collapsed = no info)** | 117 | **Always show context in collapsed view** — file paths, command previews, search patterns visible without expanding. |
| 7 | **Edit tool "string not found" failures** | 46 | **Fuzzy matching fallback** — when exact match fails, offer normalized whitespace match. Show diff of what was expected vs actual. |
| 8 | **MCP tool context pollution** | 150+ | **Lazy tool loading by default** — tools loaded on-demand, not upfront. Per-tool enable/disable filtering. |
| 9 | **`.claude.json` unbounded growth** | 46 | **Per-project SQLite DB** — sessions, MCP config, permissions in structured storage with TTL and size limits. |
| 10 | **Windows platform parity** | 200+ | **Cross-platform test matrix from Day 1** — CI runs on macOS, Linux, Windows. Platform-specific code isolated behind adapters. |

### UX Improvements

| Feature | Our Approach |
|---------|-------------|
| Quirky spinner messages | Configurable: `professional`, `cute`, `custom`, or **parrot-themed** default |
| Pasted text invisible | Full preview + edit before submission |
| IME Enter key issues | Proper composition event handling |
| No file info in collapsed tools | Rich collapsed summaries with file paths |
| RTL text support | Proper bidirectional text rendering |
| Session cleanup | Automatic TTL-based cleanup + manual prune command |

---

## White-Label & Distribution System

The **killer feature** of Mimi Code: anyone can create their own branded CLI.

### How It Works

```
mimi-code (base)
    │
    ├── acme-code (Acme Corp's branded CLI)
    │   ├── brand.json          ← name, colors, ASCII art
    │   ├── system-prompt.md    ← extra system prompt (appended)
    │   ├── default-mcp.json    ← pre-configured MCP servers
    │   ├── default-skills/     ← bundled skills
    │   └── default-settings.json ← default permission rules
    │
    ├── startup-code (A startup's branded CLI)
    │   └── brand.json
    │
    └── solo-dev-code (An indie dev's branded CLI)
        └── brand.json
```

### `brand.json` Schema

```jsonc
{
  "$schema": "https://mimi-code.dev/schemas/brand.json",
  "name": "Acme Code",
  "binary_name": "acme",
  "version": "1.0.0",

  // Branding
  "mascot": {
    "ascii_art": "path/to/ascii-art.txt",
    "emoji": "🏢",
    "name": "Acme Bot"
  },
  "theme": {
    "primary": "#FF6B00",
    "secondary": "#1A1A2E",
    "accent": "#00D4FF",
    "spinner_style": "professional"  // "cute" | "professional" | "minimal"
  },

  // System Prompt Extension (does NOT replace base prompts)
  "system_prompt": {
    "prepend": "path/to/prepend-prompt.md",   // before base prompt
    "append": "path/to/append-prompt.md",     // after base prompt
    "reminders": ["path/to/custom-reminder.md"]
  },

  // Bundled Defaults
  "defaults": {
    "mcp_servers": "path/to/default-mcp.json",
    "skills": "path/to/skills/",
    "agents": "path/to/agents/",
    "plugins": "path/to/plugins/",
    "settings": "path/to/default-settings.json",
    "claude_md": "path/to/MIMI.md"  // project instruction template
  },

  // Distribution
  "distribution": {
    "npm_scope": "@acme",
    "homebrew_tap": "acme/tap",
    "auto_update_url": "https://acme.com/cli/update"
  },

  // Provider Restrictions (for enterprise)
  "providers": {
    "allowed": ["anthropic", "bedrock"],
    "default": "bedrock",
    "api_base_url": "https://llm-gateway.acme.com"
  }
}
```

### Build a White-Label in 5 Minutes

```bash
# 1. Create brand config
mkdir acme-code && cd acme-code
mimi init-brand --name "Acme Code" --emoji "🏢"

# 2. Add custom system prompt
echo "You are Acme's AI assistant. Follow Acme's coding standards..." > system-prompt.md

# 3. Build & distribute
mimi build-brand           # → produces acme-code binary
mimi publish-brand --npm   # → publishes @acme/acme-code to npm
```

---

## Phase 0: Foundation & Project Scaffold

**Duration**: 1 week
**Branch**: `phase/0-foundation`

### 0.1 Project Structure

```
mimi-code/
├── packages/
│   ├── core/                    # Agent engine, context, sessions
│   │   ├── src/
│   │   │   ├── agent/           # ReAct loop, message handling
│   │   │   ├── context/         # Context window management, compaction
│   │   │   ├── session/         # Session store (SQLite)
│   │   │   ├── prompt/          # System prompt assembler
│   │   │   └── provider/        # LLM provider abstraction
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── tools/                   # Built-in tool implementations
│   │   ├── src/
│   │   │   ├── bash/            # Shell execution
│   │   │   ├── filesystem/      # Read, Write, Edit, Glob, Grep
│   │   │   ├── web/             # WebSearch, WebFetch
│   │   │   ├── agent/           # Task (sub-agent spawner)
│   │   │   ├── notebook/        # NotebookEdit
│   │   │   └── registry.ts      # Tool registry & lazy loading
│   │   └── package.json
│   │
│   ├── mcp/                     # MCP client implementation
│   │   ├── src/
│   │   │   ├── client/          # MCP protocol client
│   │   │   ├── transport/       # stdio, HTTP, SSE transports
│   │   │   ├── auth/            # OAuth 2.0 flow
│   │   │   └── registry.ts      # Server registry & lifecycle
│   │   └── package.json
│   │
│   ├── permissions/             # Permission & security engine
│   │   ├── src/
│   │   │   ├── rules/           # Rule parser & evaluator
│   │   │   ├── store/           # SQLite permission persistence
│   │   │   ├── sandbox/         # Process sandboxing
│   │   │   └── audit/           # Audit logging
│   │   └── package.json
│   │
│   ├── hooks/                   # Hooks runtime
│   │   ├── src/
│   │   │   ├── lifecycle/       # Event lifecycle manager
│   │   │   ├── handlers/        # command, http, prompt, agent handlers
│   │   │   └── registry.ts      # Hook configuration & matching
│   │   └── package.json
│   │
│   ├── ui/                      # Terminal UI (Ink + React)
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   ├── renderer/        # Incremental ANSI renderer
│   │   │   ├── themes/          # Color themes
│   │   │   ├── ascii/           # ASCII art assets
│   │   │   └── app.tsx          # Root app component
│   │   └── package.json
│   │
│   ├── skills/                  # Skills engine
│   │   ├── src/
│   │   │   ├── parser/          # SKILL.md frontmatter parser
│   │   │   ├── loader/          # Discovery & loading
│   │   │   └── runtime.ts       # Execution runtime
│   │   └── package.json
│   │
│   ├── plugins/                 # Plugin system
│   │   ├── src/
│   │   │   ├── loader/          # Plugin discovery & validation
│   │   │   ├── marketplace/     # Marketplace client
│   │   │   └── runtime.ts       # Plugin lifecycle
│   │   └── package.json
│   │
│   ├── brand/                   # White-label engine
│   │   ├── src/
│   │   │   ├── config/          # brand.json parser
│   │   │   ├── builder/         # Brand builder (binary packaging)
│   │   │   ├── prompt/          # System prompt injection layer
│   │   │   └── theme/           # Theme override system
│   │   └── package.json
│   │
│   └── cli/                     # CLI entry point
│       ├── src/
│       │   ├── commands/        # CLI command handlers
│       │   ├── flags.ts         # CLI flag definitions
│       │   └── main.ts          # Entry point
│       └── package.json
│
├── prompts/                     # System prompt fragments (from community extraction)
│   ├── system/                  # Core system prompt fragments
│   ├── tools/                   # Tool description fragments
│   ├── agents/                  # Sub-agent prompt templates
│   ├── reminders/               # System reminder templates
│   ├── skills/                  # Built-in skill prompts
│   └── data/                    # Embedded reference data
│
├── assets/
│   ├── ascii/                   # ASCII art (parrot + variations)
│   ├── themes/                  # Built-in color themes
│   └── brand/                   # Default brand config
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── scripts/
│   ├── build.ts                 # Build system
│   ├── brand-build.ts           # White-label builder
│   └── release.ts               # Release automation
│
├── docs/
│   ├── architecture.md
│   ├── white-label-guide.md
│   ├── contributing.md
│   └── api/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml               # Test on macOS/Linux/Windows
│   │   ├── release.yml          # Auto-release
│   │   └── brand-build.yml      # White-label CI
│   └── CODEOWNERS
│
├── brand.json                   # Default Mimi brand config
├── turbo.json                   # Turborepo config
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json                   # Linting & formatting
├── vitest.config.ts
└── DEVELOPMENT_PLAN.md          # This file
```

### 0.2 Toolchain

| Tool | Purpose | Why |
|------|---------|-----|
| **TypeScript 5.7+** | Language | Type safety, same as Claude Code |
| **pnpm** | Package manager | Fast, disk-efficient, great monorepo |
| **Turborepo** | Monorepo build | Parallel builds, caching |
| **Ink 5 + React 19** | Terminal UI | Same as Claude Code, but we fix the rendering |
| **Vitest** | Testing | Fast, TypeScript-native |
| **Biome** | Linting/Formatting | Fast, single tool replaces ESLint+Prettier |
| **tsup** | Bundling | Fast esbuild-based TS bundler |
| **better-sqlite3** | Session/Permission DB | Fast, zero-config, single-file |
| **commander** | CLI parsing | Standard, battle-tested |
| **zod** | Schema validation | Runtime type safety |
| **pkg / bun compile** | Binary packaging | Cross-platform native binaries |

### 0.3 Tasks

- [ ] Initialize pnpm monorepo with Turborepo
- [ ] Set up TypeScript with strict mode + path aliases
- [ ] Configure Biome for linting + formatting
- [ ] Set up Vitest with coverage
- [ ] Create GitHub Actions CI (macOS, Linux, Windows)
- [ ] Create CONTRIBUTING.md, CODE_OF_CONDUCT.md
- [ ] Design and commit ASCII art assets
- [ ] Set up Changesets for versioning

---

## Phase 1: Core Agent Loop

**Duration**: 2 weeks
**Branch**: `phase/1-agent-loop`
**Depends on**: Phase 0

### 1.1 Provider Abstraction Layer

```typescript
// packages/core/src/provider/types.ts
interface LLMProvider {
  name: string;
  createMessage(params: MessageParams): AsyncIterable<StreamEvent>;
  listModels(): Promise<Model[]>;
  supportsToolUse: boolean;
  supportsStreaming: boolean;
  supportsExtendedThinking: boolean;
}

interface MessageParams {
  model: string;
  system: SystemPrompt[];
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens: number;
  stream: true;
  metadata?: Record<string, unknown>;
}

// Supported providers
class AnthropicProvider implements LLMProvider { ... }
class BedrockProvider implements LLMProvider { ... }
class VertexProvider implements LLMProvider { ... }
class OpenAICompatibleProvider implements LLMProvider { ... }  // bonus!
```

### 1.2 ReAct Agent Loop

```typescript
// packages/core/src/agent/loop.ts
class AgentLoop {
  private messages: Message[] = [];
  private contextManager: ContextManager;
  private toolExecutor: ToolExecutor;

  async *run(userMessage: string): AsyncIterable<AgentEvent> {
    this.messages.push({ role: 'user', content: userMessage });

    while (true) {
      // Check context budget BEFORE API call
      if (this.contextManager.usage > this.contextManager.compactionThreshold) {
        yield { type: 'compacting' };
        await this.contextManager.compact(this.messages);
      }

      const stream = this.provider.createMessage({
        system: this.promptAssembler.build(),
        messages: this.messages,
        tools: this.toolRegistry.getActiveTools(),
      });

      for await (const event of stream) {
        yield this.processEvent(event);

        if (event.type === 'tool_use') {
          const result = await this.toolExecutor.execute(event);
          this.messages.push(toolResultMessage(result));
        }
      }

      if (this.shouldStop()) break;
    }
  }
}
```

### 1.3 Context Manager (Fix: Rolling Compaction)

```typescript
// packages/core/src/context/manager.ts
class ContextManager {
  // Configurable thresholds (default: start at 60%, not 95%)
  compactionThreshold = 0.60;
  criticalThreshold = 0.85;

  async compact(messages: Message[]): Promise<Message[]> {
    // Phase 1: Summarize oldest conversation turns
    // Phase 2: Preserve recent turns verbatim
    // Phase 3: Keep all system prompts intact
    // NEVER fail — if summarization fails, just trim oldest turns
  }

  get usage(): number {
    return this.currentTokens / this.maxTokens;
  }
}
```

### 1.4 Session Store (Fix: Per-Project SQLite)

```typescript
// packages/core/src/session/store.ts
class SessionStore {
  private db: Database; // better-sqlite3

  // Per-project database at .mimi/sessions.db
  // Global database at ~/.mimi/sessions.db
  // Automatic TTL-based cleanup
  // Schema: sessions, messages, tool_results, metadata
}
```

### 1.5 Tasks

- [ ] Implement `LLMProvider` interface + Anthropic provider
- [ ] Implement SSE streaming parser
- [ ] Build `AgentLoop` with ReAct pattern
- [ ] Build `ContextManager` with rolling compaction
- [ ] Build `SessionStore` with SQLite backend
- [ ] Build `PromptAssembler` (modular fragment system)
- [ ] Import community-extracted system prompts
- [ ] Add message serialization/deserialization
- [ ] Tests: agent loop, context management, session persistence
- [ ] Benchmark: memory usage during long sessions

---

## Phase 2: Tool System

**Duration**: 2–3 weeks
**Branch**: `phase/2-tools`
**Depends on**: Phase 1

### 2.1 Tool Registry (Fix: Lazy Loading)

```typescript
// packages/tools/src/registry.ts
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private loaded: Map<string, Tool> = new Map();

  // Lazy: only load implementation when first called
  async execute(name: string, input: unknown): Promise<ToolResult> {
    if (!this.loaded.has(name)) {
      const impl = await this.loadTool(name);
      this.loaded.set(name, impl);
    }
    return this.loaded.get(name)!.execute(input);
  }

  // For prompt assembly: return only schemas, not implementations
  getActiveToolSchemas(): ToolSchema[] { ... }
}
```

### 2.2 Built-in Tools

| Tool | Priority | Key Implementation Notes |
|------|----------|-------------------------|
| **Read** | P0 | Line-based, offset/limit, image support, PDF pages |
| **Write** | P0 | Must-read-first enforcement, atomic writes |
| **Edit** | P0 | Exact match + fuzzy fallback, replace_all |
| **Glob** | P0 | Fast pattern matching via `fast-glob` |
| **Grep** | P0 | Bundled ripgrep binary (via `@vscode/ripgrep`) |
| **Bash** | P0 | PTY-based, timeout, background support, temp file cleanup |
| **WebSearch** | P1 | Pluggable search provider |
| **WebFetch** | P1 | HTML→Markdown, cache, content processing |
| **NotebookEdit** | P1 | Jupyter cell operations |
| **AskUserQuestion** | P0 | Multi-question, multi-select |
| **Task** (sub-agent) | P1 | Agent spawner (Phase 7) |
| **TodoWrite/Read** | P1 | Task list management |

### 2.3 Bash Tool (Fix: Temp File Cleanup)

```typescript
// packages/tools/src/bash/bash-tool.ts
class BashTool implements Tool {
  private tempFiles: Set<string> = new Set();
  private cleanupRegistered = false;

  async execute(input: BashInput): Promise<ToolResult> {
    if (!this.cleanupRegistered) {
      this.registerCleanup();
      this.cleanupRegistered = true;
    }
    // ... execute command ...
  }

  private registerCleanup() {
    const cleanup = () => {
      for (const f of this.tempFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}
```

### 2.4 Edit Tool (Fix: Fuzzy Matching)

```typescript
// packages/tools/src/filesystem/edit-tool.ts
class EditTool implements Tool {
  async execute(input: EditInput): Promise<ToolResult> {
    const content = await fs.readFile(input.file_path, 'utf-8');

    // Try exact match first
    if (content.includes(input.old_string)) {
      return this.replace(content, input);
    }

    // Fuzzy fallback: normalize whitespace and try again
    const normalized = this.normalizeWhitespace(input.old_string);
    const match = this.findFuzzyMatch(content, normalized);

    if (match) {
      return {
        type: 'fuzzy_match',
        message: `Exact match not found. Found similar match at line ${match.line}. Proceeding with normalized match.`,
        result: this.replace(content, { ...input, old_string: match.text })
      };
    }

    return { type: 'error', message: this.buildHelpfulError(content, input) };
  }
}
```

### 2.5 Tasks

- [ ] Implement `ToolRegistry` with lazy loading
- [ ] Implement Read tool (with image/PDF support)
- [ ] Implement Write tool (with read-first enforcement)
- [ ] Implement Edit tool (with fuzzy matching fallback)
- [ ] Implement Glob tool (fast-glob based)
- [ ] Implement Grep tool (bundled ripgrep)
- [ ] Implement Bash tool (PTY, timeout, temp cleanup)
- [ ] Implement AskUserQuestion tool
- [ ] Implement TodoWrite/TodoRead tools
- [ ] Implement WebSearch + WebFetch tools
- [ ] Import tool description prompts from community extraction
- [ ] Tests: each tool individually + integration tests
- [ ] Cross-platform tests (especially Bash on Windows)

---

## Phase 3: Permission & Security System

**Duration**: 1–2 weeks
**Branch**: `phase/3-permissions`
**Depends on**: Phase 2

### 3.1 Permission Rule Engine (Fix: Persistent "Always Allow")

```typescript
// packages/permissions/src/rules/engine.ts
class PermissionEngine {
  private store: PermissionStore;  // SQLite-backed

  async check(tool: string, input: unknown): Promise<PermissionDecision> {
    // 1. Check deny rules (always wins)
    if (this.matchesRules(tool, input, this.rules.deny)) {
      return { decision: 'deny', reason: '...' };
    }
    // 2. Check persistent "always allow" (from SQLite)
    if (await this.store.isAlwaysAllowed(tool, input)) {
      return { decision: 'allow', source: 'persistent' };
    }
    // 3. Check session allow rules
    if (this.matchesRules(tool, input, this.rules.allow)) {
      return { decision: 'allow', source: 'rule' };
    }
    // 4. Ask user
    return { decision: 'ask' };
  }

  async setAlwaysAllow(tool: string, pattern: string): Promise<void> {
    // This ACTUALLY persists. For real. In SQLite.
    await this.store.addAlwaysAllow(tool, pattern);
  }
}
```

### 3.2 Settings Hierarchy

```
Priority (highest → lowest):
1. Managed settings (enterprise, cannot be overridden)
2. CLI flags
3. .mimi/settings.local.json (project personal, gitignored)
4. .mimi/settings.json (project shared)
5. ~/.mimi/settings.json (user global)
6. brand.json defaults (white-label)
```

### 3.3 Tasks

- [ ] Implement permission rule parser (gitignore-style patterns)
- [ ] Implement SQLite-backed permission store
- [ ] Implement settings hierarchy with proper precedence
- [ ] Implement permission modes (ask, acceptEdits, plan, dontAsk, bypass)
- [ ] Implement sandbox manager (filesystem + network restrictions)
- [ ] Implement audit logger
- [ ] Tests: rule matching, persistence, hierarchy conflicts

---

## Phase 4: Terminal UI

**Duration**: 2–3 weeks
**Branch**: `phase/4-ui`
**Depends on**: Phase 2, 3

### 4.1 Incremental Renderer (Fix: No Flickering)

The biggest architectural fix. Claude Code uses Ink's default full-buffer redraws.
We implement **incremental ANSI rendering**:

```typescript
// packages/ui/src/renderer/incremental.ts
class IncrementalRenderer {
  private previousFrame: string[] = [];

  render(nextFrame: string[]): string {
    const patches: string[] = [];

    for (let i = 0; i < Math.max(this.previousFrame.length, nextFrame.length); i++) {
      if (this.previousFrame[i] !== nextFrame[i]) {
        // Only update changed lines using ANSI cursor positioning
        patches.push(`\x1b[${i + 1};1H`);  // Move cursor to line i
        patches.push(`\x1b[2K`);             // Clear line
        patches.push(nextFrame[i] || '');     // Write new content
      }
    }

    this.previousFrame = nextFrame;
    return patches.join('');
  }
}
```

### 4.2 Components

| Component | Description |
|-----------|-------------|
| `<MimiApp>` | Root app, theme provider |
| `<InputEditor>` | Multi-line input with history, vim mode, paste preview |
| `<OutputStream>` | Streaming markdown output with syntax highlighting |
| `<ToolCallView>` | Collapsed/expanded tool call display (**with file paths always visible**) |
| `<PermissionPrompt>` | Interactive permission dialog |
| `<DiffViewer>` | Inline diff display |
| `<Spinner>` | Parrot-themed animated spinner |
| `<StatusBar>` | Model, tokens, session info |
| `<TaskList>` | Todo list sidebar |
| `<ParrotBanner>` | ASCII art welcome screen |

### 4.3 ASCII Art Collection

```
Welcome Banner:
    ╭─────────────────────────────────╮
    │                                 │
    │     (•◡•)>   ~ chirp chirp! ~  │
    │    / 🦜 \    Mimi Code v1.0    │
    │   /  ||  \   Ready to help!    │
    │      ||                        │
    │     _||_                       │
    │    /____\                      │
    │                                 │
    ╰─────────────────────────────────╯

Thinking Spinner (animated):
  Frame 1:  🦜 ～ thinking...
  Frame 2:  🦜 ～～ thinking...
  Frame 3:  🦜 ～～～ thinking...

Error:
    (•̩̩̩̩_•̩̩̩̩)>  Oops! Something went wrong...
    / 🦜 \

Success:
    (•◡•)>  ✓ Done!
    / 🦜 \
```

### 4.4 Themes

```typescript
// packages/ui/src/themes/index.ts
interface MimiTheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  text: string;
  muted: string;
  background: string;
  // Parrot-specific
  parrotBody: string;
  parrotBeak: string;
  parrotEyes: string;
}

const defaultThemes = {
  'sunflower': { primary: '#FFD700', ... },     // Default: warm yellow
  'midnight': { primary: '#7B68EE', ... },       // Dark mode
  'sakura': { primary: '#FFB7C5', ... },         // Pink
  'terminal': { primary: '#00FF00', ... },       // Classic green
  'custom': null,                                 // From brand.json
};
```

### 4.5 Tasks

- [ ] Implement `IncrementalRenderer` (no flickering!)
- [ ] Build `<InputEditor>` with history, vim mode, paste preview
- [ ] Build `<OutputStream>` with streaming markdown
- [ ] Build `<ToolCallView>` with rich collapsed summaries
- [ ] Build `<PermissionPrompt>` dialogs
- [ ] Build `<DiffViewer>` component
- [ ] Build `<Spinner>` with parrot animation
- [ ] Build `<StatusBar>` component
- [ ] Build `<ParrotBanner>` welcome screen
- [ ] Design and implement theme system
- [ ] Create all ASCII art assets (welcome, error, success, thinking, etc.)
- [ ] Implement keyboard shortcuts (Ctrl+C, Ctrl+D, Shift+Tab, etc.)
- [ ] Accessibility: screen reader hints, reduced motion support
- [ ] Tests: render snapshot tests, theme tests

---

## Phase 5: MCP Integration

**Duration**: 2 weeks
**Branch**: `phase/5-mcp`
**Depends on**: Phase 2

### 5.1 MCP Client (Fix: Per-Tool Filtering)

```typescript
// packages/mcp/src/client/client.ts
class MCPClient {
  private servers: Map<string, MCPServer> = new Map();

  // Per-tool enable/disable
  async getTools(filter?: ToolFilter): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];
    for (const [name, server] of this.servers) {
      const serverTools = await server.listTools();
      for (const tool of serverTools) {
        const fqn = `mcp__${name}__${tool.name}`;
        if (!filter?.disabled?.includes(fqn)) {
          tools.push({ ...tool, name: fqn });
        }
      }
    }
    return tools;
  }
}
```

### 5.2 Transport Support

| Transport | Status | Notes |
|-----------|--------|-------|
| **stdio** | P0 | Child process, stdin/stdout |
| **Streamable HTTP** | P0 | Recommended by MCP spec |
| **SSE** | P1 | Deprecated but needed for compat |

### 5.3 Compatibility with Claude Code MCP Config

We read from the SAME config locations as Claude Code:
- `~/.claude.json` → `mcpServers` section (read-only compat)
- `.mcp.json` → project-scoped servers
- `~/.mimi/mcp.json` → Mimi-native config
- `brand.json` → white-label bundled servers

### 5.4 Tasks

- [ ] Implement MCP JSON-RPC 2.0 client
- [ ] Implement stdio transport
- [ ] Implement Streamable HTTP transport
- [ ] Implement SSE transport (compat)
- [ ] Implement OAuth 2.0 flow for MCP auth
- [ ] Implement per-tool filtering (enable/disable)
- [ ] Implement lazy tool loading (MCP tools loaded on-demand)
- [ ] Implement `mimi mcp add/remove/list` CLI commands
- [ ] Read `.claude.json` MCP config for backward compatibility
- [ ] Implement `/mcp` interactive management command
- [ ] Implement MCP resource support (`@server:resource`)
- [ ] Implement MCP prompts as commands
- [ ] Tests: protocol compliance, transport reliability, auth flows

---

## Phase 6: Hooks & Skills System

**Duration**: 1–2 weeks
**Branch**: `phase/6-hooks-skills`
**Depends on**: Phase 2, 3, 5

### 6.1 Hooks Runtime

Support ALL Claude Code hook events for full compatibility:

| Event | Supported |
|-------|-----------|
| `SessionStart` | Yes |
| `UserPromptSubmit` | Yes |
| `PreToolUse` | Yes |
| `PermissionRequest` | Yes |
| `PostToolUse` | Yes |
| `PostToolUseFailure` | Yes |
| `Notification` | Yes |
| `SubagentStart` | Yes |
| `SubagentStop` | Yes |
| `Stop` | Yes |
| `TaskCompleted` | Yes |
| `ConfigChange` | Yes |
| `PreCompact` | Yes |
| `SessionEnd` | Yes |

Handler types: `command`, `http`, `prompt`, `agent`

### 6.2 Skills Engine

Full SKILL.md compatibility:
- Frontmatter parsing (name, description, allowed-tools, model, context, hooks)
- String substitutions ($ARGUMENTS, $N, ${CLAUDE_SESSION_ID})
- Shell preprocessing (`!`command``)
- Discovery from: `~/.mimi/skills/`, `.mimi/skills/`, plugins, `~/.claude/skills/` (compat)

### 6.3 Tasks

- [ ] Implement hooks lifecycle manager
- [ ] Implement `command` handler (stdin JSON, exit codes)
- [ ] Implement `http` handler (POST JSON)
- [ ] Implement `prompt` handler (LLM evaluation)
- [ ] Implement `agent` handler (multi-turn)
- [ ] Implement hook matching (regex patterns)
- [ ] Implement SKILL.md parser
- [ ] Implement skill discovery & loading
- [ ] Implement skill execution runtime
- [ ] Implement `/hooks` and `/skills` interactive commands
- [ ] Backward compat: read `.claude/commands/` directory
- [ ] Tests: hook lifecycle, skill parsing, handler types

---

## Phase 7: Sub-agents & Teams

**Duration**: 2 weeks
**Branch**: `phase/7-agents`
**Depends on**: Phase 1, 2, 4, 6

### 7.1 Sub-agent System

```typescript
// packages/core/src/agent/subagent.ts
class SubAgentSpawner {
  async spawn(config: SubAgentConfig): Promise<SubAgentHandle> {
    const agent = new AgentLoop({
      provider: this.resolveProvider(config.model),
      tools: this.filterTools(config.tools, config.disallowedTools),
      systemPrompt: this.buildAgentPrompt(config),
      maxTurns: config.maxTurns,
      isolation: config.isolation,
    });

    if (config.background) {
      return this.runInBackground(agent, config);
    }
    return this.runInForeground(agent, config);
  }
}
```

### 7.2 Built-in Agent Types

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| `Explore` | haiku | Read-only | Fast codebase search |
| `Plan` | inherit | Read-only | Architecture planning |
| `general-purpose` | inherit | All | Complex multi-step tasks |

### 7.3 Custom Agents (`.mimi/agents/*.md`)

Full compatibility with Claude Code's agent frontmatter:
- name, description, tools, disallowedTools, model, permissionMode
- maxTurns, skills, mcpServers, hooks, memory, background, isolation

### 7.4 Tasks

- [ ] Implement `SubAgentSpawner`
- [ ] Implement foreground agent execution
- [ ] Implement background agent execution
- [ ] Implement agent resume (by conversation history)
- [ ] Implement git worktree isolation
- [ ] Implement built-in agent types (Explore, Plan, general-purpose)
- [ ] Implement custom agent loading (`.mimi/agents/`, `~/.mimi/agents/`)
- [ ] Backward compat: read `.claude/agents/` directory
- [ ] Implement `/agents` interactive management
- [ ] Implement Team mode (experimental, gated)
- [ ] Tests: agent spawning, isolation, lifecycle

---

## Phase 8: White-Label Engine

**Duration**: 2 weeks
**Branch**: `phase/8-brand`
**Depends on**: Phase 0–7

### 8.1 Brand Config System

```typescript
// packages/brand/src/config/loader.ts
class BrandLoader {
  load(brandPath: string): BrandConfig {
    const config = this.parse(brandPath);
    return {
      name: config.name,
      binaryName: config.binary_name,
      theme: this.resolveTheme(config.theme),
      asciiArt: this.loadAsciiArt(config.mascot),
      systemPrompt: {
        prepend: this.loadPrompt(config.system_prompt?.prepend),
        append: this.loadPrompt(config.system_prompt?.append),
        reminders: this.loadReminders(config.system_prompt?.reminders),
      },
      defaults: this.resolveDefaults(config.defaults),
      providers: this.resolveProviders(config.providers),
    };
  }
}
```

### 8.2 System Prompt Injection

```
Final prompt assembly order:
1. [Brand prepend prompt]     ← from brand.json
2. [Mimi core system prompt]  ← built-in, never overridable
3. [Brand append prompt]      ← from brand.json
4. [User CLAUDE.md / MIMI.md] ← project instructions
5. [MCP server instructions]  ← from connected MCPs
6. [Contextual reminders]     ← runtime-injected
```

### 8.3 Binary Builder

```bash
mimi build-brand --config ./brand.json --output ./dist/
# Produces:
#   dist/acme-code-darwin-arm64
#   dist/acme-code-darwin-x64
#   dist/acme-code-linux-arm64
#   dist/acme-code-linux-x64
#   dist/acme-code-win32-x64.exe
```

### 8.4 Tasks

- [ ] Implement `brand.json` schema + validator (with JSON Schema)
- [ ] Implement brand loader
- [ ] Implement system prompt injection layer
- [ ] Implement theme override system
- [ ] Implement ASCII art override system
- [ ] Implement `mimi init-brand` scaffolding command
- [ ] Implement `mimi build-brand` binary builder
- [ ] Implement `mimi publish-brand` (npm, homebrew)
- [ ] Implement brand-specific config directories (~/.{brand}/)
- [ ] Create brand.json JSON Schema for IDE autocomplete
- [ ] Tests: brand loading, prompt assembly order, theme overrides
- [ ] Write white-label guide documentation

---

## Phase 9: Distribution & Packaging

**Duration**: 1–2 weeks
**Branch**: `phase/9-distribution`
**Depends on**: Phase 8

### 9.1 Distribution Channels

| Channel | Priority | Method |
|---------|----------|--------|
| **npm** | P0 | `@mimi-code/cli` + brand scoped packages |
| **Homebrew** | P0 | Official tap + brand taps |
| **curl installer** | P0 | `curl -fsSL https://mimi-code.dev/install.sh \| sh` |
| **GitHub Releases** | P0 | Pre-built binaries per platform |
| **Docker** | P1 | Official image for CI/headless |
| **WinGet** | P1 | Windows native package |
| **Nix** | P2 | Nix flake |

### 9.2 Auto-Update System

```typescript
// Soft-update: check in background, notify user
// Hard-update: only for critical security fixes
class AutoUpdater {
  async checkForUpdate(): Promise<UpdateInfo | null> {
    // Check brand-specific update URL first, then default
    const url = this.brand.distribution?.auto_update_url
      || 'https://api.mimi-code.dev/updates';
    // ...
  }
}
```

### 9.3 Tasks

- [ ] Set up npm publishing workflow
- [ ] Create Homebrew formula + tap
- [ ] Create install.sh script
- [ ] Set up GitHub Releases with pre-built binaries
- [ ] Implement auto-update system
- [ ] Create Docker image
- [ ] Create WinGet manifest
- [ ] Brand: npm scope publishing, custom install scripts
- [ ] Tests: install scripts on all platforms

---

## Phase 10: Polish & Launch

**Duration**: 2 weeks
**Branch**: `phase/10-launch`
**Depends on**: Phase 0–9

### 10.1 CLI Commands (Full List)

```
mimi                          # Interactive session
mimi "query"                  # Session with initial prompt
mimi -p "query"               # Print mode (non-interactive)
mimi -c                       # Continue most recent conversation
mimi -r "session"             # Resume session
mimi -w                       # Start in git worktree

# Auth
mimi auth login
mimi auth logout
mimi auth status

# MCP
mimi mcp add <name> <url>
mimi mcp remove <name>
mimi mcp list

# Agents
mimi agents

# Brand
mimi init-brand
mimi build-brand
mimi publish-brand

# System
mimi update
mimi doctor
```

### 10.2 Slash Commands (Built-in)

```
/clear          /compact        /config
/context        /copy           /cost
/diff           /exit           /fast
/fork           /help           /hooks
/init           /login          /logout
/mcp            /memory         /model
/permissions    /plan           /plugin
/rename         /resume         /review
/rewind         /sandbox        /skills
/simplify       /stats          /status
/tasks          /theme          /vim
```

### 10.3 Documentation

- [ ] README.md with gorgeous ASCII art header
- [ ] Getting Started guide
- [ ] White-Label Guide (the star of the docs)
- [ ] Architecture deep-dive
- [ ] API reference (for SDK/programmatic usage)
- [ ] Migration guide from Claude Code
- [ ] Contributing guide

### 10.4 Launch Tasks

- [ ] Performance profiling & optimization
- [ ] Memory leak testing (long sessions)
- [ ] Cross-platform final validation
- [ ] Security audit
- [ ] Write all documentation
- [ ] Create demo GIF / video
- [ ] Create landing page
- [ ] Write launch blog post
- [ ] Submit to Hacker News / Reddit / Twitter

---

## Tech Stack Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Language** | TypeScript (strict) | Same ecosystem as Claude Code; type safety; broad contributor pool |
| **Runtime** | Node.js 22+ | LTS, stable, cross-platform; matches Claude Code |
| **Package Manager** | pnpm | Fast, disk-efficient, great monorepo support |
| **Monorepo** | Turborepo | Parallel builds, remote caching, well-maintained |
| **Terminal UI** | Ink 5 + React 19 | Proven for terminal apps; but we fix the rendering layer |
| **Database** | better-sqlite3 | Zero-config, fast, single-file; for sessions/permissions |
| **Bundler** | tsup (esbuild) | Extremely fast TypeScript bundling |
| **Testing** | Vitest | Fast, TypeScript-native, good DX |
| **Linting** | Biome | Fast single tool, replaces ESLint+Prettier |
| **CI** | GitHub Actions | Standard, free for open source |
| **Binary** | pkg or bun compile | Cross-platform native binaries |
| **Schema** | Zod | Runtime validation + TypeScript inference |
| **Search** | @vscode/ripgrep | Bundled ripgrep binary, cross-platform |
| **CLI** | Commander | Battle-tested, standard |

### Why NOT Rust/Go?

While Rust or Go would give better performance, TypeScript was chosen because:
1. **Ecosystem compatibility** — Claude Code is TypeScript; MCP SDK is TypeScript; plugins are JavaScript
2. **Contributor accessibility** — More developers can contribute
3. **Rapid iteration** — TypeScript allows faster feature development
4. **Ink/React** — The terminal UI framework is React-based
5. **MCP client libraries** — Reference implementations are TypeScript

Performance hotspots (ripgrep, glob, SQLite) use native bindings anyway.

---

## Compatibility Matrix

### Claude Code Ecosystem Compatibility

| Feature | Compatible | Notes |
|---------|-----------|-------|
| `CLAUDE.md` | Yes | Read from same locations |
| `AGENTS.md` | Yes | Also supports the emerging standard |
| `.claude/settings.json` | Yes | Read as fallback |
| `.claude/agents/` | Yes | Read as fallback |
| `.claude/skills/` | Yes | Read as fallback |
| `.claude/commands/` | Yes | Legacy compat |
| `.mcp.json` | Yes | Same format |
| `~/.claude.json` MCP servers | Yes | Read-only compat |
| Hooks (all events) | Yes | Same JSON protocol |
| Plugins | Yes | Same `.claude-plugin/` structure |
| MCP servers | Yes | Full protocol support |
| API providers | Yes | Anthropic, Bedrock, Vertex + OpenAI-compatible |
| Permission rules | Yes | Same syntax |
| Sandbox config | Yes | Same schema |

### Mimi-Native Additions

| Feature | Description |
|---------|-------------|
| `.mimi/` directory | Mimi-specific config (alongside .claude/) |
| `MIMI.md` | Mimi-specific project instructions |
| `brand.json` | White-label configuration |
| SQLite sessions | Per-project session DB |
| SQLite permissions | Persistent "always allow" |
| Incremental rendering | No flickering |
| Rolling compaction | Never deadlocks |
| Per-tool MCP filtering | Enable/disable individual tools |
| Lazy tool loading | Tools loaded on-demand |
| Fuzzy edit matching | Fallback when exact match fails |

---

## Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| **Phase 0** | Week 1 | Project scaffold, CI, toolchain |
| **Phase 1** | Weeks 2–3 | Agent loop, context, sessions |
| **Phase 2** | Weeks 4–6 | All built-in tools |
| **Phase 3** | Weeks 6–7 | Permissions, security |
| **Phase 4** | Weeks 7–9 | Terminal UI (no flickering!) |
| **Phase 5** | Weeks 9–10 | MCP integration |
| **Phase 6** | Weeks 10–11 | Hooks & skills |
| **Phase 7** | Weeks 11–12 | Sub-agents & teams |
| **Phase 8** | Weeks 13–14 | White-label engine |
| **Phase 9** | Weeks 14–15 | Distribution & packaging |
| **Phase 10** | Weeks 15–16 | Polish & launch |

**Total: ~16 weeks (4 months) to v1.0**

---

## Git Workflow

```
main          ← Protected: requires PR + 1 review + status checks
  └── develop ← Integration branch
       ├── phase/0-foundation
       ├── phase/1-agent-loop
       ├── phase/2-tools
       ├── phase/3-permissions
       ├── phase/4-ui
       ├── phase/5-mcp
       ├── phase/6-hooks-skills
       ├── phase/7-agents
       ├── phase/8-brand
       ├── phase/9-distribution
       └── phase/10-launch
```

Each phase merges to `develop` via PR. `develop` → `main` for releases.

---

```
    (•◡•)>  Let's build something amazing!
    / 🦜 \
   /  ||  \
      ||
     _||_
    /____\

    Mimi Code — Your Friendly AI Coding CLI
    Made with 💛 by a yellow Quaker parrot
```
