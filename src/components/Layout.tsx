import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, FilePlus2, FileText, LayoutDashboard, Mail, Menu, RotateCcw, Scale, Search, X } from 'lucide-react';
import { useStore } from '../store/store';
import { useToast } from './Toast';
import { CURRENT_USER } from '../data/mock';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/claims', label: 'Claims', icon: FileText, end: true },
  { to: '/claims/new', label: 'New Claim', icon: FilePlus2, end: true },
  { to: '/suppliers', label: 'Supplier SOPs', icon: BookOpen },
  { to: '/reconciliation', label: 'Credit Notes', icon: Scale },
  { to: '/email', label: 'Email Drafts', icon: Mail },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" /></svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Kedia Pharmacy</p>
        <p className="text-xs text-brand-200">Claims Manager</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { claims, resetDemo } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const pending = claims.filter((c) => c.status === 'Not Claimed').length;

  useEffect(() => setOpen(false), [location.pathname]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/claims?q=${encodeURIComponent(q.trim())}`);
    setQ('');
  };

  const onReset = () => {
    if (window.confirm('Reset all demo data? Any claims, status changes and credit notes you added will be replaced with the original sample data.')) {
      resetDemo();
      toast('Demo data reset', 'Sample claims and credit notes restored.', 'info');
      navigate('/');
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="text-brand-200 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-white/10 text-white' : 'text-brand-100/80 hover:bg-white/5 hover:text-white')
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{label}</span>
            {to === '/claims' && pending > 0 && <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[11px] font-semibold text-amber-950" title="Claims not yet submitted">{pending}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-3 text-xs text-brand-100/80">
          <p className="font-medium text-white">Prototype mode</p>
          <p className="mt-1">Fictional data. Changes are saved in this browser only.</p>
          <button onClick={onReset} className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand-200 hover:text-white"><RotateCcw className="h-3.5 w-3.5" /> Reset demo data</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85%]">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <form onSubmit={onSearch} className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search claim ID, invoice, product…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{CURRENT_USER}</p>
              <p className="text-xs text-slate-500">Accounts · Claims desk</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">PS</div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
