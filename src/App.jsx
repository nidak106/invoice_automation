// src/App.jsx
//
// SETUP
// -----
// 1. npm install @supabase/supabase-js lucide-react
// 2. Create src/supabaseClient.js (see the file provided alongside this one)
//    and add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to your .env file.
// 3. Make sure the `invoices` table has Realtime replication enabled in
//    Supabase (Database -> Replication -> invoices -> ON), otherwise the
//    live-update subscription below will silently receive nothing.
// 4. Drop this file in as src/App.jsx. Tailwind is assumed to be configured
//    (the default `npm create vite@latest -- --template react` + Tailwind
//    setup works fine — no custom theme config required).

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  FileStack,
  DollarSign,
  ShieldAlert,
  Gauge,
  Search,
  RadioTower,
  ArrowUpRight,
  ArrowDownRight,
  Inbox,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const dateFmt = (d) => {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const pct = (n) => `${Math.round((n ?? 0) * 100)}%`;

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function KpiCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/60 bg-[#1e293b] p-5 transition-colors hover:border-slate-600">
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20 ${accent.glow}`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-50">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${accent.bg}`}>
          <Icon size={18} className={accent.text} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const isLogged = status === 'LOGGED';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        isLogged
          ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
          : 'bg-amber-500/10 text-amber-400 ring-amber-500/30'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isLogged ? 'bg-emerald-400' : 'bg-amber-400'
        }`}
      />
      {isLogged ? 'Logged' : 'Needs Review'}
    </span>
  );
}

function ConfidenceReadout({ value }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const color =
    v >= 0.95 ? 'bg-emerald-400' : v >= 0.8 ? 'bg-indigo-400' : 'bg-amber-400';
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 font-mono text-sm tabular-nums text-slate-200">
        {pct(v)}
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

const FILTERS = ['ALL', 'LOGGED', 'NEEDS_REVIEW'];

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState(false);
  const [freshIds, setFreshIds] = useState(() => new Set());

  // Initial fetch --------------------------------------------------------
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

  // Realtime subscription --------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel('invoices-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invoices' },
        (payload) => {
          setInvoices((prev) => [payload.new, ...prev]);
          setFreshIds((prev) => new Set(prev).add(payload.new.id));
          setTimeout(() => {
            setFreshIds((prev) => {
              const next = new Set(prev);
              next.delete(payload.new.id);
              return next;
            });
          }, 4000);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices' },
        (payload) => {
          setInvoices((prev) =>
            prev.map((inv) => (inv.id === payload.new.id ? payload.new : inv))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'invoices' },
        (payload) => {
          setInvoices((prev) => prev.filter((inv) => inv.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Derived data ------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = invoices.length;
    const spend = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const flagged = invoices.filter((i) => i.status === 'NEEDS_REVIEW').length;
    const avgConfidence =
      total === 0
        ? 0
        : invoices.reduce((sum, i) => sum + (Number(i.confidence) || 0), 0) / total;
    return { total, spend, flagged, avgConfidence };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesFilter = filter === 'ALL' || inv.status === filter;
      const matchesQuery =
        q.length === 0 ||
        inv.vendor?.toLowerCase().includes(q) ||
        inv.invoice_number?.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [invoices, filter, query]);

  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 antialiased">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
              <FileStack size={14} /> Automated Ledger
            </p>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
              Invoice Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-[#1e293b] px-3 py-1.5 text-xs text-slate-400">
            <RadioTower
              size={14}
              className={connected ? 'text-emerald-400' : 'text-slate-500'}
            />
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            {connected ? 'Live — watching for new invoices' : 'Connecting…'}
          </div>
        </header>

        {/* KPI Cards */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Invoices"
            value={metrics.total.toLocaleString()}
            icon={FileStack}
            accent={{
              bg: 'bg-indigo-500/10',
              text: 'text-indigo-400',
              glow: 'bg-indigo-500',
            }}
          />
          <KpiCard
            label="Total Spend"
            value={currency.format(metrics.spend)}
            icon={DollarSign}
            accent={{
              bg: 'bg-sky-500/10',
              text: 'text-sky-400',
              glow: 'bg-sky-500',
            }}
          />
          <KpiCard
            label="Flagged for Review"
            value={metrics.flagged.toLocaleString()}
            icon={ShieldAlert}
            accent={{
              bg: 'bg-amber-500/10',
              text: 'text-amber-400',
              glow: 'bg-amber-500',
            }}
            sub={
              metrics.total > 0
                ? `${Math.round((metrics.flagged / metrics.total) * 100)}% of total`
                : undefined
            }
          />
          <KpiCard
            label="Avg. AI Confidence"
            value={pct(metrics.avgConfidence)}
            icon={Gauge}
            accent={{
              bg: 'bg-emerald-500/10',
              text: 'text-emerald-400',
              glow: 'bg-emerald-500',
            }}
          />
        </section>

        {/* Filters + Search */}
        <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5 rounded-lg border border-slate-700/60 bg-[#1e293b] p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                }`}
              >
                {f === 'ALL'
                  ? 'All'
                  : f === 'LOGGED'
                  ? 'Logged'
                  : 'Needs Review'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendor or invoice #"
              className="w-full rounded-lg border border-slate-700/60 bg-[#1e293b] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-xl border border-slate-700/60 bg-[#1e293b]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">Issue Date</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-500">
                      <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                      Loading invoices…
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-red-400">
                      Couldn't load invoices: {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-500">
                      <Inbox size={22} className="mx-auto mb-2 text-slate-600" />
                      {invoices.length === 0
                        ? 'No invoices processed yet. New invoices from n8n will appear here automatically.'
                        : 'No invoices match your filters.'}
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`transition-colors hover:bg-slate-800/60 ${
                        freshIds.has(inv.id) ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-100">
                        {inv.vendor || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-300">
                        {inv.invoice_number || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {dateFmt(inv.issue_date)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {dateFmt(inv.due_date)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-100">
                        {currency.format(Number(inv.amount) || 0)}
                      </td>
                      <td className="px-5 py-3.5">
                        <ConfidenceReadout value={inv.confidence} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!loading && !error && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-700/60 px-5 py-3 text-xs text-slate-500">
              <span>
                Showing {filtered.length} of {invoices.length} invoice
                {invoices.length === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-1">
                {metrics.avgConfidence >= 0.9 ? (
                  <ArrowUpRight size={12} className="text-emerald-400" />
                ) : (
                  <ArrowDownRight size={12} className="text-amber-400" />
                )}
                {pct(metrics.avgConfidence)} avg. extraction confidence
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
