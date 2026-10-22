import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, FilePlus2, Pencil, Search, SearchX } from 'lucide-react';
import { useStore } from '../store/store';
import { balanceFor } from '../lib/calc';
import { fmtDate, inr } from '../lib/format';
import { Button, Card, cx, EmptyState, Input, LinkButton, PageHeader, Select, StatusBadge } from '../components/ui';
import { CLAIM_STATUSES, CLAIM_TYPES, type Claim } from '../types';

type SortKey = 'id' | 'invoiceDate' | 'amount' | 'outstanding' | 'supplier';

const STATUS_TABS = ['All', 'Not Claimed', 'Awaiting', 'Settled', 'Rejected'] as const;
const TAB_LABEL: Record<string, string> = { Awaiting: 'Sent / Received' };

export default function Claims() {
  const { claims, creditNotes, suppliers, supplier } = useStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'id', dir: -1 });

  const q = params.get('q') ?? '';
  const status = params.get('status') ?? 'All';
  const sup = params.get('supplier') ?? '';
  const type = params.get('type') ?? '';

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v && v !== 'All') next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    const list = claims
      .filter((c) => {
        if (status === 'Awaiting') return c.status === 'Claim Sent' || c.status === 'Claim Received';
        return status === 'All' || c.status === status;
      })
      .filter((c) => !sup || c.supplierId === sup)
      .filter((c) => !type || c.type === type)
      .filter((c) => {
        if (!needle) return true;
        const s = supplier(c.supplierId);
        return [c.id, c.invoiceNo, c.productName, c.batchNo, s?.name, s?.code, c.submission?.reference].some((v) => v?.toLowerCase().includes(needle));
      })
      .map((c) => ({ c, bal: balanceFor(c, creditNotes), sName: supplier(c.supplierId)?.name ?? '' }));
    const val = (r: (typeof list)[number]): string | number =>
      sort.key === 'amount' ? r.c.amount : sort.key === 'outstanding' ? r.bal.outstanding : sort.key === 'supplier' ? r.sName : sort.key === 'invoiceDate' ? r.c.invoiceDate : r.c.id;
    return list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [claims, creditNotes, q, status, sup, type, sort, supplier]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: claims.length, Awaiting: 0 };
    for (const s of CLAIM_STATUSES) m[s] = claims.filter((c) => c.status === s).length;
    m.Awaiting = m['Claim Sent'] + m['Claim Received'];
    return m;
  }, [claims]);

  const totals = rows.reduce((t, r) => ({ amount: t.amount + r.c.amount, out: t.out + (r.c.status === 'Not Claimed' ? 0 : r.bal.outstanding) }), { amount: 0, out: 0 });

  const exportCsv = () => {
    const header = ['Claim ID', 'Supplier', 'Type', 'Product', 'Batch', 'Invoice No', 'Invoice Date', 'Qty', 'Amount', 'Credited', 'Outstanding', 'Status'];
    const lines = rows.map(({ c, bal, sName }) => [c.id, sName, c.type, c.productName, c.batchNo, c.invoiceNo, c.invoiceDate, c.quantity, c.amount, bal.credited, bal.outstanding, c.status]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `kedia-claims-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const Th = ({ k, children, right }: { k?: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={cx('whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500', right && 'text-right')}>
      {k ? (
        <button className={cx('inline-flex items-center gap-1 hover:text-slate-800', sort.key === k && 'text-slate-800')} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : -1 }))}>
          {children}
          {sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      ) : children}
    </th>
  );

  return (
    <>
      <PageHeader
        title="Claims"
        subtitle="Every supplier claim in one place. Click a row to see details, change status or record credit."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button>
            <LinkButton to="/claims/new" icon={FilePlus2}>New claim</LinkButton>
          </>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => set('status', s)}
            className={cx('flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition', status === s || (s === 'Awaiting' && (status === 'Claim Sent' || status === 'Claim Received')) ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
          >
            {TAB_LABEL[s] ?? s}
            <span className={cx('rounded-full px-1.5 text-xs', status === s ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{counts[s]}</span>
          </button>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search by claim ID, invoice, product, batch or reference…" className="pl-9" aria-label="Search claims" />
          </div>
          <Select value={sup} onChange={(e) => set('supplier', e.target.value)} className="md:w-56" aria-label="Filter by supplier">
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={type} onChange={(e) => set('type', e.target.value)} className="md:w-44" aria-label="Filter by claim type">
            <option value="">All claim types</option>
            {CLAIM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
          {status !== 'All' && status !== 'Awaiting' && !STATUS_TABS.includes(status as (typeof STATUS_TABS)[number]) && (
            <Button variant="ghost" onClick={() => set('status', 'All')}>Clear “{status}”</Button>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No claims match these filters">Try a different search or clear the filters.</EmptyState>
        ) : (
          <>
          {/* Phones: one card per claim instead of a wide table */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {rows.map(({ c, bal }) => (
              <li key={c.id}>
                <Link to={`/claims/${c.id}`} className="block px-4 py-3 active:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-700">{c.id}</p>
                      <p className="truncate text-sm text-slate-800">{c.productName}</p>
                      <p className="truncate text-xs text-slate-500">{supplier(c.supplierId)?.name} · {c.type}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num font-semibold text-slate-900">{inr(c.amount)}</p>
                      {c.status !== 'Not Claimed' && bal.outstanding > 0 && <p className="num text-xs text-amber-700">{inr(bal.outstanding)} due</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-slate-400">Inv {c.invoiceNo} · {fmtDate(c.invoiceDate)}</span>
                  </div>
                </Link>
              </li>
            ))}
            <li className="flex justify-between bg-slate-50/60 px-4 py-3 text-sm font-medium text-slate-600">
              <span>{rows.length} claim{rows.length === 1 ? '' : 's'}</span>
              <span className="num">{inr(totals.amount)}</span>
            </li>
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <Th k="id">Claim ID</Th>
                  <Th k="supplier">Supplier</Th>
                  <Th>Product</Th>
                  <Th k="invoiceDate">Invoice</Th>
                  <Th right>Qty</Th>
                  <Th k="amount" right>Amount</Th>
                  <Th k="outstanding" right>Outstanding</Th>
                  <Th>Status</Th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, bal }) => (
                  <Row key={c.id} c={c} outstanding={c.status === 'Not Claimed' ? null : bal.outstanding} partial={bal.state === 'partial'} supplierName={supplier(c.supplierId)?.name ?? ''} onOpen={() => navigate(`/claims/${c.id}`)} />
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/60 text-sm">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-600" colSpan={5}>{rows.length} claim{rows.length === 1 ? '' : 's'}</td>
                  <td className="num px-4 py-3 text-right font-semibold text-slate-800">{inr(totals.amount)}</td>
                  <td className="num px-4 py-3 text-right font-semibold text-slate-800">{inr(totals.out)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </Card>
    </>
  );
}

function Row({ c, outstanding, partial, supplierName, onOpen }: { c: Claim; outstanding: number | null; partial: boolean; supplierName: string; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer transition hover:bg-brand-50/40" onClick={onOpen}>
      <td className="whitespace-nowrap px-4 py-3">
        <Link to={`/claims/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-700 hover:underline">{c.id}</Link>
        <p className="text-xs text-slate-400">{c.type}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{supplierName}</td>
      <td className="px-4 py-3">
        <p className="text-slate-800">{c.productName}</p>
        <p className="text-xs text-slate-400">Batch {c.batchNo}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <p className="text-slate-700">{c.invoiceNo}</p>
        <p className="text-xs text-slate-400">{fmtDate(c.invoiceDate)}</p>
      </td>
      <td className="num px-4 py-3 text-right text-slate-700">{c.quantity.toLocaleString('en-IN')}</td>
      <td className="num whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">{inr(c.amount)}</td>
      <td className="num whitespace-nowrap px-4 py-3 text-right">
        {outstanding === null ? <span className="text-slate-300">—</span> : outstanding === 0 ? <span className="text-emerald-600">₹0</span> : (
          <span className={partial ? 'font-medium text-amber-700' : 'text-slate-700'} title={partial ? 'Partially credited' : undefined}>{inr(outstanding)}</span>
        )}
      </td>
      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
      <td className="px-4 py-3 text-right">
        <Link to={`/claims/${c.id}/edit`} onClick={(e) => e.stopPropagation()} className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit claim" aria-label={`Edit ${c.id}`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}
