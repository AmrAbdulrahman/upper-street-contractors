import {
  AddStrapiEntry,
  StrapiEntry,
  StrapiEntryField,
} from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
import { Button } from "@/components/ui/button";
import { PlanningRenovationSectionFragment } from "@/generated/graphql";

type PlanningRenovationSectionProps = {
  data: PlanningRenovationSectionFragment;
};

export function PlanningRenovationSection({
  data,
}: PlanningRenovationSectionProps) {
  const { overline, title, description, footer, buttons } = data;
  const buttonItems = buttons?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={data}>
      <section className="bg-dark text-center text-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          {overline ? (
            <StrapiEntryField field="overline">
              <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                {overline}
              </p>
            </StrapiEntryField>
          ) : null}

          {title ? (
            <StrapiEntryField field="title">
              <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-white">
                {title}
              </h2>
            </StrapiEntryField>
          ) : null}

          {description ? (
            <StrapiEntryField field="description">
              <p className="mx-auto mt-4 max-w-[500px] text-lg leading-relaxed text-subtle">
                {description}
              </p>
            </StrapiEntryField>
          ) : null}

          {buttonItems.length ? (
            <div className="mt-10 flex flex-wrap justify-center gap-3.5">
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

          {footer ? (
            <StrapiEntryField field="footer">
              <RichText
                content={footer}
                variant="planning-renovation-footer"
                className="mx-auto mt-6 max-w-xl"
              />
            </StrapiEntryField>
          ) : null}
        </div>
      </section>
    </StrapiEntry>
  );
}
