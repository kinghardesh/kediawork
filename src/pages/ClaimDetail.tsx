import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Calculator, Check, CheckCircle2, ChevronDown, Clock, FileText, History, Mail, MessageSquarePlus, Paperclip, Pencil, Receipt, Send, XCircle } from 'lucide-react';
import { useStore } from '../store/store';
import { balanceFor, calcForClaim, requiredDocsFor } from '../lib/calc';
import { daysSince, fmtDate, fmtDateTime, inr, inrExact } from '../lib/format';
import { Button, Card, cx, DL, LinkButton, PageHeader, Pill, ProgressBar, SettlementBadge, StatusBadge, Textarea } from '../components/ui';
import { DocumentList, DocumentUploader, RequiredChecklist } from '../components/Documents';
import StatusModal from '../components/StatusModal';
import CreditNoteModal from '../components/CreditNoteModal';
import { useToast } from '../components/Toast';
import { PIPELINE, type ClaimStatus } from '../types';
import NotFound from './NotFound';

export default function ClaimDetail() {
  const { id = '' } = useParams();
  const store = useStore();
  const toast = useToast();
  const claim = store.claim(id);
  const [target, setTarget] = useState<ClaimStatus | null>(null);
  const [cnOpen, setCnOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [note, setNote] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the status menu on outside click or Escape (works for touch and keyboard, not just mouse).
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMoreOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  if (!claim) return <NotFound what="Claim" />;
  const s = store.supplier(claim.supplierId)!;
  const bal = balanceFor(claim, store.creditNotes);
  const calc = calcForClaim(claim, s);
  const required = requiredDocsFor(s, claim.type);
  const missing = required.filter((r) => !claim.documents.some((d) => d.category === r.category));
  const linkedCns = store.creditNotes
    .map((cn) => ({ cn, a: cn.allocations.find((a) => a.claimId === claim.id) }))
    .filter((x): x is { cn: typeof x.cn; a: NonNullable<typeof x.a> } => !!x.a);
  const stepIndex = PIPELINE.indexOf(claim.status);

  const addNote = () => {
    if (!note.trim()) return;
    store.addNote(claim.id, note.trim());
    setNote('');
    toast('Note added');
  };

  return (
    <>
      <PageHeader
        back={<Link to="/claims" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All claims</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{claim.id} <StatusBadge status={claim.status} className="text-sm" /></span>}
        subtitle={<>{claim.type} claim · <Link to={`/suppliers/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link> · Created {fmtDate(claim.createdAt)}</>}
        actions={
          <>
            <LinkButton to={`/claims/${claim.id}/edit`} variant="secondary" icon={Pencil}>Edit</LinkButton>
            <LinkButton to={`/email?claim=${claim.id}`} variant="secondary" icon={Mail}>Email draft</LinkButton>
            {claim.status !== 'Rejected' && bal.outstanding > 0 && claim.status !== 'Not Claimed' && <Button icon={Receipt} onClick={() => setCnOpen(true)}>Record credit note</Button>}
          </>
        }
      />

      {/* Status stepper + next action */}
      <Card className="mb-6">
        {claim.status === 'Rejected' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-slate-900">This claim was rejected by the supplier</p>
                <p className="text-sm text-slate-500">{claim.rejectionReason ?? 'No reason recorded.'}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setTarget('Not Claimed')}>Reopen claim</Button>
          </div>
        ) : (
          <>
            <ol className="grid grid-cols-4 gap-2">
              {PIPELINE.map((p, i) => {
                const done = i < stepIndex || claim.status === 'Settled';
                const current = i === stepIndex && claim.status !== 'Settled';
                return (
                  <li key={p} className="flex flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <div className={cx('h-0.5 flex-1', i === 0 ? 'opacity-0' : i <= stepIndex ? 'bg-brand-500' : 'bg-slate-200')} />
                      <div className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold', done ? 'border-brand-600 bg-brand-600 text-white' : current ? 'border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100' : 'border-slate-200 bg-white text-slate-400')}>
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <div className={cx('h-0.5 flex-1', i === PIPELINE.length - 1 ? 'opacity-0' : i < stepIndex ? 'bg-brand-500' : 'bg-slate-200')} />
                    </div>
                    <p className={cx('mt-2 text-xs font-medium sm:text-sm', current || done ? 'text-slate-800' : 'text-slate-400')}>{p}</p>
                    <p className="hidden text-xs text-slate-400 sm:block">
                      {p === 'Not Claimed' && fmtDate(claim.createdAt)}
                      {p === 'Claim Sent' && claim.submission && fmtDate(claim.submission.date)}
                      {p === 'Claim Received' && claim.acknowledgment && fmtDate(claim.acknowledgment.date)}
                      {p === 'Settled' && claim.status === 'Settled' && linkedCns.length > 0 && fmtDate(linkedCns[linkedCns.length - 1].cn.date)}
                    </p>
                  </li>
                );
              })}
            </ol>
            <NextAction
              status={claim.status}
              supplierName={s.name}
              method={s.submissionMethod}
              sentDays={claim.submission ? daysSince(claim.submission.date) : 0}
              responseDays={s.responseDays}
              missingDocs={missing.length}
              outstanding={bal.outstanding}
              claimId={claim.id}
              supplierId={s.id}
              onStatus={setTarget}
              onCredit={() => setCnOpen(true)}
            />
            <div ref={menuRef} className="relative mt-3 flex justify-end">
              <button onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="menu" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
                Other status changes <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-6 z-10 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu">
                  {(['Not Claimed', 'Claim Sent', 'Claim Received', 'Settled', 'Rejected'] as ClaimStatus[])
                    .filter((x) => x !== claim.status)
                    .map((x) => (
                      <button key={x} role="menuitem" onClick={() => { setTarget(x); setMoreOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        Set to <StatusBadge status={x} />
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Claim details" icon={FileText}>
            <DL
              cols={3}
              items={[
                ['Supplier', s.name],
                ['Claim type', claim.type],
                ['Invoice', <>{claim.invoiceNo}<span className="block text-xs text-slate-500">{fmtDate(claim.invoiceDate)}</span></>],
                ['Product', claim.productName],
                ['Batch', claim.batchNo],
                ['Expiry date', fmtDate(claim.expiryDate)],
                ['Quantity', claim.quantity.toLocaleString('en-IN')],
                ['Invoice rate', inrExact(claim.invoiceRate)],
                ...(claim.agreedRate !== undefined ? ([['Agreed rate', inrExact(claim.agreedRate)]] as [string, string][]) : []),
                ['GST', `${claim.gstPct}%`],
              ]}
            />
            {claim.notes && (
              <div className="mt-5 rounded-lg bg-amber-50/60 p-3 text-sm text-slate-700">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Notes</p>
                <p className="whitespace-pre-line">{claim.notes}</p>
              </div>
            )}
          </Card>

          <Card title="Supporting documents" icon={Paperclip} action={missing.length > 0 && claim.status === 'Not Claimed' ? <Pill className="bg-amber-50 text-amber-700">{missing.length} missing</Pill> : undefined}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <DocumentList docs={claim.documents} onRemove={(docId) => store.removeDocument(claim.id, docId)} />
                <DocumentUploader required={missing.length ? missing : required} onAdd={(d) => { store.addDocuments(claim.id, d); toast(`${d.length} document(s) uploaded`); }} />
              </div>
              <RequiredChecklist required={required} docs={claim.documents} />
            </div>
          </Card>

          <Card title="History" icon={History}>
            <ol className="relative space-y-5 border-l border-slate-200 pl-5">
              {[...claim.history].reverse().map((h) => (
                <li key={h.id} className="relative">
                  <span className={cx('absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white', h.action.startsWith('Status') ? 'bg-brand-500' : h.action.startsWith('Credit') ? 'bg-emerald-500' : 'bg-slate-300')} />
                  <p className="text-sm font-medium text-slate-800">{h.action}</p>
                  {h.detail && <p className="mt-0.5 text-sm text-slate-600">{h.detail}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">{h.user} · {fmtDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
              <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note, e.g. “Called Rohit, he'll check by Friday”" className="flex-1" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addNote())} />
              <Button variant="secondary" icon={MessageSquarePlus} onClick={addNote} disabled={!note.trim()}>Add note</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Settlement" icon={Receipt}>
            <div className="space-y-3 text-sm">
              <Row label="Claim amount" value={inrExact(claim.amount)} strong />
              <Row label="Credited so far" value={inrExact(bal.credited)} />
              <ProgressBar value={bal.pct} tone={bal.state === 'full' ? 'emerald' : bal.state === 'partial' ? 'amber' : 'brand'} />
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Outstanding</span>
                <span className={cx('num text-lg font-semibold', bal.outstanding > 0 ? 'text-amber-700' : 'text-emerald-600')}>{inrExact(bal.outstanding)}</span>
              </div>
              {claim.status !== 'Not Claimed' && claim.status !== 'Rejected' && <SettlementBadge state={bal.state} />}
            </div>
            {linkedCns.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Linked credit notes</p>
                <ul className="space-y-2">
                  {linkedCns.map(({ cn, a }) => (
                    <li key={cn.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{cn.cnNumber}</p>
                        <p className="text-xs text-slate-500">{fmtDate(cn.date)}{cn.allocations.length > 1 && ` · split across ${cn.allocations.length} claims`}</p>
                      </div>
                      <span className="num font-medium text-emerald-700">{inr(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Calculation" icon={Calculator}>
            <dl className="space-y-2 text-sm">
              {calc.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-3">
                  <dt className="text-slate-600">{l.label}{l.formula && <span className="block text-xs text-slate-400">{l.formula}</span>}</dt>
                  <dd className="num whitespace-nowrap text-slate-800">{inrExact(l.value)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><dt>Total</dt><dd className="num">{inrExact(claim.amount)}</dd></div>
            </dl>
          </Card>

          <Card title="Submission" icon={Send}>
            {claim.submission ? (
              <DL items={[
                ['Sent on', fmtDate(claim.submission.date)],
                ['Method', claim.submission.method],
                ['Reference', claim.submission.reference ?? '—'],
                ['Acknowledged', claim.acknowledgment ? `${fmtDate(claim.acknowledgment.date)}${claim.acknowledgment.reference ? ` · ${claim.acknowledgment.reference}` : ''}` : 'Not yet'],
              ]} />
            ) : (
              <p className="text-sm text-slate-500">Not submitted yet. {s.code} accepts claims via <span className="font-medium text-slate-700">{s.submissionMethod}</span> within {s.claimWindowDays} days of invoice ({Math.max(0, s.claimWindowDays - daysSince(claim.invoiceDate))} days left).</p>
            )}
            <LinkButton to={`/suppliers/${s.id}?claim=${claim.id}`} variant="ghost" size="sm" icon={BookOpen} className="mt-3 -ml-2">View {s.code} claim procedure</LinkButton>
          </Card>
        </div>
      </div>

      {target && <StatusModal claim={claim} target={target} onClose={() => setTarget(null)} />}
      <CreditNoteModal open={cnOpen} onClose={() => setCnOpen(false)} presetSupplierId={s.id} presetClaimId={claim.id} />
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={cx('num', strong ? 'font-semibold text-slate-900' : 'text-slate-800')}>{value}</span>
    </div>
  );
}

function NextAction(p: {
  status: ClaimStatus; supplierName: string; method: string; sentDays: number; responseDays: number; missingDocs: number; outstanding: number;
  claimId: string; supplierId: string; onStatus: (s: ClaimStatus) => void; onCredit: () => void;
}) {
  let icon = Clock;
  let title = '';
  let body = '';
  let actions: React.ReactNode = null;
  if (p.status === 'Not Claimed') {
    title = `Next: submit this claim to ${p.supplierName}`;
    body = `Submission method: ${p.method}.${p.missingDocs ? ` ${p.missingDocs} required document(s) still missing.` : ' All required documents are uploaded.'}`;
    actions = (
      <>
        <LinkButton to={`/suppliers/${p.supplierId}?claim=${p.claimId}`} variant="secondary" size="sm" icon={BookOpen}>Follow SOP</LinkButton>
        <LinkButton to={`/email?claim=${p.claimId}`} variant="secondary" size="sm" icon={Mail}>Generate email</LinkButton>
        <Button size="sm" icon={Send} onClick={() => p.onStatus('Claim Sent')}>Mark as sent</Button>
      </>
    );
  } else if (p.status === 'Claim Sent') {
    const overdue = p.sentDays > p.responseDays;
    title = overdue ? `Follow up — sent ${p.sentDays} days ago` : `Waiting for ${p.supplierName} to acknowledge`;
    body = overdue ? `They usually respond within ${p.responseDays} days. Send a reminder or call the contact.` : `Sent ${p.sentDays} day(s) ago. Usual response time is ${p.responseDays} days.`;
    actions = (
      <>
        {overdue && <LinkButton to={`/email?claim=${p.claimId}&template=followup`} variant="secondary" size="sm" icon={Mail}>Reminder email</LinkButton>}
        <Button size="sm" icon={CheckCircle2} onClick={() => p.onStatus('Claim Received')}>Mark as received</Button>
      </>
    );
  } else if (p.status === 'Claim Received') {
    title = 'Waiting for credit note';
    body = `Supplier has acknowledged the claim. ${inr(p.outstanding)} is outstanding — record the credit note when it arrives.`;
    actions = <Button size="sm" icon={Receipt} onClick={p.onCredit}>Record credit note</Button>;
  } else {
    icon = CheckCircle2;
    title = 'Claim fully settled';
    body = 'Credit notes cover the full claim amount. No further action needed.';
  }
  const Icon = icon;
  return (
    <div className={cx('mt-5 flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between', p.status === 'Settled' ? 'bg-emerald-50' : 'bg-brand-50/60')}>
      <div className="flex items-start gap-3">
        <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', p.status === 'Settled' ? 'text-emerald-600' : 'text-brand-600')} />
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{body}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
