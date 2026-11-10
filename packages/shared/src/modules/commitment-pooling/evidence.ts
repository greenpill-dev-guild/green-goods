/**
 * Commitment evidence documents
 *
 * What a member attached as proof: a note, links, photos, a voice note, documents. The
 * contract stores one CID per attachment (`attachEvidence(commitmentId, cid,
 * creditedContributors)`), so everything composed in the field becomes one
 * JSON document whose media entries name their own CIDs. The shape follows the
 * commitment metadata v1 convention (contract-spec §6 addendum 2026-08-11):
 * `version` required, every other field optional, unknown fields preserved-
 * but-ignored by readers.
 *
 * Parsing is forgiving for the same reason metadata is: an attachment whose
 * document is unreachable is still counted on chain, and the timeline keeps
 * its row.
 *
 * @module modules/commitment-pooling/evidence
 */

import type { CommitmentMetadataLink } from "./metadata";

/** Bumped only for a change old readers cannot understand. */
export const COMMITMENT_EVIDENCE_VERSION = 1;

export interface CommitmentEvidenceMedia {
  cid: string;
  mime: string;
  kind: "photo" | "video";
}

export interface CommitmentEvidenceAudio {
  cid: string;
  mime: string;
  durationSeconds?: number;
}

/**
 * A PDF, Markdown, text or Word file attached as proof. Listed apart from
 * `media`, which readers draw as photos and videos; a reader that predates it
 * skips it, as it skips any field it does not know.
 */
export interface CommitmentEvidenceDocumentFile {
  cid: string;
  mime: string;
  name: string;
  /** Bytes, when the publisher said. */
  size?: number;
}

export interface CommitmentEvidenceDocumentV1 {
  version: number;
  note?: string;
  links?: CommitmentMetadataLink[];
  media?: CommitmentEvidenceMedia[];
  audio?: CommitmentEvidenceAudio[];
  documents?: CommitmentEvidenceDocumentFile[];
}

const MAX_NOTE = 2000;
export const MAX_EVIDENCE_LINKS = 10;
const MAX_LINKS = MAX_EVIDENCE_LINKS;
const MAX_LINK_LABEL = 120;
/** As many documents as a work may carry (`WORK_DOCUMENT_MAX_COUNT`), which the composer enforces. */
const MAX_DOCUMENTS = 5;
const MAX_DOCUMENT_NAME = 120;

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length === 0 ? null : collapsed.slice(0, max);
}

/**
 * A note keeps its paragraphs. The review screen shows them, so the pinned
 * document must hold the same text; only runs of spaces and blank lines are
 * tidied, never the breaks themselves.
 */
function cleanNote(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const tidied = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return tidied.length === 0 ? null : tidied.slice(0, max);
}

function cleanLinks(value: unknown): CommitmentMetadataLink[] {
  if (!Array.isArray(value)) return [];
  const links: CommitmentMetadataLink[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.url !== "string") continue;
    const url = record.url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) continue;
    const label = cleanLine(record.label, MAX_LINK_LABEL);
    links.push(label ? { url, label } : { url });
    if (links.length === MAX_LINKS) break;
  }
  return links;
}

function cleanMedia(value: unknown): CommitmentEvidenceMedia[] {
  if (!Array.isArray(value)) return [];
  const media: CommitmentEvidenceMedia[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.cid !== "string" || record.cid.trim().length === 0) continue;
    const mime = typeof record.mime === "string" ? record.mime : "";
    const kind = record.kind === "video" || mime.startsWith("video/") ? "video" : "photo";
    media.push({ cid: record.cid.trim(), mime, kind });
  }
  return media;
}

function cleanAudio(value: unknown): CommitmentEvidenceAudio[] {
  if (!Array.isArray(value)) return [];
  const audio: CommitmentEvidenceAudio[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.cid !== "string" || record.cid.trim().length === 0) continue;
    const mime = typeof record.mime === "string" ? record.mime : "";
    const durationSeconds =
      typeof record.durationSeconds === "number" && Number.isFinite(record.durationSeconds)
        ? record.durationSeconds
        : undefined;
    audio.push({
      cid: record.cid.trim(),
      mime,
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    });
  }
  return audio;
}

/**
 * Documents with a content identifier a gateway can serve: anyone can pin an
 * evidence document, so a name is cleaned and a CID that is not one is dropped.
 */
function cleanDocuments(value: unknown): CommitmentEvidenceDocumentFile[] {
  if (!Array.isArray(value)) return [];
  const documents: CommitmentEvidenceDocumentFile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const cid = typeof record.cid === "string" ? record.cid.trim() : "";
    if (!/^[A-Za-z0-9]{20,120}$/.test(cid)) continue;
    const size =
      typeof record.size === "number" && Number.isFinite(record.size) && record.size > 0
        ? Math.round(record.size)
        : undefined;
    documents.push({
      cid,
      mime: typeof record.mime === "string" ? record.mime.slice(0, 120) : "",
      name: cleanLine(record.name, MAX_DOCUMENT_NAME) ?? "document",
      ...(size !== undefined ? { size } : {}),
    });
    if (documents.length === MAX_DOCUMENTS) break;
  }
  return documents;
}

/** Kind of a media file, by its MIME type. Anything that is not video is a photo. */
export function evidenceMediaKind(mime: string): CommitmentEvidenceMedia["kind"] {
  return mime.startsWith("video/") ? "video" : "photo";
}

/** Build the document the executor pins, from already-uploaded media CIDs. */
export function buildCommitmentEvidenceDocument(input: {
  note?: string;
  links?: CommitmentMetadataLink[];
  media?: CommitmentEvidenceMedia[];
  audio?: CommitmentEvidenceAudio[];
  documents?: CommitmentEvidenceDocumentFile[];
}): CommitmentEvidenceDocumentV1 {
  const note = cleanNote(input.note, MAX_NOTE);
  const links = cleanLinks(input.links);
  const media = cleanMedia(input.media);
  const audio = cleanAudio(input.audio);
  const documents = cleanDocuments(input.documents);
  if (
    !note &&
    links.length === 0 &&
    media.length === 0 &&
    audio.length === 0 &&
    documents.length === 0
  ) {
    throw new Error("Proof needs at least one item");
  }
  return {
    version: COMMITMENT_EVIDENCE_VERSION,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(media.length > 0 ? { media } : {}),
    ...(audio.length > 0 ? { audio } : {}),
    ...(documents.length > 0 ? { documents } : {}),
  };
}

/** Read whatever is at an evidence CID. Null when nothing usable is there. */
export function parseCommitmentEvidenceDocument(raw: unknown): CommitmentEvidenceDocumentV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const note = cleanNote(record.note, MAX_NOTE);
  const links = cleanLinks(record.links);
  const media = cleanMedia(record.media);
  const audio = cleanAudio(record.audio);
  const documents = cleanDocuments(record.documents);
  if (
    !note &&
    links.length === 0 &&
    media.length === 0 &&
    audio.length === 0 &&
    documents.length === 0
  )
    return null;
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : COMMITMENT_EVIDENCE_VERSION;
  return {
    version,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(media.length > 0 ? { media } : {}),
    ...(audio.length > 0 ? { audio } : {}),
    ...(documents.length > 0 ? { documents } : {}),
  };
}
