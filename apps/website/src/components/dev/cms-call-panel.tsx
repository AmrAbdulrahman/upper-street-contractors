"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  clearCmsCalls,
  useCmsCalls,
  visibleEntries,
  type CmsCall,
} from "./cms-call-store";

type Tab = "analytics" | "details";
type NetFilter = "all" | "network" | "cached";

const GROUPS_PER_PAGE = 8;

/** Stable "source" identity for grouping/ranking. */
function srcKey(c: CmsCall): string {
  return c.kind === "graphql"
    ? c.op ?? "unknown"
    : `${c.method ?? "GET"} ${c.path ?? ""}`;
}

export default function CmsCallPanel({ onClose }: { onClose: () => void }) {
  const state = useCmsCalls();
  const entries = visibleEntries(state);
  const [tab, setTab] = useState<Tab>("analytics");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="CMS Call Meter"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-lg">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-dark">CMS Call Meter</h2>
            <p className="truncate text-[0.6875rem] text-subtle">
              local dev · {state.bootTs ? `since ${fmtClock(state.bootTs)}` : "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearCmsCalls}
              className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-dark hover:bg-border-light"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="px-1 text-xl leading-none text-subtle hover:text-dark"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex border-b border-border" role="tablist">
          {(["analytics", "details"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2 text-xs font-semibold capitalize ${
                tab === t
                  ? "border-b-2 border-dark text-dark"
                  : "text-subtle hover:text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "analytics" ? (
            <Analytics entries={entries} total={state.total} />
          ) : (
            <Details entries={entries} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Analytics({ entries, total }: { entries: CmsCall[]; total: number }) {
  const a = useMemo(() => {
    const networkCalls = entries.filter((e) => e.network);
    const durations = networkCalls.map((e) => e.durationMs);
    const avg = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;
    return {
      network: networkCalls.length,
      cached: entries.length - networkCalls.length,
      byOp: rank(entries, srcKey),
      byKind: rank(entries, (e) => e.kind),
      byStatus: rank(entries, (e) => e.status ?? "—"),
      avg,
      max: durations.length ? Math.max(...durations) : 0,
    };
  }, [entries]);

  if (entries.length === 0) return <Empty />;

  const cacheRate = Math.round((a.cached / entries.length) * 100);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Requests" value={entries.length} />
        <Stat label="Real HTTP" value={a.network} />
        <Stat label="Cached" value={a.cached} />
        <Stat label="Cache hit" value={`${cacheRate}%`} />
        <Stat label="Avg ms" value={a.avg} />
        <Stat label="Max ms" value={a.max} />
      </div>

      <BarList title="Which parts use the CMS most" rows={a.byOp} />
      <BarList title="By kind" rows={a.byKind} />
      <BarList title="By status" rows={a.byStatus} />

      <p className="text-[0.6875rem] text-subtle">
        Lifetime total since dev boot: <span className="font-semibold">{total}</span>
      </p>
    </div>
  );
}

function Details({ entries }: { entries: CmsCall[] }) {
  const [filter, setFilter] = useState<NetFilter>("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(() => {
    const filtered = entries.filter((e) =>
      filter === "all" ? true : filter === "network" ? e.network : !e.network,
    );
    const map = new Map<string, CmsCall[]>();
    for (const e of filtered) {
      const key = srcKey(e);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()]
      .map(([key, calls]) => ({ key, calls, kind: calls[0].kind }))
      .sort((x, y) => y.calls.length - x.calls.length);
  }, [entries, filter]);

  if (entries.length === 0) return <Empty />;

  const pageCount = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * GROUPS_PER_PAGE;
  const slice = groups.slice(start, start + GROUPS_PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["all", "network", "cached"] as NetFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-medium ${
              filter === f
                ? "bg-dark text-white"
                : "bg-border-light text-muted hover:text-dark"
            }`}
          >
            {f === "network" ? "Real HTTP" : f === "cached" ? "Cached" : "All"}
          </button>
        ))}
      </div>

      <ul className="space-y-1.5">
        {slice.map((g) => {
          const isOpen = expanded.has(g.key);
          return (
            <li key={g.key} className="rounded-sm border border-border">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(setExpanded, g.key)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <KindDot kind={g.kind} />
                  <span className="truncate text-xs font-medium text-dark">
                    {g.key}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-dark">
                  {g.calls.length}
                </span>
              </button>
              {isOpen ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-border px-3 py-2">
                  {g.calls
                    .slice()
                    .reverse()
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-[0.6875rem] text-muted"
                      >
                        <span className="tabular-nums">{fmtClock(c.ts, true)}</span>
                        <span className="flex items-center gap-2">
                          <span
                            className={
                              c.network ? "text-emerald-600" : "text-amber-600"
                            }
                          >
                            {c.network ? "HTTP" : "cache"}
                          </span>
                          {c.status ? <span>{c.status}</span> : null}
                          <span className="tabular-nums">{c.durationMs}ms</span>
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="rounded-sm border border-border px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-subtle">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            className="rounded-sm border border-border px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function rank(
  entries: CmsCall[],
  key: (c: CmsCall) => string,
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    const k = key(e);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((x, y) => y.count - x.count);
}

function BarList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  if (rows.length === 0) return null;
  const max = rows[0].count || 1;
  return (
    <section>
      <h3 className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-subtle">
        {title}
      </h3>
      <ul className="space-y-1">
        {rows.slice(0, 8).map((r) => (
          <li
            key={r.label}
            className="relative overflow-hidden rounded-sm bg-border-light"
          >
            <div
              className="absolute inset-y-0 left-0 bg-gold/25"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
            <div className="relative flex items-center justify-between gap-2 px-2 py-1 text-xs">
              <span className="truncate text-dark">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-dark">
                {r.count}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-sm border border-border px-2 py-1.5 text-center">
      <div className="text-base font-bold tabular-nums text-dark">{value}</div>
      <div className="text-[0.625rem] uppercase tracking-wide text-subtle">
        {label}
      </div>
    </div>
  );
}

function KindDot({ kind }: { kind: CmsCall["kind"] }) {
  return (
    <span
      aria-hidden
      title={kind}
      className={`h-2 w-2 shrink-0 rounded-full ${
        kind === "graphql" ? "bg-gold" : "bg-dark"
      }`}
    />
  );
}

function Empty() {
  return (
    <p className="py-10 text-center text-sm text-subtle">
      No CMS calls yet. Navigate the site.
    </p>
  );
}

function toggle(
  setExpanded: (fn: (prev: ReadonlySet<string>) => ReadonlySet<string>) => void,
  key: string,
): void {
  setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

function fmtClock(ts: number, withMs = false): string {
  const d = new Date(ts);
  const base = d.toLocaleTimeString(undefined, { hour12: false });
  return withMs ? `${base}.${String(d.getMilliseconds()).padStart(3, "0")}` : base;
}
