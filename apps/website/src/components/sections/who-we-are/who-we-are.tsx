import {
  AddStrapiEntry,
  StrapiEntry,
  StrapiEntryField,
  StrapiRelationEntry,
} from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
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
    <StrapiEntry entry={data}>
      <section className="bg-white">
        <div className="mx-auto grid max-w-container gap-10 px-6 py-[88px] lg:grid-cols-2 lg:items-center">
          <div className="min-w-0 flex flex-col">
            {overline ? (
              <StrapiEntryField field="overline">
                <p className="mb-2.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                  {overline}
                </p>
              </StrapiEntryField>
            ) : null}

            {title ? (
              <StrapiEntryField field="title">
                <h2 className="text-[2rem] leading-tight text-dark">{title}</h2>
              </StrapiEntryField>
            ) : null}

            {body ? (
              <StrapiEntryField field="body">
                <RichText
                  content={body}
                  variant="who-we-are-body"
                  className="mt-4 flex flex-col gap-5"
                />
              </StrapiEntryField>
            ) : null}

            {buttonItems.length ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {buttonItems.map((button) =>
                  button ? (
                    <StrapiEntry key={button.documentId} entry={button}>
                      <Button data={button} />
                    </StrapiEntry>
                  ) : null,
                )}

                <AddStrapiEntry field="buttons" />
              </div>
            ) : null}
          </div>

          <StrapiRelationEntry entry={imageContainer} field="imageContainer">
            <div className="min-w-0">
              <ImageContainer
                data={imageContainer}
                alt={imageContainer?.imgDescription ?? title ?? "Team photo"}
                placeholderLabel="Team photo placeholder"
              />
            </div>
          </StrapiRelationEntry>
        </div>
      </section>
    </StrapiEntry>
  );
}
