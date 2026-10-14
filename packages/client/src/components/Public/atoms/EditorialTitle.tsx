import type { ReactNode } from "react";
import { EditorialTitleAccent } from "./EditorialAtoms";

export interface EditorialTitleLineProps {
  children: ReactNode;
}

/**
 * One authored line of a hero title. A title written as lines keeps the same number of lines
 * at every width instead of taking whatever the card's measure gives it. A line longer than a
 * very narrow card still wraps rather than clip.
 */
export function EditorialTitleLine({ children }: EditorialTitleLineProps) {
  return <span className="block">{children}</span>;
}

/**
 * How the tags in a hero title's catalog message render: `<accent>` as the green italic,
 * `<line>` as one authored line, `<noBreak>` as words that stay together. Pass it as the
 * values of `formatMessage`.
 */
export const editorialTitleTags = {
  accent: (chunks: ReactNode[]) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
  line: (chunks: ReactNode[]) => <EditorialTitleLine>{chunks}</EditorialTitleLine>,
  noBreak: (chunks: ReactNode[]) => <span className="whitespace-nowrap">{chunks}</span>,
};
