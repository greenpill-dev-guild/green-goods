import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import { EditorialLede } from "./atoms";

export interface PublicStatementProps {
  /** The state's own words, drawn as the website's serif sentence. */
  title: ReactNode;
  /** A page's state names the page (`h1`); a list's names its section (`h2`). */
  titleAs?: "h1" | "h2" | "p";
  /**
   * Ties the sentence to the region it names. A page title with an id also takes focus when the
   * reporting pages' focused shell moves to a new step.
   */
  headingId?: string;
  /** One plain line under the sentence. */
  description?: ReactNode;
  /** The state's own act, as a website button. */
  action?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}

/**
 * A state in the website's voice (DL-121): its own words as the serif italic sentence a failed
 * public read says (`PublicReadUnavailable`), one plain line under it, and its act as a website
 * button. No mark, tile or illustration, since the website draws none (DESIGN.browser.md).
 */
export function PublicStatement({
  title,
  titleAs: Title = "p",
  headingId,
  description,
  action,
  role,
  className,
}: PublicStatementProps) {
  return (
    <div role={role} data-component="PublicStatement" className={cn("max-w-md", className)}>
      <Title
        id={headingId}
        tabIndex={headingId ? -1 : undefined}
        className="font-serif text-xl italic text-text-soft-400 focus:outline-none"
      >
        {title}
      </Title>
      {description ? <EditorialLede className="mt-2">{description}</EditorialLede> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
