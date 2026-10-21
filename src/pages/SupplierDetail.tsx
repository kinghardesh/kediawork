import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Circle, Copy, FileCheck2, FilePlus2, Lightbulb, ListChecks, Mail, Phone, Send, Users } from 'lucide-react';
import { useStore } from '../store/store';
import { useToast } from '../components/Toast';
import { requiredDocsFor } from '../lib/calc';
import { daysSince, fmtDate, inr } from '../lib/format';
import { Button, Card, cx, DL, LinkButton, PageHeader, Pill, ProgressBar, Select, StatusBadge } from '../components/ui';
import StatusModal from '../components/StatusModal';
import { CLAIM_TYPES, type ClaimType } from '../types';
import { METHOD_ICON } from './Suppliers';
import NotFound from './NotFound';

export default function SupplierDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const store = useStore();
  const toast = useToast();
  const s = store.supplier(id);
  const claimId = params.get('claim') ?? '';
  const [done, setDone] = useState<Record<string, boolean[]>>({});
  const [docType, setDocType] = useState<ClaimType | 'all'>('all');
  const [sendOpen, setSendOpen] = useState(false);

  const claim = claimId ? store.claim(claimId) : undefined;
  useEffect(() => {
    if (claim) setDocType(claim.type);
  }, [claim?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <NotFound what="Supplier" />;

  const mine = store.claims.filter((c) => c.supplierId === s.id);
  const pending = mine.filter((c) => c.status === 'Not Claimed');
  const key = claim?.id ?? '_';
  const checks = done[key] ?? s.steps.map(() => false);
  const progress = checks.filter(Boolean).length / s.steps.length;
  const toggle = (i: number) => setDone((d) => ({ ...d, [key]: checks.map((v, j) => (j === i ? !v : v)) }));
  const Icon = METHOD_ICON[s.submissionMethod];
  const docs = docType === 'all' ? s.requiredDocuments : requiredDocsFor(s, docType);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast('Copied', text, 'info')).catch(() => {});
  };

  return (
    <>
      <PageHeader
        back={<Link to="/suppliers" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All suppliers</Link>}
        title={<span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">{s.code}</span>{s.name}</span>}
        subtitle={`${s.city} · Claim procedure (SOP)`}
        actions={<LinkButton to={`/claims/new?supplier=${s.id}`} icon={FilePlus2}>New claim for {s.code}</LinkButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label="Submit via" value={<span className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-brand-600" />{s.submissionMethod}</span>} />
        <Fact label="Claim window" value={`${s.claimWindowDays} days from invoice`} />
        <Fact label="Usual response" value={`${s.responseDays} days`} />
        <Fact label="Expiry reimbursement" value={s.expiryReimbursementPct ? `${s.expiryReimbursementPct}% of value` : 'Not accepted'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Step-by-step claim procedure"
            icon={ListChecks}
            action={<span className="text-xs font-medium text-slate-500">{checks.filter(Boolean).length}/{s.steps.length} done</span>}
          >
            <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
              <label className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
                <span className="font-medium text-slate-700">Working on claim:</span>
                <Select value={claimId} onChange={(e) => { const n = new URLSearchParams(params); if (e.target.value) n.set('claim', e.target.value); else n.delete('claim'); setParams(n, { replace: true }); }} className="sm:max-w-sm">
                  <option value="">— Just reading the SOP —</option>
                  {pending.length > 0 && <optgroup label="Not yet submitted">{pending.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.productName} · {inr(c.amount)}</option>)}</optgroup>}
                  {mine.filter((c) => c.status !== 'Not Claimed').length > 0 && <optgroup label="Other claims">{mine.filter((c) => c.status !== 'Not Claimed').map((c) => <option key={c.id} value={c.id}>{c.id} · {c.status}</option>)}</optgroup>}
                </Select>
              </label>
              {claim && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <StatusBadge status={claim.status} /> {claim.type} · Inv {claim.invoiceNo} · {s.claimWindowDays - daysSince(claim.invoiceDate)} days left in window ·
                  <Link className="font-medium text-brand-700 hover:underline" to={`/claims/${claim.id}`}>Open claim</Link>
                </p>
              )}
              <div className="mt-3"><ProgressBar value={progress} tone={progress === 1 ? 'emerald' : 'brand'} /></div>
            </div>

            <ol className="space-y-2">
              {s.steps.map((step, i) => (
                <li key={i}>
                  <button onClick={() => toggle(i)} className={cx('flex w-full items-start gap-3 rounded-lg border p-3 text-left transition', checks[i] ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50')} aria-pressed={checks[i]}>
                    <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', checks[i] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600')}>
                      {checks[i] ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span>
                      <span className={cx('block text-sm font-medium', checks[i] ? 'text-slate-500 line-through' : 'text-slate-800')}>{step.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">{step.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {claim && claim.status === 'Not Claimed' && (
              <div className={cx('mt-4 flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between', progress === 1 ? 'bg-emerald-50' : 'bg-slate-50')}>
                <p className="text-sm text-slate-700">{progress === 1 ? <><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />All steps done — record the submission.</> : 'Tick each step as you go. Use these shortcuts when you reach them:'}</p>
                <div className="flex flex-wrap gap-2">
                  <LinkButton to={`/email?claim=${claim.id}`} variant="secondary" size="sm" icon={Mail}>Generate email</LinkButton>
                  <Button size="sm" icon={Send} onClick={() => setSendOpen(true)}>Mark as sent</Button>
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Required documents"
            icon={FileCheck2}
            action={
              <Select value={docType} onChange={(e) => setDocType(e.target.value as ClaimType | 'all')} className="!w-auto !py-1 text-xs" aria-label="Claim type">
                <option value="all">All claim types</option>
                {CLAIM_TYPES.map((t) => <option key={t} value={t} disabled={!s.acceptedTypes.includes(t)}>{t}{!s.acceptedTypes.includes(t) ? ' (not accepted)' : ''}</option>)}
              </Select>
            }
          >
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => {
                const have = claim?.documents.some((x) => x.category === d.category);
                return (
                  <li key={d.category} className="flex items-start gap-3 py-2.5">
                    {claim ? (have ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />) : <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{d.category}</p>
                      {d.note && <p className="text-xs text-slate-500">{d.note}</p>}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">{(d.forTypes ?? ['All types']).map((t) => <Pill key={t}>{t}</Pill>)}</div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Accepts: {s.acceptedTypes.join(', ')}.</p>
          </Card>

          <Card title={`Claims with ${s.code} (${mine.length})`} padded={false}>
            <ul className="divide-y divide-slate-100">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link to={`/claims/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brand-700">{c.id}</p>
                      <p className="truncate text-xs text-slate-500">{c.type} · {c.productName} · {fmtDate(c.invoiceDate)}</p>
                    </div>
                    <span className="num text-sm text-slate-700">{inr(c.amount)}</span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Where to send" icon={Icon}>
            <DL items={[
              ['Claims email', <CopyLine key="e" text={s.claimsEmail} onCopy={copy} />],
              ...(s.ccEmails.length ? ([['CC', <span key="cc">{s.ccEmails.map((e) => <CopyLine key={e} text={e} onCopy={copy} />)}</span>]] as [string, React.ReactNode][]) : []),
              ...(s.portalUrl ? ([['Portal', <span key="p" className="break-all">{s.portalUrl}</span>]] as [string, React.ReactNode][]) : []),
              ...(s.courierAddress ? ([['Courier address', s.courierAddress]] as [string, React.ReactNode][]) : []),
            ]} />
            {s.portalUrl && <p className="mt-3 flex gap-1.5 text-xs text-slate-500"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Fictional portal — submission is simulated in this prototype.</p>}
          </Card>

          <Card title="Contacts" icon={Users}>
            <ul className="space-y-4">
              {s.contacts.map((c) => (
                <li key={c.email}>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.role}</p>
                  <div className="mt-1 space-y-0.5 text-sm">
                    <CopyLine text={c.email} onCopy={copy} icon={Mail} />
                    <p className="flex items-center gap-1.5 text-slate-600"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Good to know" icon={Lightbulb}>
            <ul className="space-y-2 text-sm text-slate-700">
              {s.tips.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />{t}</li>)}
            </ul>
          </Card>
        </div>
      </div>

      {sendOpen && claim && <StatusModal claim={claim} target="Claim Sent" onClose={() => setSendOpen(false)} />}
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function CopyLine({ text, onCopy, icon: I }: { text: string; onCopy: (t: string) => void; icon?: typeof Mail }) {
  return (
    <button onClick={() => onCopy(text)} className="group flex max-w-full items-center gap-1.5 text-left text-brand-700 hover:underline" title="Copy">
      {I && <I className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      <span className="truncate">{text}</span>
      <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
    </button>
  );
}
