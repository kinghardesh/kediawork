import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDollarSign, Link2, Receipt, Scale, Wallet } from 'lucide-react';
import { useStore } from '../store/store';
import { allocatedOf, balanceFor, unallocatedOf, type SettlementState } from '../lib/calc';
import { fmtDate, inr, inrExact } from '../lib/format';
import { Button, Card, cx, EmptyState, PageHeader, ProgressBar, Select, SettlementBadge, StatusBadge } from '../components/ui';
import CreditNoteModal from '../components/CreditNoteModal';
import type { CreditNote } from '../types';

type Tab = 'claims' | 'notes';
type Filter = 'all' | SettlementState;

export default function Reconciliation() {
  const { claims, creditNotes, suppliers, supplier } = useStore();
  const [tab, setTab] = useState<Tab>('claims');
  const [filter, setFilter] = useState<Filter>('all');
  const [sup, setSup] = useState('');
  const [modal, setModal] = useState<{ open: boolean; existing?: CreditNote }>({ open: false });

  // Only submitted claims take part in reconciliation.
  const rows = useMemo(
    () =>
      claims
        .filter((c) => c.status !== 'Not Claimed' && c.status !== 'Rejected')
        .filter((c) => !sup || c.supplierId === sup)
        .map((c) => ({ c, bal: balanceFor(c, creditNotes) }))
        .sort((a, b) => b.bal.outstanding - a.bal.outstanding),
    [claims, creditNotes, sup],
  );
  const shown = rows.filter((r) => filter === 'all' || r.bal.state === filter);
  const notes = creditNotes.filter((cn) => !sup || cn.supplierId === sup);

  const totals = useMemo(() => {
    const claimed = rows.reduce((t, r) => t + r.c.amount, 0);
    const credited = rows.reduce((t, r) => t + r.bal.credited, 0);
    const outstanding = rows.reduce((t, r) => t + r.bal.outstanding, 0);
    const unallocated = notes.reduce((t, cn) => t + unallocatedOf(cn), 0);
    const count = (s: SettlementState) => rows.filter((r) => r.bal.state === s).length;
    return { claimed, credited, outstanding, unallocated, full: count('full'), partial: count('partial'), none: count('none') };
  }, [rows, notes]);

  return (
    <>
      <PageHeader
        title="Credit note reconciliation"
        subtitle="Match supplier credit notes to claims and see what is still owed."
        actions={
          <>
            <Select value={sup} onChange={(e) => setSup(e.target.value)} className="!w-56" aria-label="Filter by supplier">
              <option value="">All suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Button icon={Receipt} onClick={() => setModal({ open: true })}>Record credit note</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Submitted claim value" value={inr(totals.claimed)} sub={`${rows.length} claims`} />
        <Stat icon={CheckCircle2} label="Credited" value={inr(totals.credited)} sub={<ProgressBar value={totals.claimed ? totals.credited / totals.claimed : 0} tone="emerald" />} />
        <Stat icon={Wallet} label="Outstanding" value={inr(totals.outstanding)} sub={`${totals.partial} partial · ${totals.none} uncredited`} accent />
        <Stat icon={Link2} label="Unallocated credit" value={inr(totals.unallocated)} sub="On credit notes, not matched to a claim" />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {(['claims', 'notes'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx('rounded-md px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              {t === 'claims' ? `Claim balances (${rows.length})` : `Credit notes (${notes.length})`}
            </button>
          ))}
        </div>
        {tab === 'claims' && (
          <div className="flex flex-wrap gap-1.5">
            {([['all', 'All', rows.length], ['none', 'No credit yet', totals.none], ['partial', 'Partially credited', totals.partial], ['full', 'Fully settled', totals.full]] as [Filter, string, number][]).map(([k, l, n]) => (
              <button key={k} onClick={() => setFilter(k)} className={cx('rounded-full border px-3 py-1 text-xs font-medium', filter === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                {l} · {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'claims' ? (
        <Card className="mt-4" padded={false}>
          {shown.length === 0 ? <EmptyState icon={Scale} title="No claims in this view" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Claim</th>
                    <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                    <th className="px-4 py-3 text-right font-semibold">Claimed</th>
                    <th className="px-4 py-3 text-right font-semibold">Credited</th>
                    <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                    <th className="w-40 px-4 py-3 text-left font-semibold">Progress</th>
                    <th className="px-4 py-3 text-left font-semibold">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map(({ c, bal }) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/claims/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.id}</Link>
                        <p className="text-xs text-slate-500">{c.productName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{supplier(c.supplierId)?.name}</p>
                        <StatusBadge status={c.status} className="mt-1" />
                      </td>
                      <td className="num px-4 py-3 text-right text-slate-800">{inrExact(c.amount)}</td>
                      <td className="num px-4 py-3 text-right text-emerald-700">{bal.credited ? inrExact(bal.credited) : '—'}</td>
                      <td className={cx('num px-4 py-3 text-right font-medium', bal.outstanding > 0 ? 'text-amber-700' : 'text-emerald-600')}>{inrExact(bal.outstanding)}</td>
                      <td className="px-4 py-3"><ProgressBar value={bal.pct} tone={bal.state === 'full' ? 'emerald' : bal.state === 'partial' ? 'amber' : 'brand'} /><p className="mt-1 text-xs text-slate-500">{Math.round(bal.pct * 100)}%</p></td>
                      <td className="px-4 py-3"><SettlementBadge state={bal.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {notes.length === 0 && <Card><EmptyState icon={Receipt} title="No credit notes recorded" /></Card>}
          {notes.map((cn) => {
            const un = unallocatedOf(cn);
            return (
              <Card key={cn.id} padded={false}>
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{cn.cnNumber}</p>
                    <p className="text-sm text-slate-500">{supplier(cn.supplierId)?.name} · {fmtDate(cn.date)}</p>
                    {cn.notes && <p className="mt-1 text-xs text-slate-500">{cn.notes}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="num text-lg font-semibold text-slate-900">{inrExact(cn.amount)}</p>
                      <p className={cx('text-xs', un > 0 ? 'text-amber-700' : 'text-emerald-600')}>{un > 0 ? `${inrExact(un)} unallocated` : 'Fully allocated'}</p>
                    </div>
                    {un > 0 && <Button size="sm" variant="secondary" icon={Link2} onClick={() => setModal({ open: true, existing: cn })}>Allocate</Button>}
                  </div>
                </div>
                <ul className="divide-y divide-slate-50 px-5 py-2">
                  {cn.allocations.map((a) => {
                    const c = claims.find((x) => x.id === a.claimId);
                    return (
                      <li key={a.claimId} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <Link to={`/claims/${a.claimId}`} className="font-medium text-brand-700 hover:underline">{a.claimId}</Link>
                          <span className="truncate text-slate-500">{c?.productName}</span>
                        </span>
                        <span className="num shrink-0 text-slate-800">{inrExact(a.amount)}</span>
                      </li>
                    );
                  })}
                  {cn.allocations.length === 0 && <li className="py-2 text-sm text-slate-500">Not linked to any claim yet.</li>}
                </ul>
                <div className="px-5 pb-4"><ProgressBar value={cn.amount ? allocatedOf(cn) / cn.amount : 0} tone={un > 0 ? 'amber' : 'emerald'} /></div>
              </Card>
            );
          })}
        </div>
      )}

      <CreditNoteModal open={modal.open} existing={modal.existing} presetSupplierId={sup || undefined} onClose={() => setModal({ open: false })} />
    </>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: { icon: typeof Wallet; label: string; value: string; sub: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Icon className="h-4 w-4" />{label}</div>
      <p className={cx('num mt-2 text-xl font-semibold sm:text-2xl', accent ? 'text-amber-700' : 'text-slate-900')}>{value}</p>
      <div className="mt-1.5 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
