import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { CmsImage } from "@/components/ui/cms-image";
import { ReviewCardFragment } from "@/generated/graphql";
import Link from "next/link";

type ReviewCardProps = {
  data: ReviewCardFragment;
};

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

function parseReviewScore(score: unknown): number {
  if (score == null || score === "") return 0;

  const parsed =
    typeof score === "number" ? score : Number.parseFloat(String(score));

  if (!Number.isFinite(parsed)) return 0;

  return Math.max(0, Math.min(5, parsed));
}

function FilledStar() {
  return (
    <svg
      className="size-4 text-gold"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

function EmptyStar() {
  return (
    <svg
      className="size-4 text-border"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

function HalfStar() {
  return (
    <span className="relative inline-block size-4" aria-hidden>
      <EmptyStar />
      <svg
        className="absolute inset-0 size-4 text-gold"
        viewBox="0 0 20 20"
        fill="currentColor"
        style={{ clipPath: "inset(0 50% 0 0)" }}
        aria-hidden
      >
        <path d={STAR_PATH} />
      </svg>
    </span>
  );
}

function StarRating({ score }: { score?: number | null }) {
  const rating = parseReviewScore(score);
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: fullStars }).map((_, index) => (
        <FilledStar key={`full-${index}`} />
      ))}
      {hasHalf ? <HalfStar /> : null}
      {Array.from({ length: emptyStars }).map((_, index) => (
        <EmptyStar key={`empty-${index}`} />
      ))}
    </div>
  );
}

function ReviewProfile({
  clientInfo,
}: {
  clientInfo: NonNullable<ReviewCardFragment["clientInfo"]>;
}) {
  const { name, reviewSource, location, image } = clientInfo;
  const meta =
    [reviewSource, location].filter(Boolean).join(" · ") || null;

  // Wrap in the clientInfo entry's own ZeroCmsEntry so clicking the reviewer
  // block opens the Client Review Info entry (its name/source/image fields)
  // rather than the parent review card. Inner fields are now relative to it.
  return (
    <ZeroCmsEntry entry={clientInfo}>
      <div className="mt-auto flex items-center gap-3 pt-6">
        <ZeroCmsEntryField field="image">
          <div className="size-10 shrink-0 overflow-hidden rounded-full">
            <CmsImage
              data={image}
              fallbackAlt={name ?? "Reviewer"}
              placeholderLabel={name?.charAt(0)?.toUpperCase() ?? "?"}
              className="size-10 rounded-full object-cover"
            />
          </div>
        </ZeroCmsEntryField>

        <div className="min-w-0">
          {name ? (
            <ZeroCmsEntryField field="name">
              <p className="truncate text-sm font-bold text-dark">{name}</p>
            </ZeroCmsEntryField>
          ) : null}

          {meta ? (
            <ZeroCmsEntryField field="reviewSource">
              <p className="truncate text-xs text-subtle">{meta}</p>
            </ZeroCmsEntryField>
          ) : null}
        </div>
      </div>
    </ZeroCmsEntry>
  );
}

export function ReviewCard({ data }: ReviewCardProps) {
  const { score, clientReview, clientInfo } = data;

  const cardClassName =
    "flex h-full flex-col rounded-2xl border border-border bg-white p-6 shadow-sm transition-shadow";

  const card = (
    <article
      className={
        clientInfo?.reviewLink
          ? `${cardClassName} group-hover:shadow-md`
          : cardClassName
      }
    >
      <ZeroCmsEntryField field="score">
        <StarRating score={score} />
      </ZeroCmsEntryField>

      {clientReview ? (
        <ZeroCmsEntryField field="clientReview" className="mt-4 min-w-0 flex-1">
          <RichTextViewer
            content={clientReview}
            variant="review-card-body"
            className="text-[15px] leading-relaxed text-muted"
          />
        </ZeroCmsEntryField>
      ) : null}

      {clientInfo ? <ReviewProfile clientInfo={clientInfo} /> : null}
    </article>
  );

  if (clientInfo?.reviewLink) {
    return (
      <ZeroCmsEntry entry={data}>
        <Link
          href={clientInfo.reviewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          aria-label={
            clientInfo.name
              ? `Read ${clientInfo.name}'s review on ${clientInfo.reviewSource ?? "external site"}`
              : "Read review"
          }
        >
          {card}
        </Link>
      </ZeroCmsEntry>
    );
  }

  return <ZeroCmsEntry entry={data}>{card}</ZeroCmsEntry>;
}
