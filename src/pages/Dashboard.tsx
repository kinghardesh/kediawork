import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock, FilePlus2, FileText, IndianRupee, Send, Wallet } from 'lucide-react';
import { useStore } from '../store/store';
import { attentionItems, balanceFor } from '../lib/calc';
import { inr, inrCompact, relativeTime } from '../lib/format';
import { Card, cx, EmptyState, LinkButton, PageHeader, STATUS_STYLE } from '../components/ui';
import { PIPELINE, type ClaimStatus } from '../types';

function Kpi({ label, value, sub, icon: Icon, tone, to }: { label: string; value: string; sub: string; icon: typeof FileText; tone: string; to: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cx('rounded-lg p-1.5', tone)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="num mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Link>
  );
}

export default function Dashboard() {
  const { claims, creditNotes, suppliers, supplier } = useStore();

  const stats = useMemo(() => {
    const live = claims.filter((c) => c.status !== 'Rejected');
    const by = (s: ClaimStatus) => claims.filter((c) => c.status === s);
    const sum = (xs: typeof claims) => xs.reduce((t, c) => t + c.amount, 0);
    const submitted = live.filter((c) => c.status !== 'Not Claimed');
    const outstanding = submitted.reduce((t, c) => t + balanceFor(c, creditNotes).outstanding, 0);
    const credited = creditNotes.reduce((t, cn) => t + cn.amount, 0);
    return {
      total: claims.length,
      totalValue: sum(live),
      pending: by('Not Claimed'),
      pendingValue: sum(by('Not Claimed')),
      settled: by('Settled'),
      settledValue: sum(by('Settled')),
      outstanding,
      awaiting: submitted.filter((c) => c.status !== 'Settled').length,
      credited,
      counts: Object.fromEntries(PIPELINE.map((s) => [s, by(s).length])) as Record<ClaimStatus, number>,
      values: Object.fromEntries(PIPELINE.map((s) => [s, sum(by(s))])) as Record<ClaimStatus, number>,
    };
  }, [claims, creditNotes]);

  const bySupplier = useMemo(
    () =>
      suppliers
        .map((s) => {
          const mine = claims.filter((c) => c.supplierId === s.id && c.status !== 'Not Claimed' && c.status !== 'Rejected');
          return { name: s.code, full: s.name, outstanding: Math.round(mine.reduce((t, c) => t + balanceFor(c, creditNotes).outstanding, 0)) };
        })
        .filter((x) => x.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding),
    [claims, creditNotes, suppliers],
  );

  const attention = useMemo(() => attentionItems(claims, suppliers, creditNotes), [claims, suppliers, creditNotes]);

  const activity = useMemo(
    () =>
      claims
        .flatMap((c) => c.history.map((h) => ({ ...h, claimId: c.id, supplierId: c.supplierId })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 8),
    [claims],
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, Priya`}
        subtitle={`${stats.pending.length} claims waiting to be submitted · ${attention.filter((a) => a.severity === 'high').length} urgent items`}
        actions={<LinkButton to="/claims/new" icon={FilePlus2}>New claim</LinkButton>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Total claims" value={String(stats.total)} sub={`${inr(stats.totalValue)} claimed (excl. rejected)`} icon={FileText} tone="bg-slate-100 text-slate-600" to="/claims" />
        <Kpi label="Pending submission" value={String(stats.pending.length)} sub={`${inr(stats.pendingValue)} not yet claimed`} icon={Clock} tone="bg-slate-100 text-slate-600" to="/claims?status=Not%20Claimed" />
        <Kpi label="Awaiting settlement" value={String(stats.awaiting)} sub="Sent or acknowledged" icon={Send} tone="bg-blue-50 text-blue-600" to="/claims?status=Awaiting" />
        <Kpi label="Settled" value={String(stats.settled.length)} sub={`${inr(stats.settledValue)} fully credited`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" to="/claims?status=Settled" />
        <Kpi label="Outstanding balance" value={inr(stats.outstanding)} sub="Owed by suppliers on submitted claims" icon={Wallet} tone="bg-amber-50 text-amber-600" to="/reconciliation" />
      </div>

      {/* Pipeline */}
      <Card className="mt-6" title="Claim pipeline" icon={Activity} action={<Link to="/claims" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {PIPELINE.map((s, i) => (
            <Link key={s} to={`/claims?status=${encodeURIComponent(s)}`} className="relative rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/30">
              <div className="flex items-center gap-2">
                <span className={cx('h-2 w-2 rounded-full', STATUS_STYLE[s].dot)} />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {i + 1}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-800">{s}</p>
              <p className="num mt-1 text-2xl font-semibold text-slate-900">{stats.counts[s]}</p>
              <p className="num text-xs text-slate-500">{inr(stats.values[s])}</p>
              {i < PIPELINE.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white text-slate-300 md:block" />}
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={`Needs attention (${attention.length})`} icon={AlertTriangle} padded={false}>
          {attention.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up">Nothing needs action right now.</EmptyState>
          ) : (
            <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link to={a.title === 'Follow up with supplier' ? `/email?claim=${a.claim.id}&template=followup` : `/claims/${a.claim.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.severity === 'high' ? 'bg-red-500' : 'bg-amber-400')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="truncate text-xs text-slate-500">{a.detail}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-brand-700">{a.claim.id}</p>
                      <p className="text-xs text-slate-400">{supplier(a.claim.supplierId)?.code} · {inr(a.claim.amount)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2" title="Outstanding by supplier" icon={IndianRupee}>
          {bySupplier.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing outstanding" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySupplier} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={inrCompact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={44} tick={{ fontSize: 12, fill: '#334155', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(v: number) => [inr(v), 'Outstanding']}
                    labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="outstanding" fill="#2a9888" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Submitted claims minus credit notes received. Record credit notes on the Credit Notes page to reduce these balances.</p>
        </Card>
      </div>

      <Card className="mt-6" title="Recent activity" icon={Activity} padded={false}>
        <ul className="divide-y divide-slate-100">
          {activity.map((h) => (
            <li key={h.id + h.claimId} className="flex items-start gap-3 px-5 py-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                {h.user === 'System' ? 'SY' : h.user.split(' ').map((p) => p[0]).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{h.user}</span> · {h.action} on{' '}
                  <Link to={`/claims/${h.claimId}`} className="font-medium text-brand-700 hover:underline">{h.claimId}</Link>
                </p>
                {h.detail && <p className="truncate text-xs text-slate-500">{h.detail}</p>}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{relativeTime(h.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
