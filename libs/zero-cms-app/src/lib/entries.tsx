'use client';

/** Content section: entry listing (search + status filter) and the entry editor. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OutputEntry, Type } from '@usc/zero-cms-core';
import { useZeroCms } from './context';
import { useDraftRegistryOptional } from './draft-registry';
import { EntryForm, entryLabel, titleField, type FormValues } from './fields';
import { Badge, Button, EmptyState, Input, Select, Spinner, cls, cx } from './components/ui';
import { cleanValues, defaultsFor, errorMessage } from './util';

type StatusFilter = 'all' | 'published' | 'draft' | 'unpublished';

function StatusBadges({ entry }: { entry: OutputEntry }) {
  return (
    <span className="inline-flex gap-1">
      <Badge tone={entry.__status === 'published' ? 'green' : 'neutral'}>
        {entry.__status}
      </Badge>
      {entry.hasDraft && <Badge tone="amber">draft</Badge>}
    </span>
  );
}

export function EntriesList({
  type,
  onOpen,
  onNew,
}: {
  type: Type;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const { adapter } = useZeroCms();
  const [entries, setEntries] = useState<OutputEntry[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setEntries(null);
    const { data } = await adapter.query(type.__name, {
      status: 'draft',
      includeUnpublished: true,
    });
    setEntries(data);
  }, [adapter, type.__name]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (status === 'published' && e.__status !== 'published') return false;
      if (status === 'unpublished' && e.__status !== 'unpublished') return false;
      if (status === 'draft' && !e.hasDraft) return false;
      if (!q) return true;
      return Object.values(e).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(q)
      );
    });
  }, [entries, search, status]);

  const tf = titleField(type);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={`Search ${type.label ?? type.__name}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="max-w-40"
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Has draft</option>
          <option value="unpublished">Unpublished</option>
        </Select>
        <div className="ml-auto">
          <Button variant="primary" onClick={onNew}>
            + New
          </Button>
        </div>
      </div>

      {entries === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState>No entries.</EmptyState>
      ) : (
        <div className={cx(cls.card, 'divide-y divide-neutral-100')}>
          {filtered.map((e) => (
            <button
              key={e.__id}
              onClick={() => onOpen(e.__id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50"
            >
              <span className="flex-1 truncate text-sm text-neutral-800">
                {entryLabel(type, e)}
              </span>
              {tf == null && (
                <span className="text-xs text-neutral-400">{e.__id.slice(0, 8)}</span>
              )}
              <StatusBadges entry={e} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EntryEditor({
  type,
  entryId,
  createMode,
  onClose,
  onChanged,
  focusField,
}: {
  type: Type;
  entryId?: string;
  /**
   * Force the "create" title even though the entry already exists — the in-place
   * widget pre-creates the entry before opening, so `isNew` (no id) can't tell
   * create from edit. Defaults to `isNew` (the admin "+ New" path passes nothing).
   */
  createMode?: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Field `__name` to scroll to + highlight on open. */
  focusField?: string;
}) {
  const { adapter, refreshMedia, notify } = useZeroCms();
  const draftReg = useDraftRegistryOptional();
  const isNew = !entryId;
  const creating = createMode ?? isNew;
  const [entry, setEntry] = useState<OutputEntry | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadEntry = useCallback(async () => {
    if (isNew || !entryId) return;
    setEntry(
      await adapter.get(type.__name, entryId, {
        status: 'draft',
        includeUnpublished: true,
      })
    );
  }, [adapter, type.__name, entryId, isNew]);

  useEffect(() => {
    let live = true;
    if (isNew) {
      setEntry(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void adapter
      .get(type.__name, entryId, { status: 'draft', includeUnpublished: true })
      .then((e) => live && (setEntry(e), setLoading(false)));
    return () => {
      live = false;
    };
  }, [adapter, type.__name, entryId, isNew]);

  const run = async (fn: () => Promise<unknown>, successMsg?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refreshMedia();
      onChanged();
      if (successMsg) notify('success', successMsg);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      notify('error', msg);
    } finally {
      setBusy(false);
    }
  };

  const save = (values: FormValues) =>
    run(async () => {
      const clean = cleanValues(values);
      if (isNew) {
        const created = await adapter.create(type.__name, clean);
        draftReg?.markDraft(type.__name, created.__id);
      } else {
        await adapter.update(type.__name, entryId, clean);
        draftReg?.markDraft(type.__name, entryId);
      }
      onClose();
    }, isNew ? 'Entry created' : 'Changes saved');

  // Autosave (existing entries only): persist to __draft without closing. Errors
  // surface inline and rethrow so EntryForm keeps the edit dirty for a retry.
  const saveQuiet = async (values: FormValues) => {
    if (isNew || !entryId) return;
    setError(null);
    try {
      await adapter.update(type.__name, entryId, cleanValues(values));
      // Reflect the new draft at once: flip the header badge and register it so the
      // bar's publish count updates instantly, no re-query round-trip.
      setEntry((prev) => (prev ? { ...prev, hasDraft: true } : prev));
      draftReg?.markDraft(type.__name, entryId);
      onChanged();
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      notify('error', msg);
      throw err;
    }
  };

  const act = (fn: () => Promise<unknown>, close = false, successMsg?: string) =>
    run(async () => {
      await fn();
      if (close) onClose();
      else await reloadEntry();
    }, successMsg);

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-neutral-900">
            {creating ? 'Add Entry' : 'Edit Entry'}
          </h3>
          <Badge>{type.label ?? type.__name}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {entry && <StatusBadges entry={entry} />}
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <EntryForm
        type={type}
        defaultValues={defaultsFor(type, entry)}
        onSubmit={save}
        autosave={!isNew && entryId ? saveQuiet : undefined}
        focusField={focusField}
        submitLabel={isNew ? 'Create draft' : 'Save draft'}
        footer={
          !isNew && entry ? (
            // A fragment (not a nested flex container) so these render as direct
            // siblings of the submit button in EntryForm's single flat row.
            <>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await adapter.publish(type.__name, entryId!);
                    draftReg?.clearDraft(type.__name, entryId!);
                  }, false, 'Published')
                }
              >
                Publish
              </Button>
              {entry.__status === 'published' && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act(() => adapter.unpublish(type.__name, entryId!), false, 'Unpublished')
                  }
                >
                  Unpublish
                </Button>
              )}
              {entry.hasDraft && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await adapter.discardDraft(type.__name, entryId!);
                      draftReg?.clearDraft(type.__name, entryId!);
                    }, false, 'Draft discarded')
                  }
                >
                  Discard draft
                </Button>
              )}
              <Button
                variant="danger"
                disabled={busy}
                className="ml-auto"
                onClick={() =>
                  act(async () => {
                    await adapter.delete(type.__name, entryId!);
                    draftReg?.clearDraft(type.__name, entryId!);
                  }, true, 'Entry deleted')
                }
              >
                Delete
              </Button>
            </>
          ) : null
        }
      />
    </div>
  );
}
