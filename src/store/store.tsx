import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Allocation, Claim, ClaimDocument, ClaimStatus, CreditNote, HistoryEntry, SubmissionMethod, Supplier } from '../types';
import { SUPPLIERS } from '../data/suppliers';
import { buildSeed, CURRENT_USER } from '../data/mock';
import { creditedFor } from '../lib/calc';
import { uid } from '../lib/format';

const STORAGE_KEY = 'kedia-claims-demo-v1';

interface Data {
  claims: Claim[];
  creditNotes: CreditNote[];
}

export type NewClaimInput = Omit<Claim, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'history'>;

export interface StatusMeta {
  date?: string;
  method?: SubmissionMethod;
  reference?: string;
  reason?: string;
}

interface Store extends Data {
  suppliers: Supplier[];
  supplier: (id: string) => Supplier | undefined;
  claim: (id: string) => Claim | undefined;
  addClaim: (input: NewClaimInput) => string;
  updateClaim: (id: string, patch: Partial<Claim>, changeSummary: string) => void;
  setStatus: (id: string, status: ClaimStatus, meta?: StatusMeta) => void;
  addDocuments: (id: string, docs: ClaimDocument[]) => void;
  removeDocument: (id: string, docId: string) => void;
  addNote: (id: string, text: string) => void;
  logEvent: (id: string, action: string, detail?: string) => void;
  recordCreditNote: (cn: Omit<CreditNote, 'id' | 'createdAt'>) => void;
  allocateCreditNote: (cnId: string, allocations: Allocation[]) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

function load(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Data;
      if (Array.isArray(parsed.claims) && Array.isArray(parsed.creditNotes)) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt — fall back to seed data */
  }
  return buildSeed();
}

const entry = (action: string, detail?: string, user = CURRENT_USER): HistoryEntry => ({ id: uid('h'), at: new Date().toISOString(), user, action, detail });
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** After credit notes change, move affected claims forward: any credit ⇒ at least "Claim Received"; full credit ⇒ "Settled". */
function applySettlement(claims: Claim[], cns: CreditNote[], affected: Map<string, string[]>): Claim[] {
  return claims.map((c) => {
    const notes = affected.get(c.id);
    if (!notes) return c;
    const credited = creditedFor(c.id, cns);
    const history = [...c.history, ...notes.map((n) => entry(n.split('|')[0], n.split('|')[1]))];
    let status = c.status;
    if (c.status !== 'Rejected') {
      if (credited >= c.amount - 0.5 && c.status !== 'Settled') {
        history.push(entry(`Status changed: ${c.status} → Settled`, 'Fully credited — outstanding balance is ₹0', 'System'));
        status = 'Settled';
      } else if (credited < c.amount - 0.5 && (c.status === 'Not Claimed' || c.status === 'Claim Sent')) {
        history.push(entry(`Status changed: ${c.status} → Claim Received`, 'Partial credit received from supplier', 'System'));
        status = 'Claim Received';
      }
    }
    return { ...c, status, history, updatedAt: new Date().toISOString() };
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [data]);

  const mutateClaim = useCallback((id: string, fn: (c: Claim) => Claim) => {
    setData((d) => ({ ...d, claims: d.claims.map((c) => (c.id === id ? { ...fn(c), updatedAt: new Date().toISOString() } : c)) }));
  }, []);

  const store = useMemo<Store>(() => ({
    ...data,
    suppliers: SUPPLIERS,
    supplier: (id) => SUPPLIERS.find((s) => s.id === id),
    claim: (id) => data.claims.find((c) => c.id === id),

    addClaim: (input) => {
      const year = new Date().getFullYear();
      const maxSeq = data.claims.reduce((m, c) => Math.max(m, Number(c.id.split('-').pop()) || 0), 0);
      const id = `CLM-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();
      const history = [entry('Claim created', `${input.type} claim for ${input.productName}, value ${rupees(input.amount)}`)];
      if (input.documents.length) history.push(entry('Documents uploaded', input.documents.map((d) => d.name).join(', ')));
      const claim: Claim = { ...input, id, status: 'Not Claimed', createdAt: now, updatedAt: now, history };
      setData((d) => ({ ...d, claims: [claim, ...d.claims] }));
      return id;
    },

    updateClaim: (id, patch, changeSummary) => mutateClaim(id, (c) => ({ ...c, ...patch, history: [...c.history, entry('Claim edited', changeSummary)] })),

    setStatus: (id, status, meta = {}) =>
      mutateClaim(id, (c) => {
        const next: Claim = { ...c, status };
        const bits: string[] = [];
        if (status === 'Claim Sent') {
          next.submission = { date: meta.date ?? new Date().toISOString().slice(0, 10), method: meta.method ?? c.submission?.method ?? 'Email', reference: meta.reference };
          bits.push(`Submitted via ${next.submission.method}`);
          if (meta.reference) bits.push(`Ref ${meta.reference}`);
        }
        if (status === 'Claim Received') {
          next.acknowledgment = { date: meta.date ?? new Date().toISOString().slice(0, 10), reference: meta.reference };
          bits.push('Supplier acknowledged the claim');
          if (meta.reference) bits.push(`Ref ${meta.reference}`);
        }
        if (status === 'Rejected') next.rejectionReason = meta.reason;
        if (status === 'Not Claimed') {
          next.submission = undefined;
          next.acknowledgment = undefined;
          next.rejectionReason = undefined;
        }
        if (meta.reason) bits.push(meta.reason);
        return { ...next, history: [...c.history, entry(`Status changed: ${c.status} → ${status}`, bits.join(' · ') || undefined)] };
      }),

    addDocuments: (id, docs) => mutateClaim(id, (c) => ({ ...c, documents: [...c.documents, ...docs], history: [...c.history, entry('Documents uploaded', docs.map((d) => `${d.name} (${d.category})`).join(', '))] })),

    removeDocument: (id, docId) =>
      mutateClaim(id, (c) => {
        const doc = c.documents.find((d) => d.id === docId);
        return { ...c, documents: c.documents.filter((d) => d.id !== docId), history: [...c.history, entry('Document removed', doc?.name)] };
      }),

    addNote: (id, text) => mutateClaim(id, (c) => ({ ...c, notes: c.notes ? `${c.notes}\n${text}` : text, history: [...c.history, entry('Note added', text)] })),

    logEvent: (id, action, detail) => mutateClaim(id, (c) => ({ ...c, history: [...c.history, entry(action, detail)] })),

    recordCreditNote: (input) =>
      setData((d) => {
        const cn: CreditNote = { ...input, id: uid('cn-'), createdAt: new Date().toISOString() };
        const creditNotes = [cn, ...d.creditNotes];
        const affected = new Map<string, string[]>();
        for (const a of cn.allocations) affected.set(a.claimId, [`Credit note ${cn.cnNumber} applied|${rupees(a.amount)} credited`]);
        return { creditNotes, claims: applySettlement(d.claims, creditNotes, affected) };
      }),

    allocateCreditNote: (cnId, allocations) =>
      setData((d) => {
        const creditNotes = d.creditNotes.map((cn) => {
          if (cn.id !== cnId) return cn;
          const merged = cn.allocations.map((m) => ({ ...m }));
          for (const a of allocations) {
            const existing = merged.find((m) => m.claimId === a.claimId);
            if (existing) existing.amount = Math.round((existing.amount + a.amount) * 100) / 100;
            else merged.push({ ...a });
          }
          return { ...cn, allocations: merged };
        });
        const cn = creditNotes.find((c) => c.id === cnId)!;
        const affected = new Map<string, string[]>();
        for (const a of allocations) affected.set(a.claimId, [`Credit note ${cn.cnNumber} applied|${rupees(a.amount)} credited (allocated from unmatched balance)`]);
        return { creditNotes, claims: applySettlement(d.claims, creditNotes, affected) };
      }),

    resetDemo: () => setData(buildSeed()),
  }), [data, mutateClaim]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
