# Mimi Code — Project Instructions

## Overview
Open-source CLI agent (Claude Code alternative) built as a 10-package TypeScript monorepo.

## Tech Stack
- **Runtime**: Node.js 18+, TypeScript strict mode
- **Build**: pnpm workspaces, Turborepo, tsup
- **Test**: Vitest
- **UI**: Ink 5 + React 18 (TUI)
- **LLM**: @anthropic-ai/sdk
- **Storage**: better-sqlite3

## Package Dependency Order
```
@mimi/core (zero deps)
  → @mimi/tools, @mimi/permissions, @mimi/mcp
    → @mimi/hooks, @mimi/skills
      → @mimi/agents, @mimi/ui, @mimi/brand
        → @mimi/cli (top-level entry)
```

## Key Commands
```bash
pnpm build          # Build all 10 packages
pnpm test           # Run all tests
pnpm dev            # Dev mode with watch
node packages/cli/dist/cli.js --help   # Run CLI
```

## Architecture Conventions
- All packages use ESM (`"type": "module"` in package.json)
- Imports use `.js` extension (ESM requirement)
- DI container with `Token<T>` phantom types in `@mimi/core`
- EventBus is typed with `EventMap` interface
- Tool names use FQN format: `mcp__<server>__<tool>` for MCP tools
- Prompt cache breakpoints use `cache_control: { type: 'ephemeral' }`
- Agent states: IDLE → ASSEMBLING → COMPACTING → STREAMING → CHECKING_PERM → AWAITING_USER → EXECUTING_TOOL → LOOP_BACK → CANCELLED

## Code Style
- No default exports; always named exports
- Prefer `interface` over `type` for object shapes
- Use `readonly` for arrays returned from getters
- Tests go in `src/__tests__/` within each package
- Config files: `.mimi/config.json`, `.mimi.json`, `.claude/settings.json`
