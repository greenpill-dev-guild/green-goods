/**
 * GardenCard — a garden in the installed app, the shared media card with the garden's banner
 * (step 16 of the app and cockpit unification).
 *
 * The banner is the garden's own picture, or its name's gradient when it has none; then the
 * garden's name on one line and one detail line: how many members, then where (the place
 * shortens first). Stewards, the description and how to join live on the garden's page. Home's
 * garden list opens a garden from it, and Submit Work chooses one with `GardenPicker`, the same
 * listbox as the action picker.
 *
 * @module components/Cards/GardenCard
 */
import * as React from "react";
import { type IntlShape, useIntl } from "react-intl";
import { buildGardenMemberSets } from "../../../utils/app/garden";
import { GardenBannerFallback } from "../../Display/GardenBannerFallback";
import { ImageWithFallback } from "../../Display/ImageWithFallback";
import { MediaCard, type MediaCardProps } from "../MediaCard";
import {
  MediaCardPicker,
  type MediaCardPickerLayout,
  type MediaCardPickerOption,
} from "../MediaCardPicker";

/** What a garden card shows of a garden. */
export interface GardenCardData {
  id: string;
  name: string;
  location?: string;
  bannerImage?: string;
  gardeners?: string[];
  stewards?: string[];
}

export interface GardenCardProps
  extends Omit<
    MediaCardProps,
    | "media"
    | "mediaShape"
    | "mediaLabel"
    | "mediaCount"
    | "title"
    | "status"
    | "subtitle"
    | "details"
    | "detailsEnd"
    | "detailsTitle"
    | "layout"
  > {
  garden: GardenCardData;
}

/** The card's picture, title and detail line, shared by the card and the picker. */
function gardenCardContent(
  garden: GardenCardData,
  formatMessage: IntlShape["formatMessage"]
): Pick<MediaCardPickerOption, "media" | "title" | "details" | "detailsTitle"> {
  // A member is a person, whatever roles they hold (DL-049).
  const members = buildGardenMemberSets(garden.gardeners ?? [], garden.stewards ?? []).memberIds
    .size;
  const place = garden.location?.trim();
  const memberLabel = formatMessage({ id: "app.garden.memberCount" }, { count: members });
  return {
    title: garden.name,
    media: (
      <ImageWithFallback
        src={garden.bannerImage || ""}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        backgroundFallback={<GardenBannerFallback name={garden.name} />}
      />
    ),
    details: (
      <>
        {memberLabel}
        {place ? <span className="font-normal text-text-soft"> · {place}</span> : null}
      </>
    ),
    detailsTitle: place ? `${memberLabel} · ${place}` : memberLabel,
  };
}

export const GardenCard = React.forwardRef<HTMLElement, GardenCardProps>(function GardenCard(
  { garden, ...props },
  ref
) {
  const { formatMessage } = useIntl();
  const content = gardenCardContent(garden, formatMessage);
  return (
    <MediaCard ref={ref} data-testid="garden-card" {...props} {...content} mediaShape="banner" />
  );
});

GardenCard.displayName = "GardenCard";

export interface GardenPickerProps {
  gardens: readonly GardenCardData[];
  /** The chosen garden's id; nothing is chosen when it matches none. */
  value: string | null;
  onChange: (gardenId: string) => void;
  /** Names the group for assistive technology. */
  label: string;
  layout: MediaCardPickerLayout;
  disabled?: boolean;
  /** Holds the gardens' place while they load. */
  loading?: boolean;
  className?: string;
}

/** Choosing a garden from its cards: the action picker's listbox, with garden cards. */
export function GardenPicker({ gardens, ...picker }: GardenPickerProps) {
  const { formatMessage } = useIntl();
  return (
    <MediaCardPicker
      {...picker}
      options={gardens.map((garden) => ({
        value: garden.id,
        ...gardenCardContent(garden, formatMessage),
      }))}
    />
  );
}
