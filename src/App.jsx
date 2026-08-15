import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  FileStack,
  DollarSign,
  ShieldAlert,
  Gauge,
  Search,
  RadioTower,
  Inbox,
  Plus,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  paper: '#F7F3EA',
  paperLine: '#E7E0D0',
  ink: '#1B241F',
  inkSoft: '#5B6B62',
  forest: '#16332C',
  forestDeep: '#0F2521',
  jade: '#2F6F5A',
  lime: '#D8ED6E',
  limeDeep: '#A9C93E',
  coral: '#F2A25C',
  coralDeep: '#E27D3F',
  cream: '#FFFDF8',
};

const AVATAR_PALETTE = [
  { bg: '#E7EFC8', fg: '#3E5B27' },
  { bg: '#F6DCC0', fg: '#8A4B1F' },
  { bg: '#D9E7E2', fg: '#215048' },
  { bg: '#F0DDE6', fg: '#7A2E4C' },
  { bg: '#DCE3F5', fg: '#2C3E77' },
];

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const dateFmt = (d) => {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

const pct = (n) => `${Math.round((n ?? 0) * 100)}%`;

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '—';

const avatarColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
};

// ---------------------------------------------------------------------------
// Presentational Components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, variant }) {
  const styles = {
    cream: { bg: C.cream, border: `1px solid ${C.paperLine}`, ink: C.ink, sub: C.inkSoft, iconBg: '#EEF3E2', iconFg: C.jade },
    lime: { bg: `linear-gradient(155deg, ${C.lime}, ${C.limeDeep})`, border: 'none', ink: '#1F2E12', sub: '#3B4F22', iconBg: 'rgba(27,36,25,0.12)', iconFg: '#1F2E12' },
    coral: { bg: `linear-gradient(155deg, #F7C08B, ${C.coral})`, border: 'none', ink: '#4A2A0E', sub: '#6B4321', iconBg: 'rgba(74,42,14,0.14)', iconFg: '#4A2A0E' },
    forest: { bg: `linear-gradient(160deg, ${C.jade}, ${C.forestDeep})`, border: 'none', ink: '#FBFAF4', sub: '#BFD8C9', iconBg: 'rgba(255,255,255,0.14)', iconFg: '#EFF7E4' },
  }[variant];

  return (
    <div
      className="relative flex min-w-[190px] flex-1 flex-col justify-between rounded-3xl p-5"
      style={{ background: styles.bg, border: styles.border, boxShadow: '0 8px 24px -12px rgba(22,51,44,0.18)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: styles.sub }}>
          {label}
        </p>
        <div className="rounded-xl p-2" style={{ background: styles.iconBg }}>
          <Icon size={16} strokeWidth={2.25} style={{ color: styles.iconFg }} />
        </div>
      </div>
      <div className="mt-5">
        <p className="font-mono text-[28px] font-semibold leading-none tracking-tight" style={{ color: styles.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
          {value}
        </p>
        {sub && (
          <p className="mt-2 text-xs font-medium" style={{ color: styles.sub }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function RadialConfidence({ value, size = 46 }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const color = v >= 0.9 ? C.jade : v >= 0.7 ? C.limeDeep : C.coralDeep;
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.paperLine} strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - v)}
          strokeLinecap="round"
        />
      </svg>
      <span className="font-mono text-sm font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
        {pct(v)}
      </span>
    </div>
  );
}

function StampBadge({ status }) {
  const logged = status === 'LOGGED';
  const color = logged ? C.jade : C.coralDeep;
  return (
    <span
      className="inline-block select-none rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{
        color,
        border: `1.5px dashed ${color}`,
        transform: 'rotate(-4deg)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {logged ? 'Logged' : 'Review'}
    </span>
  );
}

function VendorAvatar({ name }) {
  const c = avatarColor(name || '');
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ background: c.bg, color: c.fg, fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {initials(name)}
    </div>
  );
}

function LedgerSkyline() {
  return (
    <svg viewBox="0 0 340 170" className="pointer-events-none absolute inset-x-0 bottom-0 w-full" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3E7A64" />
          <stop offset="1" stopColor="#2C5B49" />
        </linearGradient>
      </defs>
      <rect x="10" y="70" width="46" height="90" rx="6" fill="#1E4438" opacity="0.9" />
      <rect x="18" y="82" width="30" height="6" rx="2" fill="#D8ED6E" opacity="0.55" />
      <rect x="18" y="96" width="30" height="6" rx="2" fill="#D8ED6E" opacity="0.35" />
      <rect x="66" y="40" width="54" height="120" rx="6" fill="url(#sky1)" />
      <rect x="76" y="54" width="34" height="7" rx="2" fill="#F7F3EA" opacity="0.5" />
      <rect x="76" y="70" width="20" height="7" rx="2" fill="#F7F3EA" opacity="0.3" />
      <rect x="130" y="94" width="40" height="66" rx="6" fill="#1E4438" opacity="0.85" />
      <rect x="180" y="20" width="60" height="140" rx="8" fill="url(#sky1)" />
      <rect x="192" y="36" width="36" height="8" rx="2" fill="#F7F3EA" opacity="0.5" />
      <rect x="192" y="54" width="24" height="8" rx="2" fill="#F7F3EA" opacity="0.28" />
      <rect x="250" y="66" width="44" height="94" rx="6" fill="#1E4438" opacity="0.9" />
      <rect x="260" y="80" width="24" height="6" rx="2" fill="#D8ED6E" opacity="0.5" />
      <rect x="300" y="100" width="34" height="60" rx="6" fill="#2C5B49" />
      <ellipse cx="60" cy="160" rx="200" ry="14" fill="#0F2521" opacity="0.35" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Connected Component
// ---------------------------------------------------------------------------
const FILTERS = ['ALL', 'LOGGED', 'NEEDS_REVIEW'];

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState(false);

  // Initial fetch from Supabase
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .order('id', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setInvoices(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('invoices-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invoices' },
        (payload) => setInvoices((prev) => [payload.new, ...prev])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices' },
        (payload) => setInvoices((prev) => prev.map((inv) => (inv.id === payload.new.id ? payload.new : inv)))
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'invoices' },
        (payload) => setInvoices((prev) => prev.filter((inv) => inv.id !== payload.old.id))
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const metrics = useMemo(() => {
    const total = invoices.length;
    const spend = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const flagged = invoices.filter((i) => i.status === 'NEEDS_REVIEW').length;
    const avgConfidence = total === 0 ? 0 : invoices.reduce((s, i) => s + (Number(i.confidence) || 0), 0) / total;
    return { total, spend, flagged, avgConfidence };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesFilter = filter === 'ALL' || inv.status === filter;
      const matchesQuery = !q || inv.vendor?.toLowerCase().includes(q) || inv.invoice_number?.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [invoices, filter, query]);

  return (
    <div className="min-h-screen w-full" style={{ background: C.paper, fontFamily: "'Inter', sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
        rel="stylesheet"
      />

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.jade }}>
              <FileStack size={13} /> Automated Ledger
            </p>
            <h1 className="text-[32px] font-semibold leading-tight sm:text-[38px]" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>
              Invoice dashboard
            </h1>
            <p className="mt-1 text-sm" style={{ color: C.inkSoft }}>
              Everything n8n has read, sorted, and priced out this month.
            </p>
          </div>
          <div
            className="flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
            style={{ background: C.cream, border: `1px solid ${C.paperLine}`, color: C.inkSoft }}
          >
            <RadioTower size={13} style={{ color: connected ? C.jade : C.inkSoft }} />
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse' : ''}`} style={{ background: connected ? C.jade : C.coralDeep }} />
            {connected ? 'Live — watching for new invoices' : 'Connecting to database…'}
          </div>
        </header>

        {/* Body */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            {/* Stat Cards */}
            <section className="mb-6 flex flex-wrap gap-3.5">
              <StatCard label="Total invoices" value={metrics.total} sub="This month" icon={FileStack} variant="cream" />
              <StatCard label="Total spend" value={currency.format(metrics.spend)} sub="Across all vendors" icon={DollarSign} variant="lime" />
              <StatCard
                label="Flagged"
                value={metrics.flagged}
                sub={metrics.total > 0 ? `${Math.round((metrics.flagged / metrics.total) * 100)}% need a look` : '0% need a look'}
                icon={ShieldAlert}
                variant="coral"
              />
              <StatCard label="Avg. confidence" value={pct(metrics.avgConfidence)} sub="Extraction accuracy" icon={Gauge} variant="forest" />
            </section>

            {/* Filters + Search */}
            <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1 rounded-full p-1" style={{ background: C.cream, border: `1px solid ${C.paperLine}` }}>
                {FILTERS.map((f) => {
                  const active = filter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      style={{ background: active ? C.forest : 'transparent', color: active ? C.cream : C.inkSoft }}
                    >
                      {f === 'ALL' ? 'All' : f === 'LOGGED' ? 'Logged' : 'Needs review'}
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.inkSoft }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vendor or invoice #"
                  className="w-full rounded-full py-2 pl-9 pr-3 text-sm outline-none"
                  style={{ background: C.cream, border: `1px solid ${C.paperLine}`, color: C.ink }}
                />
              </div>
            </section>

            {/* Table */}
            <section className="overflow-hidden rounded-3xl" style={{ background: C.cream, border: `1px solid ${C.paperLine}` }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr style={{ background: '#EEF3E2' }}>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: C.jade }}>Vendor</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: C.jade }}>Due</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: C.jade }}>Amount</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: C.jade }}>Confidence</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: C.jade }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center" style={{ color: C.inkSoft }}>
                          <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                          Loading invoices from database…
                        </td>
                      </tr>
                    )}

                    {!loading && error && (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-red-600">
                          Error loading invoices: {error}
                        </td>
                      </tr>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center" style={{ color: C.inkSoft }}>
                          <Inbox size={20} className="mx-auto mb-2" style={{ color: C.paperLine }} />
                          No invoices match your filters.
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      !error &&
                      filtered.map((inv, idx) => (
                        <tr key={inv.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${C.paperLine}` }}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <VendorAvatar name={inv.vendor} />
                              <div>
                                <p className="font-medium" style={{ color: C.ink }}>{inv.vendor || '—'}</p>
                                <p className="font-mono text-xs" style={{ color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                                  {inv.invoice_number || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5" style={{ color: C.inkSoft }}>{dateFmt(inv.due_date)}</td>
                          <td className="px-5 py-3.5 text-right font-mono font-semibold" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {currency.format(Number(inv.amount) || 0)}
                          </td>
                          <td className="px-5 py-3.5">
                            <RadialConfidence value={Number(inv.confidence) || 0} />
                          </td>
                          <td className="px-5 py-3.5">
                            <StampBadge status={inv.status} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-5 py-3 text-xs" style={{ borderTop: `1px solid ${C.paperLine}`, color: C.inkSoft }}>
                <span>Showing {filtered.length} of {invoices.length}</span>
                <span className="flex items-center gap-1">
                  <ArrowUpRight size={12} style={{ color: C.jade }} />
                  {pct(metrics.avgConfidence)} avg. extraction confidence
                </span>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside
            className="relative flex h-fit flex-col overflow-hidden rounded-3xl p-5 pb-[190px]"
            style={{ background: `linear-gradient(175deg, ${C.forest}, ${C.forestDeep})`, minHeight: 420 }}
          >
            <div className="relative z-10 flex items-center justify-between">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(216,237,110,0.16)', color: C.lime }}>
                ● Synced via n8n
              </span>
            </div>

            <div className="relative z-10 mt-5 flex flex-col items-center text-center">
             <div className="relative z-10 mt-5 flex flex-col items-center text-center">
  <img 
    src="/logo.png" 
    alt="Company Logo" 
    className="h-20 w-100 object-contain rounded-full" 
  />
</div>
              
            </div>

            <div className="relative z-10 mt-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'rgba(247,243,234,0.65)' }}>Total Logged</span>
                <span className="font-mono text-sm font-semibold" style={{ color: C.cream, fontFamily: "'IBM Plex Mono', monospace" }}>{metrics.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'rgba(247,243,234,0.65)' }}>Awaiting review</span>
                <span className="font-mono text-sm font-semibold" style={{ color: C.lime, fontFamily: "'IBM Plex Mono', monospace" }}>{metrics.flagged}</span>
              </div>
            </div>

            <p className="relative z-10 mt-8 text-[15px] font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.cream }}>
              The Ledger Skyline
            </p>
            <p className="relative z-10 text-[11px] leading-snug" style={{ color: 'rgba(247,243,234,0.55)' }}>
              Every filed invoice adds a floor.
            </p>

            <LedgerSkyline />
          </aside>
        </div>
      </div>
    </div>
  );
}