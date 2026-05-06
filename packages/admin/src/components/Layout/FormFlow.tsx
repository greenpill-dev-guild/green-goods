import { cn, SheetBody, SheetFooter, Surface, type Step } from "@green-goods/shared";
import type { ReactNode } from "react";

export interface FormFlowSection {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  content: ReactNode;
}

export interface FormFlowProps {
  sections: FormFlowSection[];
  actions: ReactNode;
  intro?: ReactNode;
  feedback?: ReactNode;
  layout?: "page" | "sheet";
  className?: string;
  "aria-label"?: string;
}

export function toFormFlowSections(
  steps: Step[],
  contentByStepId: Record<string, ReactNode>
): FormFlowSection[] {
  return steps.map((step) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    content: contentByStepId[step.id],
  }));
}

export function FormFlow({
  sections,
  actions,
  intro,
  feedback,
  layout = "page",
  className,
  "aria-label": ariaLabel,
}: FormFlowProps) {
  const sectionsBlock = (
    <>
      {intro ? (
        <div data-region="form-flow-intro" className="text-sm text-text-sub">
          {intro}
        </div>
      ) : null}

      {feedback ? <div data-region="form-flow-feedback">{feedback}</div> : null}

      <div data-region="form-flow-sections" className="space-y-4">
        {sections.map((section, index) => (
          <Surface
            key={section.id}
            as="section"
            elevation="solid-raised"
            padding="none"
            radius="lg"
            data-region={`form-section-${section.id}`}
            aria-labelledby={`form-section-${section.id}-title`}
            className="overflow-hidden border border-stroke-soft-200"
          >
            <div className="flex items-start gap-3 border-b border-stroke-soft-200 px-4 py-3 sm:px-5 sm:py-4">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-bg-weak px-2 text-xs font-semibold text-text-sub">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id={`form-section-${section.id}-title`}
                  className="text-label-lg font-semibold text-text-strong"
                >
                  {section.title}
                </h2>
                {section.description ? (
                  <p className="mt-0.5 text-sm text-text-sub">{section.description}</p>
                ) : null}
              </div>
            </div>
            <div className="px-4 py-4 sm:px-5 sm:py-5">{section.content}</div>
          </Surface>
        ))}
      </div>
    </>
  );

  // Sheet layout: SheetBody (scrolls) + pinned SheetFooter so the actions
  // stay reachable on long forms. Per handoff `sheet-system.css` anatomy.
  if (layout === "sheet") {
    return (
      <>
        <SheetBody padded={true} className={cn("space-y-4", className)}>
          <div data-component="FormFlow" data-layout="sheet" aria-label={ariaLabel}>
            {sectionsBlock}
          </div>
        </SheetBody>
        <SheetFooter>
          <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {actions}
          </div>
        </SheetFooter>
      </>
    );
  }

  return (
    <div
      data-component="FormFlow"
      data-layout={layout}
      aria-label={ariaLabel}
      className={cn("mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6", className)}
    >
      {sectionsBlock}

      <Surface
        as="footer"
        elevation="solid-raised"
        padding="compact"
        radius="lg"
        data-region="form-flow-actions"
        className="mt-4 border border-stroke-soft-200"
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      </Surface>
    </div>
  );
}
