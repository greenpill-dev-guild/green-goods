/**
 * What one proof carries, counted, so a line can name it without its files:
 * the media step's pill, the note's hint, and the promise's "on its way" line.
 *
 * @module hooks/client-ui/commitment/proofContents
 */

import { isVideoFile } from "../../../modules/work/media-processing";

export interface ProofContents {
  photos: number;
  videos: number;
  voiceNotes: number;
  links: number;
  words: boolean;
}

export function proofContentsOf(proof: {
  media?: readonly File[];
  audioNotes?: readonly File[];
  links?: readonly string[];
  note?: string;
}): ProofContents {
  const media = proof.media ?? [];
  const videos = media.filter((file) => isVideoFile(file)).length;
  return {
    photos: media.length - videos,
    videos,
    voiceNotes: proof.audioNotes?.length ?? 0,
    links: proof.links?.length ?? 0,
    words: Boolean(proof.note?.trim()),
  };
}
