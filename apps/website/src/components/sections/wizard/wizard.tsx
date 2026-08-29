"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { DayPicker } from "@daypicker/react";
import "@daypicker/react/style.css";
import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryProvider,
  ZeroCmsList,
  useInspect,
} from "@usc/zero-cms-widget";
import { CmsImage } from "@/components/ui/cms-image";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import type { WizardSectionFragment } from "@/generated/graphql";
import { AvailabilityField } from "./availability-field";
import {
  DAYPICKER_THEME,
  TIME_WINDOWS,
  formatAvailability,
  formatDateLong,
  fromISODate,
  isAvailabilityComplete,
  toISODate,
  type AvailabilityEntry,
} from "./helpers";
import {
  ENQUIRY_FILE_ACCEPT as FILE_ACCEPT,
  ENQUIRY_MAX_FILES,
  ENQUIRY_MAX_TOTAL_BYTES,
  enquiryFileCapsText,
  formatBytes,
  planEnquiryDelivery,
  validateEnquiryFiles,
  type HostedAttachment,
} from "@/helpers/enquiry-files";

type WizardQuestion = NonNullable<WizardSectionFragment["questions"]>[number];
type WizardSectionProps = { data: WizardSectionFragment };

/**
 * A **Branch rule**: the condition an option card, a form field or a step's
 * wording variant carries, deciding whether the visitor in front of us should
 * see it.
 *
 * `appliesTo` lists the step-1 job-type cards it belongs to. Empty means always
 * — which is what every entry authored before this feature carries, so nothing
 * had to be migrated for the rollout.
 */
type BranchRule = {
  appliesTo?: ReadonlyArray<{ id: string } | null> | null;
  whenEmergency?: string | null;
};

/**
 * Everything a step's wording amounts to: a title, and an optional Step
 * introduction — a `rich-text-block` entry rather than inline blocks, so it
 * carries its own id and gets its own pencil.
 */
type StepIntro = { id: string; body?: unknown } | null | undefined;
type StepCopy = { title?: string | null; intro?: StepIntro };

/**
 * Identity for an Attachment across picks. The native input hands us a fresh
 * File object every time, so this triple is what lets a second pick append
 * without re-adding something already in the list.
 */
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

/** Files above this go up in parallel parts, with per-part retry — worth it for video. */
const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

// Postcode lookup (postcodes.io): matched by CMS fieldKey convention.
const POSTCODE_RE = /^post.?code$/i;
const TOWN_RE = /^(town|city)$/i;
const REGION_RE = /^(region|county)$/i;
// Contact + address fieldKey conventions, matched by `autoCompleteFor`. Written
// against the keys the CMS actually holds (`addressLine1`, `address2`, `email`,
// `phone`, `fullName`, `companyName`) plus the obvious near-misses an editor
// might type instead.
const ADDRESS_LINE2_RE = /^address(?:[-_ ]?line)?[-_ ]?2$/i;
const ADDRESS_LINE1_RE = /^address/i;
const EMAIL_RE = /email/i;
const PHONE_RE = /^(?:phone|tel|telephone|mobile|contact[-_ ]?number)$/i;
const COMPANY_RE = /^(?:company|organisation|organization)(?:[-_ ]?name)?$/i;
const GIVEN_NAME_RE = /^(?:first|given|fore)[-_ ]?name$/i;
const FAMILY_NAME_RE = /^(?:last|family|sur)[-_ ]?name$/i;
const NAME_RE = /name/i;
// Loose UK postcode shape (e.g. "N1 1AA", "SW1A 1AA"); postcodes.io is the source of truth.
const UK_POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
const POSTCODE_DEBOUNCE_MS = 700;

type PostcodeStatus = "idle" | "loading" | "found" | "notfound" | "error";

/**
 * Map a CMS fieldKey to an HTML autocomplete token.
 *
 * Order is load-bearing: the second address line has to be tested BEFORE the
 * generic `^address` rule, which previously swallowed it and handed both lines
 * `address-line1` — so a browser autofilled the same street into each.
 *
 * The contact fields matter as much as the address ones. Without a token a
 * browser cannot offer a saved name, email or phone, which is the slowest part
 * of the form to type on a phone and the part assistive tech most benefits from
 * having a declared purpose for (WCAG 1.3.5 Identify Input Purpose).
 */
function autoCompleteFor(fieldKey: string | null | undefined): string | undefined {
  const k = (fieldKey ?? "").trim();
  if (!k) return undefined;

  if (POSTCODE_RE.test(k)) return "postal-code";
  if (TOWN_RE.test(k)) return "address-level2";
  if (REGION_RE.test(k)) return "address-level1";
  if (ADDRESS_LINE2_RE.test(k)) return "address-line2";
  if (ADDRESS_LINE1_RE.test(k)) return "address-line1";
  if (EMAIL_RE.test(k)) return "email";
  if (PHONE_RE.test(k)) return "tel";
  if (COMPANY_RE.test(k)) return "organization";
  if (GIVEN_NAME_RE.test(k)) return "given-name";
  if (FAMILY_NAME_RE.test(k)) return "family-name";
  if (NAME_RE.test(k)) return "name";

  return undefined;
}

type CollectedAnswers = {
  fields: { label: string; value: string }[];
  files: File[];
  senderEmail: string;
  senderName: string;
};

/** 0-100 upload progress per hosted attachment, keyed by `fileKey`. */
type UploadProgress = Record<string, number>;

/**
 * Does this Branch rule match the visitor's current answers?
 *
 * Two independent gates, both of which must pass. `selected` is every
 * image-option id ticked anywhere in the wizard (in practice the job type from
 * step 1); `emergency` is the value of whichever boolean field is marked as the
 * emergency switch.
 */
function branchMatches(
  rule: BranchRule | null | undefined,
  selected: ReadonlySet<string>,
  emergency: boolean,
): boolean {
  if (!rule) return true;

  const appliesTo = (rule.appliesTo ?? []).filter(Boolean) as { id: string }[];
  if (appliesTo.length > 0 && !appliesTo.some((o) => selected.has(o.id))) return false;

  const when = rule.whenEmergency ?? "any";
  if (when === "only" && !emergency) return false;
  if (when === "never" && emergency) return false;

  return true;
}

export function WizardSection({ data }: WizardSectionProps) {
  // Inspect mode has to come from `useInspect`, never the provider's own flag:
  // the provider commits before deeper Suspense boundaries hydrate, and this
  // component sits well below one.
  const inspect = useInspect();
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
  // Availability answers can't live in `formAnswers` (strings only), same as files.
  const [availabilityAnswers, setAvailabilityAnswers] = useState<
    Record<string, AvailabilityEntry[]>
  >({});
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  // Honeypot. Both /api/enquiry and the upload-token route have always checked
  // `company_website`, but nothing ever rendered it — so the check was dead.
  const [honeypot, setHoneypot] = useState("");
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

  /**
   * Every image-option in the wizard, id → label. Branch rules store ids; the
   * editor badges and the enquiry email both want words.
   */
  const optionLabels = new Map<string, string>(
    questions.flatMap((q) =>
      q.__typename === "ImageQuestion"
        ? (q.options ?? []).filter(Boolean).map((o) => [o!.id, o!.label ?? ""] as const)
        : [],
    ),
  );

  const fieldValue = (questionId: string, key: string | null | undefined) =>
    formAnswers[`${questionId}:${key}`] ?? "";

  /**
   * Every image-option the visitor has ticked, by id, across every step.
   *
   * Answers are keyed by option **id** and not by label, which they used to be.
   * A Branch rule points at the option entry it depends on, and two options can
   * legitimately share a label ("Other" on two different steps) while a label
   * can be reworded at any time — neither is true of an id.
   */
  const selectedOptionIds = new Set(Object.values(imageAnswers).flat());

  /**
   * The emergency switch's current value. Found by the `isEmergencyFlag` marker
   * rather than by matching `fieldKey === 'emergency'`, so renaming the key in
   * the CMS cannot quietly detach every rule that depends on it.
   */
  const emergencyOn = questions.some(
    (q) =>
      q.__typename === "FormQuestion" &&
      (q.fields ?? []).some(
        (f) => f?.isEmergencyFlag && fieldValue(q.id, f.fieldKey) === "true",
      ),
  );

  const matches = (rule: BranchRule | null | undefined) =>
    branchMatches(rule, selectedOptionIds, emergencyOn);

  /** The older, same-step conditional: this field's sibling must match. */
  const passesDependsOn = (
    questionId: string,
    field: { dependsOnFieldKey?: string | null; dependsOnValue?: string | null },
  ) => {
    if (!field.dependsOnFieldKey) return true;
    return fieldValue(questionId, field.dependsOnFieldKey) === (field.dependsOnValue ?? "");
  };

  // A field shows when BOTH conditionals agree: the same-step `dependsOn`, and
  // the cross-step Branch rule.
  const isFieldVisible = (
    questionId: string,
    field: {
      dependsOnFieldKey?: string | null;
      dependsOnValue?: string | null;
    } & BranchRule,
  ) => matches(field) && passesDependsOn(questionId, field);

  /**
   * What an editor sees on a card or field whose Branch rule is not currently
   * satisfied — and on every card of a gated step, so a missing rule is as
   * visible as a wrong one. Inspect mode only.
   */
  const branchBadge = (rule: BranchRule, host?: WizardQuestion): string => {
    const names = (rule.appliesTo ?? [])
      .filter(Boolean)
      .map((o) => optionLabels.get(o!.id) ?? o!.id.slice(0, 6));
    const when = rule.whenEmergency ?? "any";
    const emergency =
      when === "only" ? " · emergency only" : when === "never" ? " · non-emergency" : "";

    if (names.length === 0) {
      // A gated step whose card names no job type shows for everyone — usually
      // an oversight rather than a decision, so say so rather than stay quiet.
      return host?.__typename === "ImageQuestion" && host.gatedBy
        ? `⚠ no job type set${emergency}`
        : `All job types${emergency}`;
    }
    return `${names.join(", ")}${emergency}`;
  };

  const toggleImage = (questionId: string, optionId: string, multi: boolean) =>
    setImageAnswers((prev) => {
      const existing = prev[questionId] ?? [];
      if (!multi) return { ...prev, [questionId]: [optionId] };
      return {
        ...prev,
        [questionId]: existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId],
      };
    });

  /**
   * The wording this step should use: the first variant whose Branch rule
   * matches, else the step's own title and Step introduction.
   *
   * This is what stops an hourly-repair visitor being asked "When do you plan
   * this renovation?" — one step, several sets of words, chosen by what they
   * already told us.
   */
  const stepCopy = (question: WizardQuestion): StepCopy => {
    const variant = (question.variants ?? []).find((v) => v && matches(v));
    return variant
      ? { title: variant.title, intro: variant.intro }
      : { title: question.title, intro: question.intro };
  };

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

  /**
   * Every Attachment in the enquiry, in the order the questions ask for them.
   * The caps and the inline/hosted split are properties of the whole enquiry,
   * not of one field, so both are computed over this — and it has to be the
   * same traversal `collectAnswers` uses, or the destination shown against a
   * row would not be the one the submit actually picks.
   */
  const orderedAttachments = (): File[] => {
    const out: File[] = [];
    for (const q of questions) {
      if (q.__typename !== "FormQuestion") continue;
      for (const f of q.fields ?? []) {
        if (!f?.fieldKey || f.inputType !== "file") continue;
        if (!isFieldVisible(q.id, f)) continue;
        out.push(...(fileAnswers[`${q.id}:${f.fieldKey}`] ?? []));
      }
    }
    return out;
  };

  /**
   * Adds a pick to the field's existing Attachments rather than replacing them,
   * so a visitor can upload a PDF, then come back and add a video and a photo.
   * Native `<input type=file>` replaces its own FileList on every pick, so the
   * accumulated set has to live in React state.
   *
   * Caps are checked against the MERGED set — per-pick checks would let three
   * picks of 100 MB each through.
   */
  const handleFiles = (key: string, list: FileList | null) => {
    const picked = list ? Array.from(list) : [];
    if (!picked.length) return;

    const existing = fileAnswers[key] ?? [];
    const seen = new Set(existing.map(fileKey));
    const added = picked.filter((f) => f.size > 0 && !seen.has(fileKey(f)));
    if (!added.length) {
      setError("Those files are already attached.");
      return;
    }

    const problem = validateEnquiryFiles([...orderedAttachments(), ...added]);
    if (problem) {
      // Keep what was already accepted — the previous version bailed out here
      // and left the visible list disagreeing with the input's own selection.
      setError(problem);
      return;
    }

    setError(null);
    setFileAnswers((prev) => ({ ...prev, [key]: [...existing, ...added] }));
  };

  const removeFile = (key: string, file: File) => {
    setError(null);
    setFileAnswers((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((f) => fileKey(f) !== fileKey(file)),
    }));
  };

  const canProceed = (() => {
    if (current.__typename === "ImageQuestion") {
      // Only a card the visitor can actually see counts — a selection carried
      // over from a since-hidden card must not unlock the step.
      const visible = new Set(
        (current.options ?? []).filter((o) => o && matches(o)).map((o) => o!.id),
      );
      return (imageAnswers[current.id] ?? []).some((id) => visible.has(id));
    }
    return (current.fields ?? []).every((f) => {
      if (!f) return true;
      if (!isFieldVisible(current.id, f)) return true;
      if (!f.required) return true;
      const key = `${current.id}:${f.fieldKey}`;
      if (f.inputType === "file") return (fileAnswers[key]?.length ?? 0) > 0;
      if (f.inputType === "availability")
        return isAvailabilityComplete(availabilityAnswers[key] ?? []);
      if (f.inputType === "boolean") return formAnswers[key] === "true";
      return (formAnswers[key] ?? "").trim().length > 0;
    });
  })();

  /** The wording this step is showing right now — its own, or a variant's. */
  const currentCopy = stepCopy(current);

  /**
   * Exactly what this step renders, in order. `<ZeroCmsList>` pairs its `items`
   * with its children by index, so the filtering has to happen once, here —
   * doing it again inside the map would slide the two out of alignment and hang
   * the wrong entry's pencil on a card.
   *
   * Outside edit mode a Branch-gated card is simply absent. Inside it every card
   * stays, dimmed and badged: an editor cannot fix the rules on a card they
   * cannot see.
   */
  const optionItems =
    current.__typename === "ImageQuestion"
      ? (current.options ?? []).filter((o) => o && (inspect || matches(o)))
      : [];

  // `dependsOn` is honoured even in edit mode — that one reacts to an answer on
  // this very step, so hiding it is the behaviour being previewed rather than a
  // rule being configured.
  const fieldItems =
    current.__typename === "FormQuestion"
      ? (current.fields ?? []).filter(
          (f) =>
            f &&
            (inspect ? passesDependsOn(current.id, f) : isFieldVisible(current.id, f)),
        )
      : [];

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
        // Answers are ids; the email wants the labels, and only for cards that
        // were actually offered — a stale tick behind a Branch rule the visitor
        // has since branched away from is not something they told us.
        const shown = (q.options ?? []).filter((o) => o && matches(o));
        const selected = shown.filter((o) => (imageAnswers[q.id] ?? []).includes(o!.id));
        if (selected.length) {
          fields.push({
            label: q.stepLabel || stepCopy(q).title || "Selection",
            value: selected.map((o) => o!.label ?? "").filter(Boolean).join(", "),
          });
        }
        for (const opt of selected) {
          if (opt!.revealTextInput) {
            const text = (optionText[opt!.id] ?? "").trim();
            if (text) fields.push({ label: `${opt!.label} — details`, value: text });
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
          if (f.inputType === "availability") {
            const value = formatAvailability(availabilityAnswers[key] ?? []);
            if (value) fields.push({ label: f.label || f.fieldKey, value });
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

      // Split the Attachments: fill the email's inline budget first, then send
      // whatever is left straight to Blob from here (ADR 0014). Uploading from
      // the browser is what makes a 40 MB video possible at all — /api/enquiry
      // could never receive it, Vercel caps a Function request body at ~4.5 MB.
      const { inline, hosted } = planEnquiryDelivery(files);
      const hostedLinks: HostedAttachment[] = [];
      if (hosted.length) {
        const { upload } = await import("@vercel/blob/client");
        for (const file of hosted) {
          const result = await upload(`enquiry/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/enquiry/upload-token",
            clientPayload: JSON.stringify({ honeypot }),
            contentType: file.type || "application/octet-stream",
            multipart: file.size > MULTIPART_THRESHOLD_BYTES,
            onUploadProgress: ({ percentage }) =>
              setUploadProgress((p) => ({ ...p, [fileKey(file)]: percentage })),
          });
          hostedLinks.push({
            name: file.name,
            size: file.size,
            url: result.url,
          });
        }
      }

      const body = new FormData();
      body.append(
        "payload",
        JSON.stringify({ fields, senderEmail, senderName, hostedLinks }),
      );
      body.append("company_website", honeypot);
      inline.forEach((file) => body.append("attachments", file, file.name));

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
    pending: "bg-white text-muted border-border",
  } as const;

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-4 py-2.5 text-dark outline-none focus:border-gold";

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-surface">
        {/* Full width. The Contact Details panel used to take a 1fr column on
            the right, squeezing the form — the room cards, the calendar and the
            address rows all wanted the space more than a phone number does.
            Contact details now sit in their own section below the wizard, where
            they get the whole width too. */}
        <div className="mx-auto max-w-container px-6 py-[72px]">
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
                      <span className={`text-[10px] font-bold tracking-[0.1em] uppercase sr-only md:not-sr-only ${state === "pending" ? "text-muted" : "text-dark"}`}>
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
              // Everything below belongs to the CURRENT question, not to the
              // wizard: the provider re-points `<ZeroCmsList field="options">`
              // and `field="fields"` at this step, and it is a Provider rather
              // than a <ZeroCmsEntry> so it draws no outline of its own and
              // cannot swallow the pencils inside it.
              <ZeroCmsEntryProvider entry={current}>
              <div className="mt-10">
                <p className="text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                  Step {step + 1} of {total}
                  {current.stepLabel ? ` — ${current.stepLabel}` : ""}
                </p>
                {/* The step's own heading and hint are fields of the question
                    entry, so the pencil here opens exactly those — along with
                    its wording variants and its Branch gate. The Step
                    introduction is no longer part of this block; it renders
                    below the inputs. */}
                <ZeroCmsEntry entry={current}>
                  <div>
                    {currentCopy.title ? (
                      <h2 className="mt-2 font-serif text-[clamp(24px,3.5vw,34px)] leading-tight text-dark">
                        {currentCopy.title}
                      </h2>
                    ) : null}
                    {current.hint ? (
                      <p className="mt-2 text-sm text-muted">{current.hint}</p>
                    ) : null}
                  </div>
                </ZeroCmsEntry>

                {current.__typename === "ImageQuestion" ? (
                  <>
                    <ZeroCmsList
                      className="mt-6 grid gap-4 sm:grid-cols-2"
                      field="options"
                      items={optionItems}
                    >
                      {optionItems.map((option) => {
                        const label = option!.label ?? "";
                        const selected = (imageAnswers[current.id] ?? []).includes(option!.id);
                        const live = matches(option!);
                        return (
                          <ZeroCmsEntry key={option!.id} entry={option!}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleImage(current.id, option!.id, Boolean(current.multiSelect))}
                            className={`group relative h-44 overflow-hidden rounded-2xl border-2 text-left transition-colors ${selected ? "border-gold" : "border-transparent hover:border-gold/40"} ${live ? "" : "border-dashed border-gold/60 opacity-45"}`}
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
                            {inspect ? (
                              <span className="absolute left-3 top-3 rounded-full bg-dark/85 px-2 py-1 text-[10px] font-semibold tracking-wide text-white">
                                {branchBadge(option!, current)}
                              </span>
                            ) : null}
                          </button>
                          </ZeroCmsEntry>
                        );
                      })}
                    </ZeroCmsList>

                    {/* Reveal a free-text box for any selected option that asks for detail. */}
                    {(current.options ?? []).filter(Boolean).map((option) => {
                      const label = option!.label ?? "";
                      const selected =
                        (imageAnswers[current.id] ?? []).includes(option!.id) &&
                        matches(option!);
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
                  <ZeroCmsList
                    className="mt-6 flex flex-col gap-4"
                    field="fields"
                    items={fieldItems}
                  >
                    {/* Every control is one `form-field` entry, so each gets its
                        own pencil — label, key, input type, required, the
                        Branch rule and the Availability settings all live
                        there. The control itself is built by an inline IIFE
                        rather than a named function purely so the existing
                        per-input-type branches keep their `return`s; the
                        wrapper is what had to change, not the 250 lines of
                        rendering inside it. */}
                    {fieldItems.map((field) => (
                      <ZeroCmsEntry key={field!.id} entry={field!}>
                        {(() => {
                        const key = `${current.id}:${field!.fieldKey}`;
                        const id = `wizard-${field!.id}`;
                        const gated = !matches(field!);
                        const labelText = (
                          <span className="text-sm font-medium text-dark">
                            {field!.label}
                            {field!.required ? (
                              <span className="text-gold" aria-hidden>
                                {" *"}
                              </span>
                            ) : null}
                            {gated ? (
                              <span className="ml-2 rounded-full bg-dark/85 px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-white">
                                {branchBadge(field!)}
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
                          // Counts and the inline/hosted split span the whole
                          // enquiry, not this field. Recomputed on every change
                          // because removing a file can promote a later one back
                          // into the inline budget.
                          const allFiles = orderedAttachments();
                          const totalBytes = allFiles.reduce((s, f) => s + f.size, 0);
                          const { inline } = planEnquiryDelivery(allFiles);
                          const inlineKeys = new Set(inline.map(fileKey));
                          const capsId = `${id}-caps`;
                          return (
                            <div key={field!.id} className="flex flex-col gap-1.5">
                              <label htmlFor={id}>{labelText}</label>
                              <input
                                id={id}
                                type="file"
                                multiple
                                accept={FILE_ACCEPT}
                                aria-describedby={capsId}
                                onChange={(e) => {
                                  handleFiles(key, e.target.files);
                                  // Clear the native selection so picking the same
                                  // file again still fires `change`, and so the
                                  // control never contradicts our own list.
                                  e.target.value = "";
                                }}
                                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-border-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-dark outline-none focus:border-gold"
                              />

                              {files.length ? (
                                <ul className="mt-1 flex flex-col gap-1.5">
                                  {files.map((f) => {
                                    const k = fileKey(f);
                                    const isInline = inlineKeys.has(k);
                                    const pct = uploadProgress[k];
                                    return (
                                      <li
                                        key={k}
                                        className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-3 py-2"
                                      >
                                        <span aria-hidden="true">📎</span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-sm text-dark">
                                            {f.name}
                                          </span>
                                          <span className="block text-xs text-muted">
                                            {formatBytes(f.size)}
                                            {" · "}
                                            {isInline
                                              ? "attached to the email"
                                              : "sent as a download link"}
                                            {typeof pct === "number" && pct < 100
                                              ? ` · uploading ${Math.round(pct)}%`
                                              : ""}
                                          </span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeFile(key, f)}
                                          disabled={submitting}
                                          aria-label={`Remove ${f.name}`}
                                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-border-light hover:text-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
                                        >
                                          <span aria-hidden="true">✕</span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : null}

                              {/* Caps stay visible once files are picked — they used
                                  to be replaced by the file list, which is exactly
                                  when a visitor needs to know what is left. */}
                              <span id={capsId} className="text-xs text-muted">
                                {enquiryFileCapsText()}
                                {allFiles.length ? (
                                  <>
                                    {" "}
                                    <span className="text-dark">
                                      {allFiles.length} of {ENQUIRY_MAX_FILES} files ·{" "}
                                      {formatBytes(totalBytes)} of{" "}
                                      {formatBytes(ENQUIRY_MAX_TOTAL_BYTES)} used.
                                    </span>
                                  </>
                                ) : null}
                              </span>
                            </div>
                          );
                        }

                        if (field!.inputType === "availability") {
                          return (
                            <AvailabilityField
                              key={field!.id}
                              id={id}
                              labelText={labelText}
                              field={field!}
                              emergency={emergencyOn}
                              value={availabilityAnswers[key] ?? []}
                              onChange={(next) =>
                                setAvailabilityAnswers((prev) => ({ ...prev, [key]: next }))
                              }
                            />
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
                                autoComplete={autoCompleteFor(field!.fieldKey)}
                                value={formAnswers[key] ?? ""}
                                onChange={(e) => setField(key, e.target.value)}
                              />
                            )}
                          </label>
                        );
                        })()}
                      </ZeroCmsEntry>
                    ))}
                  </ZeroCmsList>
                )}

                {/* The Step introduction, BELOW the inputs rather than above
                    them. Above the options it sat between the question and the
                    answers, pushing the thing being asked about off the first
                    screen on a phone; the copy is context for a choice already
                    on screen, so it reads after it. Still the question's own
                    `body` (or the matching variant's), so the pencil opens the
                    same field it always did. */}
                {currentCopy.intro?.body ? (
                  // Wrapped on the BLOCK, not the question: the introduction is
                  // its own entry now, so its pencil should open that block's
                  // rich text rather than the whole step's form.
                  <ZeroCmsEntry entry={currentCopy.intro}>
                    <div className="mt-8 max-w-2xl border-t border-border-light pt-6">
                      <RichTextViewer content={currentCopy.intro.body} />
                    </div>
                  </ZeroCmsEntry>
                ) : null}

                {/* Honeypot — off-screen rather than display:none so bots that
                    skip hidden inputs still fill it. Never announced, never
                    tabbable, never labelled for a human. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <input
                    type="text"
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

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
              </ZeroCmsEntryProvider>
            )}

            {/* Adding a STEP belongs to the wizard, not to the step you happen
                to be looking at — so it sits outside the question's provider,
                where `field="questions"` resolves against the wizard entry.
                Only one step is on screen at a time, so there is no list to
                hang an insert slot off; this appends, and the new step's own
                pencil is reached by stepping to it. */}
            {inspect ? (
              <div className="mt-8 border-t border-border pt-4">
                <p className="mb-2 text-[11px] font-bold tracking-[0.12em] text-gold-deep uppercase">
                  Wizard steps
                </p>
                <AddZeroCmsEntry field="questions" />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
