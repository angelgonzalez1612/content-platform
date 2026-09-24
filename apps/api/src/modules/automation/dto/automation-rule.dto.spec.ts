import { automationRuleSchema, updateAutomationRuleSchema } from './automation-rule.dto';

describe('automation rule schemas', () => {
  it('does not inject defaults into a partial update', () => {
    expect(updateAutomationRuleSchema.parse({ active: true })).toEqual({ active: true });
  });

  it('defaults to 0 (sin tope) and accepts 0 as unlimited', () => {
    expect(automationRuleSchema.parse({ name: 'General' }).dailyLimit).toBe(0);
    expect(automationRuleSchema.parse({ name: 'General', dailyLimit: 0 }).dailyLimit).toBe(0);
  });

  it('un update parcial preserva los campos que no vienen (no los borra)', () => {
    expect(updateAutomationRuleSchema.parse({ dailyLimit: 5 })).toEqual({ dailyLimit: 5 });
  });

  it('un update rechaza llaves desconocidas (strict)', () => {
    expect(() => updateAutomationRuleSchema.parse({ active: true, foo: 'bar' })).toThrow();
  });

  it('el default de proveedor es codex-cli', () => {
    expect(automationRuleSchema.parse({ name: 'General' }).provider).toBe('codex-cli');
  });
});
