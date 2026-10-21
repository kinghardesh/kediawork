import type { Claim, ClaimType, CreditNote, Supplier } from '../types';
import { daysSince } from './format';

export interface CalcInput {
  type: ClaimType;
  quantity: number;
  invoiceRate: number;
  agreedRate?: number;
  gstPct: number;
  expiryReimbursementPct?: number;
}

export interface CalcLine {
  label: string;
  formula?: string;
  value: number;
}

export interface CalcResult {
  lines: CalcLine[];
  base: number;
  gst: number;
  total: number;
  valid: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Simulated claim calculation. Rules (prototype assumptions):
 *  - Price Difference: (invoice rate − agreed rate) × qty
 *  - Expiry: invoice rate × qty × supplier's reimbursement %
 *  - Damaged / Short Supply: invoice rate × qty
 * GST is added on top of the base claim value.
 */
export function calculateClaim(i: CalcInput): CalcResult {
  const qty = Number(i.quantity) || 0;
  const rate = Number(i.invoiceRate) || 0;
  const lines: CalcLine[] = [];
  let base = 0;

  if (i.type === 'Price Difference') {
    const agreed = Number(i.agreedRate) || 0;
    const diff = rate - agreed;
    lines.push({ label: 'Rate difference per unit', formula: `₹${rate} − ₹${agreed}`, value: round2(diff) });
    base = diff * qty;
    lines.push({ label: 'Base claim value', formula: `₹${round2(diff)} × ${qty} units`, value: round2(base) });
  } else if (i.type === 'Expiry') {
    const pct = i.expiryReimbursementPct ?? 100;
    const stockValue = rate * qty;
    lines.push({ label: 'Expired stock value', formula: `₹${rate} × ${qty} units`, value: round2(stockValue) });
    base = (stockValue * pct) / 100;
    lines.push({ label: `Supplier reimburses ${pct}%`, formula: `${pct}% of stock value`, value: round2(base) });
  } else {
    base = rate * qty;
    lines.push({ label: i.type === 'Damaged' ? 'Damaged stock value' : 'Value of short-supplied units', formula: `₹${rate} × ${qty} units`, value: round2(base) });
  }

  const gst = (base * (Number(i.gstPct) || 0)) / 100;
  lines.push({ label: `GST @ ${i.gstPct || 0}%`, value: round2(gst) });
  const total = round2(base + gst);
  return { lines, base: round2(base), gst: round2(gst), total, valid: qty > 0 && rate > 0 && base > 0 };
}

export function calcForClaim(c: Pick<Claim, 'type' | 'quantity' | 'invoiceRate' | 'agreedRate' | 'gstPct'>, supplier?: Supplier) {
  return calculateClaim({ ...c, expiryReimbursementPct: supplier?.expiryReimbursementPct });
}

/* ---------------- Reconciliation ---------------- */

export type SettlementState = 'none' | 'partial' | 'full';

export interface Balance {
  credited: number;
  outstanding: number;
  state: SettlementState;
  pct: number;
}

export function creditedFor(claimId: string, cns: CreditNote[]) {
  let total = 0;
  for (const cn of cns) for (const a of cn.allocations) if (a.claimId === claimId) total += a.amount;
  return round2(total);
}

export function balanceFor(claim: Claim, cns: CreditNote[]): Balance {
  const credited = creditedFor(claim.id, cns);
  if (claim.status === 'Rejected') return { credited, outstanding: 0, state: credited > 0 ? 'partial' : 'none', pct: claim.amount ? credited / claim.amount : 0 };
  const outstanding = Math.max(0, round2(claim.amount - credited));
  const state: SettlementState = outstanding <= 0.5 ? 'full' : credited > 0 ? 'partial' : 'none';
  return { credited, outstanding, state, pct: claim.amount ? Math.min(1, credited / claim.amount) : 0 };
}

export const allocatedOf = (cn: CreditNote) => round2(cn.allocations.reduce((s, a) => s + a.amount, 0));
export const unallocatedOf = (cn: CreditNote) => round2(cn.amount - allocatedOf(cn));

/* ---------------- Attention rules ---------------- */

export interface AttentionItem {
  claim: Claim;
  severity: 'high' | 'medium';
  title: string;
  detail: string;
}

export function attentionItems(claims: Claim[], suppliers: Supplier[], cns: CreditNote[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const c of claims) {
    const s = suppliers.find((x) => x.id === c.supplierId);
    if (!s) continue;
    if (c.status === 'Not Claimed') {
      const left = s.claimWindowDays - daysSince(c.invoiceDate);
      if (left < 0) items.push({ claim: c, severity: 'high', title: 'Claim window has passed', detail: `${s.name} accepts claims within ${s.claimWindowDays} days of invoice — ${-left} days overdue.` });
      else if (left <= 15) items.push({ claim: c, severity: 'high', title: `Submit within ${left} day${left === 1 ? '' : 's'}`, detail: `${s.name} claim window closes soon.` });
      const needed = s.requiredDocuments.filter((d) => !d.forTypes || d.forTypes.includes(c.type));
      const missing = needed.filter((d) => !c.documents.some((doc) => doc.category === d.category));
      if (missing.length) items.push({ claim: c, severity: 'medium', title: `${missing.length} required document${missing.length > 1 ? 's' : ''} missing`, detail: missing.map((m) => m.category).join(', ') });
    }
    if (c.status === 'Claim Sent' && c.submission) {
      const waited = daysSince(c.submission.date);
      if (waited > s.responseDays) items.push({ claim: c, severity: waited > s.responseDays * 2 ? 'high' : 'medium', title: 'Follow up with supplier', detail: `Sent ${waited} days ago, no acknowledgment (usual: ${s.responseDays} days).` });
    }
    if (c.status === 'Claim Received') {
      const b = balanceFor(c, cns);
      const since = daysSince(c.acknowledgment?.date ?? c.updatedAt);
      if (since > 30 && b.outstanding > 0) items.push({ claim: c, severity: 'medium', title: b.state === 'partial' ? 'Balance credit pending' : 'Awaiting credit note', detail: `Acknowledged ${since} days ago, outstanding balance pending.` });
    }
  }
  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
}

export function requiredDocsFor(s: Supplier | undefined, type: ClaimType) {
  return s ? s.requiredDocuments.filter((d) => !d.forTypes || d.forTypes.includes(type)) : [];
}
