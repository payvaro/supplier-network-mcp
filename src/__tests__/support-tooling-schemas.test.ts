import { describe, it, expect } from 'vitest';
import {
  AcceptorsToolSchema,
  AcceptorIntegrationsToolSchema,
  BuyersToolSchema,
  PlaybooksToolSchema,
  SuppliersToolSchema,
} from '../schemas/index.js';

describe('support tooling schemas', () => {
  describe('AcceptorsToolSchema', () => {
    it('accepts list with no extra args', () => {
      expect(AcceptorsToolSchema.safeParse({ action: 'list' }).success).toBe(true);
    });
    it('rejects get without id', () => {
      const r = AcceptorsToolSchema.safeParse({ action: 'get' });
      expect(r.success).toBe(false);
    });
    it('rejects for_supplier without supplierId', () => {
      const r = AcceptorsToolSchema.safeParse({ action: 'for_supplier' });
      expect(r.success).toBe(false);
    });
  });

  describe('AcceptorIntegrationsToolSchema', () => {
    it('requires supplierId for every action', () => {
      expect(AcceptorIntegrationsToolSchema.safeParse({ action: 'list' }).success).toBe(false);
    });
    it('requires acceptorId + providerId on create', () => {
      const r = AcceptorIntegrationsToolSchema.safeParse({
        action: 'create',
        supplierId: 's1',
      });
      expect(r.success).toBe(false);
    });
    it('accepts a valid create payload', () => {
      const r = AcceptorIntegrationsToolSchema.safeParse({
        action: 'create',
        supplierId: 's1',
        acceptorId: 'ACC#1',
        providerId: 'p',
        rail: 'CARD',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('BuyersToolSchema.update_external_refs', () => {
    it('rejects payload missing externalRefs', () => {
      const r = BuyersToolSchema.safeParse({ action: 'update_external_refs', id: 'b1' });
      expect(r.success).toBe(false);
    });
    it('rejects empty externalRefs', () => {
      const r = BuyersToolSchema.safeParse({
        action: 'update_external_refs',
        id: 'b1',
        externalRefs: {},
      });
      expect(r.success).toBe(false);
    });
    it('accepts a clientId-only patch', () => {
      const r = BuyersToolSchema.safeParse({
        action: 'update_external_refs',
        id: 'b1',
        externalRefs: { clientId: 'CLR#new' },
      });
      expect(r.success).toBe(true);
    });
  });

  describe('SuppliersToolSchema.update_external_refs', () => {
    it('accepts an externalRef-only patch', () => {
      const r = SuppliersToolSchema.safeParse({
        action: 'update_external_refs',
        id: 's1',
        externalRefs: { externalRef: 'NSR#abc' },
      });
      expect(r.success).toBe(true);
    });
    it('rejects empty externalRefs', () => {
      const r = SuppliersToolSchema.safeParse({
        action: 'update_external_refs',
        id: 's1',
        externalRefs: {},
      });
      expect(r.success).toBe(false);
    });
  });

  describe('PlaybooksToolSchema', () => {
    it('audit_client requires no params', () => {
      expect(PlaybooksToolSchema.safeParse({ action: 'audit_client' }).success).toBe(true);
    });
    it('diagnose_buyer_link requires both ids', () => {
      expect(
        PlaybooksToolSchema.safeParse({ action: 'diagnose_buyer_link', buyerId: 'b' }).success,
      ).toBe(false);
    });
    it('diagnose_acceptor_integration accepts supplierId alone', () => {
      expect(
        PlaybooksToolSchema.safeParse({
          action: 'diagnose_acceptor_integration',
          supplierId: 's',
        }).success,
      ).toBe(true);
    });
  });
});
