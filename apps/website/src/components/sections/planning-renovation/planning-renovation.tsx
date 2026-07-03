import {
  AddZeroCmsEntry,
  ZeroCmsEntry,
  ZeroCmsEntryField,
} from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
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
    <ZeroCmsEntry entry={data}>
      <section className="bg-dark text-center text-white">
        <div className="mx-auto max-w-container px-6 py-[88px]">
          {overline ? (
            <ZeroCmsEntryField field="overline">
              <p className="text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                {overline}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {title ? (
            <ZeroCmsEntryField field="title">
              <h2 className="mt-2.5 text-[clamp(26px,3.5vw,42px)] leading-tight text-white">
                {title}
              </h2>
            </ZeroCmsEntryField>
          ) : null}

          {description ? (
            <ZeroCmsEntryField field="description">
              <p className="mx-auto mt-4 max-w-[500px] text-lg leading-relaxed text-subtle">
                {description}
              </p>
            </ZeroCmsEntryField>
          ) : null}

          {buttonItems.length ? (
            <div className="mt-10 flex flex-wrap justify-center gap-3.5">
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

          {footer ? (
            <ZeroCmsEntryField field="footer">
              <RichTextViewer
                content={footer}
                variant="planning-renovation-footer"
                className="mx-auto mt-6 max-w-xl"
              />
            </ZeroCmsEntryField>
          ) : null}
        </div>
      </section>
    </ZeroCmsEntry>
  );
}
