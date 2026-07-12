"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { DayPicker } from "@daypicker/react";
import "@daypicker/react/style.css";
import { ZeroCmsEntry } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { ContactDetailsPanel } from "../contact-details";
import type { WizardSectionFragment } from "@/generated/graphql";

type WizardQuestion = NonNullable<WizardSectionFragment["questions"]>[number];
type WizardSectionProps = { data: WizardSectionFragment };

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB
const FILE_ACCEPT = "image/*,.pdf,.doc,.docx";

// Fixed booking slots for the `timeWindow` field (multi-select). En-dash by design.
const TIME_WINDOWS = ["9am–1pm", "1pm–4pm", "4pm–8pm"] as const;

// Store a picked date as local YYYY-MM-DD (no UTC shift from toISOString()).
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

// Parse a stored YYYY-MM-DD back to a local Date for the controlled picker.
const fromISODate = (s: string): Date | undefined => {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

// Human-readable date for the confirmation line + the emailed enquiry.
const formatDateLong = (s: string): string => {
  const d = fromISODate(s);
  return d
    ? d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : s;
};

// Gold-tinted theme for the DayPicker calendar (CSS vars inherit into .rdp-root).
const DAYPICKER_THEME = {
  "--rdp-accent-color": "var(--color-gold)",
  "--rdp-accent-background-color": "color-mix(in srgb, var(--color-gold) 14%, white)",
  "--rdp-today-color": "var(--color-gold-deep)",
} as CSSProperties;

// Postcode lookup (postcodes.io): matched by CMS fieldKey convention.
const POSTCODE_RE = /^post.?code$/i;
const TOWN_RE = /^(town|city)$/i;
const REGION_RE = /^(region|county)$/i;
// Loose UK postcode shape (e.g. "N1 1AA", "SW1A 1AA"); postcodes.io is the source of truth.
const UK_POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
const POSTCODE_DEBOUNCE_MS = 700;

type PostcodeStatus = "idle" | "loading" | "found" | "notfound" | "error";

/** Map an address-ish fieldKey to an HTML autocomplete token (UX + a11y). */
function addressAutoComplete(fieldKey: string | null | undefined): string | undefined {
  const k = fieldKey ?? "";
  if (POSTCODE_RE.test(k)) return "postal-code";
  if (TOWN_RE.test(k)) return "address-level2";
  if (REGION_RE.test(k)) return "address-level1";
  if (/^address/i.test(k)) return "address-line1";
  return undefined;
}

type CollectedAnswers = {
  fields: { label: string; value: string }[];
  files: File[];
  senderEmail: string;
  senderName: string;
};

export function WizardSection({ data }: WizardSectionProps) {
  const questions = (data.questions ?? []).filter(Boolean) as WizardQuestion[];
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageAnswers, setImageAnswers] = useState<Record<string, string[]>>({});
  const [optionText, setOptionText] = useState<Record<string, string>>({});
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [fileAnswers, setFileAnswers] = useState<Record<string, File[]>>({});
  const [pcStatus, setPcStatus] = useState<Record<string, PostcodeStatus>>({});
  const [pcSuggestions, setPcSuggestions] = useState<Record<string, string[]>>({});
  const [pcOpen, setPcOpen] = useState<Record<string, boolean>>({});
  const pcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcSuppressOpen = useRef(false);

  // Close any open postcode dropdown when clicking outside its widget.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-pc-widget]")) return;
      pcSuppressOpen.current = true;
      setPcOpen({});
      window.setTimeout(() => {
        pcSuppressOpen.current = false;
      }, 300);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const total = questions.length;
  if (total === 0) return null;

  const current = questions[Math.min(step, total - 1)];
  const isLast = step === total - 1;

  const fieldValue = (questionId: string, key: string | null | undefined) =>
    formAnswers[`${questionId}:${key}`] ?? "";

  // A field with a `dependsOn` only shows when its sibling field matches.
  const isFieldVisible = (
    questionId: string,
    field: { dependsOnFieldKey?: string | null; dependsOnValue?: string | null },
  ) => {
    if (!field.dependsOnFieldKey) return true;
    return fieldValue(questionId, field.dependsOnFieldKey) === (field.dependsOnValue ?? "");
  };

  const toggleImage = (questionId: string, label: string, multi: boolean) =>
    setImageAnswers((prev) => {
      const existing = prev[questionId] ?? [];
      if (!multi) return { ...prev, [questionId]: [label] };
      return {
        ...prev,
        [questionId]: existing.includes(label)
          ? existing.filter((l) => l !== label)
          : [...existing, label],
      };
    });

  const setField = (key: string, value: string) =>
    setFormAnswers((prev) => ({ ...prev, [key]: value }));

  // Validate a UK postcode via postcodes.io and auto-fill sibling Town/Region
  // fields (matched by fieldKey) in the same FormQuestion. Free, no API key.
  const lookupPostcode = async (questionId: string, raw: string) => {
    const pc = raw.trim();
    const statusKey = `${questionId}:__postcode`;
    if (!UK_POSTCODE_RE.test(pc)) {
      setPcStatus((s) => ({ ...s, [statusKey]: "idle" }));
      return;
    }
    setPcStatus((s) => ({ ...s, [statusKey]: "loading" }));
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
      );
      if (!res.ok) {
        setPcStatus((s) => ({ ...s, [statusKey]: "notfound" }));
        return;
      }
      const body = (await res.json()) as {
        result?: {
          admin_district?: string | null;
          parish?: string | null;
          region?: string | null;
          country?: string | null;
        } | null;
      };
      const result = body.result;
      if (!result) {
        setPcStatus((s) => ({ ...s, [statusKey]: "notfound" }));
        return;
      }
      const q = questions.find((x) => x.id === questionId);
      const siblings =
        q && q.__typename === "FormQuestion"
          ? (q.fields ?? []).filter(Boolean)
          : [];
      const townField = siblings.find((f) => TOWN_RE.test(f!.fieldKey ?? ""));
      const regionField = siblings.find((f) => REGION_RE.test(f!.fieldKey ?? ""));
      // postcodes.io has no PAF "post town"; admin_district is the closest area name.
      const town = result.admin_district || result.parish || "";
      // region is null outside England — fall back to the country name.
      const region = result.region || result.country || "";
      if (townField?.fieldKey && town) {
        setField(`${questionId}:${townField.fieldKey}`, town);
      }
      if (regionField?.fieldKey && region) {
        setField(`${questionId}:${regionField.fieldKey}`, region);
      }
      setPcStatus((s) => ({ ...s, [statusKey]: "found" }));
    } catch {
      setPcStatus((s) => ({ ...s, [statusKey]: "error" }));
    }
  };

  // postcodes.io autocomplete: candidate postcodes for a partial input (free).
  const fetchPostcodeSuggestions = async (questionId: string, query: string) => {
    const q = query.trim();
    const statusKey = `${questionId}:__postcode`;
    if (q.length < 2) {
      setPcSuggestions((s) => ({ ...s, [questionId]: [] }));
      setPcOpen((s) => ({ ...s, [questionId]: false }));
      setPcStatus((s) => ({ ...s, [statusKey]: "idle" }));
      return;
    }
    setPcStatus((s) => ({ ...s, [statusKey]: "loading" }));
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete`,
      );
      if (!res.ok) {
        setPcSuggestions((s) => ({ ...s, [questionId]: [] }));
        setPcOpen((s) => ({ ...s, [questionId]: true }));
        setPcStatus((s) => ({ ...s, [statusKey]: "notfound" }));
        return;
      }
      const body = (await res.json()) as { result?: string[] | null };
      const list = body.result ?? [];
      setPcSuggestions((s) => ({ ...s, [questionId]: list }));
      setPcOpen((s) => ({ ...s, [questionId]: true }));
      setPcStatus((s) => ({ ...s, [statusKey]: list.length ? "idle" : "notfound" }));
    } catch {
      setPcStatus((s) => ({ ...s, [statusKey]: "error" }));
    }
  };

  const schedulePostcodeSuggestions = (questionId: string, query: string) => {
    if (pcTimer.current) clearTimeout(pcTimer.current);
    pcTimer.current = setTimeout(() => {
      void fetchPostcodeSuggestions(questionId, query);
    }, POSTCODE_DEBOUNCE_MS);
  };

  // Pick a postcode from the dropdown → set the field + fill Town/Region.
  const selectPostcode = (questionId: string, fieldKey: string, pc: string) => {
    if (pcTimer.current) clearTimeout(pcTimer.current);
    setField(`${questionId}:${fieldKey}`, pc);
    setPcSuggestions((s) => ({ ...s, [questionId]: [] }));
    setPcOpen((s) => ({ ...s, [questionId]: false }));
    void lookupPostcode(questionId, pc);
  };

  const handleFiles = (key: string, list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length > MAX_FILES) {
      setError(`Please attach at most ${MAX_FILES} files.`);
      return;
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError("Attachments must total under 10 MB.");
      return;
    }
    setError(null);
    setFileAnswers((prev) => ({ ...prev, [key]: files }));
  };

  const canProceed = (() => {
    if (current.__typename === "ImageQuestion") {
      return (imageAnswers[current.id] ?? []).length > 0;
    }
    return (current.fields ?? []).every((f) => {
      if (!f) return true;
      if (!isFieldVisible(current.id, f)) return true;
      if (!f.required) return true;
      const key = `${current.id}:${f.fieldKey}`;
      if (f.inputType === "file") return (fileAnswers[key]?.length ?? 0) > 0;
      if (f.inputType === "boolean") return formAnswers[key] === "true";
      return (formAnswers[key] ?? "").trim().length > 0;
    });
  })();

  const goToStep = (index: number) => {
    if (index < 0 || index > maxStep) return;
    setDone(false);
    setStep(index);
  };

  const next = () => {
    const target = Math.min(total - 1, step + 1);
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
  };

  const collectAnswers = (): CollectedAnswers => {
    const fields: { label: string; value: string }[] = [];
    const files: File[] = [];
    let senderEmail = "";
    let senderName = "";

    for (const q of questions) {
      if (q.__typename === "ImageQuestion") {
        const selected = imageAnswers[q.id] ?? [];
        if (selected.length) {
          fields.push({ label: q.stepLabel || q.title || "Selection", value: selected.join(", ") });
        }
        for (const opt of q.options ?? []) {
          if (opt?.revealTextInput && opt.label && selected.includes(opt.label)) {
            const text = (optionText[opt.id] ?? "").trim();
            if (text) fields.push({ label: `${opt.label} — details`, value: text });
          }
        }
      } else if (q.__typename === "FormQuestion") {
        for (const f of q.fields ?? []) {
          if (!f?.fieldKey || !isFieldVisible(q.id, f)) continue;
          const key = `${q.id}:${f.fieldKey}`;
          if (f.inputType === "file") {
            const list = fileAnswers[key] ?? [];
            list.forEach((file) => files.push(file));
            if (list.length) {
              fields.push({ label: f.label || f.fieldKey, value: list.map((x) => x.name).join(", ") });
            }
            continue;
          }
          if (f.inputType === "boolean") {
            fields.push({ label: f.label || f.fieldKey, value: formAnswers[key] === "true" ? "Yes" : "No" });
            continue;
          }
          const value = (formAnswers[key] ?? "").trim();
          const displayValue =
            f.inputType === "date" && value ? formatDateLong(value) : value;
          if (displayValue) fields.push({ label: f.label || f.fieldKey, value: displayValue });
          if (f.inputType === "email" && !senderEmail && value) senderEmail = value;
          if (!senderName && value && /name/i.test(f.fieldKey)) senderName = value;
        }
      }
    }

    return { fields, files, senderEmail, senderName };
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { fields, files, senderEmail, senderName } = collectAnswers();
      const body = new FormData();
      body.append("payload", JSON.stringify({ fields, senderEmail, senderName }));
      files.forEach((file) => body.append("attachments", file, file.name));

      const res = await fetch("/api/enquiry", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "We couldn't send your enquiry. Please try again.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Stepper nodes = one per question + a trailing "Done" node.
  const nodes = [
    ...questions.map((q, i) => ({ key: q.id, label: q.stepLabel || `Step ${i + 1}`, clickable: true })),
    { key: "done", label: "Done", clickable: false },
  ];

  const dotState = (i: number): "complete" | "current" | "pending" => {
    if (done) return "complete";
    if (i < step) return "complete";
    if (i === step) return "current";
    return "pending";
  };
  const dotClass = {
    complete: "bg-gold text-white border-gold",
    current: "bg-dark text-white border-dark",
    pending: "bg-white text-subtle border-border",
  } as const;

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-4 py-2.5 text-dark outline-none focus:border-gold";

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto grid max-w-container gap-8 px-6 py-[72px] lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="min-w-0">
            {/* Stepper */}
            <ol className="flex items-start">
              {nodes.map((node, i) => {
                const state = dotState(i);
                const connectorLit = done || i <= step;
                const canClick = node.clickable && i <= maxStep;
                return (
                  <Fragment key={node.key}>
                    {i > 0 ? (
                      <li
                        aria-hidden
                        className="mt-[13px] h-0.5 flex-1 rounded md:mt-[17px]"
                        style={{ background: connectorLit ? "var(--color-gold)" : "var(--color-border)" }}
                      />
                    ) : null}
                    <li className="flex w-9 shrink-0 flex-col items-center gap-1.5 text-center md:w-20 md:gap-2">
                      <button
                        type="button"
                        disabled={!canClick}
                        aria-current={state === "current" ? "step" : undefined}
                        onClick={() => goToStep(i)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors md:h-[34px] md:w-[34px] md:text-sm ${dotClass[state]} ${canClick ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {i === nodes.length - 1 || state === "complete" ? "✓" : i + 1}
                      </button>
                      <span className={`text-[10px] font-bold tracking-[0.1em] uppercase sr-only md:not-sr-only ${state === "pending" ? "text-subtle" : "text-dark"}`}>
                        {node.label}
                      </span>
                    </li>
                  </Fragment>
                );
              })}
            </ol>

            {done ? (
              <div className="mt-10 rounded-2xl border border-border bg-white p-8">
                <h2 className="font-serif text-2xl text-dark">
                  {data.doneTitle || "Thank you — your enquiry is on its way"}
                </h2>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
                  {data.doneMessage ||
                    "We've emailed you a copy of your request and will be in touch shortly."}
                </p>
              </div>
            ) : (
              <div className="mt-10">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                  Step {step + 1} of {total}
                  {current.stepLabel ? ` — ${current.stepLabel}` : ""}
                </p>
                {current.title ? (
                  <h2 className="mt-2 font-serif text-[clamp(24px,3.5vw,34px)] leading-tight text-dark">
                    {current.title}
                  </h2>
                ) : null}
                {current.hint ? (
                  <p className="mt-2 text-sm text-muted">{current.hint}</p>
                ) : null}

                {current.__typename === "ImageQuestion" ? (
                  <>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {(current.options ?? []).filter(Boolean).map((option) => {
                        const label = option!.label ?? "";
                        const selected = (imageAnswers[current.id] ?? []).includes(label);
                        return (
                          <button
                            type="button"
                            key={option!.id}
                            aria-pressed={selected}
                            onClick={() => toggleImage(current.id, label, Boolean(current.multiSelect))}
                            className={`group relative h-44 overflow-hidden rounded-2xl border-2 text-left transition-colors ${selected ? "border-gold" : "border-transparent hover:border-gold/40"}`}
                          >
                            <CmsImage
                              data={option!.image}
                              fallbackAlt={label}
                              placeholderLabel=""
                              sizes="(max-width: 640px) 100vw, 320px"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <span
                              aria-hidden
                              className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/35 to-transparent"
                            />
                            <span className="absolute inset-x-0 bottom-0 p-4">
                              {option!.emoji ? (
                                <span aria-hidden className="mb-1 block text-xl">
                                  {option!.emoji}
                                </span>
                              ) : null}
                              <span className="block font-semibold text-white">{label}</span>
                              {option!.description ? (
                                <span className="mt-0.5 block text-sm text-white/75">
                                  {option!.description}
                                </span>
                              ) : null}
                            </span>
                            {selected ? (
                              <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs text-white">
                                ✓
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* Reveal a free-text box for any selected option that asks for detail. */}
                    {(current.options ?? []).filter(Boolean).map((option) => {
                      const label = option!.label ?? "";
                      const selected = (imageAnswers[current.id] ?? []).includes(label);
                      if (!option!.revealTextInput || !selected) return null;
                      return (
                        <label key={`reveal-${option!.id}`} className="mt-4 flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-dark">
                            Tell us more about “{label}”
                          </span>
                          <textarea
                            rows={3}
                            className={inputClass}
                            placeholder={option!.textInputPlaceholder ?? ""}
                            value={optionText[option!.id] ?? ""}
                            onChange={(e) =>
                              setOptionText((prev) => ({ ...prev, [option!.id]: e.target.value }))
                            }
                          />
                        </label>
                      );
                    })}
                  </>
                ) : (
                  <div className="mt-6 flex flex-col gap-4">
                    {(current.fields ?? [])
                      .filter(Boolean)
                      .filter((field) => isFieldVisible(current.id, field!))
                      .map((field) => {
                        const key = `${current.id}:${field!.fieldKey}`;
                        const id = `wizard-${field!.id}`;
                        const labelText = (
                          <span className="text-sm font-medium text-dark">
                            {field!.label}
                            {field!.required ? (
                              <span className="text-gold" aria-hidden>
                                {" *"}
                              </span>
                            ) : null}
                          </span>
                        );

                        if (field!.inputType === "boolean") {
                          const on = formAnswers[key] === "true";
                          return (
                            <div key={field!.id} className="flex items-center gap-3">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={on}
                                id={id}
                                onClick={() => setField(key, on ? "" : "true")}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${on ? "bg-gold" : "bg-border"}`}
                              >
                                <span
                                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
                                />
                              </button>
                              <label htmlFor={id} className="cursor-pointer">
                                {labelText}
                              </label>
                            </div>
                          );
                        }

                        if (field!.inputType === "file") {
                          const files = fileAnswers[key] ?? [];
                          return (
                            <div key={field!.id} className="flex flex-col gap-1.5">
                              <label htmlFor={id}>{labelText}</label>
                              <input
                                id={id}
                                type="file"
                                multiple
                                accept={FILE_ACCEPT}
                                onChange={(e) => handleFiles(key, e.target.files)}
                                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-border-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-dark outline-none focus:border-gold"
                              />
                              {files.length ? (
                                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
                                  {files.map((f) => (
                                    <li key={f.name}>📎 {f.name}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-subtle">
                                  Up to {MAX_FILES} files, 10 MB total (images, PDF, Word).
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (field!.inputType === "date") {
                          const value = formAnswers[key] ?? "";
                          const selected = value ? fromISODate(value) : undefined;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return (
                            <div key={field!.id} className="flex flex-col gap-1.5">
                              {labelText}
                              <div className="w-fit rounded-lg border border-border bg-white p-2">
                                <DayPicker
                                  mode="single"
                                  selected={selected}
                                  onSelect={(d) => setField(key, d ? toISODate(d) : "")}
                                  disabled={{ before: today }}
                                  style={DAYPICKER_THEME}
                                />
                              </div>
                              {value ? (
                                <span className="text-xs text-muted">
                                  Selected: {formatDateLong(value)}
                                </span>
                              ) : null}
                            </div>
                          );
                        }

                        if (field!.inputType === "timeWindow") {
                          const selectedWindows = (formAnswers[key] ?? "")
                            .split(", ")
                            .filter(Boolean);
                          const toggleWindow = (w: string) => {
                            const nextSel = selectedWindows.includes(w)
                              ? selectedWindows.filter((x) => x !== w)
                              : [...selectedWindows, w];
                            // Persist in canonical slot order regardless of click order.
                            setField(
                              key,
                              TIME_WINDOWS.filter((x) => nextSel.includes(x)).join(", "),
                            );
                          };
                          return (
                            <div key={field!.id} className="flex flex-col gap-1.5">
                              {labelText}
                              <div
                                role="group"
                                aria-label={field!.label ?? "Preferred time"}
                                className="flex flex-wrap gap-2"
                              >
                                {TIME_WINDOWS.map((w) => {
                                  const on = selectedWindows.includes(w);
                                  return (
                                    <button
                                      type="button"
                                      key={w}
                                      aria-pressed={on}
                                      onClick={() => toggleWindow(w)}
                                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${on ? "border-gold bg-gold text-white" : "border-border bg-white text-dark hover:border-gold/40"}`}
                                    >
                                      {w}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        const isPostcode = POSTCODE_RE.test(field!.fieldKey ?? "");

                        if (isPostcode) {
                          const listId = `${id}-pc-list`;
                          const pcState =
                            pcStatus[`${current.id}:__postcode`] ?? "idle";
                          const suggestions = pcSuggestions[current.id] ?? [];
                          const listOpen =
                            Boolean(pcOpen[current.id]) && suggestions.length > 0;
                          const pcMessage =
                            pcState === "loading"
                              ? "Searching postcodes…"
                              : pcState === "found"
                                ? "Town & region filled in below."
                                : pcState === "notfound"
                                  ? "No matching postcodes — check and try again."
                                  : pcState === "error"
                                    ? "Couldn't reach the postcode service — type your address manually."
                                    : "";
                          return (
                            <label
                              key={field!.id}
                              className="flex flex-col gap-1.5"
                              data-pc-widget
                            >
                              {labelText}
                              <div className="relative">
                                <input
                                  id={id}
                                  type="text"
                                  role="combobox"
                                  aria-expanded={listOpen}
                                  aria-controls={listId}
                                  aria-autocomplete="list"
                                  className={inputClass}
                                  required={Boolean(field!.required)}
                                  placeholder={
                                    field!.placeholder ?? "Start typing a postcode…"
                                  }
                                  autoComplete="postal-code"
                                  value={formAnswers[key] ?? ""}
                                  onChange={(e) => {
                                    setField(key, e.target.value);
                                    schedulePostcodeSuggestions(
                                      current.id,
                                      e.target.value,
                                    );
                                  }}
                                  onBlur={() => {
                                    if (!pcSuppressOpen.current) {
                                      void fetchPostcodeSuggestions(
                                        current.id,
                                        formAnswers[key] ?? "",
                                      );
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      setPcOpen((s) => ({
                                        ...s,
                                        [current.id]: false,
                                      }));
                                    }
                                  }}
                                />
                                {listOpen ? (
                                  <ul
                                    id={listId}
                                    role="listbox"
                                    className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-white py-1 shadow-lg"
                                  >
                                    {suggestions.map((pc) => (
                                      <li
                                        key={pc}
                                        role="option"
                                        aria-selected={false}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                          selectPostcode(
                                            current.id,
                                            field!.fieldKey ?? "",
                                            pc,
                                          )
                                        }
                                        className="cursor-pointer px-4 py-2 text-sm text-dark hover:bg-surface"
                                      >
                                        {pc}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                              {pcMessage ? (
                                <span
                                  aria-live="polite"
                                  className={`text-xs ${
                                    pcState === "notfound" || pcState === "error"
                                      ? "text-red-600"
                                      : "text-muted"
                                  }`}
                                >
                                  {pcMessage}
                                </span>
                              ) : null}
                            </label>
                          );
                        }

                        return (
                          <label key={field!.id} className="flex flex-col gap-1.5">
                            {labelText}
                            {field!.inputType === "textarea" ? (
                              <textarea
                                id={id}
                                rows={4}
                                className={inputClass}
                                required={Boolean(field!.required)}
                                placeholder={field!.placeholder ?? undefined}
                                value={formAnswers[key] ?? ""}
                                onChange={(e) => setField(key, e.target.value)}
                              />
                            ) : (
                              <input
                                id={id}
                                type={field!.inputType ?? "text"}
                                className={inputClass}
                                required={Boolean(field!.required)}
                                placeholder={field!.placeholder ?? undefined}
                                autoComplete={addressAutoComplete(field!.fieldKey)}
                                value={formAnswers[key] ?? ""}
                                onChange={(e) => setField(key, e.target.value)}
                              />
                            )}
                          </label>
                        );
                      })}
                  </div>
                )}

                {error ? (
                  <p role="alert" className="mt-5 text-sm font-medium text-red-600">
                    {error}
                  </p>
                ) : null}

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => goToStep(step - 1)}
                      className="rounded-lg border border-border bg-white px-5 py-2.5 font-medium text-dark transition-colors hover:bg-border-light"
                    >
                      ← Back
                    </button>
                  ) : null}
                  {!isLast ? (
                    <button
                      type="button"
                      disabled={!canProceed}
                      onClick={next}
                      className="rounded-lg bg-dark px-5 py-2.5 font-medium text-white transition-colors hover:bg-dark/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canProceed || submitting}
                      onClick={submit}
                      className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {submitting ? "Sending…" : data.submitLabel || "Send enquiry"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {data.contactDetails ? (
            <div className="min-w-0">
              <ContactDetailsPanel data={data.contactDetails} />
            </div>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
