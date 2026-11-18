/**
 * The evidence renderers the Hub's views share: a work's media in Review and a promise's
 * proof in the Garden pool both draw photos and documents through these, so the two read
 * the same way.
 */

import { Button } from "@green-goods/shared/components/Button";
import { ImagePreviewDialog } from "@green-goods/shared/components/Dialog/ImagePreviewDialog";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import {
  RiExternalLinkLine,
  RiFile3Line,
  RiFilePdf2Line,
  RiFileTextLine,
  RiFileWord2Line,
  RiMarkdownLine,
  RiZoomInLine,
} from "@remixicon/react";
import { type ComponentType, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { imagePreviewLabels } from "@/components/imagePreviewLabels";

type DocumentKind = "pdf" | "word" | "markdown" | "text" | "other";

const DOCUMENT_ICONS: Record<DocumentKind, ComponentType<{ className?: string }>> = {
  pdf: RiFilePdf2Line,
  word: RiFileWord2Line,
  markdown: RiMarkdownLine,
  text: RiFileTextLine,
  other: RiFile3Line,
};

/** The kind a document's type names, as the installed app words it on the same row. */
function documentKind(type: string): DocumentKind {
  if (type === "application/pdf") return "pdf";
  if (type === "text/markdown") return "markdown";
  if (type === "text/plain") return "text";
  if (type === "application/msword" || type.includes("wordprocessingml")) return "word";
  return "other";
}

function documentSize(intl: IntlShape, bytes: number): string | null {
  if (!(bytes > 0)) return null;
  return bytes >= 1024 * 1024
    ? intl.formatNumber(bytes / (1024 * 1024), {
        style: "unit",
        unit: "megabyte",
        maximumFractionDigits: 1,
      })
    : intl.formatNumber(Math.max(1, Math.round(bytes / 1024)), {
        style: "unit",
        unit: "kilobyte",
      });
}

/** A published document: work metadata and proof both name one this way. */
interface EvidenceDocument {
  cid: string;
  name: string;
  /** Its MIME type, which picks the icon and the word under its name. */
  type: string;
  /** Bytes; the size is left out when it is 0 or unknown. */
  size?: number;
}

/**
 * One row per document, each opening from the gateway in a new tab: its kind, its name and
 * its size. Documents are read rather than looked at, so a row never previews one.
 */
export function EvidenceDocumentList({
  documents,
  label,
}: {
  documents: readonly EvidenceDocument[];
  /** Names the list where no heading above it does. */
  label?: string;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  return (
    <ul className="space-y-2" aria-label={label}>
      {documents.map((document, index) => {
        const kind = documentKind(document.type);
        const Icon = DOCUMENT_ICONS[kind];
        const facts = [
          formatMessage({ id: `app.work.document.kind.${kind}` }),
          documentSize(intl, document.size ?? 0),
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={`${index}:${document.cid}`}
            data-component="EvidenceDocumentRow"
            className="flex items-center gap-3 rounded-lg border border-stroke-soft p-3"
          >
            <Icon className="h-5 w-5 shrink-0 text-text-sub" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <a
                href={resolveIPFSUrl(document.cid)}
                target="_blank"
                rel="noopener noreferrer"
                title={document.name}
                className="flex items-center gap-1 type-label-sm text-primary-dark underline-offset-4 hover:underline"
              >
                <span className="truncate">{document.name}</span>
                <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">
                  {formatMessage({ id: "app.work.document.opensInNewTab" })}
                </span>
              </a>
              <p className="type-meta text-text-sub">{facts}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Photos as square tiles, two or three to a row; a tile opens the photo large, with the
 * rest of the set a swipe away.
 */
export function EvidencePhotoGrid({
  sources,
  photoLabel,
  photoAlt,
}: {
  /** Gateway URLs, in order. */
  sources: readonly string[];
  /** The name of the button that opens a photo, from its 0-based place. */
  photoLabel: (index: number) => string;
  photoAlt: (index: number) => string;
}) {
  const { formatMessage } = useIntl();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sources.map((src, index) => (
          <Button
            key={src}
            type="button"
            emphasis="tertiary"
            size="compact"
            onClick={() => setPreviewIndex(index)}
            className="group relative aspect-square h-auto max-h-none min-w-0 overflow-hidden rounded-lg border border-stroke-soft bg-bg-weak p-0"
            aria-label={photoLabel(index)}
          >
            <ImageWithFallback
              src={src}
              alt={photoAlt(index)}
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-static-black/0 transition-colors group-hover:bg-static-black/20">
              <RiZoomInLine className="h-6 w-6 text-static-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </Button>
        ))}
      </div>
      <ImagePreviewDialog
        labels={imagePreviewLabels(formatMessage)}
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={[...sources]}
        initialIndex={previewIndex ?? 0}
      />
    </>
  );
}
