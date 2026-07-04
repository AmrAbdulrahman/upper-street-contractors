"use client";

import { Fragment, useEffect, useState } from "react";
import { ZeroCmsEntry } from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { ContactDetailsPanel } from "../contact-details";
import type { WizardSectionFragment } from "@/generated/graphql";

type WizardQuestion = NonNullable<WizardSectionFragment["questions"]>[number];
type WizardSectionProps = { data: WizardSectionFragment };

const AUTO_OPEN_SECONDS = 5;

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function buildWhatsappUrl(
  number: string | null | undefined,
  questions: WizardQuestion[],
  imageAnswers: Record<string, string[]>,
  formAnswers: Record<string, string>,
): string | null {
  const digits = digitsOnly(number);
  if (!digits) return null;

  const lines: string[] = ["Hi, I'd like to enquire about a project.", ""];
  for (const q of questions) {
    if (q.__typename === "ImageQuestion") {
      const selected = imageAnswers[q.id] ?? [];
      if (selected.length) {
        lines.push(`${q.stepLabel || q.title || "Selection"}: ${selected.join(", ")}`);
      }
    } else if (q.__typename === "FormQuestion") {
      for (const field of q.fields ?? []) {
        if (!field?.fieldKey) continue;
        const value = (formAnswers[`${q.id}:${field.fieldKey}`] ?? "").trim();
        if (value) lines.push(`${field.label || field.fieldKey}: ${value}`);
      }
    }
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function WizardSection({ data }: WizardSectionProps) {
  const questions = (data.questions ?? []).filter(Boolean) as WizardQuestion[];
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [done, setDone] = useState(false);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_OPEN_SECONDS);
  const [imageAnswers, setImageAnswers] = useState<Record<string, string[]>>({});
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});

  // After the form is submitted, open WhatsApp (prefilled) in a new tab after 5s.
  useEffect(() => {
    if (!done || !waUrl) return;
    setCountdown(AUTO_OPEN_SECONDS);
    let remaining = AUTO_OPEN_SECONDS;
    const id = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        window.open(waUrl, "_blank", "noopener,noreferrer");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [done, waUrl]);

  const total = questions.length;
  if (total === 0) return null;

  const current = questions[Math.min(step, total - 1)];
  const isLast = step === total - 1;

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

  const canProceed = (() => {
    if (current.__typename === "ImageQuestion") {
      return (imageAnswers[current.id] ?? []).length > 0;
    }
    return (current.fields ?? []).every((f) =>
      f?.required
        ? (formAnswers[`${current.id}:${f.fieldKey}`] ?? "").trim().length > 0
        : true,
    );
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

  const submit = () => {
    setWaUrl(buildWhatsappUrl(data.whatsappNumber, questions, imageAnswers, formAnswers));
    setDone(true);
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

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        <div className="mx-auto grid max-w-container gap-8 px-6 py-[72px] lg:grid-cols-[1.6fr_1fr] lg:items-start">
          {/* Left — stepper + steps */}
          <div className="min-w-0">
            {/* Stepper */}
            <ol className="flex items-start">
              {nodes.map((node, i) => {
                const state = dotState(i);
                const connectorLit = done || i <= step;
                const canClick = node.clickable && i <= maxStep && !(done && false);
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
                  {data.doneTitle || "Thanks — opening WhatsApp"}
                </h2>
                {data.doneMessage ? (
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
                    {data.doneMessage}
                  </p>
                ) : null}
                {waUrl ? (
                  <>
                    <p className="mt-5 text-sm text-muted">
                      Opening WhatsApp in {Math.max(0, countdown)}s…
                    </p>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 font-medium text-white transition-[filter] hover:brightness-110"
                    >
                      💬 Open WhatsApp now
                    </a>
                  </>
                ) : (
                  <p className="mt-5 text-sm text-muted">
                    No WhatsApp number configured for this form.
                  </p>
                )}
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
                ) : (
                  <div className="mt-6 flex flex-col gap-4">
                    {(current.fields ?? []).filter(Boolean).map((field) => {
                      const key = `${current.id}:${field!.fieldKey}`;
                      const id = `wizard-${field!.id}`;
                      const common = {
                        id,
                        value: formAnswers[key] ?? "",
                        required: Boolean(field!.required),
                        placeholder: field!.placeholder ?? undefined,
                        className:
                          "w-full rounded-lg border border-border bg-white px-4 py-2.5 text-dark outline-none focus:border-gold",
                      };
                      return (
                        <label key={field!.id} className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-dark">
                            {field!.label}
                            {field!.required ? (
                              <span className="text-gold" aria-hidden>
                                {" *"}
                              </span>
                            ) : null}
                          </span>
                          {field!.inputType === "textarea" ? (
                            <textarea {...common} rows={4} onChange={(e) => setField(key, e.target.value)} />
                          ) : (
                            <input
                              {...common}
                              type={field!.inputType ?? "text"}
                              onChange={(e) => setField(key, e.target.value)}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

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
                      disabled={!canProceed}
                      onClick={submit}
                      className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-6 py-2.5 font-medium text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      💬 {data.submitLabel || "Send on WhatsApp"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right — contact details panel */}
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
