import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, Calculator, Info, Save } from 'lucide-react';
import { useStore } from '../store/store';
import { useToast } from '../components/Toast';
import { calculateClaim, requiredDocsFor } from '../lib/calc';
import { daysSince, inrExact, todayInput } from '../lib/format';
import { PRODUCT_CATALOGUE } from '../data/mock';
import { Button, Card, cx, Field, Input, PageHeader, Pill, Select, Textarea } from '../components/ui';
import { DocumentList, DocumentUploader, RequiredChecklist } from '../components/Documents';
import { CLAIM_TYPES, type ClaimDocument, type ClaimType } from '../types';
import NotFound from './NotFound';

interface FormState {
  supplierId: string;
  type: ClaimType;
  invoiceNo: string;
  invoiceDate: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  quantity: string;
  invoiceRate: string;
  agreedRate: string;
  gstPct: string;
  notes: string;
}

const TYPE_HELP: Record<ClaimType, string> = {
  'Price Difference': 'Supplier billed above the agreed / scheme rate.',
  Expiry: 'Stock expired before it could be sold.',
  Damaged: 'Stock arrived broken, leaking or unusable.',
  'Short Supply': 'Fewer units received than invoiced.',
};

export default function ClaimForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = id ? store.claim(id) : undefined;

  const [f, setF] = useState<FormState>(() =>
    editing
      ? {
          supplierId: editing.supplierId, type: editing.type, invoiceNo: editing.invoiceNo, invoiceDate: editing.invoiceDate, productName: editing.productName,
          batchNo: editing.batchNo, expiryDate: editing.expiryDate ?? '', quantity: String(editing.quantity), invoiceRate: String(editing.invoiceRate),
          agreedRate: editing.agreedRate !== undefined ? String(editing.agreedRate) : '', gstPct: String(editing.gstPct), notes: editing.notes,
        }
      : {
          supplierId: params.get('supplier') ?? '', type: 'Price Difference', invoiceNo: '', invoiceDate: '', productName: '', batchNo: '', expiryDate: '',
          quantity: '', invoiceRate: '', agreedRate: '', gstPct: '12', notes: '',
        },
  );
  const [docs, setDocs] = useState<ClaimDocument[]>(editing?.documents ?? []);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const supplier = store.supplier(f.supplierId);
  const required = requiredDocsFor(supplier, f.type);
  const calc = useMemo(
    () => calculateClaim({ type: f.type, quantity: Number(f.quantity), invoiceRate: Number(f.invoiceRate), agreedRate: Number(f.agreedRate), gstPct: Number(f.gstPct), expiryReimbursementPct: supplier?.expiryReimbursementPct }),
    [f, supplier],
  );
  const typeNotAccepted = supplier && !supplier.acceptedTypes.includes(f.type);
  const windowLeft = supplier && f.invoiceDate ? supplier.claimWindowDays - daysSince(f.invoiceDate) : null;

  if (id && !editing) return <NotFound what="Claim" />;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (submitted) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!f.supplierId) e.supplierId = 'Choose the supplier';
    if (!f.invoiceNo.trim()) e.invoiceNo = 'Enter the invoice number';
    if (!f.invoiceDate) e.invoiceDate = 'Enter the invoice date';
    else if (f.invoiceDate > todayInput()) e.invoiceDate = 'Invoice date cannot be in the future';
    if (!f.productName.trim()) e.productName = 'Enter the product';
    if (!f.batchNo.trim()) e.batchNo = 'Enter the batch number';
    if (!(Number(f.quantity) > 0)) e.quantity = 'Quantity must be more than 0';
    if (!(Number(f.invoiceRate) > 0)) e.invoiceRate = 'Enter the rate billed on the invoice';
    if (f.type === 'Price Difference') {
      if (f.agreedRate === '' || !(Number(f.agreedRate) >= 0)) e.agreedRate = 'Enter the agreed / scheme rate';
      else if (Number(f.agreedRate) >= Number(f.invoiceRate)) e.agreedRate = 'Agreed rate must be lower than the invoice rate';
    }
    if (f.type === 'Expiry' && !f.expiryDate) e.expiryDate = 'Enter the expiry date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = (ev: FormEvent, another = false) => {
    ev.preventDefault();
    setSubmitted(true);
    if (!validate()) {
      toast('Please fix the highlighted fields', undefined, 'info');
      return;
    }
    const payload = {
      supplierId: f.supplierId, type: f.type, invoiceNo: f.invoiceNo.trim(), invoiceDate: f.invoiceDate, productName: f.productName.trim(), batchNo: f.batchNo.trim().toUpperCase(),
      expiryDate: f.expiryDate || undefined, quantity: Number(f.quantity), invoiceRate: Number(f.invoiceRate),
      agreedRate: f.type === 'Price Difference' ? Number(f.agreedRate) : undefined, gstPct: Number(f.gstPct), amount: calc.total, notes: f.notes.trim(), documents: docs,
    };
    if (editing) {
      const labels: [keyof typeof payload, string][] = [['supplierId', 'supplier'], ['type', 'type'], ['invoiceNo', 'invoice no'], ['invoiceDate', 'invoice date'], ['productName', 'product'], ['batchNo', 'batch'], ['expiryDate', 'expiry'], ['quantity', 'quantity'], ['invoiceRate', 'invoice rate'], ['agreedRate', 'agreed rate'], ['gstPct', 'GST'], ['notes', 'notes']];
      const changed = labels.filter(([k]) => String(payload[k] ?? '') !== String(editing[k] ?? '')).map(([, l]) => l);
      if (payload.amount !== editing.amount) changed.push(`amount ${inrExact(editing.amount)} → ${inrExact(payload.amount)}`);
      if (docs.length !== editing.documents.length || docs.some((d, i) => d.category !== editing.documents[i]?.category)) changed.push('documents');
      store.updateClaim(editing.id, payload, changed.length ? `Updated ${changed.join(', ')}` : 'No field changes');
      toast('Claim updated', `${editing.id} saved.`);
      navigate(`/claims/${editing.id}`);
      return;
    }
    const newId = store.addClaim(payload);
    toast('Claim created', `${newId} added to the claims table as “Not Claimed”.`);
    if (another) {
      setF((p) => ({ ...p, productName: '', batchNo: '', expiryDate: '', quantity: '', invoiceRate: '', agreedRate: '', notes: '' }));
      setDocs((d) => d.filter((x) => x.category === 'Invoice copy' || x.category === 'Debit note'));
      setSubmitted(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else navigate(`/claims/${newId}`);
  };

  return (
    <form onSubmit={(e) => onSubmit(e)} noValidate>
      <PageHeader
        back={<Link to={editing ? `/claims/${editing.id}` : '/claims'} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> {editing ? `Back to ${editing.id}` : 'Back to claims'}</Link>}
        title={editing ? `Edit ${editing.id}` : 'New claim'}
        subtitle={editing ? 'Changes are recorded in the claim history.' : 'Fill in the invoice and product details. The claim value is calculated for you.'}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={<><Step n={1} /> Supplier & claim type</>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Supplier" required error={errors.supplierId}>
                <Select value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                  <option value="">Select supplier…</option>
                  {store.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="GST rate" hint="As shown on the invoice">
                <Select value={f.gstPct} onChange={(e) => set('gstPct', e.target.value)}>
                  {['0', '5', '12', '18'].map((g) => <option key={g} value={g}>{g}%</option>)}
                </Select>
              </Field>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-slate-700">Claim type <span className="text-red-500">*</span></legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CLAIM_TYPES.map((t) => {
                  const blocked = supplier && !supplier.acceptedTypes.includes(t);
                  return (
                    <label key={t} className={cx('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition', f.type === t ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300', blocked && 'opacity-60')}>
                      <input type="radio" name="type" className="mt-0.5 accent-brand-600" checked={f.type === t} onChange={() => set('type', t)} />
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{t}</span>
                        <span className="block text-xs text-slate-500">{blocked ? `Not accepted by ${supplier?.code}` : TYPE_HELP[t]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {typeNotAccepted && (
              <Alert tone="red">{supplier!.name} does not accept {f.type.toLowerCase()} claims. Check the <Link className="font-medium underline" to={`/suppliers/${supplier!.id}`}>supplier SOP</Link>.</Alert>
            )}
          </Card>

          <Card title={<><Step n={2} /> Invoice details</>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Invoice number" required error={errors.invoiceNo} hint={supplier ? `e.g. ${supplier.code}/26/01234` : undefined}>
                <Input value={f.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} placeholder="Exactly as printed on invoice" />
              </Field>
              <Field label="Invoice date" required error={errors.invoiceDate}>
                <Input type="date" max={todayInput()} value={f.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} />
              </Field>
            </div>
            {windowLeft !== null && (
              windowLeft < 0 ? <Alert tone="red">This invoice is {-windowLeft} days past {supplier!.code}'s {supplier!.claimWindowDays}-day claim window. The supplier may reject it — get approval first.</Alert>
                : windowLeft <= 15 ? <Alert tone="amber">Only {windowLeft} days left in {supplier!.code}'s claim window. Submit soon.</Alert>
                : <p className="mt-3 text-xs text-slate-500">{windowLeft} days left in {supplier!.code}'s {supplier!.claimWindowDays}-day claim window.</p>
            )}
          </Card>

          <Card title={<><Step n={3} /> Product details</>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product" required error={errors.productName} className="sm:col-span-2">
                <Input list="products" value={f.productName} onChange={(e) => set('productName', e.target.value)} placeholder="Start typing to search the catalogue" />
                <datalist id="products">{PRODUCT_CATALOGUE.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Batch number" required error={errors.batchNo}>
                <Input value={f.batchNo} onChange={(e) => set('batchNo', e.target.value)} placeholder="e.g. PV24J11" />
              </Field>
              <Field label="Expiry date" required={f.type === 'Expiry'} error={errors.expiryDate}>
                <Input type="date" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
              </Field>
              <Field label={f.type === 'Short Supply' ? 'Units short' : f.type === 'Damaged' ? 'Units damaged' : f.type === 'Expiry' ? 'Units expired' : 'Quantity billed'} required error={errors.quantity}>
                <Input type="number" min={1} inputMode="numeric" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="0" />
              </Field>
              <Field label="Invoice rate (₹ per unit, excl. GST)" required error={errors.invoiceRate}>
                <Input type="number" min={0} step="0.01" inputMode="decimal" value={f.invoiceRate} onChange={(e) => set('invoiceRate', e.target.value)} placeholder="0.00" />
              </Field>
              {f.type === 'Price Difference' && (
                <Field label="Agreed / scheme rate (₹ per unit)" required error={errors.agreedRate} hint="From the price agreement or scheme letter">
                  <Input type="number" min={0} step="0.01" inputMode="decimal" value={f.agreedRate} onChange={(e) => set('agreedRate', e.target.value)} placeholder="0.00" />
                </Field>
              )}
            </div>
          </Card>

          <Card title={<><Step n={4} /> Supporting documents</>}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <DocumentUploader required={required} onAdd={(d) => setDocs((p) => [...p, ...d])} />
                <DocumentList docs={docs} onRemove={(id) => setDocs((p) => p.filter((d) => d.id !== id))} onRecategorize={(id, c) => setDocs((p) => p.map((d) => (d.id === id ? { ...d, category: c } : d)))} />
              </div>
              {supplier ? <RequiredChecklist required={required} docs={docs} /> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Select a supplier to see which documents they require.</p>}
            </div>
          </Card>

          <Card title={<><Step n={5} /> Notes</>}>
            <Textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything the team should know — e.g. who approved the special rate, warehouse remarks…" />
          </Card>
        </div>

        {/* Sticky calculation panel */}
        <div className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card title="Claim calculation" icon={Calculator}>
              <dl className="space-y-2.5 text-sm">
                {calc.lines.map((l) => (
                  <div key={l.label} className="flex items-start justify-between gap-3">
                    <dt className="text-slate-600">
                      {l.label}
                      {l.formula && <span className="block text-xs text-slate-400">{l.formula}</span>}
                    </dt>
                    <dd className="num whitespace-nowrap font-medium text-slate-800">{inrExact(l.value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4">
                <span className="text-sm font-medium text-slate-700">Total claim value</span>
                <span className={cx('num text-2xl font-semibold', calc.valid ? 'text-brand-700' : 'text-slate-300')}>{inrExact(calc.total)}</span>
              </div>
              {f.type === 'Expiry' && supplier && (
                <p className="mt-3 flex gap-1.5 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {supplier.code} reimburses {supplier.expiryReimbursementPct}% of expired stock value.</p>
              )}
              <p className="mt-3 text-xs text-slate-400">Simulated calculation for the prototype. Final value is confirmed by the supplier's credit note.</p>
            </Card>

            {supplier && (
              <Card>
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-800">{supplier.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill>{supplier.submissionMethod}</Pill>
                      <Pill>{supplier.claimWindowDays}-day window</Pill>
                    </div>
                    <Link to={`/suppliers/${supplier.id}`} target="_blank" className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">Open claim procedure ↗</Link>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex flex-col gap-2">
              <Button type="submit" icon={Save} disabled={!!typeNotAccepted}>{editing ? 'Save changes' : 'Save claim'}</Button>
              {!editing && <Button type="button" variant="secondary" disabled={!!typeNotAccepted} onClick={(e) => onSubmit(e, true)}>Save & add another from same invoice</Button>}
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
            {submitted && Object.values(errors).some(Boolean) && (
              <Alert tone="red">{Object.values(errors).filter(Boolean).length} field(s) need attention.</Alert>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{n}</span>;
}

function Alert({ tone, children }: { tone: 'red' | 'amber'; children: React.ReactNode }) {
  return (
    <div className={cx('mt-3 flex gap-2 rounded-lg p-3 text-sm', tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
