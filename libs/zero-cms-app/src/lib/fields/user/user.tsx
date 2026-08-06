'use client';

/**
 * `user` editor — a picker over the current CMS users that stores the chosen
 * person's **display name** (ADR 0016), not their id.
 *
 * The stored value is therefore not guaranteed to be in the list: the person may
 * have been renamed, disabled or deleted since. That value is kept and offered as
 * an extra option rather than silently blanked — an old byline is still true.
 *
 * `listAuthors` is injected through `<ZeroCmsProvider>`; without it (a host on the
 * plain no-auth adapter) this degrades to a free-text input rather than an empty
 * dropdown that can never be filled.
 */

import { useEffect, useState, type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import { useZeroCms } from '../../context';
import type { RendererProps } from '../registry/types';
import { Input, Select } from '../../components/ui';

export const UserRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const { listAuthors } = useZeroCms();
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    if (!listAuthors) return;
    let live = true;
    void (async () => {
      try {
        const authors = await listAuthors();
        if (live) setNames(authors.map((a) => a.name).filter(Boolean));
      } catch {
        // A failed load must not block editing the rest of the entry — fall
        // back to the free-text input below.
        if (live) setNames([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [listAuthors]);

  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => {
        const value = (f.value as string) ?? '';
        if (!listAuthors) {
          return <Input value={value} onChange={f.onChange} onBlur={f.onBlur} />;
        }
        // `value` first so a departed author's name survives a re-save.
        const options = names
          ? [...new Set([...(value ? [value] : []), ...names])]
          : value
            ? [value]
            : [];
        return (
          <Select value={value} onChange={f.onChange} onBlur={f.onBlur}>
            <option value="">{names === null ? 'Loading…' : '—'}</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        );
      }}
    />
  );
};
