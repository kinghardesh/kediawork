import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, Circle, Copy, ExternalLink, Info, Mail, RotateCcw, Send } from 'lucide-react';
import { useStore } from '../store/store';
import { useToast } from '../components/Toast';
import { buildEmail, mailtoUrl, type EmailTemplate } from '../lib/email';
import { daysSince, inr } from '../lib/format';
import { Button, Card, cx, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Textarea } from '../components/ui';
import StatusModal from '../components/StatusModal';

export default function EmailDraft() {
  const store = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const claimId = params.get('claim') ?? '';
  const claim = claimId ? store.claim(claimId) : undefined;
  const supplier = claim ? store.supplier(claim.supplierId) : undefined;
  const canFollowUp = claim?.status === 'Claim Sent' || claim?.status === 'Claim Received';
  const template: EmailTemplate = params.get('template') === 'followup' && canFollowUp ? 'followup' : 'submission';

  const generated = useMemo(
    () => (claim && supplier ? buildEmail(claim, supplier, store.creditNotes, template) : null),
    // Regenerate only when the claim or template changes, not on every unrelated store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claim?.id, claim?.status, claim?.documents.length, template],
  );

  const [draft, setDraft] = useState({ to: '', cc: '', subject: '', body: '' });
  const [sendOpen, setSendOpen] = useState(false);
  useEffect(() => {
    if (generated) setDraft({ to: generated.to, cc: generated.cc, subject: generated.subject, body: generated.body });
  }, [generated]);

  const edited = !!generated && (draft.to !== generated.to || draft.cc !== generated.cc || draft.subject !== generated.subject || draft.body !== generated.body);
  const missing = generated?.attachments.filter((a) => a.missing) ?? [];

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k === 'claim') n.delete('template');
    setParams(n, { replace: true });
  };

  const groups = useMemo(() => {
    const by = (pred: (s: string) => boolean) => store.claims.filter((c) => pred(c.status));
    return [
      { label: 'Ready to submit (Not Claimed)', items: by((s) => s === 'Not Claimed') },
      { label: 'Submitted – for follow-up', items: by((s) => s === 'Claim Sent' || s === 'Claim Received') },
      { label: 'Closed', items: by((s) => s === 'Settled' || s === 'Rejected') },
    ].filter((g) => g.items.length);
  }, [store.claims]);

  const copy = async () => {
    const text = `To: ${draft.to}${draft.cc ? `\nCc: ${draft.cc}` : ''}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Email copied', 'Paste it into your email app, attach the documents and send.');
      if (claim) store.logEvent(claim.id, template === 'followup' ? 'Follow-up email drafted' : 'Claim email drafted', `Copied to clipboard · To ${draft.to}`);
    } catch {
      toast('Could not copy', 'Select the text in the box and copy it manually.', 'info');
    }
  };

  const openMail = () => {
    window.location.href = mailtoUrl(draft);
    if (claim) store.logEvent(claim.id, template === 'followup' ? 'Follow-up email drafted' : 'Claim email drafted', `Opened in email app · To ${draft.to}`);
  };

  const markFollowUpSent = () => {
    if (!claim) return;
    store.logEvent(claim.id, 'Follow-up email sent', `Reminder sent to ${draft.to}`);
    toast('Follow-up recorded', `Logged in ${claim.id} history.`);
  };

  return (
    <>
      <PageHeader
        title="Email draft generator"
        subtitle="Creates a pre-filled claim email from the claim and the supplier's SOP. Review it, attach the documents, and send it from your own email app."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="1. Choose a claim">
            <Field label="Claim">
              <Select value={claimId} onChange={(e) => setParam('claim', e.target.value)}>
                <option value="">Select a claim…</option>
                {groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((c) => <option key={c.id} value={c.id}>{c.id} · {store.supplier(c.supplierId)?.code} · {c.productName} · {inr(c.amount)}</option>)}
                  </optgroup>
                ))}
              </Select>
            </Field>
            {claim && supplier && (
              <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={claim.status} /><span className="text-slate-600">{claim.type}</span></div>
                <p className="text-slate-700">{supplier.name}</p>
                <p className="text-xs text-slate-500">Submits via <span className="font-medium text-slate-700">{supplier.submissionMethod}</span></p>
                <div className="flex gap-3 pt-1 text-xs font-medium">
                  <Link to={`/claims/${claim.id}`} className="text-brand-700 hover:underline">Open claim</Link>
                  <Link to={`/suppliers/${supplier.id}?claim=${claim.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><BookOpen className="h-3 w-3" />SOP</Link>
                </div>
              </div>
            )}
            {claim && (
              <fieldset className="mt-4">
                <legend className="mb-1.5 text-sm font-medium text-slate-700">Template</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['submission', 'followup'] as EmailTemplate[]).map((t) => {
                    const disabled = t === 'followup' && !canFollowUp;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={disabled}
                        onClick={() => setParam('template', t === 'followup' ? 'followup' : '')}
                        className={cx('rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50', template === t ? 'border-brand-500 bg-brand-50 font-medium text-brand-800 ring-1 ring-brand-500' : 'border-slate-200 text-slate-700 hover:border-slate-300')}
                        title={disabled ? 'Available once the claim has been sent' : undefined}
                      >
                        {t === 'submission' ? 'Claim submission' : 'Follow-up reminder'}
                      </button>
                    );
                  })}
                </div>
                {template === 'followup' && claim.submission && (
                  <p className="mt-2 text-xs text-slate-500">Sent {daysSince(claim.submission.date)} days ago · usual response {supplier?.responseDays} days</p>
                )}
              </fieldset>
            )}
          </Card>

          {generated && template === 'submission' && (
            <Card title="2. Attach manually" action={missing.length ? <span className="text-xs font-medium text-amber-700">{missing.length} missing</span> : <span className="text-xs font-medium text-emerald-600">All ready</span>}>
              <ul className="space-y-2">
                {generated.attachments.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {a.missing ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                    <span className="min-w-0">
                      <span className="block text-slate-800">{a.label}</span>
                      <span className={cx('block truncate text-xs', a.missing ? 'text-amber-700' : 'text-slate-500')}>{a.file ?? 'Not uploaded yet'}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {missing.length > 0 && claim && (
                <Link to={`/claims/${claim.id}`} className="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline">Upload missing documents on the claim →</Link>
              )}
              <p className="mt-3 flex gap-1.5 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />This prototype never sends email or attaches files. Attach them in your email app.</p>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          {!generated ? (
            <Card><EmptyState icon={Mail} title="Choose a claim to generate its email">The supplier, invoice, product, amount and required documents are filled in for you.</EmptyState></Card>
          ) : (
            <Card
              title={template === 'followup' ? '3. Follow-up email' : '3. Review the draft'}
              icon={Mail}
              action={edited ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setDraft({ to: generated.to, cc: generated.cc, subject: generated.subject, body: generated.body })}>Reset to generated</Button> : <span className="text-xs text-slate-400">Everything is editable</span>}
            >
              {supplier?.submissionMethod !== 'Email' && template === 'submission' && (
                <div className="mb-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {supplier?.submissionMethod === 'Supplier Portal'
                      ? `${supplier.code} takes claims through its portal. Submit there first, then send this courtesy email with the portal reference.`
                      : `${supplier?.code} needs original documents by courier. Send the courier first, then email the scans with the docket number.`}
                  </span>
                </div>
              )}
              <div className="space-y-3">
                <Row label="To"><Input value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} /></Row>
                <Row label="Cc"><Input value={draft.cc} onChange={(e) => setDraft((d) => ({ ...d, cc: e.target.value }))} placeholder="Optional" /></Row>
                <Row label="Subject"><Input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} /></Row>
                <Textarea rows={22} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} className="font-mono text-[13px] leading-relaxed" aria-label="Email body" />
              </div>
              {/\[(TO ATTACH|portal reference|docket no\.)\]/.test(draft.subject + draft.body) && (
                <p className="mt-2 flex gap-1.5 text-xs text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Replace the text in [square brackets] before sending.</p>
              )}
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={Copy} onClick={copy}>Copy email</Button>
                  <Button variant="secondary" icon={ExternalLink} onClick={openMail}>Open in email app</Button>
                </div>
                {template === 'submission' && claim?.status === 'Not Claimed' && (
                  <Button icon={Send} onClick={() => setSendOpen(true)}>I've sent it – mark as sent</Button>
                )}
                {template === 'followup' && <Button icon={Send} onClick={markFollowUpSent}>I've sent the reminder</Button>}
                {template === 'submission' && claim && claim.status !== 'Not Claimed' && (
                  <span className="text-xs text-slate-500">This claim is already {claim.status.toLowerCase()}.</span>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {sendOpen && claim && <StatusModal claim={claim} target="Claim Sent" onClose={() => setSendOpen(false)} />}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      {children}
    </div>
  );
}
