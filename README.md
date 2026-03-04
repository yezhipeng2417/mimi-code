# 🦜 Mimi Code

**Your Friendly AI Coding CLI** — An open-source, white-label CLI agent built with TypeScript.

```
    ╭───────────────────────────────────────────╮
    │                                             │
    │            .▄▄▄▄.                           │
    │          ▄▀░░░░░░▀▄                         │
    │         █░░●░░░░░░█                         │
    │         █░░░▄██▀▀▀▔╲   M I M I  C O D E    │
    │          █░░▀▀▀▀▀▀▀    ~chirp chirp!~       │
    │          █░░░░░░░█                           │
    │         █░╱░░░░╲░█   v0.1.0                 │
    │          ▀█░░░░█▀                            │
    │            ╫╫╫╫                              │
    │         ═══╧══╧═══                           │
    │                                              │
    ╰───────────────────────────────────────────╯
```

Mimi Code is a modular, extensible CLI agent that connects to the Anthropic API to help with software engineering tasks. It features a prompt cache-first architecture, MCP server support, a permission system, and a white-label branding system.

## Features

- **Streaming AI responses** via Anthropic Claude API
- **Built-in tools**: Read, Write, Edit, Glob, Grep, Bash, NotebookEdit
- **MCP server support** for extending capabilities
- **4-tier permission engine** (config rules → persistent store → session rules → ask user)
- **9-state agent loop** with automatic compaction
- **White-label branding** via `brand.json`
- **Slash commands and skills** system
- **Hook system** for pre/post tool execution
- **Sub-agent orchestration** for complex tasks
- **Prompt caching** for cost optimization
- **SQLite session persistence**

## Quick Start

```bash
# Clone
git clone https://github.com/yezhipeng2417/mimi-code.git
cd mimi-code

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Run interactive mode
node packages/cli/dist/cli.js

# Or one-shot mode
node packages/cli/dist/cli.js "explain this codebase"
```

## Architecture

Mimi Code is organized as a **10-package monorepo** with a strict dependency DAG:

```
@mimi/core          ← Foundation: types, DI container, event bus, agent loop
  ├── @mimi/tools        ← Tool registry, executor, 7 built-in tools
  ├── @mimi/permissions  ← 4-tier permission engine with glob matching
  └── @mimi/mcp          ← MCP client (JSON-RPC 2.0 over stdio)
        ├── @mimi/hooks       ← Pre/post tool execution hooks
        └── @mimi/skills      ← Slash command and skill system
              ├── @mimi/agents      ← Sub-agent orchestrator
              ├── @mimi/ui          ← Ink/React terminal components
              └── @mimi/brand       ← White-label branding + ASCII art
                    └── @mimi/cli        ← Entry point, DI wiring, REPL
```

### Key Design Decisions

- **Prompt Cache-First**: Static system prompt → brand layers → tools → dynamic messages, with `cache_control: ephemeral` breakpoints for optimal cache hit rates
- **Deferred Tool Loading**: Lightweight MCP tool stubs loaded upfront; full schemas loaded on-demand via ToolSearch
- **DI Container**: Typed Token\<T\> with phantom types, factory-based lazy singletons, hierarchical scoping for sub-agents
- **Event-Driven**: EventBus with 22 typed channels for decoupled communication between packages

## Packages

| Package | Description | Size |
|---------|-------------|------|
| `@mimi/core` | Types, DI container, EventBus, AgentLoop, PromptAssembler, SessionStore | ~1400 LOC |
| `@mimi/tools` | ToolRegistry, ToolExecutor, 7 built-in tools, ToolSearch | ~900 LOC |
| `@mimi/permissions` | PermissionEngine, PathMatcher, 4-tier evaluation | ~270 LOC |
| `@mimi/mcp` | McpClient, StdioTransport (JSON-RPC 2.0), McpToolAdapter | ~600 LOC |
| `@mimi/hooks` | HookRunner for shell command hooks | ~210 LOC |
| `@mimi/skills` | SkillLoader (multi-source discovery), SkillRunner | ~210 LOC |
| `@mimi/agents` | AgentOrchestrator for sub-agent spawning | ~170 LOC |
| `@mimi/ui` | Ink 5 + React terminal components (Spinner, ToolStatus, etc.) | ~300 LOC |
| `@mimi/brand` | BrandLoader, ASCII art banner, theme system | ~400 LOC |
| `@mimi/cli` | CLI entry, DI wiring, REPL, AnthropicProvider | ~900 LOC |

## White-Label Branding

Create a `brand.json` to customize Mimi as your own product:

```json
{
  "name": "MyAgent",
  "version": "1.0.0",
  "welcomeMessage": "Welcome to MyAgent!",
  "defaultModel": "claude-sonnet-4-6",
  "prompt": {
    "prepend": "You are MyAgent, a specialized coding assistant.",
    "append": "Always follow our company coding standards."
  },
  "theme": {
    "primary": "#FF6600",
    "accent": "#00CCFF"
  }
}
```

```bash
node packages/cli/dist/cli.js --brand ./brand.json
```

## Development

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Run tests (37 tests across 3 packages)
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Watch mode
pnpm dev
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **Monorepo**: pnpm workspaces + Turborepo
- **Build**: tsup (esbuild)
- **Test**: Vitest
- **Lint**: Biome
- **UI**: Ink 5 + React 18
- **AI SDK**: @anthropic-ai/sdk
- **Database**: better-sqlite3

## License

MIT
