import { useEffect, useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { useStore } from '../store/store';
import { useToast } from './Toast';
import { balanceFor, unallocatedOf } from '../lib/calc';
import { fmtDate, inr, inrExact, todayInput } from '../lib/format';
import { Button, cx, Field, Input, Modal, Select, StatusBadge, Textarea } from './ui';
import type { CreditNote } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  presetSupplierId?: string;
  presetClaimId?: string;
  /** When set, allocate the unmatched balance of an existing credit note instead of recording a new one. */
  existing?: CreditNote;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function CreditNoteModal({ open, onClose, presetSupplierId, presetClaimId, existing }: Props) {
  const { suppliers, claims, creditNotes, recordCreditNote, allocateCreditNote } = useStore();
  const toast = useToast();
  const [supplierId, setSupplierId] = useState('');
  const [cnNumber, setCnNumber] = useState('');
  const [date, setDate] = useState(todayInput());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(existing?.supplierId ?? presetSupplierId ?? '');
    setCnNumber('');
    setDate(todayInput());
    setNotes('');
    setTried(false);
    const preset = presetClaimId ? claims.find((c) => c.id === presetClaimId) : undefined;
    if (existing) {
      setAmount(String(unallocatedOf(existing)));
      setAlloc({});
    } else if (preset) {
      const out = balanceFor(preset, creditNotes).outstanding;
      setAmount(String(out));
      setAlloc({ [preset.id]: String(out) });
    } else {
      setAmount('');
      setAlloc({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing, presetClaimId, presetSupplierId]);

  const openClaims = useMemo(
    () =>
      claims
        .filter((c) => c.supplierId === supplierId && c.status !== 'Rejected')
        .map((c) => ({ c, bal: balanceFor(c, creditNotes) }))
        .filter((x) => x.bal.outstanding > 0)
        .sort((a, b) => a.c.invoiceDate.localeCompare(b.c.invoiceDate)),
    [claims, creditNotes, supplierId],
  );

  if (!open) return null;

  const cnAmount = existing ? unallocatedOf(existing) : Number(amount) || 0;
  const allocated = r2(Object.values(alloc).reduce((t, v) => t + (Number(v) || 0), 0));
  const remaining = r2(cnAmount - allocated);
  const overClaim = openClaims.find((x) => (Number(alloc[x.c.id]) || 0) > x.bal.outstanding + 0.01);
  const dupNumber = !existing && creditNotes.some((cn) => cn.cnNumber.trim().toLowerCase() === cnNumber.trim().toLowerCase() && cnNumber.trim());

  const errors = {
    supplier: !supplierId ? 'Choose the supplier' : '',
    cnNumber: !existing && !cnNumber.trim() ? 'Enter the credit note number' : dupNumber ? 'This credit note number is already recorded' : '',
    amount: !existing && !(cnAmount > 0) ? 'Enter the credit note amount' : '',
    alloc: remaining < -0.01 ? `Allocated ${inrExact(allocated)} is more than the credit note amount` : overClaim ? `${overClaim.c.id} only has ${inrExact(overClaim.bal.outstanding)} outstanding` : existing && allocated <= 0 ? 'Allocate an amount to at least one claim' : '',
  };
  const valid = !Object.values(errors).some(Boolean);

  const autoAllocate = () => {
    let left = cnAmount;
    const next: Record<string, string> = {};
    for (const { c, bal } of openClaims) {
      if (left <= 0) break;
      const take = r2(Math.min(left, bal.outstanding));
      next[c.id] = String(take);
      left = r2(left - take);
    }
    setAlloc(next);
  };

  const save = () => {
    setTried(true);
    if (!valid) return;
    const allocations = Object.entries(alloc)
      .map(([claimId, v]) => ({ claimId, amount: r2(Number(v) || 0) }))
      .filter((a) => a.amount > 0);
    const settled = allocations.filter((a) => {
      const x = openClaims.find((o) => o.c.id === a.claimId);
      return x && a.amount >= x.bal.outstanding - 0.5;
    }).length;
    if (existing) {
      allocateCreditNote(existing.id, allocations);
      toast('Credit allocated', `${inr(allocated)} from ${existing.cnNumber} applied to ${allocations.length} claim(s).`);
    } else {
      recordCreditNote({ cnNumber: cnNumber.trim(), supplierId, date, amount: r2(cnAmount), allocations, notes: notes.trim() || undefined });
      toast('Credit note recorded', `${allocations.length} claim(s) updated${settled ? `, ${settled} fully settled` : ''}${remaining > 0 ? `. ${inr(remaining)} left unallocated.` : '.'}`);
    }
    onClose();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={existing ? `Allocate ${existing.cnNumber}` : 'Record supplier credit note'}
      subtitle={existing ? `${inrExact(unallocatedOf(existing))} not yet matched to any claim` : 'Enter the credit note, then choose which claims it pays off.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={tried && !valid}>{existing ? 'Apply allocation' : 'Save credit note'}</Button>
        </>
      }
    >
      {!existing && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier" required error={tried ? errors.supplier : undefined}>
            <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setAlloc({}); }}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Credit note number" required error={tried || dupNumber ? errors.cnNumber : undefined}>
            <Input value={cnNumber} onChange={(e) => setCnNumber(e.target.value)} placeholder="As printed on the credit note" />
          </Field>
          <Field label="Credit note date" required>
            <Input type="date" max={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Credit note amount (₹, incl. GST)" required error={tried ? errors.amount : undefined}>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Partial credit, remaining under review" />
          </Field>
        </div>
      )}

      <div className={cx(!existing && 'mt-5')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">Link to claims</h4>
          {openClaims.length > 0 && cnAmount > 0 && <Button size="sm" variant="secondary" icon={Wand2} onClick={autoAllocate}>Auto-allocate oldest first</Button>}
        </div>
        {!supplierId ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Select a supplier to see their claims with an outstanding balance.</p>
        ) : openClaims.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">This supplier has no claims with an outstanding balance. The full amount will be kept as unallocated credit.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Claim</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Outstanding</th>
                  <th className="w-40 px-3 py-2 text-right font-semibold">Apply (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openClaims.map(({ c, bal }) => {
                  const v = Number(alloc[c.id]) || 0;
                  const over = v > bal.outstanding + 0.01;
                  return (
                    <tr key={c.id} className={cx(v > 0 && 'bg-brand-50/40')}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{c.id}</p>
                        <p className="text-xs text-slate-500">{c.productName} · Inv {c.invoiceNo} · {fmtDate(c.invoiceDate)}</p>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                      <td className="num px-3 py-2 text-right text-slate-700">
                        {inrExact(bal.outstanding)}
                        {bal.state === 'partial' && <span className="block text-xs text-amber-700">of {inr(c.amount)}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Input type="number" min={0} step="0.01" value={alloc[c.id] ?? ''} onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: e.target.value }))} className={cx('num text-right', over && 'border-red-400')} placeholder="0" aria-label={`Amount to apply to ${c.id}`} />
                          <button type="button" className="shrink-0 rounded px-1.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50" onClick={() => setAlloc((a) => ({ ...a, [c.id]: String(bal.outstanding) }))} title="Apply full outstanding">Full</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center text-sm">
          <div><p className="text-xs text-slate-500">Credit note</p><p className="num font-semibold text-slate-800">{inrExact(cnAmount)}</p></div>
          <div><p className="text-xs text-slate-500">Allocated</p><p className="num font-semibold text-slate-800">{inrExact(allocated)}</p></div>
          <div><p className="text-xs text-slate-500">Unallocated</p><p className={cx('num font-semibold', remaining < -0.01 ? 'text-red-600' : remaining > 0 ? 'text-amber-700' : 'text-emerald-600')}>{inrExact(remaining)}</p></div>
        </div>
        {errors.alloc && (tried || remaining < -0.01 || overClaim) && <p className="mt-2 text-sm text-red-600">{errors.alloc}</p>}
        {remaining > 0.01 && !errors.alloc && <p className="mt-2 text-xs text-slate-500">Unallocated credit stays on the credit note and can be matched to claims later.</p>}
      </div>
    </Modal>
  );
}
