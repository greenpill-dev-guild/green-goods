/**
 * Commitment evidence documents
 *
 * What a member attached as proof: a note, links, photos, a voice note. The
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

export interface CommitmentEvidenceDocumentV1 {
  version: number;
  note?: string;
  links?: CommitmentMetadataLink[];
  media?: CommitmentEvidenceMedia[];
  audio?: CommitmentEvidenceAudio[];
}

const MAX_NOTE = 2000;
const MAX_LINKS = 10;
const MAX_LINK_LABEL = 120;

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length === 0 ? null : collapsed.slice(0, max);
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
}): CommitmentEvidenceDocumentV1 {
  const note = cleanLine(input.note, MAX_NOTE);
  const links = cleanLinks(input.links);
  const media = cleanMedia(input.media);
  const audio = cleanAudio(input.audio);
  if (!note && links.length === 0 && media.length === 0 && audio.length === 0) {
    throw new Error("Proof needs at least one item");
  }
  return {
    version: COMMITMENT_EVIDENCE_VERSION,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(media.length > 0 ? { media } : {}),
    ...(audio.length > 0 ? { audio } : {}),
  };
}

/** Read whatever is at an evidence CID. Null when nothing usable is there. */
export function parseCommitmentEvidenceDocument(raw: unknown): CommitmentEvidenceDocumentV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const note = cleanLine(record.note, MAX_NOTE);
  const links = cleanLinks(record.links);
  const media = cleanMedia(record.media);
  const audio = cleanAudio(record.audio);
  if (!note && links.length === 0 && media.length === 0 && audio.length === 0) return null;
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
  };
}
