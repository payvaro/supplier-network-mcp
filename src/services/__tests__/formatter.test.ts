import { describe, it, expect } from 'vitest';
import {
  formatAddress,
  formatContact,
  formatSupplierMarkdown,
  formatSupplierMatchMarkdown,
  formatSearchResultsMarkdown,
  formatSupplierListMarkdown,
  truncateIfNeeded,
  formatOutput,
  createErrorResponse,
} from '../formatter.js';
import { ResponseFormat, CHARACTER_LIMIT } from '../../constants.js';
import {
  createSupplier,
  createAddress,
  createContact,
  createSupplierMatch,
  createMatchScore,
} from '../../test-utils/fixtures.js';
import type { SearchResult } from '../../types.js';

describe('formatter', () => {
  describe('formatAddress', () => {
    it('returns "No address provided" for undefined', () => {
      expect(formatAddress(undefined)).toBe('No address provided');
    });

    it('formats full address with all parts', () => {
      const address = createAddress({
        streetAddress: '123 Main St',
        suiteUnit: 'Suite 100',
        city: 'Springfield',
        stateProvince: 'IL',
        postalCode: '62701',
      });
      const result = formatAddress(address);
      expect(result).toBe('123 Main St, Suite 100, Springfield, IL, 62701');
    });

    it('formats partial address (city and state only)', () => {
      const address: Parameters<typeof formatAddress>[0] = {
        city: 'Chicago',
        stateProvince: 'IL',
      };
      const result = formatAddress(address);
      expect(result).toBe('Chicago, IL');
    });

    it('formats address with only street', () => {
      const address: Parameters<typeof formatAddress>[0] = {
        streetAddress: '456 Oak Ave',
      };
      const result = formatAddress(address);
      expect(result).toBe('456 Oak Ave');
    });

    it('handles empty address object', () => {
      const address: Parameters<typeof formatAddress>[0] = {};
      const result = formatAddress(address);
      expect(result).toBe('');
    });
  });

  describe('formatContact', () => {
    it('formats contact with all fields', () => {
      const contact = createContact({
        name: 'John Doe',
        position: 'Manager',
        email: 'john@example.com',
        phone: '555-1234',
        type: 'PRIMARY',
      });
      const result = formatContact(contact);
      expect(result).toContain('**John Doe**');
      expect(result).toContain('Manager');
      expect(result).toContain('john@example.com');
      expect(result).toContain('555-1234');
      expect(result).toContain('(PRIMARY)');
    });

    it('formats contact with name only', () => {
      const contact: Parameters<typeof formatContact>[0] = { name: 'Jane Smith' };
      const result = formatContact(contact);
      expect(result).toBe('**Jane Smith**');
    });

    it('formats contact with email only', () => {
      const contact = createContact({ email: 'test@example.com' });
      const result = formatContact(contact);
      expect(result).toContain('test@example.com');
    });

    it('uses bullet separator between parts', () => {
      const contact = createContact({
        name: 'Test',
        email: 'test@example.com',
      });
      const result = formatContact(contact);
      expect(result).toContain(' • ');
    });
  });

  describe('formatSupplierMarkdown', () => {
    it('formats supplier with basic info', () => {
      const supplier = createSupplier({
        name: 'Acme Corp',
        id: 'supplier-123',
        email: 'info@acme.com',
      });
      const result = formatSupplierMarkdown(supplier);
      expect(result).toContain('### Acme Corp');
      expect(result).toContain('**ID:** supplier-123');
      expect(result).toContain('**Email:** info@acme.com');
    });

    it('shows "Unnamed Supplier" when name is missing', () => {
      const supplier = createSupplier({ name: undefined });
      const result = formatSupplierMarkdown(supplier);
      expect(result).toContain('### Unnamed Supplier');
    });

    it('includes address when present', () => {
      const supplier = createSupplier({
        address: { city: 'Chicago', stateProvince: 'IL' },
      });
      const result = formatSupplierMarkdown(supplier);
      expect(result).toContain('**Address:** Chicago, IL');
    });

    it('includes contacts in detailed mode', () => {
      const supplier = createSupplier({
        contacts: [createContact({ name: 'John Doe', email: 'john@test.com' })],
      });
      const result = formatSupplierMarkdown(supplier, true);
      expect(result).toContain('**Contacts:**');
      expect(result).toContain('John Doe');
    });

    it('excludes contacts in non-detailed mode', () => {
      const supplier = createSupplier({
        contacts: [createContact({ name: 'John Doe' })],
      });
      const result = formatSupplierMarkdown(supplier, false);
      expect(result).not.toContain('**Contacts:**');
    });

    it('includes aliases in detailed mode', () => {
      const supplier = createSupplier({
        aliases: [{ id: '1', name: 'Acme Inc' }, { id: '2', name: 'Acme LLC' }],
      });
      const result = formatSupplierMarkdown(supplier, true);
      expect(result).toContain('**Aliases:** Acme Inc, Acme LLC');
    });

    it('includes buyer link count in detailed mode', () => {
      const supplier = createSupplier({
        buyerLinks: [
          { buyerLinkId: '1', buyerId: 'b1', supplierId: 's1' },
          { buyerLinkId: '2', buyerId: 'b2', supplierId: 's1' },
        ],
      });
      const result = formatSupplierMarkdown(supplier, true);
      expect(result).toContain('**Buyer Links:** 2 connection(s)');
    });

    it('formats created and updated dates', () => {
      const supplier = createSupplier({
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-06-20T15:30:00Z',
      });
      const result = formatSupplierMarkdown(supplier);
      expect(result).toContain('**Created:**');
      expect(result).toContain('**Updated:**');
    });
  });

  describe('formatSupplierMatchMarkdown', () => {
    it('formats match with score and emoji', () => {
      const match = createSupplierMatch({
        matchScore: createMatchScore({ score: 0.95, level: 'exact' }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('## 1.');
      expect(result).toContain('95.0%');
      expect(result).toContain('EXACT');
    });

    it('uses correct emoji for exact match', () => {
      const match = createSupplierMatch({
        matchScore: createMatchScore({ level: 'exact' }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('🎯');
    });

    it('uses correct emoji for high match', () => {
      const match = createSupplierMatch({
        matchScore: createMatchScore({ level: 'high' }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('✅');
    });

    it('uses correct emoji for medium match', () => {
      const match = createSupplierMatch({
        matchScore: createMatchScore({ level: 'medium' }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('🟡');
    });

    it('uses correct emoji for low match', () => {
      const match = createSupplierMatch({
        matchScore: createMatchScore({ level: 'low' }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('🔶');
    });

    it('includes match reasons', () => {
      const match = createSupplierMatch({
        matchScore: createMatchScore({
          reasons: ['Name matches exactly', 'City matches'],
        }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('**Why this matches:**');
      expect(result).toContain('- Name matches exactly');
      expect(result).toContain('- City matches');
    });

    it('includes field match scores', () => {
      const match = createSupplierMatch({
        matchedFields: {
          name: 0.9,
          address: 0.7,
          email: 1.0,
        },
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('**Field Matches:**');
      expect(result).toContain('Name: 90%');
      expect(result).toContain('Address: 70%');
      expect(result).toContain('Email: 100%');
    });

    it('shows primary contact if available', () => {
      const match = createSupplierMatch({
        supplier: createSupplier({
          contacts: [
            createContact({ name: 'Secondary', type: 'SECONDARY' }),
            createContact({ name: 'Primary', type: 'PRIMARY' }),
          ],
        }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('**Primary Contact:**');
      expect(result).toContain('Primary');
    });

    it('shows first contact if no primary', () => {
      const match = createSupplierMatch({
        supplier: createSupplier({
          contacts: [createContact({ name: 'First Contact', type: 'OTHER' })],
        }),
      });
      const result = formatSupplierMatchMarkdown(match, 0);
      expect(result).toContain('First Contact');
    });

    it('uses correct index in header', () => {
      const match = createSupplierMatch();
      const result = formatSupplierMatchMarkdown(match, 4);
      expect(result).toContain('## 5.');
    });
  });

  describe('formatSearchResultsMarkdown', () => {
    it('formats search results with query info', () => {
      const searchResult: SearchResult = {
        query: { name: 'Acme', email: 'test@acme.com' },
        matches: [],
        totalMatches: 0,
      };
      const result = formatSearchResultsMarkdown(searchResult);
      expect(result).toContain('# 🔍 Supplier Search Results');
      expect(result).toContain('## Search Query');
      expect(result).toContain('**Name:** Acme');
      expect(result).toContain('**Email:** test@acme.com');
      expect(result).toContain('**Total Matches Found:** 0');
    });

    it('shows no matches message when empty', () => {
      const searchResult: SearchResult = {
        query: { name: 'Nonexistent' },
        matches: [],
        totalMatches: 0,
      };
      const result = formatSearchResultsMarkdown(searchResult);
      expect(result).toContain('No matches found. Try:');
      expect(result).toContain('Using partial names');
    });

    it('formats multiple matches with separators', () => {
      const searchResult: SearchResult = {
        query: { name: 'Corp' },
        matches: [
          createSupplierMatch({ supplier: createSupplier({ name: 'Acme Corp' }) }),
          createSupplierMatch({ supplier: createSupplier({ name: 'Beta Corp' }) }),
        ],
        totalMatches: 2,
      };
      const result = formatSearchResultsMarkdown(searchResult);
      expect(result).toContain('Acme Corp');
      expect(result).toContain('Beta Corp');
      expect(result).toContain('---');
    });

    it('includes address in query when present', () => {
      const searchResult: SearchResult = {
        query: {
          address: { city: 'Chicago', stateProvince: 'IL' },
        },
        matches: [],
        totalMatches: 0,
      };
      const result = formatSearchResultsMarkdown(searchResult);
      expect(result).toContain('**Address:** Chicago, IL');
    });
  });

  describe('formatSupplierListMarkdown', () => {
    it('formats empty list', () => {
      const result = formatSupplierListMarkdown([]);
      expect(result).toContain('# Supplier List');
      expect(result).toContain('**Total:** 0 supplier(s)');
    });

    it('formats list with multiple suppliers', () => {
      const suppliers = [
        createSupplier({ name: 'Supplier A' }),
        createSupplier({ name: 'Supplier B' }),
        createSupplier({ name: 'Supplier C' }),
      ];
      const result = formatSupplierListMarkdown(suppliers);
      expect(result).toContain('**Total:** 3 supplier(s)');
      expect(result).toContain('### Supplier A');
      expect(result).toContain('### Supplier B');
      expect(result).toContain('### Supplier C');
    });

    it('adds separators between suppliers', () => {
      const suppliers = [
        createSupplier({ name: 'First' }),
        createSupplier({ name: 'Second' }),
      ];
      const result = formatSupplierListMarkdown(suppliers);
      const separatorCount = (result.match(/---/g) || []).length;
      expect(separatorCount).toBeGreaterThanOrEqual(2); // header separator + between suppliers
    });
  });

  describe('truncateIfNeeded', () => {
    it('returns text unchanged if under limit', () => {
      const text = 'Short text';
      expect(truncateIfNeeded(text)).toBe(text);
    });

    it('truncates text at default CHARACTER_LIMIT', () => {
      const longText = 'x'.repeat(CHARACTER_LIMIT + 500);
      const result = truncateIfNeeded(longText);
      expect(result.length).toBeLessThan(longText.length);
      expect(result).toContain('truncated');
    });

    it('truncates at custom limit', () => {
      const text = 'a'.repeat(500);
      const result = truncateIfNeeded(text, 200);
      expect(result.length).toBeLessThan(500);
      expect(result).toContain('truncated');
    });

    it('truncates at newline boundary when possible', () => {
      const text = 'Line 1\nLine 2\nLine 3\n' + 'x'.repeat(300);
      const result = truncateIfNeeded(text, 50);
      expect(result).toContain('truncated');
    });

    it('includes truncation message', () => {
      const text = 'x'.repeat(500);
      const result = truncateIfNeeded(text, 200);
      expect(result).toContain('[Output truncated at');
      expect(result).toContain('characters');
    });

    it('returns exact text at limit boundary', () => {
      const text = 'x'.repeat(100);
      expect(truncateIfNeeded(text, 100)).toBe(text);
    });
  });

  describe('formatOutput', () => {
    it('returns JSON format with stringified data', () => {
      const data = { name: 'Test', value: 123 };
      const result = formatOutput(data, ResponseFormat.JSON, () => 'markdown');
      expect(result.text).toBe(JSON.stringify(data, null, 2));
      expect(result.structuredData).toEqual(data);
    });

    it('returns markdown format with formatter result', () => {
      const data = { name: 'Test' };
      const markdownContent = '# Test Markdown';
      const result = formatOutput(data, ResponseFormat.MARKDOWN, () => markdownContent);
      expect(result.text).toBe(markdownContent);
      expect(result.structuredData).toEqual(data);
    });

    it('truncates markdown output if too long', () => {
      const data = { name: 'Test' };
      const longMarkdown = 'x'.repeat(CHARACTER_LIMIT + 500);
      const result = formatOutput(data, ResponseFormat.MARKDOWN, () => longMarkdown);
      expect(result.text.length).toBeLessThan(longMarkdown.length);
      expect(result.text).toContain('truncated');
    });

    it('does not truncate JSON output', () => {
      const largeData = { content: 'x'.repeat(CHARACTER_LIMIT + 500) };
      const result = formatOutput(largeData, ResponseFormat.JSON, () => 'unused');
      expect(result.text).toBe(JSON.stringify(largeData, null, 2));
    });

    it('always includes structuredData', () => {
      const data = [1, 2, 3];
      const jsonResult = formatOutput(data, ResponseFormat.JSON, () => '');
      const mdResult = formatOutput(data, ResponseFormat.MARKDOWN, () => 'list');
      expect(jsonResult.structuredData).toEqual(data);
      expect(mdResult.structuredData).toEqual(data);
    });
  });

  describe('createErrorResponse', () => {
    it('returns error with message', () => {
      const result = createErrorResponse('Something went wrong');
      expect(result.text).toBe('❌ Error: Something went wrong');
      expect(result.isError).toBe(true);
    });

    it('includes error emoji prefix', () => {
      const result = createErrorResponse('Test error');
      expect(result.text.startsWith('❌')).toBe(true);
    });

    it('sets isError to true', () => {
      const result = createErrorResponse('Any message');
      expect(result.isError).toBe(true);
    });

    it('handles empty message', () => {
      const result = createErrorResponse('');
      expect(result.text).toBe('❌ Error: ');
      expect(result.isError).toBe(true);
    });
  });
});
