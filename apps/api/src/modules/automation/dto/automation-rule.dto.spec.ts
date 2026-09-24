import { automationRuleSchema, updateAutomationRuleSchema } from './automation-rule.dto';

describe('automation rule schemas', () => {
  it('does not inject defaults into a partial update', () => {
    expect(updateAutomationRuleSchema.parse({ active: true })).toEqual({ active: true });
  });

  it('defaults to 0 (sin tope) and accepts 0 as unlimited', () => {
    expect(automationRuleSchema.parse({ name: 'General' }).dailyLimit).toBe(0);
    expect(automationRuleSchema.parse({ name: 'General', dailyLimit: 0 }).dailyLimit).toBe(0);
  });
});
