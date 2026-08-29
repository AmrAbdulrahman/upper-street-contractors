'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import { COLOR_PATTERN } from '@usc/zero-cms-core';
import type { RendererProps } from '../registry/types';
import { Button, Input, cx } from '../../components/ui';

/**
 * A colour picker: the native swatch, the hex beside it, and any presets the
 * field declares.
 *
 * Both controls are present because neither is sufficient alone. `<input
 * type="color">` cannot express "unset" — it reports `#000000` when empty,
 * which would silently write black into every optional colour field the moment
 * an editor opened one. The text input is what holds blank, and is also how a
 * brand hex gets pasted in from somewhere else.
 *
 * The swatch therefore only ever *writes* on change; the stored value is the
 * text. When that value is not a valid hex the swatch falls back to showing
 * black without claiming it, and the field reads as empty.
 */
const FALLBACK = '#000000';

export const ColorRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const presets = field.__type === 'color' ? (field.presets ?? []) : [];

  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => {
        const value = typeof f.value === 'string' ? f.value : '';
        const valid = COLOR_PATTERN.test(value);
        // `<input type="color">` accepts #rrggbb only — an 8-digit value with
        // alpha is legal in the store and legal in CSS, but the swatch would
        // reject it and reset to black, so it gets shown without its alpha.
        const swatch = valid ? value.slice(0, 7) : FALLBACK;

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${field.label ?? field.__name} colour picker`}
                value={swatch}
                onChange={(e) => f.onChange(e.target.value)}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-neutral-300 bg-white p-1"
              />

              <Input
                value={value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder="#000000"
                spellCheck={false}
                aria-label={`${field.label ?? field.__name} hex value`}
                className={cx('font-mono', !valid && value !== '' && 'border-red-400')}
              />

              {value !== '' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => f.onChange('')}
                  title="Clear this colour"
                >
                  Clear
                </Button>
              )}
            </div>

            {value !== '' && !valid && (
              <p className="text-xs text-red-600">
                Expected a hex colour — #rgb, #rrggbb or #rrggbbaa.
              </p>
            )}

            {presets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => f.onChange(preset)}
                    title={preset}
                    aria-label={`Use ${preset}`}
                    aria-pressed={value.toLowerCase() === preset.toLowerCase()}
                    className={cx(
                      'h-6 w-6 rounded-full border transition',
                      value.toLowerCase() === preset.toLowerCase()
                        ? 'border-neutral-900 ring-1 ring-neutral-900'
                        : 'border-neutral-300 hover:border-neutral-500'
                    )}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      }}
    />
  );
};
