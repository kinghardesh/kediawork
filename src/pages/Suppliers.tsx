import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Globe, Mail, Search, Truck } from 'lucide-react';
import { useStore } from '../store/store';
import { balanceFor } from '../lib/calc';
import { inr } from '../lib/format';
import { Input, PageHeader, Pill } from '../components/ui';
import type { SubmissionMethod } from '../types';

export const METHOD_ICON: Record<SubmissionMethod, typeof Mail> = { Email: Mail, 'Supplier Portal': Globe, 'Courier + Email': Truck };

export default function Suppliers() {
  const { suppliers, claims, creditNotes } = useStore();
  const [q, setQ] = useState('');
  const list = suppliers.filter((s) => `${s.name} ${s.code} ${s.city}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Supplier SOP directory" subtitle="How each supplier wants claims submitted — documents, contacts and step-by-step procedure." />
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…" className="pl-9" aria-label="Search suppliers" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const mine = claims.filter((c) => c.supplierId === s.id);
          const pending = mine.filter((c) => c.status === 'Not Claimed').length;
          const outstanding = mine.filter((c) => c.status !== 'Not Claimed').reduce((t, c) => t + balanceFor(c, creditNotes).outstanding, 0);
          const Icon = METHOD_ICON[s.submissionMethod];
          return (
            <Link key={s.id} to={`/suppliers/${s.id}`} className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">{s.code}</div>
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.city}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Pill><Icon className="h-3 w-3" /> {s.submissionMethod}</Pill>
                <Pill>{s.claimWindowDays}-day window</Pill>
                <Pill>Expiry {s.expiryReimbursementPct ? `${s.expiryReimbursementPct}%` : 'not accepted'}</Pill>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                <div><p className="num text-lg font-semibold text-slate-900">{mine.length}</p><p className="text-xs text-slate-500">Claims</p></div>
                <div><p className="num text-lg font-semibold text-slate-900">{pending}</p><p className="text-xs text-slate-500">To submit</p></div>
                <div><p className="num text-lg font-semibold text-amber-700">{inr(outstanding)}</p><p className="text-xs text-slate-500">Outstanding</p></div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
