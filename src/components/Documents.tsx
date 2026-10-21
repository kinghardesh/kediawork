import { useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, Circle, FileImage, FileSpreadsheet, FileText, Trash2, UploadCloud } from 'lucide-react';
import { DOC_CATEGORIES, type ClaimDocument, type DocCategory, type RequiredDoc } from '../types';
import { fileSize, fmtDate, uid } from '../lib/format';
import { cx, Select } from './ui';

/** Guess a category from the file name so staff rarely need to change it. */
function guessCategory(name: string, fallback: DocCategory): DocCategory {
  const n = name.toLowerCase();
  if (/invoice|inv[_-]/.test(n)) return 'Invoice copy';
  if (/debit|dn[_-]/.test(n)) return 'Debit note';
  if (/scheme|agreement|rate|circular/.test(n)) return 'Price agreement / scheme letter';
  if (/expir|ex2/.test(n)) return 'Expiry stock list';
  if (/challan|return/.test(n)) return 'Return challan';
  if (/grn|receiv/.test(n)) return 'Goods received note';
  if (/\.(jpe?g|png|heic|webp)$/.test(n) || /photo|damage/.test(n)) return 'Photos of damaged stock';
  return fallback;
}

const iconFor = (name: string) => (/\.(jpe?g|png|heic|webp)$/i.test(name) ? FileImage : /\.(xlsx?|csv)$/i.test(name) ? FileSpreadsheet : FileText);

export function DocumentUploader({ onAdd, required }: { onAdd: (docs: ClaimDocument[]) => void; required: RequiredDoc[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [category, setCategory] = useState<DocCategory | 'auto'>('auto');

  const handle = (files: FileList | null) => {
    if (!files?.length) return;
    const fallback = required[0]?.category ?? 'Other';
    onAdd(
      Array.from(files).map((f) => ({
        id: uid('doc-'),
        name: f.name,
        size: f.size,
        category: category === 'auto' ? guessCategory(f.name, fallback) : category,
        uploadedAt: new Date().toISOString(),
      })),
    );
    if (input.current) input.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handle(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        className={cx('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition', drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50')}
      >
        <UploadCloud className="h-7 w-7 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">Drop files here or <span className="text-brand-700">browse</span></p>
        <p className="mt-0.5 text-xs text-slate-500">PDF, images or Excel. Only file names are stored in this prototype.</p>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => handle(e.target.files)} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span>File type:</span>
        <Select value={category} onChange={(e) => setCategory(e.target.value as DocCategory | 'auto')} className="!w-auto !py-1 text-xs">
          <option value="auto">Detect from file name</option>
          {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>
    </div>
  );
}

export function DocumentList({ docs, onRemove, onRecategorize }: { docs: ClaimDocument[]; onRemove?: (id: string) => void; onRecategorize?: (id: string, c: DocCategory) => void }) {
  if (!docs.length) return <p className="py-2 text-sm text-slate-500">No documents uploaded yet.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {docs.map((d) => {
        const Icon = iconFor(d.name);
        return (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
            <Icon className="h-5 w-5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
              {onRecategorize ? (
                <select value={d.category} onChange={(e) => onRecategorize(d.id, e.target.value as DocCategory)} className="mt-0.5 rounded border-none bg-transparent p-0 text-xs text-slate-500 focus:ring-0" aria-label="Document type">
                  {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <p className="text-xs text-slate-500">{d.category} · {fileSize(d.size)} · {fmtDate(d.uploadedAt)}</p>
              )}
            </div>
            {onRemove && (
              <button type="button" onClick={() => onRemove(d.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${d.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RequiredChecklist({ required, docs }: { required: RequiredDoc[]; docs: ClaimDocument[] }) {
  if (!required.length) return null;
  const done = required.filter((r) => docs.some((d) => d.category === r.category)).length;
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier requires · {done}/{required.length}</p>
      <ul className="space-y-1.5">
        {required.map((r) => {
          const ok = docs.some((d) => d.category === r.category);
          return (
            <li key={r.category} className="flex items-start gap-2 text-sm">
              {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
              <span className={ok ? 'text-slate-700' : 'text-slate-600'}>
                {r.category}
                {r.note && <span className="block text-xs text-slate-400">{r.note}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
