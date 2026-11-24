import { type ReactNode, useId } from "react";

interface HomeSectionProps {
  /** The section's heading: Title Case in English, sentence case in Spanish and Portuguese. */
  title: string;
  /** A note under the heading, one line where it can be. */
  description?: string;
  children: ReactNode;
}

/**
 * One of Home's sections: a region named by its heading over a list of rows that keep the
 * list's 12px gap (DL-113). The journal's sections share it.
 */
export function HomeSection({ title, description, children }: HomeSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="type-title-sm text-text-strong">
          {title}
        </h2>
        {description ? <p className="type-label-sm text-text-sub">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-(--gg-list-gap)">{children}</div>
    </section>
  );
}
