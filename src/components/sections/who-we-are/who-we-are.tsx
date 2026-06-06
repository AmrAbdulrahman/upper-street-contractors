import { AddContentfulEntry, ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { RichText } from "@/components/contentful/rich-text";
import { Button } from "@/components/ui/button";
import { ImageContainer } from "@/components/ui/image-container";
import { WhoWeAreSectionFragment } from "@/generated/graphql";
import type { Document } from "@contentful/rich-text-types";

type WhoWeAreSectionProps = {
  data: WhoWeAreSectionFragment;
};

export function WhoWeAreSection({ data }: WhoWeAreSectionProps) {
  const { overline, title, body, imageContainer, buttonsCollection } = data;
  const bodyDocument = body?.json as Document | undefined;

  return (
    <ContentfulEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto grid max-w-container gap-10 px-6 py-[88px] lg:grid-cols-2 lg:items-center">
          <div className="min-w-0 flex flex-col">
            {overline ? (
              <ContentfulEntryField field="overline">
                <p className="mb-2.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </ContentfulEntryField>
            ) : null}

            {title ? (
              <ContentfulEntryField field="title">
                <h2 className="text-[2rem] leading-tight text-dark">{title}</h2>
              </ContentfulEntryField>
            ) : null}

            {bodyDocument ? (
              <ContentfulEntryField field="body">
                <RichText
                  document={bodyDocument}
                  variant="who-we-are-body"
                  className="mt-4 flex flex-col gap-5"
                />
              </ContentfulEntryField>
            ) : null}

            {buttonsCollection?.items?.length ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {buttonsCollection.items.map((button) =>
                  button ? (
                    <ContentfulEntry key={button._id} entry={button}>
                      <Button data={button} />
                    </ContentfulEntry>
                  ) : null,
                )}

                <AddContentfulEntry field="buttons" />
              </div>
            ) : null}
          </div>

          <ContentfulEntryField field="imageContainer">
            <ImageContainer
              data={imageContainer}
              alt={imageContainer?.imgDescription ?? title ?? "Team photo"}
              placeholderLabel="Team photo placeholder"
            />
          </ContentfulEntryField>
        </div>
      </section>
    </ContentfulEntry>
  );
}
