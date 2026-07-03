import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryField,
  ZeroCmsRelationEntry,
} from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { Button } from "@/components/ui/button";
import { ImageContainer } from "@/components/ui/image-container";
import { WhoWeAreSectionFragment } from "@/generated/graphql";

type WhoWeAreSectionProps = {
  data: WhoWeAreSectionFragment;
};

export function WhoWeAreSection({ data }: WhoWeAreSectionProps) {
  const { overline, title, body, imageContainer, buttons } = data;
  const buttonItems = buttons?.filter(Boolean) ?? [];

  return (
    <ZeroCmsEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto grid max-w-container gap-10 px-6 py-[88px] lg:grid-cols-2 lg:items-center">
          <div className="min-w-0 flex flex-col">
            {overline ? (
              <ZeroCmsEntryField field="overline">
                <p className="mb-2.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </ZeroCmsEntryField>
            ) : null}

            {title ? (
              <ZeroCmsEntryField field="title">
                <h2 className="text-[2rem] leading-tight text-dark">{title}</h2>
              </ZeroCmsEntryField>
            ) : null}

            {body ? (
              <ZeroCmsEntryField field="body">
                <RichTextViewer
                  content={body}
                  variant="who-we-are-body"
                  className="mt-4 flex flex-col gap-5"
                />
              </ZeroCmsEntryField>
            ) : null}

            {buttonItems.length ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {buttonItems.map((button) =>
                  button ? (
                    <ZeroCmsEntry key={button.id} entry={button}>
                      <Button data={button} />
                    </ZeroCmsEntry>
                  ) : null,
                )}

                <AddZeroCmsEntry field="buttons" />
              </div>
            ) : null}
          </div>

          <ZeroCmsRelationEntry entry={imageContainer} field="imageContainer">
            <div className="min-w-0">
              <ImageContainer
                data={imageContainer}
                alt={imageContainer?.imgDescription ?? title ?? "Team photo"}
                placeholderLabel="Team photo placeholder"
              />
            </div>
          </ZeroCmsRelationEntry>
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
