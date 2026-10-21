import type { Claim, ClaimDocument, ClaimStatus, ClaimType, CreditNote, DocCategory, HistoryEntry, SubmissionMethod } from '../types';
import { calcForClaim } from '../lib/calc';
import { SUPPLIERS } from './suppliers';

export const CURRENT_USER = 'Priya Sharma';
const TEAM = ['Priya Sharma', 'Amit Kedia', 'Rahul Das'];

// Dates are generated relative to "today" so the demo always looks current.
const daysAgo = (n: number, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  return d.toISOString();
};
const dateOnly = (n: number) => daysAgo(n).slice(0, 10);
const futureDate = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months, 28);
  return d.toISOString().slice(0, 10);
};

const DOC_FILES: Record<DocCategory, (inv: string) => string> = {
  'Invoice copy': (inv) => `Invoice_${inv.replace(/\W+/g, '-')}.pdf`,
  'Price agreement / scheme letter': () => 'Scheme_Circular_Q3.pdf',
  'Expiry stock list': (inv) => `Expiry_List_${inv.replace(/\W+/g, '-')}.xlsx`,
  'Debit note': (inv) => `DebitNote_${inv.replace(/\W+/g, '-')}.pdf`,
  'Return challan': () => 'Return_Challan.pdf',
  'Photos of damaged stock': () => 'Damaged_cartons.jpg',
  'Goods received note': () => 'GRN_scan.pdf',
  Other: () => 'Supporting_note.pdf',
};

type Spec = {
  sup: string; type: ClaimType; inv: string; invAgo: number; product: string; batch: string;
  qty: number; rate: number; agreed?: number; gst: number; status: ClaimStatus;
  created: number; sent?: number; ack?: number; ref?: string; docs: DocCategory[]; notes?: string; reject?: string;
};

const SPECS: Spec[] = [
  { sup: 'sup-medivance', type: 'Price Difference', inv: 'MDV/26/04512', invAgo: 118, product: 'Paravin 650 Tablet 15s', batch: 'PV24J11', qty: 2400, rate: 21.4, agreed: 18.9, gst: 12, status: 'Settled', created: 112, sent: 110, ack: 104, docs: ['Invoice copy', 'Debit note', 'Price agreement / scheme letter'] },
  { sup: 'sup-medivance', type: 'Expiry', inv: 'MDV/26/03977', invAgo: 140, product: 'Cough-Ease Syrup 100ml', batch: 'CE23K07', qty: 180, rate: 74.5, gst: 12, status: 'Settled', created: 100, sent: 98, ack: 90, docs: ['Invoice copy', 'Debit note', 'Expiry stock list'] },
  { sup: 'sup-sunrise', type: 'Price Difference', inv: 'SRL/26-27/01234', invAgo: 95, product: 'Glucofix SR 500 Tab 20s', batch: 'GF25A03', qty: 1500, rate: 46.2, agreed: 41.0, gst: 12, status: 'Claim Received', created: 88, sent: 86, ack: 70, ref: 'SRC-448120', docs: ['Invoice copy', 'Price agreement / scheme letter'] },
  { sup: 'sup-sunrise', type: 'Expiry', inv: 'SRL/26-27/00988', invAgo: 150, product: 'Atorvin 10 Tab 15s', batch: 'AT24C19', qty: 420, rate: 58.0, gst: 12, status: 'Settled', created: 80, sent: 79, ack: 66, ref: 'SRC-447301', docs: ['Invoice copy', 'Expiry stock list', 'Return challan'] },
  { sup: 'sup-aarogya', type: 'Expiry', inv: 'AHL-INV-77821', invAgo: 85, product: 'Amoxilan 500 Capsule 10s', batch: 'AX24F02', qty: 960, rate: 62.75, gst: 12, status: 'Claim Received', created: 70, sent: 66, ack: 49, ref: 'Docket BD-90213344', docs: ['Invoice copy', 'Debit note', 'Expiry stock list', 'Return challan'] },
  { sup: 'sup-aarogya', type: 'Damaged', inv: 'AHL-INV-78002', invAgo: 60, product: 'Insucare 30/70 Pen 3ml', batch: 'IC25B14', qty: 25, rate: 412.0, gst: 5, status: 'Claim Sent', created: 45, sent: 40, ref: 'Docket BD-90377120', docs: ['Invoice copy', 'Debit note', 'Return challan', 'Photos of damaged stock'] },
  { sup: 'sup-novacure', type: 'Price Difference', inv: 'NCL/KOL/5521', invAgo: 70, product: 'Telmipro 40 Tab 15s', batch: 'TP25D22', qty: 3000, rate: 38.5, agreed: 34.0, gst: 12, status: 'Settled', created: 62, sent: 61, ack: 57, docs: ['Invoice copy', 'Price agreement / scheme letter'] },
  { sup: 'sup-novacure', type: 'Short Supply', inv: 'NCL/KOL/5689', invAgo: 38, product: 'Pantorix 40 Tab 15s', batch: 'PR25E09', qty: 120, rate: 52.0, gst: 12, status: 'Claim Sent', created: 34, sent: 31, docs: ['Invoice copy', 'Goods received note'], notes: '2 shippers short against invoice; transporter confirmed seal intact.' },
  { sup: 'sup-himgiri', type: 'Expiry', inv: 'HG/2026/1187', invAgo: 110, product: 'Cetrizol 10 Tab 10s', batch: 'CZ24H30', qty: 1250, rate: 11.8, gst: 12, status: 'Claim Received', created: 76, sent: 73, ack: 60, docs: ['Invoice copy', 'Debit note', 'Expiry stock list'] },
  { sup: 'sup-himgiri', type: 'Damaged', inv: 'HG/2026/1302', invAgo: 55, product: 'Ondaset 4 MD Tab 10s', batch: 'OD25A28', qty: 300, rate: 27.4, gst: 12, status: 'Claim Received', created: 50, sent: 48, ack: 41, docs: ['Invoice copy', 'Debit note', 'Photos of damaged stock'] },
  { sup: 'sup-zenith', type: 'Price Difference', inv: 'ZB-INV-220419', invAgo: 48, product: 'Rabicure DSR Cap 15s', batch: 'RB25C11', qty: 1800, rate: 96.0, agreed: 88.5, gst: 12, status: 'Claim Sent', created: 30, sent: 26, ref: 'ZCL-310577', docs: ['Invoice copy', 'Price agreement / scheme letter'] },
  { sup: 'sup-zenith', type: 'Damaged', inv: 'ZB-INV-220877', invAgo: 20, product: 'Vitaboost D3 60K Cap 4s', batch: 'VB25F01', qty: 140, rate: 88.0, gst: 5, status: 'Not Claimed', created: 9, docs: ['Invoice copy'], notes: 'Two cartons crushed in transit. Photos still to be taken by warehouse.' },
  { sup: 'sup-medivance', type: 'Price Difference', inv: 'MDV/26/05230', invAgo: 49, product: 'Montekast LC Tab 10s', batch: 'MK25D16', qty: 2000, rate: 64.0, agreed: 59.5, gst: 12, status: 'Not Claimed', created: 12, docs: ['Invoice copy', 'Price agreement / scheme letter'] },
  { sup: 'sup-medivance', type: 'Short Supply', inv: 'MDV/26/05411', invAgo: 16, product: 'Azivex 500 Tab 3s', batch: 'AZ25G04', qty: 200, rate: 61.2, gst: 12, status: 'Not Claimed', created: 3, docs: ['Invoice copy', 'Debit note', 'Goods received note'] },
  { sup: 'sup-sunrise', type: 'Price Difference', inv: 'SRL/26-27/01577', invAgo: 32, product: 'Glucofix SR 500 Tab 20s', batch: 'GF25B12', qty: 1200, rate: 46.2, agreed: 41.0, gst: 12, status: 'Not Claimed', created: 6, docs: ['Invoice copy'] },
  { sup: 'sup-novacure', type: 'Price Difference', inv: 'NCL/KOL/5802', invAgo: 36, product: 'Telmipro 40 Tab 15s', batch: 'TP25F03', qty: 2500, rate: 38.5, agreed: 34.0, gst: 12, status: 'Not Claimed', created: 4, docs: ['Invoice copy', 'Price agreement / scheme letter'] },
  { sup: 'sup-aarogya', type: 'Expiry', inv: 'AHL-INV-78344', invAgo: 28, product: 'Amoxilan 500 Capsule 10s', batch: 'AX24H21', qty: 380, rate: 62.75, gst: 12, status: 'Not Claimed', created: 2, docs: ['Invoice copy', 'Expiry stock list'] },
  { sup: 'sup-himgiri', type: 'Short Supply', inv: 'HG/2026/1355', invAgo: 26, product: 'Cetrizol 10 Tab 10s', batch: 'CZ25B02', qty: 500, rate: 11.8, gst: 12, status: 'Claim Sent', created: 20, sent: 6, docs: ['Invoice copy', 'Debit note'] },
  { sup: 'sup-zenith', type: 'Expiry', inv: 'ZB-INV-219004', invAgo: 130, product: 'Rabicure DSR Cap 15s', batch: 'RB24K30', qty: 260, rate: 96.0, gst: 12, status: 'Rejected', created: 95, sent: 92, ack: 80, ref: 'ZCL-298811', docs: ['Invoice copy', 'Expiry stock list'], reject: 'Submitted after 60-day claim window. Supplier declined.' },
  { sup: 'sup-sunrise', type: 'Short Supply', inv: 'SRL/26-27/01402', invAgo: 58, product: 'Atorvin 10 Tab 15s', batch: 'AT25A08', qty: 300, rate: 58.0, gst: 12, status: 'Settled', created: 54, sent: 53, ack: 44, ref: 'SRC-449902', docs: ['Invoice copy', 'Goods received note'] },
  { sup: 'sup-medivance', type: 'Damaged', inv: 'MDV/26/04890', invAgo: 75, product: 'Cough-Ease Syrup 100ml', batch: 'CE25C02', qty: 96, rate: 74.5, gst: 12, status: 'Claim Received', created: 68, sent: 66, ack: 59, docs: ['Invoice copy', 'Debit note', 'Photos of damaged stock'] },
  { sup: 'sup-himgiri', type: 'Price Difference', inv: 'HG/2026/1412', invAgo: 14, product: 'Ondaset 4 MD Tab 10s', batch: 'OD25C30', qty: 900, rate: 27.4, agreed: 24.9, gst: 12, status: 'Not Claimed', created: 1, docs: [] },
];

const methodFor = (supId: string): SubmissionMethod => SUPPLIERS.find((s) => s.id === supId)!.submissionMethod;

let hid = 0;
const h = (at: string, action: string, detail?: string, user?: string): HistoryEntry => ({ id: `h${++hid}`, at, user: user ?? TEAM[hid % TEAM.length], action, detail });

function buildClaims(): Claim[] {
  return SPECS.map((s, i) => {
    const id = `CLM-2026-${String(i + 1).padStart(4, '0')}`;
    const supplier = SUPPLIERS.find((x) => x.id === s.sup)!;
    const calc = calcForClaim({ type: s.type, quantity: s.qty, invoiceRate: s.rate, agreedRate: s.agreed, gstPct: s.gst }, supplier);
    const createdAt = daysAgo(s.created, 10);
    const documents: ClaimDocument[] = s.docs.map((cat, j) => ({
      id: `${id}-d${j}`, name: DOC_FILES[cat](s.inv), category: cat, size: 80_000 + ((i * 37 + j * 91) % 900) * 1000, uploadedAt: daysAgo(s.created, 10),
    }));
    const history: HistoryEntry[] = [h(createdAt, 'Claim created', `${s.type} claim for ${s.product}, value ₹${calc.total.toLocaleString('en-IN')}`)];
    if (documents.length) history.push(h(daysAgo(s.created, 12), 'Documents uploaded', documents.map((d) => d.name).join(', ')));
    let updatedAt = createdAt;
    if (s.sent !== undefined) {
      updatedAt = daysAgo(s.sent, 15);
      history.push(h(updatedAt, 'Status changed: Not Claimed → Claim Sent', `Submitted via ${methodFor(s.sup)}${s.ref ? ` · Ref ${s.ref}` : ''}`));
    }
    if (s.ack !== undefined) {
      updatedAt = daysAgo(s.ack, 14);
      history.push(h(updatedAt, 'Status changed: Claim Sent → Claim Received', 'Supplier acknowledged the claim'));
    }
    if (s.status === 'Rejected') history.push(h(daysAgo((s.ack ?? 0) - 1, 16), 'Status changed: Claim Received → Rejected', s.reject));
    return {
      id, supplierId: s.sup, type: s.type, invoiceNo: s.inv, invoiceDate: dateOnly(s.invAgo), productName: s.product, batchNo: s.batch,
      expiryDate: s.type === 'Expiry' ? dateOnly(s.invAgo - 20) : futureDate(14 + (i % 10)),
      quantity: s.qty, invoiceRate: s.rate, agreedRate: s.agreed, gstPct: s.gst, amount: calc.total,
      status: s.status, createdAt, updatedAt,
      submission: s.sent !== undefined ? { date: dateOnly(s.sent), method: methodFor(s.sup), reference: s.ref } : undefined,
      acknowledgment: s.ack !== undefined ? { date: dateOnly(s.ack) } : undefined,
      rejectionReason: s.reject, documents, notes: s.notes ?? '', history,
    };
  });
}

/** [claim index, fraction of claim amount] */
type AllocSpec = [number, number][];
const CN_SPECS: { sup: string; cn: string; ago: number; allocs: AllocSpec; extra?: number; notes?: string }[] = [
  { sup: 'sup-medivance', cn: 'MDV-CN-2026-0412', ago: 92, allocs: [[0, 1], [1, 1]], notes: 'Combined credit note for July claims' },
  { sup: 'sup-sunrise', cn: 'SRL-CN-88120', ago: 60, allocs: [[3, 1]] },
  { sup: 'sup-novacure', cn: 'NCL-CN-KOL-0931', ago: 52, allocs: [[6, 1]] },
  { sup: 'sup-sunrise', cn: 'SRL-CN-88541', ago: 35, allocs: [[19, 1], [2, 0.5]], notes: 'Rate difference credited at 50% pending scheme verification' },
  { sup: 'sup-himgiri', cn: 'HGG/CN/26/214', ago: 40, allocs: [[8, 0.6]], notes: 'Partial — 500 strips disputed as near-expiry, not expired' },
  { sup: 'sup-aarogya', cn: 'AHL-CRN-55102', ago: 18, allocs: [[4, 0.75]], extra: 1500, notes: 'Includes ₹1,500 not matched to any claim' },
];

function buildCreditNotes(claims: Claim[]): CreditNote[] {
  return CN_SPECS.map((s, i) => {
    const allocations = s.allocs.map(([idx, frac]) => ({ claimId: claims[idx].id, amount: Math.round(claims[idx].amount * frac * 100) / 100 }));
    const amount = Math.round((allocations.reduce((t, a) => t + a.amount, 0) + (s.extra ?? 0)) * 100) / 100;
    return { id: `cn-${i + 1}`, cnNumber: s.cn, supplierId: s.sup, date: dateOnly(s.ago), amount, allocations, notes: s.notes, createdAt: daysAgo(s.ago, 16) };
  });
}

export function buildSeed() {
  hid = 0;
  const claims = buildClaims();
  const creditNotes = buildCreditNotes(claims);
  // Add credit-note history entries to the affected claims.
  for (const cn of creditNotes) {
    for (const a of cn.allocations) {
      const c = claims.find((x) => x.id === a.claimId)!;
      c.history.push(h(cn.createdAt, `Credit note ${cn.cnNumber} applied`, `₹${a.amount.toLocaleString('en-IN')} credited`));
      if (c.status === 'Settled') c.history.push(h(cn.createdAt, 'Status changed: Claim Received → Settled', 'Fully credited by supplier', 'System'));
      c.updatedAt = cn.createdAt;
    }
  }
  return { claims, creditNotes };
}

export const PRODUCT_CATALOGUE = Array.from(new Set(SPECS.map((s) => s.product))).concat(['Paravin 500 Tablet 15s', 'Azivex 250 Tab 6s', 'Montekast 10 Tab 10s']).sort();
