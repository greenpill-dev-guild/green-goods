import { GardenBannerFallback } from "@green-goods/shared/components/Display/GardenBannerFallback";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import type { SubmissionKind } from "@green-goods/shared/hooks/client-ui/submission/useSubmissionFlowController";
import type { Garden } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";

const LINE_MESSAGES = {
  work: { id: "app.garden.submit.gardenLine", defaultMessage: "Logging work in {garden}" },
  evidence: { id: "app.proof.gardenLine", defaultMessage: "Adding proof in {garden}" },
} as const;

/**
 * Where the work or the proof goes, said once, under the info card of the flow's first step
 * (Start, or Media when Start is skipped), whether the work is for the active garden or
 * another that a resumed draft, a promise link or navigation state chose (decision 28,
 * PRD-1492): the submission flow hides Home's chip, so nothing else names it before Review.
 * A draft that reopens past that step, and every later step, show no line (PRD-1522).
 * The garden's banner leads, as the chip's does.
 * The line is written to fit one line; a long name wraps rather than losing
 * the end that tells two gardens apart, and clips at two lines, as the info
 * panel does.
 */
export function SubmissionGardenLine({
  garden,
  kind = "work",
}: {
  garden: Pick<Garden, "name" | "bannerImage">;
  kind?: SubmissionKind;
}) {
  const intl = useIntl();
  const sentence = intl.formatMessage(LINE_MESSAGES[kind], { garden: garden.name });
  return (
    <p
      data-testid="submission-garden"
      className="flex min-w-0 items-center gap-2 type-label-sm text-text-sub-600"
    >
      <span
        aria-hidden="true"
        className="relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-full"
      >
        <ImageWithFallback
          src={garden.bannerImage || ""}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          backgroundFallback={<GardenBannerFallback name={garden.name} />}
        />
      </span>
      <span className="min-w-0 flex-1 line-clamp-2 [overflow-wrap:anywhere]" title={sentence}>
        {intl.formatMessage(LINE_MESSAGES[kind], {
          garden: (
            <span className="font-semibold text-text-strong-950" key="garden">
              {garden.name}
            </span>
          ),
        })}
      </span>
    </p>
  );
}
