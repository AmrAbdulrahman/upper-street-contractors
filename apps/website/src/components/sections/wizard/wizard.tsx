"use client";

import { Fragment, useState } from "react";
import { ZeroCmsEntry } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { ContactDetailsPanel } from "../contact-details";
import type { WizardSectionFragment } from "@/generated/graphql";

type WizardQuestion = NonNullable<WizardSectionFragment["questions"]>[number];
type WizardSectionProps = { data: WizardSectionFragment };

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB
const FILE_ACCEPT = "image/*,.pdf,.doc,.docx";

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
          if (value) fields.push({ label: f.label || f.fieldKey, value });
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
                        className="mt-[17px] h-0.5 flex-1 rounded"
                        style={{ background: connectorLit ? "var(--color-gold)" : "var(--color-border)" }}
                      />
                    ) : null}
                    <li className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
                      <button
                        type="button"
                        disabled={!canClick}
                        aria-current={state === "current" ? "step" : undefined}
                        onClick={() => goToStep(i)}
                        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border text-sm font-semibold transition-colors ${dotClass[state]} ${canClick ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {i === nodes.length - 1 || state === "complete" ? "✓" : i + 1}
                      </button>
                      <span className={`text-[10px] font-bold tracking-[0.1em] uppercase ${state === "pending" ? "text-subtle" : "text-dark"}`}>
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
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
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
