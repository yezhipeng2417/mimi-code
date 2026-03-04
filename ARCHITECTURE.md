Here is the comprehensive architecture document for Mimi Code.

---

# Mimi Code -- System Architecture Document

## Document Metadata

```
Version:     1.0.0-draft
Date:        2026-03-04
Status:      Architecture Specification
Audience:    Senior engineers ready to implement
Scope:       Full system -- monorepo through white-label distribution
```

---

## 1. Package Architecture (Monorepo Structure)

### 1.1 Package Dependency DAG

The monorepo contains 10 packages. The dependency graph is strictly acyclic. Arrows indicate "depends on."

```
                          +-----------+
                          |   @mimi/  |
                          |    cli    |  <-- Entry point, depends on everything
                          +-----+-----+
                                |
            +-------------------+-------------------+
            |                   |                   |
       +----v----+        +-----v-----+       +-----v-----+
       |  @mimi/ |        |   @mimi/  |       |   @mimi/  |
       |  brand  |        |    ui     |       |  agents   |
       +----+----+        +-----+-----+       +-----+-----+
            |                   |                   |
            +--------+  +------+------+   +---------+
                     |  |             |   |
                +----v--v---+   +-----v---v---+
                |   @mimi/  |   |    @mimi/   |
                |   hooks   |   |   skills    |
                +-----+-----+   +------+------+
                      |                |
                      +-------+--------+
                              |
            +-----------------+-----------------+
            |                 |                 |
       +----v----+      +----v------+     +----v----+
       |  @mimi/ |      |   @mimi/  |     |  @mimi/ |
       |  tools  |      |permissions|     |   mcp   |
       +----+----+      +-----+-----+     +----+----+
            |                 |                 |
            +-----------------+-----------------+
                              |
                        +-----v-----+
                        |   @mimi/  |
                        |   core    |  <-- Foundation, depends on nothing internal
                        +-----------+
```

### 1.2 Package Definitions and Boundaries

**@mimi/core** -- Foundation layer. Zero internal dependencies.

```
Purpose:  Agent loop, context management, session storage, provider
          abstraction, prompt assembly, event bus, DI container,
          shared types and utilities.

Public API surface:
  - AgentLoop           (class)    -- ReAct agent state machine
  - ContextManager      (class)    -- Token tracking and compaction
  - SessionStore        (class)    -- SQLite session persistence
  - PromptAssembler     (class)    -- System prompt composition
  - EventBus            (class)    -- Typed pub/sub event system
  - ServiceContainer    (class)    -- Dependency injection container
  - LLMProvider         (interface)-- Provider abstraction
  - StreamEvent         (type)     -- Normalized streaming events
  - Message, ToolCall   (types)    -- Core domain types
  - TokenCounter        (class)    -- Token estimation

Dependency rule: May import ONLY from Node.js stdlib, npm externals.
                 Never imports from any other @mimi/* package.
```

**@mimi/tools** -- Built-in tool implementations.

```
Purpose:  Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch,
          NotebookEdit, TodoWrite/Read, AskUser. Also contains the
          ToolRegistry that manages all tool sources.

Public API surface:
  - ToolRegistry        (class)    -- Unified registry for all tool sources
  - Tool                (interface)-- Contract every tool implements
  - ToolResult          (type)     -- Standardized tool output
  - builtinTools        (array)    -- All built-in tool factories

Dependency rule: Imports from @mimi/core only.
```

**@mimi/permissions** -- Permission engine and security.

```
Purpose:  Rule evaluation, persistent permission store, sandbox
          management, audit logging.

Public API surface:
  - PermissionEngine    (class)    -- Rule evaluator
  - PermissionStore     (class)    -- SQLite persistence for "always allow"
  - SandboxManager      (class)    -- Filesystem/network restrictions
  - AuditLogger         (class)    -- Structured audit trail
  - PermissionDecision  (type)     -- allow | deny | ask

Dependency rule: Imports from @mimi/core only.
```

**@mimi/mcp** -- MCP protocol client.

```
Purpose:  JSON-RPC 2.0 client, transport layers (stdio, HTTP, SSE),
          OAuth 2.0 flow, server lifecycle management.

Public API surface:
  - MCPClient           (class)    -- Multi-server MCP client
  - MCPTransport        (interface)-- Transport abstraction
  - MCPServerManager    (class)    -- Server lifecycle
  - StdioTransport      (class)
  - HttpTransport       (class)
  - SseTransport        (class)

Dependency rule: Imports from @mimi/core only.
```

**@mimi/hooks** -- Lifecycle hook runtime.

```
Purpose:  Hook registration, matching, execution for all lifecycle
          events. Supports command, http, prompt, and agent handlers.

Public API surface:
  - HookRuntime         (class)    -- Hook lifecycle manager
  - HookRegistry        (class)    -- Hook config loading and matching
  - HookHandler         (interface)-- Handler contract
  - HookEvent           (enum)     -- All lifecycle event types

Dependency rule: Imports from @mimi/core, @mimi/tools, @mimi/permissions.
```

**@mimi/skills** -- Skill engine.

```
Purpose:  SKILL.md frontmatter parsing, discovery, variable substitution,
          shell preprocessing, execution runtime.

Public API surface:
  - SkillEngine         (class)    -- Skill loader and executor
  - SkillParser         (class)    -- SKILL.md frontmatter parser
  - SkillManifest       (type)     -- Parsed skill definition

Dependency rule: Imports from @mimi/core, @mimi/tools, @mimi/permissions.
```

**@mimi/agents** -- Sub-agent spawning and team orchestration.

```
Purpose:  Sub-agent spawner, built-in agent types (Explore, Plan,
          general-purpose), custom agent loading, team mode.

Public API surface:
  - SubAgentSpawner     (class)    -- Agent factory
  - AgentHandle         (class)    -- Control handle for running agents
  - AgentConfig         (type)     -- Agent definition

Dependency rule: Imports from @mimi/core, @mimi/tools, @mimi/permissions,
                 @mimi/mcp, @mimi/hooks, @mimi/skills.
```

**@mimi/ui** -- Terminal user interface.

```
Purpose:  Ink+React components, incremental ANSI renderer, themes,
          ASCII art, keyboard handling.

Public API surface:
  - MimiApp             (component)-- Root React component
  - IncrementalRenderer (class)    -- Diff-based terminal renderer
  - ThemeProvider       (component)-- Theme context
  - createApp           (function) -- App factory with DI wiring

Dependency rule: Imports from @mimi/core, @mimi/tools, @mimi/permissions,
                 @mimi/hooks. Does NOT import @mimi/mcp directly (uses
                 ToolRegistry abstraction).
```

**@mimi/brand** -- White-label engine.

```
Purpose:  brand.json parsing, prompt injection layers, theme overrides,
          binary builder, distribution tooling.

Public API surface:
  - BrandLoader         (class)    -- brand.json parser
  - BrandBuilder        (class)    -- Binary packaging
  - BrandPromptLayer    (class)    -- Prompt prepend/append injection
  - BrandConfig         (type)     -- Validated brand configuration

Dependency rule: Imports from @mimi/core, @mimi/ui.
```

**@mimi/cli** -- Entry point and CLI commands.

```
Purpose:  Commander-based CLI, command handlers, process lifecycle,
          composition root (wires DI container).

Public API surface:
  - main                (function) -- Process entry point
  - (No other public API -- this is the composition root)

Dependency rule: Imports from ALL @mimi/* packages. This is the
                 only package allowed to depend on everything.
```

### 1.3 Dependency Rules (Enforced by Lint)

```
Rule 1: No circular dependencies. The DAG above is the source of truth.
Rule 2: @mimi/core imports from NO internal packages.
Rule 3: Only @mimi/cli may import from @mimi/brand, @mimi/ui, @mimi/agents.
Rule 4: No package may import from @mimi/cli.
Rule 5: Shared types live in @mimi/core. No cross-package type duplication.
Rule 6: Each package exports through a single index.ts barrel file.
Rule 7: Internal modules use /internal/ path convention and are not exported.
```

These rules are enforced by a custom Turborepo lint task that analyzes import graphs.

---

## 2. Core Engine Design

### 2.1 Agent Loop State Machine

The agent loop implements a ReAct (Reason + Act) pattern as a finite state machine.

```
                              +----------------+
                              |                |
                    +---------+     IDLE       |<-----------+
                    |         |                |            |
                    |         +-------+--------+            |
                    |                 |                      |
                    |          user message                  |
                    |          or resume                     |
                    |                 |                      |
                    |         +-------v--------+            |
                    |         |                |            |
                    |         | ASSEMBLING     |            |
                    |         | PROMPT         |            |
           cancel   |         |                |            |
           at any   |         +-------+--------+            |
           point    |                 |                      |
                    |          check context                 |
                    |          budget                        |
                    |                 |                      |
                    |         +-------v--------+            |
                    |    +--->|                |            |
                    |    |    | COMPACTING     |            |  stop signal
                    |    |    | (if needed)    +-----+      |  (no tool_use
                    |    |    +----------------+     |      |   in response)
                    |    |                          |      |
                    |    |  still over              |      |
                    |    |  threshold               |      |
                    |    +-----+                    |      |
                    |                               |      |
                    |         +-------v--------+    |      |
                    |         |                <----+      |
                    |         | STREAMING      |           |
                    |         | (API call)     |           |
                    |         |                |           |
                    |         +---+--------+---+           |
                    |             |        |               |
                    |        tool_use   end_turn           |
                    |             |        |               |
                    |    +--------v---+    +---------------+
                    |    |            |
                    |    | CHECKING   |
                    |    | PERMISSION |
                    |    |            |
                    |    +--+---------+
                    |       |      |
                    |    allow   deny/ask
                    |       |      |
                    |       |   +--v----------+
                    |       |   |             |
                    |       |   | AWAITING    |
                    |       |   | USER        |
                    |       |   | (permission)|
                    |       |   +--+----------+
                    |       |      |
                    |       |   allow/deny
                    |       |      |
                    |    +--v------v---+
                    |    |             |
                    |    | EXECUTING   |
                    |    | TOOL        |
                    |    |             |
                    |    +------+------+
                    |           |
                    |      tool result
                    |      appended to
                    |      messages
                    |           |
                    |    +------v------+
                    |    |             |
                    |    | LOOP BACK   +---------> (back to ASSEMBLING)
                    |    | (next turn) |
                    |    +-------------+
                    |
                    |         +----------------+
                    +-------->|                |
                              |  CANCELLED     |
                              |  (cleanup)     |
                              +-------+--------+
                                      |
                                      v
                                   (IDLE)
```

State descriptions:

```
IDLE             No active conversation turn. Awaiting user input.
ASSEMBLING       Building the API request: system prompts, messages,
                 tool schemas. Checks context budget.
COMPACTING       Summarizing older messages to free context space.
                 Multi-tier: recent verbatim, middle summarized, old dropped.
STREAMING        SSE connection open, receiving tokens from the provider.
                 Yields AgentEvents to the UI as they arrive.
CHECKING_PERM    Evaluating permission rules for a requested tool call.
AWAITING_USER    Blocked on user input for a permission decision.
EXECUTING_TOOL   Running the tool. May be async with timeout.
LOOP_BACK        Appending tool result to messages, deciding whether to
                 loop (tool_use present) or stop (end_turn).
CANCELLED        User pressed Ctrl+C or timeout. Cleanup in progress.
```

### 2.2 Message Lifecycle

A complete request-response cycle from keystroke to rendered output:

```
Step 1: USER INPUT
  User types message in <InputEditor>
    |
    v
Step 2: HOOK: UserPromptSubmit
  HookRuntime fires UserPromptSubmit event
  Hooks may modify or reject the message
    |
    v
Step 3: MESSAGE APPEND
  AgentLoop.messages.push({ role: 'user', content: userMessage })
  SessionStore.saveMessage(sessionId, message)
    |
    v
Step 4: CONTEXT CHECK
  ContextManager.checkBudget(messages)
  If usage > compactionThreshold:
    summarize oldest turns (see Section 2.3)
    |
    v
Step 5: PROMPT ASSEMBLY (cache-optimized, see Section 2.4)
  PromptAssembler.build() composes in strict cache order:
    system:   [core system + brand prepend/append]     ← STATIC, globally cached
    tools:    [frozen tool schemas, sorted]             ← STATIC, session-frozen
    messages: [project config as msg] + [conversation]  ← prefix-cached per turn
              + [system-reminders in latest user msg]   ← dynamic, uncached
  Tool schemas frozen at session start. Dynamic info in system-reminders only.
    |
    v
Step 6: API CALL
  LLMProvider.createMessage({
    system, messages, tools, maxTokens, stream: true
  })
  Returns AsyncIterable<ProviderStreamEvent>
    |
    v
Step 7: STREAM NORMALIZATION
  StreamNormalizer converts provider-specific events to
  unified StreamEvent types:
    content_block_start | content_block_delta |
    content_block_stop  | message_start |
    message_delta       | message_stop
    |
    v
Step 8: EVENT DISPATCH
  EventBus.emit(event) for each normalized stream event
  UI subscribes and renders incrementally
  AuditLogger records
    |
    v
Step 9: TOOL USE DETECTION
  If response contains tool_use content blocks:
    For each tool_use block:
      a. HOOK: PreToolUse fires
      b. PermissionEngine.check(tool, input)
      c. If ask: yield permission prompt to UI, await response
      d. HOOK: PermissionRequest fires
      e. ToolRegistry.execute(tool, input) with timeout
      f. HOOK: PostToolUse fires (or PostToolUseFailure)
      g. Append tool_result message
      h. SessionStore.saveToolResult(...)
    |
    v
Step 10: LOOP OR STOP
  If any tool_use blocks existed: GOTO Step 4
  If stop_reason == 'end_turn': yield final response, go IDLE
    |
    v
Step 11: HOOK: Stop
  HookRuntime fires Stop event
  Session auto-saved
```

### 2.3 Context Window Management -- Rolling Compaction

The compaction algorithm operates on a three-tier model:

```
Context Window Layout (200K tokens example):

+------------------------------------------------------------------+
|  ZONE A: PROTECTED (never compacted)                              |
|  - System prompts (~2-8K tokens)                                  |
|  - CLAUDE.md / MIMI.md content                                    |
|  - MCP server instructions                                        |
|  - Active skill/agent prompts                                      |
+------------------------------------------------------------------+
|  ZONE B: COMPACTABLE (summarized when needed)                     |
|  - Older conversation turns                                        |
|  - Old tool results (replaced with summaries)                     |
|  - Compaction creates a single "summary" message block            |
+------------------------------------------------------------------+
|  ZONE C: RECENT (preserved verbatim)                              |
|  - Last N turns (configurable, default: last 10 turns)            |
|  - All tool results from current task context                     |
|  - Any message marked as "anchor" by a tool                       |
+------------------------------------------------------------------+
|  ZONE D: BUDGET (remaining space for API response)                |
|  - Reserved for model output (~8K tokens minimum)                 |
+------------------------------------------------------------------+
```

Compaction algorithm:

```
function compact(messages: Message[]): Message[] {
  const budget = maxTokens - reservedForOutput - protectedZoneTokens;
  const currentUsage = countTokens(messages);

  if (currentUsage / budget < compactionThreshold) {
    return messages;  // No compaction needed
  }

  // Step 1: Identify the split point
  //   Keep the most recent `recentTurnCount` turns verbatim
  //   Everything older is candidate for compaction
  const splitIndex = messages.length - (recentTurnCount * 2);
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

  // Step 2: Check for anchors in old messages
  //   Anchors are messages explicitly marked as important
  //   (e.g., file contents the model is actively editing)
  const anchors = oldMessages.filter(m => m.metadata?.anchor);
  const compactable = oldMessages.filter(m => !m.metadata?.anchor);

  // Step 3: Summarize compactable messages
  //   Use a fast model (haiku-class) to create a structured summary
  //   Summary format:
  //     "Previous conversation summary:
  //      - User asked to implement auth system
  //      - Files modified: src/auth.ts, src/middleware.ts
  //      - Key decisions: JWT with refresh tokens, bcrypt for hashing
  //      - Current state: auth middleware complete, tests passing"
  const summary = await summarize(compactable);

  // Step 4: Reconstruct message array
  return [
    { role: 'user', content: summary, metadata: { type: 'compaction_summary' } },
    { role: 'assistant', content: 'Understood. I have the context from our previous conversation.' },
    ...anchors,
    ...recentMessages
  ];
}
```

Compaction triggers:

```
Proactive trigger:  usage > 60% AND messages.length increased since last check
Warning trigger:    usage > 80%, emit warning event to UI
Critical trigger:   usage > 90%, force-compact with aggressive settings
Emergency trigger:  usage > 95%, drop old tool results entirely (never deadlock)
```

### 2.4 Prompt Caching Architecture

> "You fundamentally have to design agents for prompt caching first,
>  almost every feature touches on it somehow."
> — Thariq Shihipar, Claude Code engineer

Prompt caching is the single most important cost and latency optimization. The Anthropic API caches via **prefix matching** — content is cached from request start through each `cache_control` breakpoint. Any change in the prefix invalidates ALL subsequent cache. This shapes every architectural decision.

#### 2.4.1 Cache-Optimized Request Layout

The API request body MUST maintain this exact ordering — **static first, dynamic last**:

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1: STATIC SYSTEM PROMPT          [cache_control: eph] │
│  (Core agent behavior, safety rules, tool instructions)      │
│  → Shared across ALL users, ALL sessions                     │
│  → NEVER modified mid-session                                │
├──────────────────────────────────────────────────────────────┤
│  LAYER 2: TOOL DEFINITIONS              [cache_control: eph] │
│  (JSON schemas for all registered tools)                     │
│  → Stable within a session — NEVER add/remove tools          │
│  → MCP tools use defer_loading stubs (see 2.4.3)            │
├──────────────────────────────────────────────────────────────┤
│  LAYER 3: BRAND + PROJECT CONFIG        [cache_control: eph] │
│  (brand.json prepend/append + MIMI.md/CLAUDE.md)             │
│  → Shared across sessions in the same project                │
│  → Only changes when user edits MIMI.md                      │
├──────────────────────────────────────────────────────────────┤
│  LAYER 4: CONVERSATION MESSAGES         (no cache control)   │
│  (User turns, assistant turns, tool results)                 │
│  → Unique per session, grows each turn                       │
│  → Previous turns cached via prefix matching                 │
├──────────────────────────────────────────────────────────────┤
│  LAYER 5: SYSTEM REMINDERS              (no cache control)   │
│  (Current date, env info, context reminders, MCP reminders)  │
│  → Injected as system-role messages WITHIN conversation      │
│  → NEVER injected into system prompt (would break cache)     │
└──────────────────────────────────────────────────────────────┘
```

Key invariants:
- Layers 1-3 form the **cacheable prefix**. They MUST NOT change within a session.
- Dynamic information (timestamps, git status, session state) goes into Layer 5 as system-reminder messages interleaved in the conversation, NOT in the system prompt.
- Tool definitions (Layer 2) are frozen at session start. New MCP tools discovered mid-session are deferred until next session or loaded via ToolSearch.

#### 2.4.2 Cache Breakpoint Strategy

```typescript
interface CacheBreakpoints {
  // Place cache_control markers at layer boundaries
  systemPromptEnd: CacheHint;     // After Layer 1
  toolDefinitionsEnd: CacheHint;  // After Layer 2
  projectConfigEnd: CacheHint;    // After Layer 3
  // Layer 4+ has no explicit breakpoints — relies on prefix matching
}

// In PromptAssembler.build():
function buildRequest(session: Session): APIRequest {
  return {
    system: [
      { type: 'text', text: coreSystemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    tools: [
      ...frozenToolSchemas,  // frozen at session start
      // Last tool gets cache_control
      { ...lastTool, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      // Brand + project instructions as first user message
      { role: 'user', content: brandAndProjectInstructions, cache_control: { type: 'ephemeral' } },
      { role: 'assistant', content: 'Understood.' },
      // Conversation messages (prefix-cached automatically)
      ...conversationMessages,
      // Dynamic reminders injected into latest user message
    ],
  };
}
```

#### 2.4.3 Deferred Tool Loading (defer_loading)

Full MCP tool schemas can be thousands of tokens. Loading all of them into the tool definitions breaks cache and wastes tokens. Solution: **lightweight stubs + on-demand loading**.

```typescript
// At session start: register lightweight stubs
interface DeferredToolStub {
  name: string;
  description: string;          // Short 1-line description
  defer_loading: true;          // Flag: full schema not loaded
  source: ToolSource;           // Which MCP server provides it
  // inputSchema is OMITTED — model cannot call this directly
}

// When model calls ToolSearch:
//   1. Return matching tool descriptions
//   2. Load full schema for selected tools
//   3. Inject full schema into NEXT turn's system-reminder
//      (NOT into tool definitions — that would break cache)

// ToolSearch is always available as a built-in tool:
const toolSearchTool = {
  name: 'ToolSearch',
  description: 'Search for and load additional tools by name or capability',
  inputSchema: z.object({
    query: z.string().describe('Search query for tool name or capability'),
  }),
};
```

#### 2.4.4 Cache-Safe Compaction

Standard summarization would create a new request with different system prompt → cache miss. Cache-safe compaction preserves the entire cacheable prefix:

```
BEFORE compaction (turn 50, 180K tokens):
  [System prompt] [Tools] [Brand+MIMI.md] [Turn 1..50]

AFTER compaction:
  [System prompt] [Tools] [Brand+MIMI.md]   ← IDENTICAL prefix (cache HIT)
  [Summary of turns 1..40]                    ← New summary message
  [Turn 41..50]                               ← Recent turns preserved

The compaction request itself is a separate API call:
  [System prompt] [Tools] [Brand+MIMI.md]   ← Same prefix (cache HIT)
  [Turn 1..40]                               ← Messages to summarize
  [User: "Summarize the above conversation"] ← Compaction instruction
```

This ensures the compaction API call ALSO benefits from the cached prefix.

#### 2.4.5 No Mid-Session Model Switching

Switching from Opus to Haiku mid-session forces a complete cache rebuild (different model = different KV cache). At 100K+ tokens, rebuilding cache is MORE expensive than just using Opus.

```typescript
// WRONG: switch model mid-session
provider.createMessage({ model: 'haiku', ... });  // Cache miss on 100K tokens!

// RIGHT: spawn a subagent with its own session
const subagent = agentLoop.spawnSubagent({
  model: 'haiku',
  task: 'Classify this error message',
  context: extractRelevantContext(),  // Only pass what's needed
});
```

Subagent sessions have their own cache prefix (much smaller), making Haiku cost-effective for lightweight tasks.

#### 2.4.6 Cache Hit Rate Monitoring

Cache miss rate is a **production-critical metric**. A few percentage points increase can multiply infrastructure costs.

```typescript
interface CacheMetrics {
  // Per-turn metrics
  cacheCreationInputTokens: number;  // Tokens that were NOT cached (miss)
  cacheReadInputTokens: number;      // Tokens that WERE cached (hit)
  inputTokens: number;               // Total input tokens

  // Derived
  cacheHitRate: number;              // cacheRead / (cacheRead + cacheCreation)
}

// In TelemetryService:
function reportCacheMetrics(metrics: CacheMetrics): void {
  // Log per-turn cache performance
  telemetry.gauge('cache.hit_rate', metrics.cacheHitRate);
  telemetry.counter('cache.read_tokens', metrics.cacheReadInputTokens);
  telemetry.counter('cache.creation_tokens', metrics.cacheCreationInputTokens);

  // Alert if hit rate drops
  if (metrics.cacheHitRate < CACHE_HIT_RATE_THRESHOLD) {
    telemetry.alert('cache_hit_rate_low', {
      hitRate: metrics.cacheHitRate,
      threshold: CACHE_HIT_RATE_THRESHOLD,
      severity: metrics.cacheHitRate < 0.5 ? 'critical' : 'warning',
    });
  }
}
```

#### 2.4.7 Cache-Hostile Anti-Patterns (AVOID)

| Anti-Pattern | Why It Breaks Cache | Correct Approach |
|---|---|---|
| Timestamp in system prompt | Changes every turn → full prefix miss | Put timestamp in system-reminder message |
| Non-deterministic tool ordering | Different order = different prefix | Sort tools alphabetically, freeze at session start |
| Add/remove MCP tools mid-session | Tool definitions change → prefix miss | Use defer_loading stubs, ToolSearch for on-demand |
| Model switching mid-session | Different model = different KV cache | Use subagents for different models |
| Edit system prompt for plan mode | System prompt changes → prefix miss | Use EnterPlanMode/ExitPlanMode tools that toggle via system-reminder |
| Inject MCP instructions into system prompt | Dynamic MCP content in prefix | Put MCP instructions in first user message or system-reminder |

### 2.5 Session Management with SQLite

```
Database: .mimi/sessions.db (per-project) + ~/.mimi/sessions.db (global)

Schema:

  sessions
  +------------------+----------+-----------------------------------------+
  | Column           | Type     | Description                             |
  +------------------+----------+-----------------------------------------+
  | id               | TEXT PK  | UUID v4                                 |
  | project_path     | TEXT     | Absolute path to project root           |
  | title            | TEXT     | Auto-generated or user-set title        |
  | model            | TEXT     | Model used (e.g., claude-sonnet-4-...)  |
  | created_at       | INTEGER  | Unix timestamp ms                       |
  | updated_at       | INTEGER  | Unix timestamp ms                       |
  | token_count      | INTEGER  | Total tokens used in session            |
  | cost_usd         | REAL     | Estimated cost                          |
  | status           | TEXT     | active | completed | archived           |
  +------------------+----------+-----------------------------------------+

  messages
  +------------------+----------+-----------------------------------------+
  | Column           | Type     | Description                             |
  | id               | INTEGER  | Auto-increment PK                       |
  | session_id       | TEXT FK  | References sessions.id                  |
  | role             | TEXT     | user | assistant | system               |
  | content          | TEXT     | JSON-serialized content blocks          |
  | token_count      | INTEGER  | Token count for this message            |
  | created_at       | INTEGER  | Unix timestamp ms                       |
  | metadata         | TEXT     | JSON blob (anchors, compaction info)    |
  +------------------+----------+-----------------------------------------+

  tool_results
  +------------------+----------+-----------------------------------------+
  | Column           | Type     | Description                             |
  | id               | INTEGER  | Auto-increment PK                       |
  | message_id       | INTEGER  | References messages.id                  |
  | tool_name        | TEXT     | Fully qualified tool name               |
  | input            | TEXT     | JSON-serialized tool input              |
  | output           | TEXT     | JSON-serialized tool output             |
  | duration_ms      | INTEGER  | Execution time                          |
  | status           | TEXT     | success | error | timeout | cancelled   |
  +------------------+----------+-----------------------------------------+

  permissions
  +------------------+----------+-----------------------------------------+
  | Column           | Type     | Description                             |
  | id               | INTEGER  | Auto-increment PK                       |
  | tool_pattern     | TEXT     | Tool name or glob pattern               |
  | input_pattern    | TEXT     | Input pattern (e.g., file path glob)    |
  | decision         | TEXT     | allow | deny                            |
  | scope            | TEXT     | session | project | global              |
  | created_at       | INTEGER  | Unix timestamp ms                       |
  | expires_at       | INTEGER  | Nullable, for TTL-based permissions     |
  +------------------+----------+-----------------------------------------+

Indexes:
  - sessions(project_path, updated_at DESC)
  - messages(session_id, created_at)
  - permissions(tool_pattern, scope)

TTL cleanup: Daily background sweep deletes sessions older than
  configurable TTL (default: 30 days). Runs on startup if last
  sweep > 24h ago.
```

---

## 3. Plugin Architecture -- How Everything Composes

### 3.1 The Extension Point Hierarchy

```
                    +------------------------------+
                    |         @mimi/cli             |
                    |      (composition root)       |
                    +-------+----------+-----------+
                            |          |
              registers     |          |    registers
              built-ins     |          |    from config
                            |          |
              +-------------v-+   +----v-----------+
              |               |   |                |
              | ToolRegistry  |   | PluginLoader   |
              |               |   |                |
              +--+--+--+--+--+   +---+---+---+----+
                 |  |  |  |          |   |   |
    +------------+  |  |  +----+     |   |   +--------+
    |               |  |       |     |   |            |
+---v---+   +------v--v-+  +--v-+   |  +v------+  +--v------+
|Built- |   |    MCP    |  |Plug|   |  |Plugin |  |Plugin   |
|in     |   |    Tool   |  |in  |   |  |Hooks  |  |Commands |
|Tools  |   |  Adapters |  |Tool|   |  |       |  |         |
+-------+   +-----------+  +----+   |  +-------+  +---------+
                                     |
                               +-----v------+
                               |   Plugin   |
                               |   Themes   |
                               +------------+
```

### 3.2 Unified Tool Interface

Every tool source -- built-in, MCP, plugin, or skill -- ultimately produces objects conforming to a single interface. This is the most critical interface in the system.

```typescript
interface Tool {
  // Identity
  readonly name: string;              // Unique FQN: "Read", "mcp__server__tool"
  readonly description: string;       // For LLM prompt
  readonly source: ToolSource;        // 'builtin' | 'mcp' | 'plugin' | 'skill'

  // Schema for LLM
  readonly inputSchema: z.ZodType;    // Zod schema (serializes to JSON Schema)

  // Execution
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;

  // Lifecycle (optional)
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;

  // Metadata for UI
  readonly category?: string;         // 'filesystem' | 'web' | 'agent' | ...
  readonly collapsedSummary?: (input: unknown) => string;  // For collapsed view
}

interface ToolContext {
  sessionId: string;
  workingDirectory: string;
  abortSignal: AbortSignal;           // For cancellation
  permissions: PermissionChecker;
  eventBus: EventBus;
  tempFileRegistry: TempFileRegistry;
}

type ToolResult = {
  content: ToolResultContent[];
  isError?: boolean;
  metadata?: Record<string, unknown>;
};

type ToolResultContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }
  | { type: 'resource'; resource: MCPResource };
```

### 3.3 Tool Registration Flow

```
Application startup:

1. ServiceContainer created (composition root in @mimi/cli)
     |
2. ToolRegistry instantiated (empty)
     |
3. Built-in tools registered (lazy -- schema only, no impl loaded)
     |  registerBuiltin('Read', () => import('./read-tool'))
     |  registerBuiltin('Write', () => import('./write-tool'))
     |  ...
     |
4. MCP servers loaded from config
     |  For each server:
     |    a. Start transport (stdio/http)
     |    b. Call tools/list to get schemas
     |    c. Register as MCP tool adapters (lazy -- calls forward to server)
     |    d. Apply per-tool filters (disabled tools excluded)
     |
5. Plugins loaded from discovery paths
     |  For each plugin:
     |    a. Validate manifest
     |    b. Load plugin module
     |    c. Call plugin.register(registry) -- plugin adds its tools
     |    d. Register plugin hooks, themes, commands
     |
6. Skills discovered (schema extraction deferred)
     |
7. ToolRegistry.freeze() -- no more registrations after startup
     |  (Sub-agents get a scoped clone that can further filter)
```

### 3.4 Hook Lifecycle Integration

Hooks intercept the agent loop at defined points. The hook system uses an ordered pipeline model where hooks execute in registration order and each can modify or abort the flow.

```
Hook Event Timeline (single agent turn):

  SessionStart -----> (fires once at session creation)
     |
  UserPromptSubmit -> (can modify user message, reject it)
     |
  [Agent loop turn begins]
     |
  PreToolUse -------> (can modify tool input, skip tool, inject result)
     |
  PermissionRequest -> (can auto-approve, auto-deny, modify scope)
     |
  [Tool executes]
     |
  PostToolUse ------> (can modify result, trigger follow-up actions)
  or
  PostToolUseFailure > (can retry, provide fallback result)
     |
  [If compaction needed]
  PreCompact -------> (can mark messages as anchors to preserve)
     |
  [If agent decides to stop]
  Stop -------------> (can inject final instructions to continue)
     |
  Notification -----> (fires for any user-facing notifications)
     |
  SessionEnd -------> (cleanup, reporting, persistence)
```

Hook handler types:

```
command handler:
  Spawns a child process, passes event JSON on stdin,
  reads response JSON from stdout. Exit code 0 = continue,
  exit code 2 = block/modify.

http handler:
  POSTs event JSON to a URL, reads response JSON.
  Timeout configurable (default 10s).

prompt handler:
  Injects text as a system-reminder in the NEXT user message.
  (NEVER into the system prompt — that would break prompt cache.)
  The LLM evaluates the hook condition and decides action.

agent handler:
  Spawns a sub-agent with its own tool set to evaluate
  the event and produce a decision. Most powerful but slowest.
```

### 3.5 Tool Design Philosophy: Progressive Disclosure

> "How do you design the tools of your agent? You want to give it
>  tools that are shaped to its own abilities."
> — Thariq Shihipar, "Seeing like an Agent"

Key principles for tool design in Mimi Code:

**1. Progressive Disclosure over Upfront Loading**

Don't dump all context upfront. Let the agent incrementally discover relevant context through exploration.

```
❌ WRONG: Load all 200 MCP tool schemas into tool definitions (wastes tokens, breaks cache)
✅ RIGHT: Register lightweight stubs → model calls ToolSearch → load full schema on demand

❌ WRONG: Inject all project files into context at session start
✅ RIGHT: Give agent Read/Glob/Grep tools → it discovers what it needs
```

**2. Structured Tools > Free-form Text**

Structured tool outputs reduce friction and increase communication bandwidth between user and agent.

```
❌ WRONG: Agent asks questions in plain text (hard to parse, format varies)
✅ RIGHT: Agent calls AskUserQuestion tool with structured options (modal, blocking, parseable)

❌ WRONG: Agent outputs plan as free text
✅ RIGHT: Agent calls EnterPlanMode tool, writes plan to file, calls ExitPlanMode
```

**3. Tools Evolve with Model Capabilities**

As models improve, previously necessary tools may become constraints. Design tools to be replaceable.

```
Example evolution:
  TodoWrite (simple reminder) → TaskCreate/TaskUpdate (multi-agent coordination)
  Edit (single file) → MultiEdit (batch operations)
  Bash grep → Grep tool (structured, sandboxed)
```

**4. Tools as State Machines, Not Prompt Modifications**

Use tools to toggle agent state instead of modifying the system prompt (which breaks cache).

```
❌ WRONG: if (planMode) { systemPrompt += "You are in plan mode..." }
✅ RIGHT: EnterPlanMode tool → injects plan-mode rules as system-reminder
         ExitPlanMode tool → removes plan-mode rules from next turn's reminders
```

### 3.6 Plugin Manifest and Lifecycle

```typescript
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;

  // What the plugin provides
  provides: {
    tools?: ToolRegistration[];
    hooks?: HookRegistration[];
    commands?: CommandRegistration[];
    themes?: ThemeRegistration[];
  };

  // What the plugin requires
  requires: {
    mimiVersion: string;          // semver range
    permissions?: string[];       // required permission scopes
  };
}

interface PluginLifecycle {
  // Called once when plugin is loaded
  activate(ctx: PluginContext): Promise<void>;

  // Called when plugin is unloaded (session end, disable)
  deactivate(): Promise<void>;
}

interface PluginContext {
  container: ServiceContainer;    // Scoped DI container
  eventBus: EventBus;            // Subscribe to system events
  logger: Logger;                // Scoped logger
  storage: PluginStorage;        // Per-plugin key-value store
}
```

Plugin discovery paths (in order):

```
1. Brand-bundled:         <brand>/plugins/
2. Project-scoped:        .mimi/plugins/
3. User-global:           ~/.mimi/plugins/
4. Claude Code compat:    .claude-plugin/
5. Marketplace-installed: ~/.mimi/marketplace/
```

---

## 4. Rendering Architecture

> "Most people's mental model of Claude Code is that 'it's just a TUI'
>  but it should really be closer to 'a small game engine'."
> — Thariq Shihipar

The rendering pipeline is a game-engine-style loop: React scene graph → Yoga layout → rasterize to 2D screen → diff against previous frame → generate ANSI patch sequences. Target: **~16ms frame budget** (~60fps), with ~5ms from React reconciliation to ANSI output.

### 4.1 The Flickering Problem

Claude Code uses Ink (a React renderer for terminals). Ink works by:

```
1. React reconciler updates the virtual component tree
2. Yoga layout engine computes positions
3. Ink serializes the entire tree to a string of ANSI escape codes
4. Ink calls process.stdout.write(fullOutput) EVERY FRAME
5. Before writing, Ink clears previous output with ANSI clear codes
```

This clear-then-redraw approach causes visible flickering, especially on:
- Long outputs (many lines to redraw)
- Fast-updating content (streaming tokens)
- Slow terminals (SSH, tmux)
- High-DPI displays on macOS (terminal emulator rendering lag)

### 4.2 The Solution: Intercepted Differential Rendering

Instead of replacing Ink entirely (which would lose the React component model), we intercept at step 4. We replace Ink's output writer with our own that diffs frames.

```
Architecture:

  +------------------+
  | React Components |  <-- Standard Ink components
  +--------+---------+
           |
  +--------v---------+
  | Ink Reconciler    |  <-- Standard Ink reconciliation
  | + Yoga Layout     |
  +--------+---------+
           |
           | (rendered string -- full frame)
           |
  +--------v---------+
  | VirtualTerminal   |  <-- OUR ADDITION
  | Buffer            |
  +--------+---------+
           |
           | (diff patches only)
           |
  +--------v---------+
  | ANSI Patch Writer |  <-- OUR ADDITION
  +--------+---------+
           |
  +--------v---------+
  | process.stdout    |  <-- Minimal writes
  +-------------------+
```

### 4.3 VirtualTerminal Buffer Implementation

```typescript
class VirtualTerminalBuffer {
  private currentFrame: string[] = [];     // Current lines on screen
  private pendingFrame: string[] = [];     // Next frame to render

  // Called by our custom Ink output interceptor
  acceptFrame(fullOutput: string): void {
    this.pendingFrame = fullOutput.split('\n');
  }

  // Compute minimal ANSI diff between frames
  flush(): string {
    const patches: string[] = [];
    const maxLines = Math.max(
      this.currentFrame.length,
      this.pendingFrame.length
    );

    // Hide cursor during update to prevent flash
    patches.push('\x1b[?25l');

    for (let i = 0; i < maxLines; i++) {
      const current = this.currentFrame[i] ?? '';
      const next = this.pendingFrame[i] ?? '';

      if (current !== next) {
        // Move cursor to line i+1, column 1
        patches.push(`\x1b[${i + 1};1H`);
        // Clear line
        patches.push('\x1b[2K');
        // Write new content
        if (next) patches.push(next);
      }
    }

    // If new frame is shorter, clear trailing lines
    if (this.pendingFrame.length < this.currentFrame.length) {
      for (let i = this.pendingFrame.length; i < this.currentFrame.length; i++) {
        patches.push(`\x1b[${i + 1};1H\x1b[2K`);
      }
    }

    // Show cursor, position at end
    patches.push(`\x1b[${this.pendingFrame.length + 1};1H`);
    patches.push('\x1b[?25h');

    this.currentFrame = [...this.pendingFrame];
    return patches.join('');
  }
}
```

### 4.4 Scroll Management for Long Output

When output exceeds terminal height, we implement a virtual viewport:

```
+-----------------------------------+
|  (above viewport -- not rendered) |   Scrollback buffer
|  ...                              |   (kept in memory for scroll-up)
+===================================+
|  Visible viewport                 |   terminal.rows lines
|  (what the user sees)             |
|  ...                              |
|  ...                              |
|  > input prompt                   |   Always pinned at bottom
+===================================+
```

The viewport is managed by a `ScrollController` that:
- Tracks cursor position relative to viewport
- Handles scroll events (mouse wheel, keyboard)
- Pins the input prompt to the bottom of the terminal
- Auto-scrolls to bottom on new streaming content
- Allows scroll-up to review history without disrupting stream

### 4.5 Component Architecture

```
<MimiApp>
  <ThemeProvider theme={resolvedTheme}>
    <ScrollContainer>
      <WelcomeBanner />                    // ASCII art, one-time
      <ConversationHistory>                // Previous turns
        <UserMessage />
        <AssistantMessage>
          <MarkdownBlock />                // Rendered markdown
          <ToolCallView collapsed={...}>   // Tool calls
            <CollapsedSummary />           // ALWAYS shows file path/cmd
            <ExpandedDetail />             // Full input/output
          </ToolCallView>
        </AssistantMessage>
      </ConversationHistory>
      <StreamingOutput>                    // Current streaming response
        <TokenBuffer />                    // Buffered partial markdown
      </StreamingOutput>
    </ScrollContainer>
    <StatusBar>                            // Fixed at bottom
      <ModelIndicator />
      <TokenUsage />
      <SessionInfo />
      <CostTracker />
    </StatusBar>
    <InputEditor>                          // Fixed at bottom
      <PromptLine />
      <MultiLineEditor />
    </InputEditor>
    <PermissionModal />                    // Overlay when permission needed
  </ThemeProvider>
</MimiApp>
```

### 4.6 Key UI Fix: Tool Call Collapsed View

Claude Code's collapsed tool calls show almost no information. Our fix:

```
Claude Code (collapsed):
  > Edit (collapsed)

Mimi Code (collapsed):
  > Edit  src/auth/middleware.ts  L45-52  "replace bcrypt with argon2"
  > Bash  npm test -- --grep "auth"  (2.3s, exit 0)
  > Read  src/config.ts  (142 lines)
  > Grep  "TODO|FIXME"  in src/**/*.ts  (7 matches)
```

The `collapsedSummary` method on each Tool interface enables this. Each tool knows how to produce a meaningful one-line summary from its input/output.

---

## 5. Provider Abstraction

### 5.1 Normalized Streaming Protocol

Each LLM provider has a different streaming format. We normalize everything to a single event stream.

```typescript
// The unified stream event type that all internal code works with
type StreamEvent =
  | { type: 'message_start'; message: { id: string; model: string } }
  | { type: 'content_block_start'; index: number; contentBlock: ContentBlockStart }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: MessageDelta }
  | { type: 'message_stop'; stopReason: StopReason }
  | { type: 'error'; error: ProviderError };

type ContentBlockStart =
  | { type: 'text' }
  | { type: 'tool_use'; id: string; name: string }
  | { type: 'thinking'; thinking: string };

type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partialJson: string }
  | { type: 'thinking_delta'; thinking: string };

type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
```

### 5.2 Provider Adapter Pattern

```typescript
interface LLMProvider {
  readonly name: string;
  readonly supportedFeatures: ProviderFeatures;

  createMessage(params: MessageParams): AsyncIterable<StreamEvent>;
  countTokens(content: MessageContent): Promise<number>;
  listModels?(): Promise<ModelInfo[]>;
}

interface ProviderFeatures {
  streaming: boolean;
  toolUse: boolean;
  extendedThinking: boolean;
  imageInput: boolean;
  pdfInput: boolean;
  caching: boolean;           // Prompt caching (Anthropic)
  batchApi: boolean;
}

interface MessageParams {
  model: string;
  system: SystemBlock[];
  messages: Message[];
  tools?: ToolSchema[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  // Anthropic-specific
  thinking?: { type: 'enabled'; budgetTokens: number };
  // Caching hints
  cacheControl?: CacheHint[];
}
```

### 5.3 Provider-Specific Normalization

```
Anthropic Messages API (native):
  - SSE events map 1:1 to our StreamEvent types
  - Supports tool_use, thinking, caching natively
  - Token counting via /v1/messages/count_tokens

AWS Bedrock:
  - Uses InvokeModelWithResponseStream
  - Response chunks are binary-encoded JSON
  - Must translate bedrock chunk format to StreamEvent
  - Tool use via converse API tool_use content blocks
  - Auth: AWS SDK credential chain (IAM, SSO, env vars)

Google Vertex AI:
  - Uses generateContent with stream=true
  - Response is JSON lines (NDJSON)
  - Tool use via functionCall / functionResponse
  - Must map functionCall to tool_use StreamEvents
  - Auth: Google Cloud ADC or service account

OpenAI-Compatible:
  - Uses /v1/chat/completions with stream=true
  - SSE with data: JSON lines
  - Tool use via tool_calls array in delta
  - Must accumulate partial tool call arguments
  - Map finish_reason to our StopReason
  - No native extended thinking support
```

### 5.4 Auth Flow Abstraction

```typescript
interface AuthProvider {
  // Returns headers to include in API requests
  getAuthHeaders(): Promise<Record<string, string>>;

  // Whether auth needs refresh
  needsRefresh(): boolean;

  // Interactive login flow
  login(): Promise<void>;

  // Clear stored credentials
  logout(): Promise<void>;
}

// Implementations:
//   AnthropicApiKeyAuth    -- ANTHROPIC_API_KEY env var or stored key
//   BedrockAuth            -- AWS credential chain
//   VertexAuth             -- Google ADC
//   OAuthAuth              -- OAuth 2.0 flow (for managed providers)
//   CustomHeaderAuth       -- For enterprise API gateways
```

---

## 6. White-Label Architecture

### 6.1 Prompt Injection Layers (Cache-Optimized)

The system prompt is assembled in a strict order optimized for **prompt caching** (see Section 2.4). White-label brands can prepend and append but never replace the core. The ordering follows the principle: **static first, dynamic last** — all content shared across users/sessions comes first to maximize cache hit rates.

```
 Assembly Order                 Source              Mutability        Cache Scope
 +--------------------------------------------------------------------------------------------+
 |                                                                                             |
 | ── CACHEABLE PREFIX (Layers 1-3 frozen at session start) ──────────────────────────────      |
 |                                                                                             |
 | 1. Core System Prompt        @mimi/core          IMMUTABLE         Global (all users)       |
 |    (Agent behavior, safety, tool instructions)                                              |
 |    Includes brand.prepend + core + brand.append as single block.                            |
 |    This section CANNOT be overridden or removed.               [cache_control: ephemeral]   |
 |                                                                                             |
 | 2. Tool Definitions          ToolRegistry        SESSION-FROZEN    Global (all users)       |
 |    (JSON schemas for all registered tools, alphabetically sorted)                           |
 |    MCP tools with defer_loading use lightweight stubs.                                      |
 |    Tools are NEVER added/removed mid-session.                  [cache_control: ephemeral]   |
 |                                                                                             |
 | 3. Project Instructions      MIMI.md / CLAUDE.md User controls    Per-project              |
 |    (Brand config + per-project instructions)                                                |
 |    Sent as first user message, not in system prompt.           [cache_control: ephemeral]   |
 |                                                                                             |
 | ── DYNAMIC CONTENT (changes every turn) ───────────────────────────────────────────────      |
 |                                                                                             |
 | 4. Conversation Messages     SessionStore        Growing           Per-session              |
 |    (User turns, assistant turns, tool results)                                              |
 |    Previous turns cached via prefix matching.                  (no explicit cache control)  |
 |                                                                                             |
 | 5. System Reminders          Runtime             Per-turn          Uncached                 |
 |    (Current date, env, git status, MCP instructions,                                        |
 |     brand reminders, context reminders)                                                     |
 |    Injected as <system-reminder> in latest user message.       (no cache control)           |
 |                                                                                             |
 +--------------------------------------------------------------------------------------------+
```

**Critical invariants for cache safety:**
- Brand prepend/append is baked into the core system prompt block (Layer 1), NOT as separate messages.
- Tool definitions are frozen at session start and sorted deterministically.
- Dynamic context (timestamps, env info, MCP server instructions) goes into system-reminder messages within the conversation (Layer 5), NEVER into the system prompt.
- Plan mode toggling uses EnterPlanMode/ExitPlanMode tools with system-reminder injection, NOT by modifying the system prompt or tool list.

See Section 2.4 for detailed cache architecture, breakpoint strategy, and anti-patterns.

### 6.2 Theme Override System

```typescript
interface ThemeOverride {
  // Partial override -- unspecified values inherit from base theme
  primary?: string;
  secondary?: string;
  accent?: string;
  success?: string;
  error?: string;
  warning?: string;
  text?: string;
  muted?: string;

  // Component-level overrides
  spinnerStyle?: 'cute' | 'professional' | 'minimal' | 'custom';
  spinnerFrames?: string[];
  bannerArt?: string;         // Path to custom ASCII art

  // Color scheme detection
  preferDarkMode?: boolean;
  autoDetect?: boolean;       // Detect from terminal background
}
```

Theme resolution order:

```
1. Runtime override (user's --theme flag)
2. User config (~/.mimi/settings.json theme)
3. Project config (.mimi/settings.json theme)
4. Brand theme (brand.json theme)
5. Built-in default ('sunflower' theme)
```

### 6.3 Binary Builder Pipeline

```
Input:
  brand.json + custom assets + optional source patches

Pipeline:

  Step 1: VALIDATE
    Parse brand.json against JSON Schema
    Validate all referenced file paths exist
    Check provider restrictions are valid

  Step 2: SCAFFOLD
    Create temporary build directory
    Copy @mimi/cli source
    Inject brand.json as embedded asset

  Step 3: PATCH
    Replace binary name in package.json
    Replace config directory name (.mimi/ -> .{brand}/)
    Embed custom ASCII art assets
    Embed custom prompts as static strings

  Step 4: BUNDLE
    Run tsup to bundle to single file
    Tree-shake unused providers (if brand restricts providers)

  Step 5: PACKAGE
    Use pkg (or bun compile) to create native binaries:
      {brand}-darwin-arm64
      {brand}-darwin-x64
      {brand}-linux-arm64
      {brand}-linux-x64
      {brand}-win32-x64.exe

  Step 6: VERIFY
    Run smoke tests on each binary
    Verify brand name appears in --version output
    Verify custom ASCII art renders

Output:
  dist/{brand}-{platform}-{arch}[.exe]
```

### 6.4 Config Directory Resolution

White-label brands get their own config namespace:

```
Brand "acme" creates:
  ~/.acme/                        (user global config)
  .acme/                          (project config, gitignored by default)
  .acme/settings.json             (project settings)
  .acme/sessions.db               (project sessions)
  .acme/permissions.db            (project permissions)

Fallback chain:
  .acme/ -> .mimi/ -> .claude/    (reads from all, writes to brand dir)
```

---

## 7. Data Flow Diagrams

### 7.1 Complete User Interaction Flow

```
User types: "Add error handling to auth.ts"

  +---------+     +----------+     +--------+     +-----------+
  | Terminal |---->| Input    |---->| Hook:  |---->| Agent     |
  | stdin    |     | Editor   |     | Submit |     | Loop      |
  +---------+     +----------+     +--------+     +-----+-----+
                                                        |
                                      +-----------------+
                                      |
                                +-----v------+
                                | Prompt     |
                                | Assembler  |
                                +-----+------+
                                      |
                        +-------------+-------------+
                        |             |             |
                  +-----v---+  +-----v----+  +-----v----+
                  | System  |  | Message  |  | Tool     |
                  | Prompts |  | History  |  | Schemas  |
                  +---------+  +----------+  +----------+
                        |             |             |
                        +------+------+-------------+
                               |
                         +-----v------+
                         | Context    |
                         | Check      |
                         | (compact?) |
                         +-----+------+
                               |
                         +-----v------+
                         | Provider   |     +-------------+
                         | (Anthropic)|---->| Anthropic   |
                         | API Call   |     | API         |
                         +-----+------+     +------+------+
                               |                    |
                               |<-------------------+
                               |  SSE stream
                         +-----v------+
                         | Stream     |
                         | Normalizer |
                         +-----+------+
                               |
                    +----------+----------+
                    |                     |
              +-----v------+       +-----v------+
              | Text Delta |       | Tool Use   |
              | (render)   |       | (execute)  |
              +-----+------+       +-----+------+
                    |                     |
              +-----v------+       +-----v------+
              | EventBus   |       | Permission |
              | -> UI      |       | Check      |
              +------------+       +-----+------+
                                         |
                                   +-----v------+
                                   | Tool       |
                                   | Executor   |
                                   +-----+------+
                                         |
                                   +-----v------+
                                   | Result     |
                                   | -> Messages|
                                   +-----+------+
                                         |
                                   (loop back to
                                    Prompt Assembler)
```

### 7.2 Tool Execution Flow

```
AgentLoop receives tool_use content block

  +------------------+
  | tool_use block   |
  | name: "Edit"     |
  | input: {...}     |
  +--------+---------+
           |
  +--------v---------+
  | Hook: PreToolUse |-----> Hook can:
  +--------+---------+       - Modify input
           |                 - Skip tool (provide result)
           |                 - Block execution
  +--------v---------+
  | PermissionEngine |
  | .check(tool,     |
  |        input)    |
  +--+-------+-------+
     |       |
  allow   ask/deny
     |       |
     |  +----v-----------+
     |  | UI: Permission |
     |  | Prompt         |
     |  | "Allow Edit    |
     |  |  src/auth.ts?" |
     |  +----+-----------+
     |       |
     |    user response
     |       |
     |  +----v-----------+
     |  | If "always":   |
     |  | persist to     |
     |  | SQLite         |
     |  +----+-----------+
     |       |
  +--v-------v--------+
  | ToolRegistry      |
  | .execute(name,    |
  |          input,   |
  |          ctx)     |
  +--------+----------+
           |
  +--------v----------+
  | Lazy load tool    |
  | implementation    |
  | if not loaded     |
  +--------+----------+
           |
  +--------v----------+
  | Tool.execute()    |
  | with AbortSignal  |
  | and timeout       |
  +--------+----------+
           |
     +-----+------+
     |            |
  success      error
     |            |
  +--v---+   +---v---------+
  | Hook:|   | Hook:       |
  | Post |   | PostToolUse |
  | Tool |   | Failure     |
  | Use  |   +---+---------+
  +--+---+       |
     |            |
  +--v------------v--+
  | Append tool_     |
  | result message   |
  | to conversation  |
  +--+---------------+
     |
  +--v---------------+
  | SessionStore     |
  | .saveToolResult  |
  +------------------+
```

### 7.3 MCP Communication Flow

```
AgentLoop needs to call mcp__github__create_issue

  +------------------+
  | ToolRegistry     |
  | looks up tool    |
  | source = 'mcp'   |
  +--------+---------+
           |
  +--------v---------+
  | MCPToolAdapter   |
  | (wraps MCP call  |
  |  as Tool iface)  |
  +--------+---------+
           |
  +--------v---------+
  | MCPClient        |
  | .callTool(       |
  |   server,        |
  |   toolName,      |
  |   arguments)     |
  +--------+---------+
           |
  +--------v---------+     +------------------+
  | Transport Layer  |     | MCP Server       |
  |                  |     | (child process   |
  | stdio:           |     |  or HTTP server) |
  |  stdin.write( ---|---->|                  |
  |    JSON-RPC req) |     |  processes       |
  |                  |     |  request         |
  |  stdout.on(  )<--|-----|                  |
  |    JSON-RPC res) |     |  returns         |
  |                  |     |  result          |
  | OR               |     |                  |
  |                  |     |                  |
  | http:            |     |                  |
  |  POST /rpc  ----|---->|                  |
  |  response   <----|-----|                  |
  +------------------+     +------------------+
           |
  +--------v---------+
  | MCPToolAdapter   |
  | converts MCP     |
  | result to        |
  | ToolResult       |
  +--------+---------+
           |
  (returned to AgentLoop
   as regular ToolResult)
```

### 7.4 Permission Check Flow

```
PermissionEngine.check("Bash", { command: "rm -rf /tmp/test" })

  +---------------------+
  | 1. DENY RULES       |  (from settings hierarchy)
  | Check all deny       |
  | patterns first       |
  |                      |
  | settings.deny:       |
  |  - Bash(rm -rf /)    |
  |  - Write(/etc/*)     |
  +----------+-----------+
             |
        match? ----yes----> DENY (immediate, no override)
             |
             no
             |
  +----------v-----------+
  | 2. PERSISTENT ALLOW  |  (from SQLite permissions table)
  | Check tool+pattern   |
  | in permissions.db    |
  |                      |
  | SELECT FROM perms    |
  | WHERE tool='Bash'    |
  | AND pattern matches  |
  | AND NOT expired      |
  +----------+-----------+
             |
        match? ----yes----> ALLOW (source: persistent)
             |
             no
             |
  +----------v-----------+
  | 3. SESSION ALLOW     |  (from settings hierarchy)
  | Check allow rules    |
  |                      |
  | settings.allow:      |
  |  - Read(*)           |
  |  - Glob(*)           |
  |  - Grep(*)           |
  +----------+-----------+
             |
        match? ----yes----> ALLOW (source: rule)
             |
             no
             |
  +----------v-----------+
  | 4. ASK USER          |
  | Yield permission     |
  | prompt to UI         |
  |                      |
  | Options:             |
  |  - Allow once        |
  |  - Allow for session |
  |  - Always allow      |  --> persists to SQLite
  |  - Deny              |
  +----------------------+
```

Settings hierarchy for rules (highest priority first):

```
1. Managed policy    (enterprise lockdown, cannot be overridden)
2. CLI flags         (--dangerously-skip-permissions)
3. .mimi/settings.local.json   (project personal, gitignored)
4. .mimi/settings.json         (project shared, committed)
5. ~/.mimi/settings.json       (user global)
6. brand.json defaults         (white-label defaults)
7. Built-in defaults           (safe defaults from @mimi/core)
```

---

## 8. Key Design Patterns

### 8.1 Dependency Injection Strategy

We use a lightweight, typed service container. No decorators, no reflection, no framework. Just a typed map of factory functions with scoping support.

```typescript
// The container itself
class ServiceContainer {
  private factories = new Map<symbol, () => unknown>();
  private singletons = new Map<symbol, unknown>();
  private parent?: ServiceContainer;

  constructor(parent?: ServiceContainer) {
    this.parent = parent;
  }

  // Register a factory (lazy singleton by default)
  register<T>(token: ServiceToken<T>, factory: (c: ServiceContainer) => T): void {
    this.factories.set(token, () => {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, factory(this));
      }
      return this.singletons.get(token)!;
    });
  }

  // Register a transient (new instance every time)
  registerTransient<T>(token: ServiceToken<T>, factory: (c: ServiceContainer) => T): void {
    this.factories.set(token, () => factory(this));
  }

  // Resolve a service
  resolve<T>(token: ServiceToken<T>): T {
    const factory = this.factories.get(token);
    if (factory) return factory() as T;
    if (this.parent) return this.parent.resolve(token);
    throw new Error(`Service not registered: ${token.toString()}`);
  }

  // Create a child scope (for sub-agents)
  createScope(): ServiceContainer {
    return new ServiceContainer(this);
  }
}

// Type-safe service tokens
type ServiceToken<T> = symbol & { __type?: T };

function createToken<T>(name: string): ServiceToken<T> {
  return Symbol(name) as ServiceToken<T>;
}

// Token declarations (centralized)
const Tokens = {
  AgentLoop:         createToken<AgentLoop>('AgentLoop'),
  ToolRegistry:      createToken<ToolRegistry>('ToolRegistry'),
  PermissionEngine:  createToken<PermissionEngine>('PermissionEngine'),
  SessionStore:      createToken<SessionStore>('SessionStore'),
  ContextManager:    createToken<ContextManager>('ContextManager'),
  EventBus:          createToken<EventBus>('EventBus'),
  LLMProvider:       createToken<LLMProvider>('LLMProvider'),
  MCPClient:         createToken<MCPClient>('MCPClient'),
  HookRuntime:       createToken<HookRuntime>('HookRuntime'),
  BrandConfig:       createToken<BrandConfig>('BrandConfig'),
  TempFileRegistry:  createToken<TempFileRegistry>('TempFileRegistry'),
} as const;
```

Composition root (in `@mimi/cli`):

```typescript
function createContainer(config: AppConfig): ServiceContainer {
  const c = new ServiceContainer();

  // Foundation
  c.register(Tokens.EventBus, () => new EventBus());
  c.register(Tokens.TempFileRegistry, () => new TempFileRegistry());
  c.register(Tokens.BrandConfig, () => BrandLoader.load(config.brandPath));

  // Storage
  c.register(Tokens.SessionStore, (c) =>
    new SessionStore(config.sessionDbPath));
  c.register(Tokens.PermissionEngine, (c) =>
    new PermissionEngine(config.settingsHierarchy, config.permissionDbPath));

  // Provider
  c.register(Tokens.LLMProvider, (c) =>
    ProviderFactory.create(config.provider, config.providerConfig));

  // Context
  c.register(Tokens.ContextManager, (c) =>
    new ContextManager(c.resolve(Tokens.LLMProvider), config.contextConfig));

  // Tools
  c.register(Tokens.ToolRegistry, (c) => {
    const registry = new ToolRegistry();
    registerBuiltinTools(registry);
    return registry;
  });

  // MCP
  c.register(Tokens.MCPClient, (c) =>
    new MCPClient(config.mcpConfig, c.resolve(Tokens.EventBus)));

  // Hooks
  c.register(Tokens.HookRuntime, (c) =>
    new HookRuntime(config.hookConfig, c.resolve(Tokens.EventBus)));

  // Agent
  c.register(Tokens.AgentLoop, (c) => new AgentLoop({
    provider: c.resolve(Tokens.LLMProvider),
    contextManager: c.resolve(Tokens.ContextManager),
    toolRegistry: c.resolve(Tokens.ToolRegistry),
    permissions: c.resolve(Tokens.PermissionEngine),
    sessionStore: c.resolve(Tokens.SessionStore),
    hooks: c.resolve(Tokens.HookRuntime),
    eventBus: c.resolve(Tokens.EventBus),
  }));

  return c;
}
```

Sub-agents get a scoped child container:

```typescript
// When spawning a sub-agent:
const childContainer = parentContainer.createScope();

// Override specific services for the sub-agent
childContainer.register(Tokens.ToolRegistry, (c) => {
  const parentRegistry = parentContainer.resolve(Tokens.ToolRegistry);
  return parentRegistry.createFiltered(agentConfig.allowedTools);
});

childContainer.register(Tokens.AgentLoop, (c) => new AgentLoop({
  // Inherits parent's provider, permissions, etc.
  // But uses filtered tool registry
  ...resolveAgentDeps(c),
}));
```

### 8.2 Event Bus for Cross-Cutting Concerns

```typescript
type EventMap = {
  // Agent lifecycle
  'agent:turn_start':       { sessionId: string; turnIndex: number };
  'agent:turn_end':         { sessionId: string; turnIndex: number; stopReason: StopReason };
  'agent:error':            { sessionId: string; error: Error };

  // Streaming
  'stream:text_delta':      { text: string; turnIndex: number };
  'stream:tool_use_start':  { toolName: string; id: string };
  'stream:tool_use_delta':  { id: string; partialJson: string };
  'stream:thinking_delta':  { text: string };

  // Tool execution
  'tool:executing':         { toolName: string; input: unknown };
  'tool:completed':         { toolName: string; result: ToolResult; durationMs: number };
  'tool:error':             { toolName: string; error: Error };

  // Permission
  'permission:check':       { tool: string; decision: string };
  'permission:prompt':      { tool: string; input: unknown };
  'permission:response':    { tool: string; userChoice: string };

  // Context
  'context:compacting':     { usage: number; threshold: number };
  'context:compacted':      { beforeTokens: number; afterTokens: number };

  // Session
  'session:created':        { sessionId: string };
  'session:resumed':        { sessionId: string };
  'session:saved':          { sessionId: string };

  // MCP
  'mcp:server_started':     { serverName: string };
  'mcp:server_error':       { serverName: string; error: Error };
  'mcp:server_stopped':     { serverName: string };

  // Resource lifecycle
  'resource:temp_created':  { path: string };
  'resource:temp_cleaned':  { path: string };
  'resource:memory_warning':{ usageMb: number; limitMb: number };
};

class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(data); } catch (e) { /* log, never throw */ }
    });
  }

  // For async iteration (used by UI)
  async *subscribe<K extends keyof EventMap>(event: K): AsyncIterable<EventMap[K]> {
    const queue: EventMap[K][] = [];
    let resolve: (() => void) | null = null;

    const unsub = this.on(event, (data) => {
      queue.push(data);
      resolve?.();
    });

    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>(r => { resolve = r; });
        }
        while (queue.length > 0) {
          yield queue.shift()!;
        }
      }
    } finally {
      unsub();
    }
  }
}
```

### 8.3 Error Handling Strategy

Three tiers of errors, each handled differently:

```
Tier 1: RECOVERABLE (tool-level)
  - File not found, permission denied, network timeout
  - Handled by: Tool returns ToolResult with isError: true
  - LLM sees the error and adjusts its approach
  - No user intervention needed

Tier 2: OPERATIONAL (agent-level)
  - Context window overflow, provider rate limit, MCP server crash
  - Handled by: AgentLoop catches, emits error event, attempts recovery
  - Recovery strategies:
      Rate limit:    exponential backoff with jitter
      Context full:  force emergency compaction
      MCP crash:     restart server, retry once
      Provider down: failover to secondary provider (if configured)
  - User sees a warning but interaction continues

Tier 3: FATAL (process-level)
  - Unhandled exceptions, OOM, SIGKILL
  - Handled by: Global error handlers, cleanup, crash report
  - Cleanup sequence:
      1. TempFileRegistry.cleanupAll()
      2. MCP servers sent shutdown signal
      3. Session auto-saved (best effort)
      4. Exit with non-zero code
  - User sees error message and can resume session
```

Error boundary pattern for tools:

```typescript
class ToolExecutor {
  async execute(tool: Tool, input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const timer = setTimeout(() => {
      ctx.abortSignal.dispatchEvent(new Event('abort'));
    }, this.timeout);

    try {
      const validated = tool.inputSchema.parse(input);
      return await tool.execute(validated, ctx);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          content: [{ type: 'text', text: `Invalid input: ${error.message}` }],
          isError: true,
        };
      }
      if (error instanceof AbortError) {
        return {
          content: [{ type: 'text', text: `Tool execution timed out after ${this.timeout}ms` }],
          isError: true,
        };
      }
      // Unexpected error -- log full stack, return sanitized message
      this.eventBus.emit('tool:error', { toolName: tool.name, error: error as Error });
      return {
        content: [{ type: 'text', text: `Tool error: ${(error as Error).message}` }],
        isError: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

### 8.4 Resource Lifecycle Management (Solving Memory Leaks)

This is a critical architectural concern. Claude Code leaks memory through uncleaned temp files, orphaned child processes, and unbounded caches.

```typescript
// Central resource tracker using Symbol.dispose (TC39 Explicit Resource Management)
class ResourceManager implements Disposable {
  private cleanups: (() => void | Promise<void>)[] = [];
  private tempFiles = new TempFileRegistry();
  private childProcesses = new ChildProcessTracker();
  private caches = new CacheManager();

  // Register a cleanup function
  onCleanup(fn: () => void | Promise<void>): void {
    this.cleanups.push(fn);
  }

  // Track a temp file
  trackTempFile(path: string): string {
    this.tempFiles.track(path);
    return path;
  }

  // Track a child process
  trackProcess(proc: ChildProcess): ChildProcess {
    this.childProcesses.track(proc);
    return proc;
  }

  // Bounded cache with WeakRef
  createCache<K, V extends object>(name: string, maxSize: number): BoundedCache<K, V> {
    const cache = new BoundedCache<K, V>(maxSize);
    this.caches.register(name, cache);
    return cache;
  }

  // Full cleanup
  async [Symbol.dispose](): Promise<void> {
    // Run cleanups in reverse order
    for (const fn of this.cleanups.reverse()) {
      try { await fn(); } catch { /* log, never throw during cleanup */ }
    }

    // Clean temp files
    await this.tempFiles.cleanupAll();

    // Kill orphaned child processes
    await this.childProcesses.killAll();

    // Clear caches
    this.caches.clearAll();
  }
}

// TempFileRegistry with guaranteed cleanup
class TempFileRegistry {
  private files = new Set<string>();
  private registered = false;

  track(path: string): void {
    this.files.add(path);
    if (!this.registered) {
      this.registerSignalHandlers();
      this.registered = true;
    }
  }

  untrack(path: string): void {
    this.files.delete(path);
  }

  async cleanupAll(): Promise<void> {
    for (const f of this.files) {
      try {
        await fs.rm(f, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
    this.files.clear();
  }

  private registerSignalHandlers(): void {
    const cleanup = () => {
      // Synchronous cleanup for signal handlers
      for (const f of this.files) {
        try { fs.rmSync(f, { recursive: true, force: true }); } catch {}
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(130); });
    process.on('SIGTERM', () => { cleanup(); process.exit(143); });
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      cleanup();
      process.exit(1);
    });
  }
}

// BoundedCache with LRU eviction and WeakRef support
class BoundedCache<K, V extends object> {
  private map = new Map<K, WeakRef<V>>();
  private registry = new FinalizationRegistry<K>((key) => {
    this.map.delete(key);
  });
  private accessOrder: K[] = [];

  constructor(private maxSize: number) {}

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize) {
      // Evict least recently used
      const evictKey = this.accessOrder.shift();
      if (evictKey !== undefined) this.map.delete(evictKey);
    }
    this.map.set(key, new WeakRef(value));
    this.registry.register(value, key);
    this.accessOrder.push(key);
  }

  get(key: K): V | undefined {
    const ref = this.map.get(key);
    if (!ref) return undefined;
    const value = ref.deref();
    if (!value) {
      this.map.delete(key);
      return undefined;
    }
    // Move to end of access order
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    return value;
  }

  clear(): void {
    this.map.clear();
    this.accessOrder = [];
  }
}

// Memory budget monitoring
class MemoryMonitor {
  private intervalId?: NodeJS.Timeout;

  start(budgetMb: number, eventBus: EventBus): void {
    this.intervalId = setInterval(() => {
      const usage = process.memoryUsage();
      const heapMb = usage.heapUsed / 1024 / 1024;

      if (heapMb > budgetMb * 0.85) {
        eventBus.emit('resource:memory_warning', {
          usageMb: heapMb,
          limitMb: budgetMb,
        });
        // Force GC if available
        if (global.gc) global.gc();
      }
    }, 30_000);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
```

---

## 9. Critical Interfaces

These interfaces form the structural skeleton of the system. They are designed for stability (rarely change) and extensibility (new implementations, not new methods).

### 9.1 Core Domain Types

```typescript
// === Messages ===

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: ContentBlock[];
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  anchor?: boolean;           // Preserved during compaction
  compactionSummary?: boolean; // This message is a compaction summary
  turnIndex?: number;
  timestamp?: number;
}

type ContentBlock =
  | TextBlock
  | ImageBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock;

interface TextBlock {
  type: 'text';
  text: string;
  citations?: Citation[];
}

interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; mediaType: string; data: string }
        | { type: 'url'; url: string };
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: ToolResultContent[];
  isError?: boolean;
}

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

// === System Prompts ===

type SystemBlock =
  | { type: 'text'; text: string; cacheControl?: CacheHint }
  | { type: 'tool_result'; /* for MCP resources */ };

interface CacheHint {
  type: 'ephemeral';
}
```

### 9.2 Provider Interface

```typescript
interface LLMProvider {
  readonly name: string;
  readonly supportedFeatures: ProviderFeatures;

  // Core: create a streaming message
  createMessage(params: MessageParams): AsyncIterable<StreamEvent>;

  // Token counting (provider-specific for accuracy)
  countTokens(messages: Message[], system?: SystemBlock[]): Promise<number>;

  // Optional: list available models
  listModels?(): Promise<ModelInfo[]>;
}

interface ProviderFeatures {
  streaming: boolean;
  toolUse: boolean;
  extendedThinking: boolean;
  imageInput: boolean;
  pdfInput: boolean;
  promptCaching: boolean;
}

interface MessageParams {
  model: string;
  system: SystemBlock[];
  messages: Message[];
  tools?: ToolSchema[];
  maxTokens: number;
  temperature?: number;
  thinking?: { type: 'enabled'; budgetTokens: number };
}

interface ModelInfo {
  id: string;
  name: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsThinking: boolean;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
}

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}
```

### 9.3 Tool Interface

```typescript
interface Tool {
  readonly name: string;
  readonly description: string;
  readonly source: 'builtin' | 'mcp' | 'plugin' | 'skill';
  readonly inputSchema: z.ZodType;

  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;

  // Lifecycle
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;

  // UI hints
  readonly category?: string;
  collapsedSummary?(input: unknown, result?: ToolResult): string;
}

interface ToolContext {
  sessionId: string;
  workingDirectory: string;
  abortSignal: AbortSignal;
  permissions: PermissionChecker;
  eventBus: EventBus;
  tempFiles: TempFileRegistry;
  resourceManager: ResourceManager;
}

interface PermissionChecker {
  check(toolName: string, input: unknown): Promise<PermissionDecision>;
}

type PermissionDecision =
  | { decision: 'allow'; source: 'rule' | 'persistent' | 'user' }
  | { decision: 'deny'; reason: string }
  | { decision: 'ask' };
```

### 9.4 Hook Interface

```typescript
interface HookDefinition {
  event: HookEvent;
  handler: HookHandlerConfig;
  matcher?: {
    toolName?: string | RegExp;
    inputPattern?: Record<string, string | RegExp>;
  };
  timeout?: number;
}

type HookEvent =
  | 'SessionStart'    | 'SessionEnd'
  | 'UserPromptSubmit'| 'Stop'
  | 'PreToolUse'      | 'PostToolUse'    | 'PostToolUseFailure'
  | 'PermissionRequest'| 'Notification'
  | 'SubagentStart'   | 'SubagentStop'
  | 'TaskCompleted'   | 'ConfigChange'
  | 'PreCompact';

type HookHandlerConfig =
  | { type: 'command'; command: string; args?: string[]; cwd?: string }
  | { type: 'http'; url: string; method?: string; headers?: Record<string, string> }
  | { type: 'prompt'; prompt: string }
  | { type: 'agent'; agentConfig: AgentConfig };

interface HookResult {
  action: 'continue' | 'block' | 'modify';
  modifiedInput?: unknown;
  injectedResult?: ToolResult;
  message?: string;
}
```

### 9.5 Plugin Interface

```typescript
interface Plugin {
  readonly manifest: PluginManifest;
  activate(ctx: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  mimiVersion: string;       // semver range, e.g., ">=1.0.0"
  provides: {
    tools?: string[];
    hooks?: string[];
    commands?: string[];
    themes?: string[];
  };
  permissions?: string[];
}

interface PluginContext {
  container: ServiceContainer;
  eventBus: EventBus;
  logger: ScopedLogger;
  storage: PluginStorage;

  // Registration APIs
  registerTool(tool: Tool): void;
  registerHook(hook: HookDefinition): void;
  registerCommand(cmd: SlashCommand): void;
  registerTheme(theme: ThemeDefinition): void;
}

interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
```

### 9.6 Session Interface

```typescript
interface SessionManager {
  create(projectPath: string, model: string): Promise<Session>;
  resume(sessionId: string): Promise<Session>;
  getMostRecent(projectPath: string): Promise<Session | null>;
  list(projectPath: string, options?: ListOptions): Promise<SessionSummary[]>;
  delete(sessionId: string): Promise<void>;
  prune(olderThanMs: number): Promise<number>;
}

interface Session {
  readonly id: string;
  readonly projectPath: string;
  readonly model: string;
  readonly createdAt: number;
  title: string;

  getMessages(): Promise<Message[]>;
  appendMessage(message: Message): Promise<void>;
  saveToolResult(messageId: number, result: ToolResultRecord): Promise<void>;
  getTokenCount(): Promise<number>;
  getCost(): Promise<number>;
}
```

### 9.7 Brand Configuration Interface

```typescript
interface BrandConfig {
  // Identity
  name: string;
  binaryName: string;
  version: string;
  configDirName: string;           // e.g., '.acme' for ~/.acme/

  // Visual
  mascot: {
    asciiArt: string;
    emoji: string;
    name: string;
  };
  theme: ThemeOverride;

  // Prompt layers
  systemPrompt: {
    prepend?: string;
    append?: string;
    reminders?: string[];
  };

  // Defaults
  defaults: {
    mcpServers?: MCPServerConfig[];
    skills?: string[];              // paths to bundled skills
    settings?: Partial<Settings>;
    projectInstructionsFile?: string; // default: 'MIMI.md'
  };

  // Provider restrictions
  providers?: {
    allowed?: string[];
    default?: string;
    apiBaseUrl?: string;
  };

  // Distribution
  distribution?: {
    npmScope?: string;
    homebrewTap?: string;
    autoUpdateUrl?: string;
  };
}
```

---

## 10. Trade-offs and Decisions

### 10.1 TypeScript Over Rust/Go

**Decision**: TypeScript with Node.js 22+.

**Rationale**:
- Claude Code is TypeScript. MCP SDK is TypeScript. The plugin ecosystem is JavaScript. Choosing a different language would create an impedance mismatch at every integration point.
- Performance-critical paths (ripgrep for search, better-sqlite3 for storage, fast-glob for filesystem) already use native bindings. The overhead is in the Node.js event loop, not in computation.
- Contributor accessibility. The target community is developers who use AI coding tools. Most of them write TypeScript/JavaScript.

**Risks**:
- Memory management is harder in a GC language. Mitigated by explicit resource lifecycle (Section 8.4), memory budgets, and WeakRef/FinalizationRegistry.
- Binary size is larger than Go/Rust. Mitigated by tree-shaking and pkg/bun compile.
- Cold start is slower. Mitigated by lazy loading (tools, MCP servers, plugins all deferred).

**Alternative considered**: Rust with TypeScript bindings for the plugin layer. Rejected because the development velocity cost was too high for a 16-week timeline, and the integration complexity with Ink/React would be substantial.

### 10.2 Ink+React with Custom Renderer vs. Raw ANSI

**Decision**: Keep Ink for the component model. Intercept its output with a differential renderer.

**Rationale**:
- Ink provides a React component model that enables composable UI. Building this from scratch would take weeks.
- The flickering problem is specifically in Ink's output stage, not its reconciliation stage. We can fix the output without replacing the rest.
- Raw ANSI would require reimplementing layout (flexbox via Yoga), text wrapping, and component lifecycle.

**Risks**:
- Ink's internal output API may change between versions. Mitigated by pinning Ink version and wrapping the integration in an adapter.
- The differential renderer adds complexity. Mitigated by thorough snapshot tests.

**Alternative considered**: blessed-contrib (full terminal UI framework). Rejected because it is unmaintained and would lose React ecosystem compatibility.

### 10.3 SQLite Over JSON Files

**Decision**: better-sqlite3 for sessions, permissions, and plugin storage.

**Rationale**:
- JSON files (Claude Code's approach) suffer from concurrent write corruption, unbounded growth, and expensive full-file rewrites.
- SQLite provides ACID transactions, indexes for fast queries, and built-in size management.
- better-sqlite3 is synchronous, which simplifies the session store code and avoids async race conditions.

**Risks**:
- Native binding (better-sqlite3) complicates binary packaging. Mitigated by testing pkg/bun compile with native addons, with sql.js (pure WASM) as a fallback for environments where native compilation fails.
- SQLite file corruption on hard crashes. Mitigated by WAL mode (Write-Ahead Logging) which is crash-safe by default.

**Alternative considered**: LevelDB. Rejected because it provides less querying power than SQLite and adds another native dependency without clear benefit.

### 10.4 Rolling Compaction at 60% vs. On-Demand

**Decision**: Start proactive compaction at 60% context usage, with configurable thresholds.

**Rationale**:
- Claude Code waits until ~95% full, which causes a long pause (deadlock feel) when compaction finally triggers.
- At 60%, compaction is small and fast (summarizing a few old turns). At 95%, compaction must summarize dozens of turns at once.
- 60% is a conservative default. Users who want maximum context can set it to 80% or 90%.

**Risks**:
- Unnecessary summarization for short conversations that never reach 60%. Mitigated by only triggering when new messages have been added since the last check (no compaction on a static conversation).
- Summary quality may degrade conversation quality. Mitigated by preserving anchored messages and recent turns verbatim, and by using the model itself for summarization (it can produce high-quality summaries of its own conversation).

**Alternative considered**: Background compaction on a separate thread (Web Worker). Rejected for v1 because the serialization overhead of passing message arrays between workers negates the benefit. May revisit for v2.

### 10.5 Monorepo with 10 Packages vs. Fewer

**Decision**: 10 packages with strict dependency boundaries.

**Rationale**:
- White-label builders need to selectively include/exclude components. A monorepo with clear package boundaries enables this.
- Each package can be versioned, tested, and published independently.
- Dependency rules (Section 1.3) prevent architectural decay.

**Risks**:
- Initial development velocity is slower due to cross-package imports, build configuration, and type resolution.
- Turborepo configuration complexity.

**Mitigation**: Use path aliases in tsconfig to make cross-package imports feel local during development. Turborepo's parallel builds and caching offset the package count overhead.

**Alternative considered**: 3 packages (core, ui, cli). Rejected because it would make the white-label builder much harder (cannot selectively exclude hooks or MCP without importing the whole core).

### 10.6 Lazy Tool Loading vs. Eager

**Decision**: Tools are registered with schema only at startup. Implementation loaded on first call.

**Rationale**:
- Claude Code loads all MCP tool implementations at startup, which pollutes the LLM's context with tool descriptions it may never use, and consumes memory for unused tool code.
- Lazy loading means the LLM sees all available tool schemas (lightweight) but the actual implementation code is only imported when a tool is first called.

**Risks**:
- First call to a tool is slightly slower (module import). Mitigated by caching the loaded implementation for subsequent calls.
- MCP servers must still be started at startup to discover their tool schemas. The laziness is in loading the client-side adapter, not in server startup.

### 10.7 Event Bus vs. Direct Callbacks

**Decision**: Typed EventBus for all cross-cutting concerns.

**Rationale**:
- Direct callbacks create tight coupling between components. The agent loop should not know about the UI, the audit logger, or telemetry.
- The EventBus enables adding new subscribers (plugins, hooks, analytics) without modifying existing code.
- Typed events (Section 8.2) provide compile-time safety despite the decoupled architecture.

**Risks**:
- Event ordering is harder to reason about than direct calls. Mitigated by making all event handlers synchronous-first (fire and forget), with async handlers only for non-critical paths.
- Debugging is harder when the call stack goes through an event bus. Mitigated by including correlation IDs in events and structured logging.

### 10.8 AbortSignal for Cancellation vs. Custom Mechanism

**Decision**: Use the Web-standard AbortController/AbortSignal for all cancellation.

**Rationale**:
- AbortSignal is a web standard supported natively in Node.js fetch, timers, and streams.
- Tool implementations can check `ctx.abortSignal.aborted` to bail early.
- Composable: a parent agent's AbortController can cascade cancellation to child agents and tool executions.

**Risks**:
- Some native APIs do not support AbortSignal (e.g., better-sqlite3). Mitigated by wrapping those calls with manual abort checks.

---

## Appendix A: File-Level Package Layout

```
mimi-code/
  packages/
    core/
      src/
        agent/
          loop.ts              AgentLoop state machine
          events.ts            AgentEvent types
        context/
          manager.ts           ContextManager (compaction)
          counter.ts           TokenCounter
        session/
          store.ts             SessionStore (SQLite)
          schema.sql           Database schema
        prompt/
          assembler.ts         PromptAssembler
          fragments.ts         System prompt fragment types
        provider/
          types.ts             LLMProvider interface
          anthropic.ts         Anthropic adapter
          bedrock.ts           Bedrock adapter
          vertex.ts            Vertex adapter
          openai-compat.ts     OpenAI-compatible adapter
          normalizer.ts        StreamEvent normalizer
        di/
          container.ts         ServiceContainer
          tokens.ts            Service tokens
        events/
          bus.ts               EventBus
          types.ts             EventMap
        resource/
          manager.ts           ResourceManager
          temp-files.ts        TempFileRegistry
          memory.ts            MemoryMonitor
          cache.ts             BoundedCache
        types/
          messages.ts          Message, ContentBlock types
          tools.ts             Tool, ToolResult types
        index.ts               Package barrel export
      package.json
      tsconfig.json

    tools/
      src/
        registry.ts            ToolRegistry
        builtin/
          read.ts              Read tool
          write.ts             Write tool
          edit.ts              Edit tool (with fuzzy matching)
          glob.ts              Glob tool
          grep.ts              Grep tool (ripgrep)
          bash.ts              Bash tool (PTY, cleanup)
          web-search.ts        WebSearch tool
          web-fetch.ts         WebFetch tool
          notebook-edit.ts     NotebookEdit tool
          todo.ts              TodoWrite/TodoRead
          ask-user.ts          AskUserQuestion tool
        index.ts
      package.json

    permissions/
      src/
        engine.ts              PermissionEngine
        store.ts               PermissionStore (SQLite)
        rules.ts               Rule parser (gitignore patterns)
        sandbox.ts             SandboxManager
        audit.ts               AuditLogger
        hierarchy.ts           Settings hierarchy resolver
        index.ts
      package.json

    mcp/
      src/
        client.ts              MCPClient
        adapter.ts             MCPToolAdapter (wraps MCP as Tool)
        transport/
          stdio.ts             StdioTransport
          http.ts              HttpTransport
          sse.ts               SseTransport
        auth/
          oauth.ts             OAuth 2.0 flow
        manager.ts             MCPServerManager (lifecycle)
        config.ts              Config loader (.mcp.json, etc.)
        index.ts
      package.json

    hooks/
      src/
        runtime.ts             HookRuntime
        registry.ts            HookRegistry
        handlers/
          command.ts           CommandHandler (child process)
          http.ts              HttpHandler (POST)
          prompt.ts            PromptHandler (LLM eval)
          agent.ts             AgentHandler (sub-agent)
        matching.ts            Pattern matcher
        index.ts
      package.json

    skills/
      src/
        engine.ts              SkillEngine
        parser.ts              SKILL.md frontmatter parser
        discovery.ts           Skill discovery paths
        substitution.ts        Variable substitution
        index.ts
      package.json

    agents/
      src/
        spawner.ts             SubAgentSpawner
        handle.ts              AgentHandle (control)
        builtin/
          explore.ts           Explore agent (read-only, fast)
          plan.ts              Plan agent (read-only, inherit model)
          general.ts           General-purpose agent
        loader.ts              Custom agent .md loader
        team.ts                Team mode (experimental)
        index.ts
      package.json

    ui/
      src/
        app.tsx                MimiApp root component
        renderer/
          incremental.ts       IncrementalRenderer (diff-based)
          buffer.ts            VirtualTerminalBuffer
          scroll.ts            ScrollController
          interceptor.ts       Ink output interceptor
        components/
          input-editor.tsx     Multi-line input
          output-stream.tsx    Streaming markdown
          tool-call-view.tsx   Collapsed/expanded tool calls
          permission-modal.tsx Permission dialog
          diff-viewer.tsx      Inline diff
          spinner.tsx          Parrot spinner
          status-bar.tsx       Bottom status bar
          welcome-banner.tsx   ASCII art welcome
          task-list.tsx        Todo sidebar
        themes/
          types.ts             ThemeDefinition
          resolver.ts          Theme resolution chain
          builtin.ts           Built-in themes
        index.ts
      package.json

    brand/
      src/
        loader.ts              BrandLoader
        builder.ts             BrandBuilder (binary packaging)
        prompt-layer.ts        BrandPromptLayer
        config-dir.ts          Brand config directory resolution
        schema.ts              brand.json Zod schema
        index.ts
      package.json

    cli/
      src/
        main.ts                Entry point, composition root
        commands/
          interactive.ts       Main interactive session
          auth.ts              auth login/logout/status
          mcp.ts               mcp add/remove/list
          brand.ts             init-brand/build-brand/publish
          doctor.ts            System diagnostics
          update.ts            Auto-updater
        slash/
          registry.ts          Slash command registry
          builtin.ts           Built-in slash commands
        flags.ts               CLI flag definitions (commander)
        config.ts              Config resolution
        index.ts
      package.json
```

## Appendix B: Configuration File Resolution

```
Resolution chain for all configuration (first found wins, merged bottom-up):

CLI flags
  |
  v
Environment variables
  MIMI_MODEL, MIMI_API_KEY, MIMI_PROVIDER, etc.
  |
  v
.mimi/settings.local.json     (project personal, gitignored)
  |
  v
.mimi/settings.json           (project shared, committed)
  |
  v
~/.mimi/settings.json         (user global)
  |
  v
brand.json defaults            (white-label)
  |
  v
Built-in defaults              (@mimi/core hardcoded)


Backward compatibility reads (read-only, never written):
  .claude/settings.json
  .claude/settings.local.json
  ~/.claude.json (mcpServers section only)
  .claude/agents/
  .claude/skills/
  .claude/commands/
```

## Appendix C: Key Metrics and Budgets

```
Performance budgets:
  Cold start (no MCP):           < 500ms
  Cold start (with MCP servers): < 2s (MCP server startup is async)
  First token latency:           < 200ms after API call
  Incremental render frame:      < 16ms (60fps target)
  Context compaction (60%):      < 3s
  Tool execution timeout:        120s default, configurable
  MCP tool call timeout:         30s default, configurable

Memory budgets:
  Base process:                  < 80MB RSS
  Per-session overhead:          < 20MB
  Per MCP server:                < 30MB (child process)
  Maximum heap:                  512MB (configurable, triggers warning at 85%)

Binary size budgets:
  npm package:                   < 50MB (including ripgrep binary)
  Native binary (pkg):           < 100MB
  Docker image:                  < 200MB
```

---

This document provides the structural foundation for implementing Mimi Code. The key files to reference during implementation are:

- `/Users/yezhipeng/mimi-code/DEVELOPMENT_PLAN.md` -- Phase-by-phase task breakdown and timeline
- This architecture document -- Structural decisions, interfaces, and data flows

The interfaces in Section 9 should be implemented first as they form the skeleton that all other code connects to. The dependency DAG in Section 1 determines the build order. The data flow diagrams in Section 7 serve as integration test specifications.
