"use client";

import { useCallback, useState } from "react";
import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryField,
} from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { useTabListKeys } from "@/helpers/use-tab-list-keys";
import type {
  ValueItemFragment,
  ValuesSectionFragment,
} from "@/generated/graphql";

type ValuesSectionProps = {
  data: ValuesSectionFragment;
};

/**
 * Value tabs — the values as a tab strip over an image with the copy beside it.
 *
 * Two things here are deliberate and easy to "tidy" back into something else:
 *
 * 1. The section heading wears the overline style but is a real <h2>. The
 *    design calls for a small gold eyebrow instead of a serif title; making it
 *    a <p> would leave the page jumping h1 → h3.
 * 2. `lg:items-end` — the copy sits flush with the bottom edge of the image.
 *    That alignment is the whole reason this Type exists rather than reusing
 *    Split Section, which is otherwise the same two-column shape but centred.
 *
 * Tabs are the WAI-ARIA pattern (ADR 0024), not the `aria-pressed` filter
 * buttons used by the projects and blog indexes. All panels stay in the DOM,
 * inactive ones carrying `hidden`, so every value is crawlable.
 */
export function ValuesSection({ data }: ValuesSectionProps) {
  const { overline } = data;
  const values = (data.values ?? []).filter((v): v is ValueItemFragment =>
    Boolean(v)
  );

  const [active, setActive] = useState(0);
  const select = useCallback((index: number) => setActive(index), []);
  const { setRef, onKeyDown } = useTabListKeys(values.length, active, select);

  if (values.length === 0) return null;

  const uid = `values-${data.id}`;
  const tabId = (index: number) => `${uid}-tab-${index}`;
  const panelId = (index: number) => `${uid}-panel-${index}`;

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              <h2 className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                {overline}
              </h2>
            </ZeroCmsEntryField>
          ) : null}

          <div
            role="tablist"
            aria-label={overline ?? "Our values"}
            aria-orientation="horizontal"
            onKeyDown={onKeyDown}
            className="mt-6 flex flex-wrap gap-2"
          >
            {values.map((value, index) => {
              const isActive = index === active;
              return (
                <button
                  key={value.id}
                  ref={setRef(index)}
                  type="button"
                  role="tab"
                  id={tabId(index)}
                  aria-selected={isActive}
                  aria-controls={panelId(index)}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => select(index)}
                  // gold-mid fill under a navy label is the pairing the Button
                  // primitive already reasons about — 6.6:1, comfortably AA.
                  className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep ${
                    isActive
                      ? "border-gold-mid bg-gold-mid text-dark"
                      : "border-border-light bg-surface text-muted hover:border-gold-mid hover:text-dark"
                  }`}
                >
                  {value.label}
                </button>
              );
            })}
          </div>

          <div className="mt-10">
            {values.map((value, index) => (
              <div
                key={value.id}
                role="tabpanel"
                id={panelId(index)}
                aria-labelledby={tabId(index)}
                hidden={index !== active}
                tabIndex={0}
                className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
              >
                <ZeroCmsEntry entry={value}>
                  <div className="grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-14">
                    <ZeroCmsEntryField field="image">
                      <div className="min-w-0 overflow-hidden rounded-2xl">
                        <CmsImage
                          data={value.image}
                          fallbackAlt={value.label ?? "Our values"}
                          placeholderLabel="Value image placeholder"
                          sizes="(max-width: 1024px) 100vw, 536px"
                          className="h-[280px] w-full rounded-2xl object-cover sm:h-[420px]"
                        />
                      </div>
                    </ZeroCmsEntryField>

                    <div className="lg:pb-2">
                      <ZeroCmsEntryField field="label">
                        <h3 className="font-serif text-[clamp(22px,2.4vw,30px)] leading-tight text-dark">
                          {value.label}
                        </h3>
                      </ZeroCmsEntryField>

                      {value.body ? (
                        <ZeroCmsEntryField field="body" className="mt-4">
                          <RichTextViewer
                            content={value.body}
                            variant="who-we-are-body"
                            className="flex flex-col gap-5"
                          />
                        </ZeroCmsEntryField>
                      ) : null}
                    </div>
                  </div>
                </ZeroCmsEntry>
              </div>
            ))}

            <AddZeroCmsEntry field="values" label="+ Add value" />
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
