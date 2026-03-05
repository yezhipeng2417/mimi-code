import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator, DEFAULT_AGENT_TYPES } from '../orchestrator.js';

describe('AgentOrchestrator', () => {
  it('should register default agent types', () => {
    const orch = new AgentOrchestrator();
    const types = orch.listAgentTypes();

    expect(types.length).toBe(DEFAULT_AGENT_TYPES.length);
    expect(orch.getAgentType('general-purpose')).toBeDefined();
    expect(orch.getAgentType('Explore')).toBeDefined();
    expect(orch.getAgentType('Plan')).toBeDefined();
  });

  it('should register custom agent type', () => {
    const orch = new AgentOrchestrator();
    orch.registerAgentType({
      name: 'custom-agent',
      description: 'A custom test agent',
      systemPrompt: 'You are custom.',
      allowedTools: ['Read'],
      maxTurns: 5,
    });

    expect(orch.getAgentType('custom-agent')).toBeDefined();
    expect(orch.getAgentTypeNames()).toContain('custom-agent');
  });

  it('should throw when spawning unknown agent type', async () => {
    const orch = new AgentOrchestrator();
    orch.setRunFn(async () => ({
      agentId: '',
      type: '',
      response: '',
      success: true,
      totalTokens: 0,
      durationMs: 0,
    }));

    await expect(
      orch.spawn({ type: 'nonexistent', prompt: 'test' }),
    ).rejects.toThrow('Unknown agent type: "nonexistent"');
  });

  it('should throw when runner not configured', async () => {
    const orch = new AgentOrchestrator();

    await expect(
      orch.spawn({ type: 'general-purpose', prompt: 'test' }),
    ).rejects.toThrow('Agent runner not configured');
  });

  it('should spawn foreground agent and wait for completion', async () => {
    const orch = new AgentOrchestrator();
    const runFn = vi.fn().mockResolvedValue({
      agentId: 'test-id',
      type: 'Explore',
      response: 'Found 3 files.',
      success: true,
      totalTokens: 500,
      durationMs: 100,
    });
    orch.setRunFn(runFn);

    const agentId = await orch.spawn({
      type: 'Explore',
      prompt: 'Search for test files',
    });

    expect(agentId).toBeDefined();
    expect(runFn).toHaveBeenCalledOnce();

    const agent = orch.getAgent(agentId);
    expect(agent).toBeDefined();
    expect(agent!.status).toBe('completed');
    expect(agent!.result?.response).toBe('Found 3 files.');
  });

  it('should handle agent failure gracefully', async () => {
    const orch = new AgentOrchestrator();
    orch.setRunFn(async () => {
      throw new Error('Provider timeout');
    });

    const agentId = await orch.spawn({
      type: 'Explore',
      prompt: 'test',
    });

    const agent = orch.getAgent(agentId);
    expect(agent!.status).toBe('failed');
    expect(agent!.result?.success).toBe(false);
    expect(agent!.result?.error).toContain('Provider timeout');
  });

  it('should cancel a running agent', async () => {
    const orch = new AgentOrchestrator();
    // Use a runner that never resolves (background agent)
    orch.setRunFn(() => new Promise(() => {}));

    const agentId = await orch.spawn({
      type: 'Explore',
      prompt: 'long running task',
      background: true,
    });

    expect(orch.getAgent(agentId)!.status).toBe('running');

    orch.cancelAgent(agentId);
    expect(orch.getAgent(agentId)!.status).toBe('cancelled');
  });

  it('should list only running agents', async () => {
    const orch = new AgentOrchestrator();
    orch.setRunFn(async () => ({
      agentId: '',
      type: '',
      response: '',
      success: true,
      totalTokens: 0,
      durationMs: 0,
    }));

    // Completed agent
    await orch.spawn({ type: 'Explore', prompt: 'done' });

    // Running agent
    orch.setRunFn(() => new Promise(() => {}));
    await orch.spawn({ type: 'Plan', prompt: 'still going', background: true });

    const active = orch.listActiveAgents();
    expect(active).toHaveLength(1);
    expect(active[0]!.type).toBe('Plan');
  });

  it('should clean up non-running agents', async () => {
    const orch = new AgentOrchestrator();
    orch.setRunFn(async () => ({
      agentId: '',
      type: '',
      response: '',
      success: true,
      totalTokens: 0,
      durationMs: 0,
    }));

    const id1 = await orch.spawn({ type: 'Explore', prompt: 'task1' });

    // Verify agent exists after completion
    expect(orch.getAgent(id1)).toBeDefined();

    orch.cleanup();

    // After cleanup, completed agent should be removed
    expect(orch.getAgent(id1)).toBeUndefined();
  });

  it('should emit events via eventBus', async () => {
    const eventBus = { emit: vi.fn() };
    const orch = new AgentOrchestrator(eventBus);
    orch.setRunFn(async () => ({
      agentId: '',
      type: '',
      response: '',
      success: true,
      totalTokens: 0,
      durationMs: 0,
    }));

    await orch.spawn({ type: 'Explore', prompt: 'test' });

    expect(eventBus.emit).toHaveBeenCalledWith('agent:state_change', {
      from: 'IDLE',
      to: 'ASSEMBLING',
    });
  });
});
