import { GardenBannerFallback } from "@green-goods/shared/components/Display/GardenBannerFallback";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import type { Garden } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";

/**
 * Where the work goes, said once under the steps while the submission garden
 * is not the active one: a resumed draft, a promise link or navigation state
 * chose another (decision 28). The garden's banner leads, as the chip's does.
 * The line is written to fit one line; a long name wraps rather than losing
 * the end that tells two gardens apart, and clips at two lines, as the info
 * panel does.
 */
export function SubmissionGardenLine({ garden }: { garden: Pick<Garden, "name" | "bannerImage"> }) {
  const intl = useIntl();
  const sentence = intl.formatMessage(
    { id: "app.garden.submit.gardenLine", defaultMessage: "Logging work in {garden}" },
    { garden: garden.name }
  );
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
        {intl.formatMessage(
          { id: "app.garden.submit.gardenLine", defaultMessage: "Logging work in {garden}" },
          {
            garden: (
              <span className="font-semibold text-text-strong-950" key="garden">
                {garden.name}
              </span>
            ),
          }
        )}
      </span>
    </p>
  );
}
