/**
 * MimiApp — Root Ink component composing all UI layers.
 *
 * Manages application state and renders the interactive TUI:
 *   - Welcome banner
 *   - Message history (user + assistant bubbles)
 *   - Streaming assistant response
 *   - Tool call views
 *   - Permission prompts
 *   - Status bar
 *   - Input editor
 */

import React, { useState, useEffect, useReducer } from 'react';
import { Box, useApp, useInput } from 'ink';
import { ErrorBoundary } from './ErrorBoundary.js';
import { WelcomeBanner } from './WelcomeBanner.js';
import { MessageBubble } from './MessageBubble.js';
import { StreamingText } from './StreamingText.js';
import { ToolCallView } from './ToolCallView.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { StatusBar } from './StatusBar.js';
import { InputEditor } from './InputEditor.js';
import { Spinner } from './Spinner.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface ToolCallInfo {
  id: string;
  toolName: string;
  input?: string;
  output?: string;
  isError?: boolean;
  durationMs?: number;
  status: 'running' | 'done';
}

export interface PermissionRequest {
  id: string;
  toolName: string;
  input: string;
  resolve: (decision: { allowed: boolean; persist: boolean }) => void;
}

export interface AppState {
  messages: DisplayMessage[];
  streamingText: string;
  isStreaming: boolean;
  toolCalls: ToolCallInfo[];
  permissionRequest: PermissionRequest | null;
  isProcessing: boolean;
  tokenCount: number;
  costUsd: number;
  cacheHitRate?: number;
}

// ─── Actions ──────────────────────────────────────────────────────────────

type AppAction =
  | { type: 'ADD_MESSAGE'; message: DisplayMessage }
  | { type: 'STREAM_DELTA'; text: string }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_STOP' }
  | { type: 'TOOL_START'; call: ToolCallInfo }
  | { type: 'TOOL_END'; id: string; output?: string; isError?: boolean; durationMs?: number }
  | { type: 'PERMISSION_REQUEST'; request: PermissionRequest }
  | { type: 'PERMISSION_RESOLVE' }
  | { type: 'SET_PROCESSING'; value: boolean }
  | { type: 'UPDATE_USAGE'; tokenCount: number; costUsd: number; cacheHitRate?: number }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'FINALIZE_STREAM' };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'STREAM_START':
      return { ...state, isStreaming: true, streamingText: '' };

    case 'STREAM_DELTA':
      return { ...state, streamingText: state.streamingText + action.text };

    case 'STREAM_STOP':
      return { ...state, isStreaming: false };

    case 'FINALIZE_STREAM': {
      if (!state.streamingText) return { ...state, isStreaming: false };
      const msg: DisplayMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        text: state.streamingText,
      };
      return {
        ...state,
        messages: [...state.messages, msg],
        streamingText: '',
        isStreaming: false,
      };
    }

    case 'TOOL_START':
      return { ...state, toolCalls: [...state.toolCalls, action.call] };

    case 'TOOL_END':
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.id === action.id
            ? { ...tc, status: 'done' as const, output: action.output, isError: action.isError, durationMs: action.durationMs }
            : tc,
        ),
      };

    case 'PERMISSION_REQUEST':
      return { ...state, permissionRequest: action.request };

    case 'PERMISSION_RESOLVE':
      return { ...state, permissionRequest: null };

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.value,
        // Clear tool calls when starting new processing
        ...(action.value ? { toolCalls: [] } : {}),
      };

    case 'UPDATE_USAGE':
      return {
        ...state,
        tokenCount: action.tokenCount,
        costUsd: action.costUsd,
        cacheHitRate: action.cacheHitRate,
      };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], toolCalls: [] };

    default:
      return state;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────

export interface MimiAppProps {
  /** Banner text (ASCII art) */
  bannerText?: string;
  /** Product name */
  productName: string;
  /** Version string */
  version?: string;
  /** Welcome message */
  welcomeMessage?: string;
  /** Model name for status bar */
  model: string;
  /** Called when user submits input */
  onSubmit: (text: string) => void;
  /** Called when user quits (Ctrl+C twice) */
  onExit?: () => void;
  /** EventBus to subscribe to stream/tool events */
  eventBus: {
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
  };
}

// ─── Component ────────────────────────────────────────────────────────────

export function MimiApp({
  bannerText,
  productName,
  version,
  welcomeMessage,
  model,
  onSubmit,
  onExit,
  eventBus,
}: MimiAppProps): React.ReactElement {
  const { exit } = useApp();
  const [ctrlCCount, setCtrlCCount] = useState(0);

  const initialState: AppState = {
    messages: [],
    streamingText: '',
    isStreaming: false,
    toolCalls: [],
    permissionRequest: null,
    isProcessing: false,
    tokenCount: 0,
    costUsd: 0,
  };

  const [state, dispatch] = useReducer(appReducer, initialState);

  // Subscribe to EventBus events
  useEffect(() => {
    const handlers = {
      'stream:start': () => dispatch({ type: 'STREAM_START' }),
      'stream:delta': ({ text }: { text: string }) =>
        dispatch({ type: 'STREAM_DELTA', text }),
      'stream:stop': () => dispatch({ type: 'FINALIZE_STREAM' }),
      'tool:start': ({ toolName, toolCallId }: { toolName: string; toolCallId: string }) =>
        dispatch({
          type: 'TOOL_START',
          call: { id: toolCallId, toolName, status: 'running' },
        }),
      'tool:end': ({ toolCallId, durationMs }: { toolCallId: string; durationMs: number }) =>
        dispatch({ type: 'TOOL_END', id: toolCallId, durationMs }),
      'tool:error': ({ toolCallId, error }: { toolCallId: string; error: Error }) =>
        dispatch({
          type: 'TOOL_END',
          id: toolCallId,
          output: error.message,
          isError: true,
        }),
      'agent:processing': ({ processing }: { processing: boolean }) =>
        dispatch({ type: 'SET_PROCESSING', value: processing }),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      eventBus.on(event, handler as (...args: unknown[]) => void);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        eventBus.off(event, handler as (...args: unknown[]) => void);
      }
    };
  }, [eventBus]);

  // Ctrl+C handling: first press cancels, second exits
  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      if (ctrlCCount >= 1) {
        onExit?.();
        exit();
      } else {
        setCtrlCCount((c) => c + 1);
        // Reset after 2 seconds
        setTimeout(() => setCtrlCCount(0), 2000);
      }
    }
  });

  const handleSubmit = (text: string) => {
    // Add user message to display
    dispatch({
      type: 'ADD_MESSAGE',
      message: { id: `user-${Date.now()}`, role: 'user', text },
    });
    onSubmit(text);
  };

  const inputActive = !state.isProcessing && !state.permissionRequest;

  return (
    <ErrorBoundary>
    <Box flexDirection="column">
      {/* Welcome Banner — shown once at top */}
      {bannerText && (
        <WelcomeBanner
          bannerText={bannerText}
          productName={productName}
          version={version}
          welcomeMessage={welcomeMessage}
        />
      )}

      {/* Message History */}
      {state.messages.map((msg) => (
        <MessageBubble key={msg.id} role={msg.role} text={msg.text} />
      ))}

      {/* Streaming Response */}
      {state.isStreaming && (
        <Box flexDirection="column" marginBottom={1}>
          <StreamingText text={state.streamingText} isStreaming={true} />
        </Box>
      )}

      {/* Tool Calls */}
      {state.toolCalls.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {state.toolCalls.map((tc) => (
            <Box key={tc.id}>
              {tc.status === 'running' ? (
                <Spinner label={tc.toolName} />
              ) : (
                <ToolCallView
                  toolName={tc.toolName}
                  input={tc.input}
                  output={tc.output}
                  isError={tc.isError}
                  durationMs={tc.durationMs}
                />
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Permission Prompt */}
      {state.permissionRequest && (
        <PermissionPrompt
          toolName={state.permissionRequest.toolName}
          input={state.permissionRequest.input}
          onAllow={() => {
            state.permissionRequest?.resolve({ allowed: true, persist: false });
            dispatch({ type: 'PERMISSION_RESOLVE' });
          }}
          onDeny={() => {
            state.permissionRequest?.resolve({ allowed: false, persist: false });
            dispatch({ type: 'PERMISSION_RESOLVE' });
          }}
          onAlwaysAllow={() => {
            state.permissionRequest?.resolve({ allowed: true, persist: true });
            dispatch({ type: 'PERMISSION_RESOLVE' });
          }}
        />
      )}

      {/* Processing indicator */}
      {state.isProcessing && !state.isStreaming && state.toolCalls.length === 0 && (
        <Spinner label="Thinking..." />
      )}

      {/* Status Bar */}
      <StatusBar
        model={model}
        tokenCount={state.tokenCount}
        costUsd={state.costUsd}
        cacheHitRate={state.cacheHitRate}
      />

      {/* Input Editor */}
      <InputEditor
        onSubmit={handleSubmit}
        isActive={inputActive}
        placeholder={inputActive ? 'Type a message...' : undefined}
      />
    </Box>
    </ErrorBoundary>
  );
}
