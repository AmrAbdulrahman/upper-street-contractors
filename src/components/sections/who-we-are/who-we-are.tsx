import { AddContentfulEntry, ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { Button } from "@/components/ui/button";
import { WhoWeAreSectionFragment } from "@/generated/graphql";


type WhoWeAreSectionProps = {
  data: WhoWeAreSectionFragment;
}

export function WhoWeAreSection({ data }: WhoWeAreSectionProps) {
  // const { data } = await getClient().query({
  //   query: GetHomeHeroSectionDocument,
  // });

  // const hero = data?.homeHeaderSectionCollection?.items?.at(0) ?? null;

  // if (!hero) {
  //   return null;
  // }

  const { overline, title, body, buttonsCollection } = data;

  return (
    <ContentfulEntry entry={data}>
      <section className="relative overflow-hidden text-white">
        <div className="min-w-0 flex flex-col gap-8">
          {overline ? (
            <ContentfulEntryField field="overline">
              <p className="flex items-center gap-2 text-xs font-medium tracking-[0.22em] text-gold uppercase">
                {overline}
              </p>
            </ContentfulEntryField>
          ) : null}

        {title ? (
          <ContentfulEntryField field="title">
            <h1 className="text-4xl leading-[1.15] tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
          </ContentfulEntryField>
        ) : null}

        {body ? (
          <ContentfulEntryField field="body">
            <p className="max-w-xl text-lg leading-relaxed text-subtle">
              {body}
            </p>
          </ContentfulEntryField>
        ) : null}

        {buttonsCollection?.items?.length ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
      </section>
    </ContentfulEntry>
  );
}
