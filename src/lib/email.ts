import type { Claim, Supplier } from '../types';
import { balanceFor, calcForClaim, requiredDocsFor } from './calc';
import { daysSince, fmtDate, inrExact } from './format';
import type { CreditNote } from '../types';
import { CURRENT_USER } from '../data/mock';

export type EmailTemplate = 'submission' | 'followup';

export interface EmailDraft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachments: { label: string; file?: string; missing: boolean }[];
}

const SIGNATURE = `Regards,
${CURRENT_USER}
Accounts – Claims Desk
Kedia Pharmacy
+91 33 4000 1234`;

const DEFAULT_SUBJECT = 'Claim submission – {type} – Invoice {invoice} – {claimId}';

function subjectFor(c: Claim, s: Supplier) {
  return (s.subjectFormat ?? DEFAULT_SUBJECT)
    .replace('{invoice}', c.invoiceNo)
    .replace('{type}', c.type)
    .replace('{claimId}', c.id)
    .replace('{product}', c.productName);
}

/** For portal suppliers the claim itself goes through the portal, so the email is a courtesy note to the named contact. */
function recipient(s: Supplier) {
  return s.submissionMethod === 'Supplier Portal' ? s.contacts[0]?.email ?? s.claimsEmail : s.claimsEmail;
}

function reasonLine(c: Claim, s: Supplier) {
  switch (c.type) {
    case 'Price Difference':
      return `The invoice was billed at ${inrExact(c.invoiceRate)} per unit against the agreed scheme rate of ${inrExact(c.agreedRate ?? 0)}. We request a credit note for the difference.`;
    case 'Expiry':
      return `The stock below expired before it could be sold. As per your policy of ${s.expiryReimbursementPct}% reimbursement on expired stock, we request a credit note for the amount below.`;
    case 'Damaged':
      return 'The goods below were received in damaged condition and cannot be sold. We request a credit note for their value.';
    case 'Short Supply':
      return `We received ${c.quantity.toLocaleString('en-IN')} units fewer than invoiced. We request a credit note for the short-supplied quantity.`;
  }
}

export function buildEmail(c: Claim, s: Supplier, cns: CreditNote[], template: EmailTemplate): EmailDraft {
  const greetingName = s.submissionMethod === 'Supplier Portal' ? s.contacts[0]?.name.split(' ')[0] ?? 'Team' : 'Team';
  const calc = calcForClaim(c, s);
  const required = requiredDocsFor(s, c.type);
  const attachments = required.map((r) => {
    const doc = c.documents.find((d) => d.category === r.category);
    return { label: r.category, file: doc?.name, missing: !doc };
  });
  // Extra uploaded files that are not on the SOP list still get attached.
  for (const d of c.documents) if (!required.some((r) => r.category === d.category)) attachments.push({ label: d.category, file: d.name, missing: false });

  const subject = subjectFor(c, s);
  const to = recipient(s);
  const cc = s.submissionMethod === 'Supplier Portal' ? '' : s.ccEmails.join(', ');

  if (template === 'followup') {
    const sent = c.submission;
    const bal = balanceFor(c, cns);
    const waited = sent ? daysSince(sent.date) : 0;
    const stage = c.status === 'Claim Received'
      ? `You acknowledged the claim${c.acknowledgment ? ` on ${fmtDate(c.acknowledgment.date)}` : ''}, but ${bal.credited > 0 ? `only ${inrExact(bal.credited)} has been credited so far. The outstanding balance is ${inrExact(bal.outstanding)}.` : 'we have not yet received the credit note.'}`
      : 'We have not yet received an acknowledgment.';
    const body = `Dear ${greetingName},

This is a gentle reminder about our claim ${c.id}, submitted on ${sent ? fmtDate(sent.date) : '[date]'} via ${sent?.method ?? s.submissionMethod}${sent?.reference ? ` (reference ${sent.reference})` : ''}.

Invoice: ${c.invoiceNo} dated ${fmtDate(c.invoiceDate)}
Product: ${c.productName} – Batch ${c.batchNo}
Claim type: ${c.type}
Claim value: ${inrExact(c.amount)}

It has been ${waited} days since submission. ${stage}

Could you please share an update on the status of this claim?

${SIGNATURE}`;
    // The courier docket is known once the claim was sent, so fill the SOP placeholder with it.
    const docket = sent?.reference ? sent.reference.replace(/^Docket\s*/i, '') : null;
    const filledSubject = docket ? subject.replace('[docket no.]', docket) : subject;
    return { to, cc, subject: `Reminder: ${filledSubject}`, body, attachments: [] };
  }

  const lines = [
    `Claim reference: ${c.id}`,
    `Invoice: ${c.invoiceNo} dated ${fmtDate(c.invoiceDate)}`,
    `Product: ${c.productName}`,
    `Batch: ${c.batchNo}${c.expiryDate ? ` (expiry ${fmtDate(c.expiryDate)})` : ''}`,
    `Quantity: ${c.quantity.toLocaleString('en-IN')} units`,
    ...calc.lines.map((l) => `${l.label}: ${inrExact(l.value)}${l.formula ? ` (${l.formula})` : ''}`),
    `Total claim value: ${inrExact(c.amount)}`,
  ];

  const docList = attachments.map((a, i) => `${i + 1}. ${a.label}${a.file ? ` – ${a.file}` : ' – [TO ATTACH]'}`).join('\n');

  const channel =
    s.submissionMethod === 'Supplier Portal'
      ? `\nWe have submitted this claim on your partner portal (reference: [portal reference]). This email is for your reference so it can be picked up quickly.\n`
      : s.submissionMethod === 'Courier + Email'
        ? `\nThe original signed documents have been sent by courier to your Claims Cell (docket no: [docket no.]). Scanned copies are attached.\n`
        : '';

  const body = `Dear ${greetingName},

Greetings from Kedia Pharmacy.

${reasonLine(c, s)}

${lines.join('\n')}
${channel}
Attached documents:
${docList}

Kindly acknowledge receipt of this claim and share the credit note at the earliest.

${SIGNATURE}`;

  return { to, cc, subject, body, attachments };
}

export function mailtoUrl(d: Pick<EmailDraft, 'to' | 'cc' | 'subject' | 'body'>) {
  const q = [d.cc && `cc=${encodeURIComponent(d.cc)}`, `subject=${encodeURIComponent(d.subject)}`, `body=${encodeURIComponent(d.body)}`].filter(Boolean).join('&');
  return `mailto:${d.to}?${q}`;
}
