import { describe, it, expect } from 'vitest';
import { validateBrandConfig, brandConfigSchema } from '../schema.js';

describe('Brand Schema Validation', () => {
  it('should validate a minimal brand config', () => {
    const config = validateBrandConfig({ name: 'TestBot' });
    expect(config.name).toBe('TestBot');
  });

  it('should validate a full brand config', () => {
    const config = validateBrandConfig({
      name: 'AcmeCLI',
      version: '1.0.0',
      description: 'Acme coding assistant',
      defaultModel: 'claude-sonnet-4-6',
      defaultMaxTokens: 8192,
      welcomeMessage: 'Welcome to Acme!',
      prompt: {
        prepend: 'You are AcmeBot.',
        append: 'Follow Acme standards.',
      },
      theme: {
        name: 'dark',
        colors: { primary: '#FF0000' },
        symbols: { prompt: '>' },
      },
      permissions: [
        { tool: 'Bash', decision: 'deny' },
        { tool: 'Read', pattern: '/safe/**', decision: 'allow' },
      ],
    });

    expect(config.name).toBe('AcmeCLI');
    expect(config.defaultMaxTokens).toBe(8192);
    expect(config.prompt?.prepend).toBe('You are AcmeBot.');
    expect(config.permissions).toHaveLength(2);
  });

  it('should reject config without name', () => {
    expect(() => validateBrandConfig({})).toThrow();
  });

  it('should reject empty name', () => {
    expect(() => validateBrandConfig({ name: '' })).toThrow();
  });

  it('should reject negative maxTokens', () => {
    expect(() => validateBrandConfig({ name: 'Test', defaultMaxTokens: -1 })).toThrow();
  });

  it('should reject unknown top-level fields (strict mode)', () => {
    expect(() => validateBrandConfig({ name: 'Test', unknownField: true })).toThrow();
  });
});
