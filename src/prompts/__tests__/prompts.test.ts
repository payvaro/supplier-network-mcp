import { describe, it, expect } from 'vitest';
import { NETWORK_PROMPTS, handleGetPrompt } from '../index.js';

describe('prompts', () => {
  describe('NETWORK_PROMPTS', () => {
    it('exports three prompts', () => {
      expect(NETWORK_PROMPTS).toHaveLength(3);
    });

    it('includes import_investigation prompt', () => {
      const prompt = NETWORK_PROMPTS.find(p => p.name === 'network_import_investigation');
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('import');
      expect(prompt!.arguments).toHaveLength(2);
    });

    it('includes relationship_audit prompt', () => {
      const prompt = NETWORK_PROMPTS.find(p => p.name === 'network_relationship_audit');
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('relationship');
      expect(prompt!.arguments).toHaveLength(2);
    });

    it('includes data_quality_review prompt', () => {
      const prompt = NETWORK_PROMPTS.find(p => p.name === 'network_data_quality_review');
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('quality');
      expect(prompt!.arguments).toHaveLength(1);
    });

    it('all prompts have correct structure', () => {
      for (const prompt of NETWORK_PROMPTS) {
        expect(prompt.name).toBeDefined();
        expect(prompt.name).toMatch(/^network_/);
        expect(prompt.description).toBeDefined();
        expect(prompt.arguments).toBeDefined();
        expect(Array.isArray(prompt.arguments)).toBe(true);
      }
    });
  });

  describe('handleGetPrompt', () => {
    describe('network_import_investigation', () => {
      it('returns prompt without arguments', async () => {
        const result = await handleGetPrompt('network_import_investigation', {});

        expect(result.description).toContain('import');
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
        expect(result.messages[0].content).toBeDefined();
      });

      it('returns prompt with date argument', async () => {
        const result = await handleGetPrompt('network_import_investigation', {
          date: '20251119',
        });

        expect(result.description).toContain('2025-11-19');
        const content = result.messages[0].content;
        expect(typeof content === 'object' && 'text' in content ? content.text : '').toContain('20251119');
      });

      it('returns prompt with buyerId argument', async () => {
        const result = await handleGetPrompt('network_import_investigation', {
          buyerId: 'buyer-123',
        });

        const content = result.messages[0].content;
        expect(typeof content === 'object' && 'text' in content ? content.text : '').toContain('buyer-123');
      });

      it('includes step-by-step instructions', async () => {
        const result = await handleGetPrompt('network_import_investigation', {});

        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('Step 1');
        expect(text).toContain('Step 2');
        expect(text).toContain('network_analyze_import');
      });
    });

    describe('network_relationship_audit', () => {
      it('returns prompt without arguments (standard depth)', async () => {
        const result = await handleGetPrompt('network_relationship_audit', {});

        expect(result.description).toContain('standard');
        expect(result.messages).toHaveLength(1);
      });

      it('returns prompt with buyerId argument', async () => {
        const result = await handleGetPrompt('network_relationship_audit', {
          buyerId: 'buyer-456',
        });

        expect(result.description).toContain('buyer-456');
      });

      it('returns quick depth prompt', async () => {
        const result = await handleGetPrompt('network_relationship_audit', {
          depth: 'quick',
        });

        expect(result.description).toContain('quick');
        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('quick audit');
      });

      it('returns deep depth prompt', async () => {
        const result = await handleGetPrompt('network_relationship_audit', {
          depth: 'deep',
        });

        expect(result.description).toContain('deep');
        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('Deep Dive');
      });

      it('includes all three phases', async () => {
        const result = await handleGetPrompt('network_relationship_audit', {});

        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('Phase 1');
        expect(text).toContain('Phase 2');
        expect(text).toContain('Phase 3');
        expect(text).toContain('network_analyze_relationships');
      });
    });

    describe('network_data_quality_review', () => {
      it('returns prompt without arguments (all focus)', async () => {
        const result = await handleGetPrompt('network_data_quality_review', {});

        expect(result.description).toContain('complete');
        expect(result.messages).toHaveLength(1);
      });

      it('returns prompt with suppliers focus', async () => {
        const result = await handleGetPrompt('network_data_quality_review', {
          focus: 'suppliers',
        });

        expect(result.description).toContain('suppliers');
        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('Supplier Data Quality');
      });

      it('returns prompt with buyers focus', async () => {
        const result = await handleGetPrompt('network_data_quality_review', {
          focus: 'buyers',
        });

        expect(result.description).toContain('buyers');
      });

      it('returns prompt with links focus', async () => {
        const result = await handleGetPrompt('network_data_quality_review', {
          focus: 'links',
        });

        expect(result.description).toContain('links');
        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('Link');
      });

      it('includes quality scorecard template', async () => {
        const result = await handleGetPrompt('network_data_quality_review', {});

        const content = result.messages[0].content;
        const text = typeof content === 'object' && 'text' in content ? content.text : '';
        expect(text).toContain('Quality Scorecard');
        expect(text).toContain('Completeness');
        expect(text).toContain('Accuracy');
        expect(text).toContain('Consistency');
      });
    });

    describe('error handling', () => {
      it('throws for unknown prompt name', async () => {
        await expect(
          handleGetPrompt('network_unknown_prompt', {})
        ).rejects.toThrow('Unknown prompt');
      });
    });
  });
});
