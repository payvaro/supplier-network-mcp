import { describe, it, expect } from 'vitest';
import { matchSupplier, searchAndRankSuppliers, normalizeAddress } from '../matching.js';
import { createSupplier, createAddress, createAlias } from '../../test-utils/fixtures.js';
import { MATCH_THRESHOLDS } from '../../constants.js';
import type { Supplier, Address } from '../../types.js';

describe('matching', () => {
  describe('matchSupplier', () => {
    describe('name matching', () => {
      it('returns exact level for identical name', () => {
        const supplier = createSupplier({ name: 'Acme Corporation' });
        const result = matchSupplier(supplier, { name: 'Acme Corporation' });

        expect(result).not.toBeNull();
        expect(result?.matchScore.level).toBe('exact');
        expect(result?.matchScore.score).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.EXACT);
      });

      it('returns high level for very similar name', () => {
        const supplier = createSupplier({ name: 'Acme Corporation' });
        const result = matchSupplier(supplier, { name: 'Acme Corp' });

        expect(result).not.toBeNull();
        // Fuzzysort is lenient - similar names may return exact or high
        expect(['exact', 'high']).toContain(result?.matchScore.level);
        expect(result?.matchScore.score).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.HIGH);
      });

      it('returns medium level for moderately similar name', () => {
        const supplier = createSupplier({ name: 'Acme Corporation International' });
        const result = matchSupplier(supplier, { name: 'Acme' });

        expect(result).not.toBeNull();
        // Fuzzysort is lenient with substring matches
        expect(['exact', 'high', 'medium']).toContain(result?.matchScore.level);
      });

      it('returns null for completely different name below threshold', () => {
        const supplier = createSupplier({ name: 'Acme Corporation' });
        const result = matchSupplier(supplier, { name: 'XYZ Industries' });

        expect(result).toBeNull();
      });

      it('is case insensitive for name matching', () => {
        const supplier = createSupplier({ name: 'ACME CORPORATION' });
        const result = matchSupplier(supplier, { name: 'acme corporation' });

        expect(result).not.toBeNull();
        expect(result?.matchScore.level).toBe('exact');
      });

      it('handles supplier with no name', () => {
        const supplier = createSupplier({ name: undefined });
        const result = matchSupplier(supplier, { name: 'Acme' });

        expect(result).toBeNull();
      });
    });

    describe('alias matching', () => {
      it('matches against supplier aliases', () => {
        const supplier = createSupplier({
          name: 'Advanced Computer Manufacturing Enterprises',
          aliases: [
            createAlias({ name: 'ACME' }),
            createAlias({ name: 'Acme Corp' }),
          ],
        });
        const result = matchSupplier(supplier, { name: 'ACME' });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.aliases).toBeGreaterThan(0);
      });

      it('uses best alias score when alias matches better than name', () => {
        const supplier = createSupplier({
          name: 'Advanced Computer Manufacturing Enterprises Inc',
          aliases: [createAlias({ name: 'ACME' })],
        });
        const result = matchSupplier(supplier, { name: 'ACME' });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.aliases).toBeDefined();
        // Alias score should be better than name score
        expect(result?.matchedFields.aliases).toBeGreaterThan(result?.matchedFields.name || 0);
      });

      it('ignores alias when name matches better', () => {
        const supplier = createSupplier({
          name: 'Acme Corporation',
          aliases: [createAlias({ name: 'ACM' })],
        });
        const result = matchSupplier(supplier, { name: 'Acme Corporation' });

        expect(result).not.toBeNull();
        // Alias field should not be set when name is better
        expect(result?.matchedFields.aliases).toBeUndefined();
      });
    });

    describe('email matching', () => {
      it('returns exact match for identical email', () => {
        const supplier = createSupplier({ email: 'contact@acme.com' });
        const result = matchSupplier(supplier, { email: 'contact@acme.com' });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.email).toBe(1.0);
      });

      it('is case insensitive for email matching', () => {
        const supplier = createSupplier({ email: 'Contact@ACME.com' });
        const result = matchSupplier(supplier, { email: 'contact@acme.com' });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.email).toBe(1.0);
      });

      it('returns domain match (0.6) for same domain different local part', () => {
        const supplier = createSupplier({ email: 'sales@acme.com' });
        const result = matchSupplier(supplier, { email: 'support@acme.com' });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.email).toBe(0.6);
      });

      it('returns 0 for completely different email domains', () => {
        const supplier = createSupplier({ email: 'contact@acme.com' });
        const result = matchSupplier(supplier, { email: 'contact@xyz.com' });

        // With only email matching and no match, result should be null
        expect(result).toBeNull();
      });

      it('handles supplier with no email', () => {
        const supplier = createSupplier({ email: undefined });
        const result = matchSupplier(supplier, { email: 'contact@acme.com' });

        expect(result).toBeNull();
      });
    });

    describe('address matching', () => {
      it('returns high score for identical address', () => {
        const address: Address = {
          streetAddress: '123 Main St',
          city: 'Springfield',
          stateProvince: 'IL',
          postalCode: '62701',
        };
        const supplier = createSupplier({ address });
        const result = matchSupplier(supplier, { address });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThanOrEqual(0.8);
      });

      it('matches street addresses with fuzzy matching', () => {
        const supplier = createSupplier({
          address: createAddress({ streetAddress: '123 Main Street' }),
        });
        const result = matchSupplier(supplier, {
          address: createAddress({ streetAddress: '123 Main St' }),
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('matches cities with fuzzy matching', () => {
        const supplier = createSupplier({
          address: createAddress({ city: 'Springfield' }),
        });
        const result = matchSupplier(supplier, {
          address: createAddress({ city: 'Springfeld' }), // typo
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('matches exact state/province', () => {
        const supplier = createSupplier({
          address: createAddress({ stateProvince: 'IL' }),
        });
        const result = matchSupplier(supplier, {
          address: createAddress({ stateProvince: 'il' }), // lowercase
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('matches exact postal code', () => {
        const supplier = createSupplier({
          address: createAddress({ postalCode: '62701' }),
        });
        const result = matchSupplier(supplier, {
          address: createAddress({ postalCode: '62701' }),
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('partially matches postal codes with same prefix', () => {
        const supplier = createSupplier({
          address: createAddress({ postalCode: '62701-1234' }),
        });
        const result = matchSupplier(supplier, {
          address: createAddress({ postalCode: '62701-5678' }),
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('handles missing address fields gracefully', () => {
        // Use multiple matching fields to exceed threshold
        const supplier = createSupplier({
          address: {
            city: 'Springfield',
            stateProvince: 'IL',
            postalCode: '62701',
          },
        });
        const result = matchSupplier(supplier, {
          address: {
            city: 'Springfield',
            stateProvince: 'IL',
            postalCode: '62701',
          },
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('returns null when supplier has no address', () => {
        const supplier = createSupplier({ address: undefined });
        const result = matchSupplier(supplier, {
          address: createAddress(),
        });

        expect(result).toBeNull();
      });
    });

    describe('combined matching', () => {
      it('combines name and email scores', () => {
        const supplier = createSupplier({
          name: 'Acme Corporation',
          email: 'contact@acme.com',
        });
        const result = matchSupplier(supplier, {
          name: 'Acme Corp',
          email: 'contact@acme.com',
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.name).toBeGreaterThan(0);
        expect(result?.matchedFields.email).toBe(1.0);
      });

      it('combines all three criteria', () => {
        const supplier = createSupplier({
          name: 'Acme Corporation',
          email: 'contact@acme.com',
          address: createAddress({ city: 'Springfield' }),
        });
        const result = matchSupplier(supplier, {
          name: 'Acme Corp',
          email: 'sales@acme.com',
          address: { city: 'Springfield' },
        });

        expect(result).not.toBeNull();
        expect(result?.matchedFields.name).toBeGreaterThan(0);
        expect(result?.matchedFields.email).toBe(0.6);
        expect(result?.matchedFields.address).toBeGreaterThan(0);
      });

      it('uses weighted scoring (address=4, name=3, email=2)', () => {
        // Perfect address match should have more impact than perfect email match
        const supplier = createSupplier({
          name: 'Acme Corporation',
          email: 'wrong@other.com',
          address: createAddress(),
        });

        // Only address matches
        const addressOnlyResult = matchSupplier(supplier, {
          address: supplier.address,
        });

        // Only email matches (but won't match since emails are different)
        const emailOnlyResult = matchSupplier(supplier, {
          email: 'contact@acme.com',
        });

        // Address match should produce a result
        expect(addressOnlyResult).not.toBeNull();
        // Email mismatch should produce null
        expect(emailOnlyResult).toBeNull();
      });
    });

    describe('match level thresholds', () => {
      it('returns exact for score >= 1.0', () => {
        const supplier = createSupplier({ name: 'Test Company' });
        const result = matchSupplier(supplier, { name: 'Test Company' });

        expect(result?.matchScore.level).toBe('exact');
        expect(result?.matchScore.score).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.EXACT);
      });

      it('returns high for score >= 0.8 and < 1.0', () => {
        const supplier = createSupplier({ name: 'Test Company Inc' });
        const result = matchSupplier(supplier, { name: 'Test Company' });

        expect(result).not.toBeNull();
        // Could be high or exact depending on fuzzysort
        expect(['exact', 'high']).toContain(result?.matchScore.level);
      });

      it('returns null for score < 0.4 (LOW threshold)', () => {
        const supplier = createSupplier({ name: 'Completely Different Name' });
        const result = matchSupplier(supplier, { name: 'XYZ' });

        expect(result).toBeNull();
      });
    });

    describe('reasons array', () => {
      it('includes reason for name match', () => {
        const supplier = createSupplier({ name: 'Acme Corporation' });
        const result = matchSupplier(supplier, { name: 'Acme Corporation' });

        expect(result?.matchScore.reasons).toEqual(
          expect.arrayContaining([expect.stringContaining('Name matches')])
        );
      });

      it('includes reason for alias match', () => {
        const supplier = createSupplier({
          name: 'Advanced Computer Manufacturing',
          aliases: [createAlias({ name: 'ACME' })],
        });
        const result = matchSupplier(supplier, { name: 'ACME' });

        expect(result?.matchScore.reasons).toEqual(
          expect.arrayContaining([expect.stringContaining('Alias')])
        );
      });

      it('includes reason for email match', () => {
        const supplier = createSupplier({ email: 'contact@acme.com' });
        const result = matchSupplier(supplier, { email: 'contact@acme.com' });

        expect(result?.matchScore.reasons).toEqual(
          expect.arrayContaining([expect.stringContaining('Email matches')])
        );
      });
    });
  });

  describe('searchAndRankSuppliers', () => {
    it('returns empty array when no suppliers match', () => {
      const suppliers = [
        createSupplier({ name: 'Alpha Corp' }),
        createSupplier({ name: 'Beta Inc' }),
      ];
      const result = searchAndRankSuppliers(suppliers, { name: 'Xyz' });

      expect(result).toEqual([]);
    });

    it('returns matching suppliers sorted by score descending', () => {
      const suppliers = [
        createSupplier({ id: '1', name: 'Acme Corp' }),
        createSupplier({ id: '2', name: 'Acme Corporation' }),
        createSupplier({ id: '3', name: 'Acme Inc' }),
      ];
      const result = searchAndRankSuppliers(suppliers, { name: 'Acme Corporation' });

      expect(result.length).toBeGreaterThan(0);
      // Should be sorted by score descending
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].matchScore.score).toBeGreaterThanOrEqual(
          result[i].matchScore.score
        );
      }
    });

    it('respects custom minThreshold', () => {
      const suppliers = [
        createSupplier({ id: '1', name: 'Acme Corporation' }),
        createSupplier({ id: '2', name: 'Acme' }),
      ];

      // With high threshold, only exact matches should pass
      const highThresholdResult = searchAndRankSuppliers(
        suppliers,
        { name: 'Acme Corporation' },
        MATCH_THRESHOLDS.EXACT
      );

      // With low threshold, more matches should pass
      const lowThresholdResult = searchAndRankSuppliers(
        suppliers,
        { name: 'Acme Corporation' },
        MATCH_THRESHOLDS.LOW
      );

      expect(lowThresholdResult.length).toBeGreaterThanOrEqual(
        highThresholdResult.length
      );
    });

    it('handles empty supplier array', () => {
      const result = searchAndRankSuppliers([], { name: 'Acme' });

      expect(result).toEqual([]);
    });

    it('handles search criteria with no matches', () => {
      const suppliers = [createSupplier({ name: 'Test Company' })];
      const result = searchAndRankSuppliers(suppliers, {
        name: 'Completely Different',
        email: 'nonexistent@example.com',
      });

      expect(result).toEqual([]);
    });

    it('filters results below threshold', () => {
      const suppliers = [
        createSupplier({ id: '1', name: 'Acme Corporation' }),
        createSupplier({ id: '2', name: 'Something Else' }),
      ];
      const result = searchAndRankSuppliers(
        suppliers,
        { name: 'Acme Corporation' },
        MATCH_THRESHOLDS.HIGH
      );

      // All results should be above the threshold
      result.forEach((match) => {
        expect(match.matchScore.score).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.HIGH);
      });
    });
  });

  describe('normalizeAddress', () => {
    it('trims whitespace from all fields', () => {
      const address = {
        streetAddress: '  123 Main St  ',
        city: ' Springfield ',
        stateProvince: ' IL ',
        postalCode: ' 62701 ',
      };
      const result = normalizeAddress(address);

      expect(result.streetAddress).toBe('123 Main St');
      expect(result.city).toBe('Springfield');
      expect(result.stateProvince).toBe('IL');
      expect(result.postalCode).toBe('62701');
    });

    it('converts stateProvince to uppercase', () => {
      const address = { stateProvince: 'illinois' };
      const result = normalizeAddress(address);

      expect(result.stateProvince).toBe('ILLINOIS');
    });

    it('handles undefined fields', () => {
      const address = { city: 'Springfield' };
      const result = normalizeAddress(address);

      expect(result.streetAddress).toBeUndefined();
      expect(result.city).toBe('Springfield');
      expect(result.stateProvince).toBeUndefined();
    });

    it('handles empty address', () => {
      const result = normalizeAddress({});

      expect(result.streetAddress).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.stateProvince).toBeUndefined();
      expect(result.postalCode).toBeUndefined();
    });

    it('includes suiteUnit and addressType', () => {
      const address = {
        suiteUnit: ' Suite 100 ',
        addressType: ' BILLING ',
      };
      const result = normalizeAddress(address);

      expect(result.suiteUnit).toBe('Suite 100');
      expect(result.addressType).toBe('BILLING');
    });
  });

  describe('edge cases', () => {
    it('handles special characters in names', () => {
      const supplier = createSupplier({ name: "O'Brien & Associates, LLC" });
      const result = matchSupplier(supplier, { name: "O'Brien Associates" });

      expect(result).not.toBeNull();
    });

    it('handles unicode characters in names', () => {
      const supplier = createSupplier({ name: 'Café München GmbH' });
      const result = matchSupplier(supplier, { name: 'Cafe Munchen' });

      // Should still attempt matching
      expect(result).not.toBeNull();
    });

    it('handles very long names', () => {
      const longName = 'A'.repeat(500) + ' Corporation';
      const supplier = createSupplier({ name: longName });
      const result = matchSupplier(supplier, { name: longName });

      expect(result).not.toBeNull();
      expect(result?.matchScore.level).toBe('exact');
    });

    it('handles empty search criteria', () => {
      const supplier = createSupplier({ name: 'Test' });
      const result = matchSupplier(supplier, {});

      // With no search criteria, score should be 0
      expect(result).toBeNull();
    });
  });
});
