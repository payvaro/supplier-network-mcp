import { describe, it, expect } from 'vitest';
import { runAuditClient } from '../playbooks.js';
import type { Buyer, BuyerLink, Supplier } from '../../types.js';

interface Stub {
  buyers: Buyer[];
  suppliersForBuyer: Record<string, Supplier[]>;
  integrationsForSupplier: Record<string, { id?: string }[]>;
  buyerLinks: BuyerLink[];
}

function makeDeps(stub: Stub) {
  return {
    listBuyers: async () => stub.buyers,
    getSuppliersForBuyer: async (id: string) => stub.suppliersForBuyer[id] ?? [],
    listAcceptorIntegrationsForSupplier: async (id: string) =>
      stub.integrationsForSupplier[id] ?? [],
    listBuyerLinks: async () => stub.buyerLinks,
  };
}

describe('runAuditClient', () => {
  it('returns a clean summary when nothing is broken', async () => {
    const deps = makeDeps({
      buyers: [{ id: 'b1', clientId: 'CLR#abc-123', name: 'Comet' }],
      suppliersForBuyer: { b1: [{ id: 's1' }] },
      integrationsForSupplier: { s1: [{ id: 'ai1' }] },
      buyerLinks: [{ buyerId: 'b1', supplierId: 's1' }],
    });

    const result = await runAuditClient('client-1', deps);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toEqual({
      buyers: 1,
      suppliers: 1,
      missingLinks: 0,
      missingIntegrations: 0,
      malformedExternalIds: 0,
    });
  });

  it('flags malformed buyer external IDs', async () => {
    const deps = makeDeps({
      buyers: [
        { id: 'b1', clientId: '   ', name: 'Whitespace' },
        { id: 'b2', clientId: 'UNKNOWN', name: 'Sentinel' },
        { id: 'b3', clientId: 'CLR#', name: 'Prefix only' },
        { id: 'b4', clientId: 'CLR#real', name: 'OK' },
      ],
      suppliersForBuyer: {},
      integrationsForSupplier: {},
      buyerLinks: [],
    });

    const result = await runAuditClient('c', deps);
    const malformed = result.findings.filter((f) => f.type === 'malformed_external_ids');
    expect(malformed).toHaveLength(3);
    expect(malformed.every((f) => f.playbook === 'fix-buyer-external-ids')).toBe(true);
    expect(result.summary.malformedExternalIds).toBe(3);
  });

  it('flags suppliers missing acceptor integrations', async () => {
    const deps = makeDeps({
      buyers: [{ id: 'b1', clientId: 'CLR#abc' }],
      suppliersForBuyer: { b1: [{ id: 's1' }, { id: 's2' }] },
      integrationsForSupplier: { s1: [{ id: 'ai1' }] },
      buyerLinks: [],
    });

    const result = await runAuditClient('c', deps);
    const missing = result.findings.filter((f) => f.type === 'missing_acceptor_integration');
    expect(missing).toHaveLength(1);
    expect(missing[0].supplierId).toBe('s2');
    expect(missing[0].playbook).toBe('fix-acceptor-integration');
  });

  it('flags structurally dangling buyer links only', async () => {
    // A BuyerLink can legitimately reference a supplier the buyer hasn't
    // transacted with yet, so the audit only flags links missing one side
    // entirely — never "this supplier isn't in the transactional walk".
    const deps = makeDeps({
      buyers: [{ id: 'b1', clientId: 'CLR#abc' }],
      suppliersForBuyer: { b1: [{ id: 's1' }] },
      integrationsForSupplier: { s1: [{ id: 'ai1' }] },
      buyerLinks: [
        { buyerId: 'b1', supplierId: 's1' }, // OK
        { buyerId: 'b1' }, // dangling — no supplierId
        { supplierId: 's2' }, // dangling — no buyerId
        { buyerId: 'b1', supplierId: 's-not-in-walk' }, // legit, must NOT flag
      ],
    });

    const result = await runAuditClient('c', deps);
    const links = result.findings.filter((f) => f.type === 'missing_buyer_link');
    expect(links).toHaveLength(2);
    expect(result.summary.missingLinks).toBe(2);
  });

  it('deduplicates suppliers across buyers when checking integrations', async () => {
    // Both buyers reference the same supplier; we should only flag it once.
    const deps = makeDeps({
      buyers: [
        { id: 'b1', clientId: 'CLR#a' },
        { id: 'b2', clientId: 'CLR#b' },
      ],
      suppliersForBuyer: { b1: [{ id: 's1' }], b2: [{ id: 's1' }] },
      integrationsForSupplier: {},
      buyerLinks: [],
    });

    const result = await runAuditClient('c', deps);
    expect(
      result.findings.filter((f) => f.type === 'missing_acceptor_integration'),
    ).toHaveLength(1);
    expect(result.summary.suppliers).toBe(1);
  });
});
