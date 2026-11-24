import { IconButton } from "@green-goods/shared/components/IconButton";
import {
  RiCloseLine,
  RiExternalLinkLine,
  RiFile3Line,
  RiFilePdf2Line,
  RiFileTextLine,
  RiFileWord2Line,
  RiMarkdownLine,
} from "@remixicon/react";
import type { ComponentType } from "react";
import { type IntlShape, useIntl } from "react-intl";

type DocumentKind = "pdf" | "word" | "markdown" | "text" | "other";

const KIND_ICONS: Record<DocumentKind, ComponentType<{ className?: string }>> = {
  pdf: RiFilePdf2Line,
  word: RiFileWord2Line,
  markdown: RiMarkdownLine,
  text: RiFileTextLine,
  other: RiFile3Line,
};

function documentKind(type: string): DocumentKind {
  if (type === "application/pdf") return "pdf";
  if (type === "text/markdown") return "markdown";
  if (type === "text/plain") return "text";
  if (type === "application/msword" || type.includes("wordprocessingml")) return "word";
  return "other";
}

function documentSize(intl: IntlShape, bytes: number): string | null {
  if (!(bytes > 0)) return null;
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1
    ? intl.formatNumber(megabytes, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 })
    : intl.formatNumber(Math.max(1, Math.round(bytes / 1024)), {
        style: "unit",
        unit: "kilobyte",
      });
}

export interface WorkDocumentRowProps {
  name: string;
  /** The document's type, which picks its icon and the word under its name. */
  type: string;
  /** Bytes; the size line is left out when it is unknown. */
  size?: number;
  /** A published document opens from its gateway address in a new tab. */
  href?: string;
  onRemove?: () => void;
}

/**
 * One document attached to work or proof: its kind, its name and its size, with
 * a remove button while it is being composed, or a link once it is published.
 * Documents are read rather than looked at, so the row never tries to preview one.
 */
export function WorkDocumentRow({ name, type, size, href, onRemove }: WorkDocumentRowProps) {
  const intl = useIntl();
  const kind = documentKind(type);
  const Icon = KIND_ICONS[kind];
  const facts = [
    intl.formatMessage({ id: `app.work.document.kind.${kind}` }),
    documentSize(intl, size ?? 0),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-component="WorkDocumentRow"
      className="flex items-center gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3"
    >
      <Icon className="h-6 w-6 shrink-0 text-text-sub-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={name}
            className="flex items-center gap-1 text-sm font-medium text-text-strong-950 underline-offset-2 hover:underline"
          >
            <span className="truncate">{name}</span>
            <RiExternalLinkLine className="h-4 w-4 shrink-0 text-text-sub-600" aria-hidden="true" />
            <span className="sr-only">
              {intl.formatMessage({ id: "app.work.document.opensInNewTab" })}
            </span>
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-text-strong-950" title={name}>
            {name}
          </p>
        )}
        <p className="text-xs text-text-sub-600">{facts}</p>
      </div>
      {onRemove ? (
        <IconButton
          emphasis="secondary"
          size="compact"
          aria-label={intl.formatMessage({ id: "app.work.document.remove" }, { name })}
          onClick={onRemove}
          icon={<RiCloseLine aria-hidden="true" />}
        />
      ) : null}
    </div>
  );
}
