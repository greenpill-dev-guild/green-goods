import type { ProofContents } from "@green-goods/shared/hooks/client-ui/commitment/controller.types";
import type { IntlShape } from "react-intl";

/**
 * What a proof holds, in words: "2 photos, 1 voice note, 1 link". The media
 * step's pill, the note's hint and the promise's "on its way" line all say it
 * the same way. `words` decides when the note counts: always (the pill), only
 * when it is all the proof holds (the promise's line), or never (the note's
 * own hint).
 */
export function describeProofContents(
  intl: IntlShape,
  contents: ProofContents,
  {
    words = "always",
    type = "unit",
  }: { words?: "always" | "alone" | "never"; type?: "unit" | "conjunction" } = {}
): string | null {
  const attached = [
    contents.photos > 0
      ? intl.formatMessage({ id: "app.proof.contents.photos" }, { count: contents.photos })
      : null,
    contents.videos > 0
      ? intl.formatMessage({ id: "app.proof.contents.videos" }, { count: contents.videos })
      : null,
    contents.voiceNotes > 0
      ? intl.formatMessage({ id: "app.proof.contents.voiceNotes" }, { count: contents.voiceNotes })
      : null,
    contents.links > 0
      ? intl.formatMessage({ id: "app.proof.contents.links" }, { count: contents.links })
      : null,
  ].filter((part): part is string => part !== null);
  const namesWords =
    contents.words && (words === "always" || (words === "alone" && attached.length === 0));
  const parts = namesWords
    ? [...attached, intl.formatMessage({ id: "app.proof.contents.words" })]
    : attached;
  return parts.length > 0 ? intl.formatList(parts, { type }) : null;
}
