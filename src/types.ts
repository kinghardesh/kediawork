export type ClaimType = 'Price Difference' | 'Expiry' | 'Damaged' | 'Short Supply';
export const CLAIM_TYPES: ClaimType[] = ['Price Difference', 'Expiry', 'Damaged', 'Short Supply'];

export type ClaimStatus = 'Not Claimed' | 'Claim Sent' | 'Claim Received' | 'Settled' | 'Rejected';
export const CLAIM_STATUSES: ClaimStatus[] = ['Not Claimed', 'Claim Sent', 'Claim Received', 'Settled', 'Rejected'];
/** The happy-path order shown in the status stepper. */
export const PIPELINE: ClaimStatus[] = ['Not Claimed', 'Claim Sent', 'Claim Received', 'Settled'];

export type SubmissionMethod = 'Email' | 'Supplier Portal' | 'Courier + Email';

export const DOC_CATEGORIES = [
  'Invoice copy',
  'Price agreement / scheme letter',
  'Expiry stock list',
  'Debit note',
  'Return challan',
  'Photos of damaged stock',
  'Goods received note',
  'Other',
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export interface Contact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface SopStep {
  title: string;
  detail: string;
}

export interface RequiredDoc {
  category: DocCategory;
  note?: string;
  /** If omitted the document is needed for every claim type. */
  forTypes?: ClaimType[];
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  city: string;
  submissionMethod: SubmissionMethod;
  claimsEmail: string;
  ccEmails: string[];
  portalUrl?: string;
  courierAddress?: string;
  contacts: Contact[];
  acceptedTypes: ClaimType[];
  requiredDocuments: RequiredDoc[];
  steps: SopStep[];
  /** Days after invoice date within which a claim must be submitted. */
  claimWindowDays: number;
  /** Typical days for the supplier to acknowledge a submitted claim. */
  responseDays: number;
  /** % of purchase value reimbursed on expiry claims. */
  expiryReimbursementPct: number;
  tips: string[];
  /** Subject line pattern from the SOP. Tokens: {invoice} {type} {claimId} {product}. */
  subjectFormat?: string;
}

export interface ClaimDocument {
  id: string;
  name: string;
  category: DocCategory;
  size: number;
  uploadedAt: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  user: string;
  action: string;
  detail?: string;
}

export interface Claim {
  id: string;
  supplierId: string;
  type: ClaimType;
  invoiceNo: string;
  invoiceDate: string;
  productName: string;
  batchNo: string;
  expiryDate?: string;
  quantity: number;
  /** Rate actually billed on the invoice (per unit, pre-GST). */
  invoiceRate: number;
  /** Agreed / special rate for price-difference claims (per unit, pre-GST). */
  agreedRate?: number;
  gstPct: number;
  amount: number;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  submission?: { date: string; method: SubmissionMethod; reference?: string };
  acknowledgment?: { date: string; reference?: string };
  rejectionReason?: string;
  documents: ClaimDocument[];
  notes: string;
  history: HistoryEntry[];
}

export interface Allocation {
  claimId: string;
  amount: number;
}

export interface CreditNote {
  id: string;
  cnNumber: string;
  supplierId: string;
  date: string;
  amount: number;
  allocations: Allocation[];
  notes?: string;
  createdAt: string;
}
