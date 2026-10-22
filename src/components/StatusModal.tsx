import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { requiredDocsFor } from '../lib/calc';
import { useStore } from '../store/store';
import { useToast } from './Toast';
import { Button, Field, Input, Modal, Select, StatusBadge, Textarea } from './ui';
import { todayInput } from '../lib/format';
import type { Claim, ClaimStatus, SubmissionMethod } from '../types';

const METHODS: SubmissionMethod[] = ['Email', 'Supplier Portal', 'Courier + Email'];

const COPY: Record<ClaimStatus, { title: string; cta: string }> = {
  'Claim Sent': { title: 'Mark claim as sent', cta: 'Mark as sent' },
  'Claim Received': { title: 'Mark claim as received by supplier', cta: 'Mark as received' },
  Settled: { title: 'Mark as settled manually', cta: 'Mark as settled' },
  Rejected: { title: 'Mark claim as rejected', cta: 'Mark as rejected' },
  'Not Claimed': { title: 'Move back to Not Claimed', cta: 'Reopen claim' },
};

export default function StatusModal({ claim, target, onClose }: { claim: Claim; target: ClaimStatus | null; onClose: () => void }) {
  const { setStatus, supplier } = useStore();
  const toast = useToast();
  const sup = supplier(claim.supplierId);
  const [date, setDate] = useState(todayInput());
  const [method, setMethod] = useState<SubmissionMethod>(sup?.submissionMethod ?? 'Email');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (target) {
      setDate(todayInput());
      setMethod(sup?.submissionMethod ?? 'Email');
      setReference('');
      setReason('');
    }
  }, [target, sup]);

  if (!target) return null;
  const copy = COPY[target];
  const needsReason = target === 'Rejected' || target === 'Not Claimed' || target === 'Settled';
  // A warning, not a block: staff may have the paper copy even if it isn't uploaded here.
  const missingDocs = target === 'Claim Sent' ? requiredDocsFor(sup, claim.type).filter((r) => !claim.documents.some((d) => d.category === r.category)).map((r) => r.category) : [];

  const save = () => {
    setStatus(claim.id, target, { date, method, reference: reference.trim() || undefined, reason: reason.trim() || undefined });
    toast(`${claim.id} → ${target}`, target === 'Claim Sent' ? `Follow up if no reply within ${sup?.responseDays ?? 7} days.` : undefined);
    onClose();
  };

  const refLabel = target === 'Claim Sent' ? (method === 'Supplier Portal' ? 'Portal reference' : method === 'Courier + Email' ? 'Courier docket number' : 'Email reference (optional)') : 'Supplier acknowledgment reference';

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      subtitle={<span className="inline-flex items-center gap-2">{claim.id}: <StatusBadge status={claim.status} /> → <StatusBadge status={target} /></span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={target === 'Rejected' ? 'danger' : 'primary'} onClick={save} disabled={needsReason && !reason.trim()}>{copy.cta}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {missingDocs.length > 0 && (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {sup?.code} requires {missingDocs.length === 1 ? 'a document' : 'documents'} not uploaded here: <b>{missingDocs.join(', ')}</b>. Make sure you attached {missingDocs.length === 1 ? 'it' : 'them'} to the submission.
            </span>
          </div>
        )}
        {(target === 'Claim Sent' || target === 'Claim Received') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={target === 'Claim Sent' ? 'Date sent' : 'Date acknowledged'} required>
              <Input type="date" max={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {target === 'Claim Sent' && (
              <Field label="Submitted via" hint={sup ? `${sup.code} SOP: ${sup.submissionMethod}` : undefined}>
                <Select value={method} onChange={(e) => setMethod(e.target.value as SubmissionMethod)}>
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </Select>
              </Field>
            )}
            <Field label={refLabel} className="sm:col-span-2">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'Supplier Portal' && target === 'Claim Sent' ? 'e.g. SRC-448120' : 'Optional'} />
            </Field>
          </div>
        )}
        {needsReason && (
          <Field label={target === 'Rejected' ? 'Reason given by supplier' : 'Reason'} required>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={target === 'Rejected' ? 'e.g. Submitted after claim window' : target === 'Settled' ? 'e.g. Settled by cash adjustment, no credit note issued' : 'e.g. Wrong batch number, needs to be resubmitted'} />
          </Field>
        )}
        {target === 'Settled' && <p className="text-xs text-slate-500">Claims normally become “Settled” automatically when credit notes cover the full amount.</p>}
      </div>
    </Modal>
  );
}
