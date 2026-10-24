/**
 * ActionPicker — choosing the action a work answers, one picker on the installed app and the
 * cockpit (step 16 of the app and cockpit unification).
 *
 * Each action is a media card with its banner: the action's own picture, or its domain's
 * gradient when it has none, with the domain as the mark on the banner; a one-line title; and
 * one detail, what the action asks for ("2 photos required"). The cards behave as one radio
 * group (`MediaCardPicker`): one tab stop, the arrow keys move, Space, Enter or a press chooses.
 * The surface titles each action in the reader's language before passing it, because the app
 * and the cockpit localize canonical actions differently.
 *
 * @module components/Cards/ActionPicker
 */
import { useIntl } from "react-intl";
import { DOMAIN_CONFIG } from "../../config/domain";
import type { Action } from "../../types/domain";
import { ActionBannerFallback } from "../Display/ActionBannerFallback";
import { ImageWithFallback } from "../Display/ImageWithFallback";
import {
  MediaCardPicker,
  type MediaCardPickerLayout,
  type MediaCardPickerOption,
} from "./MediaCardPicker";

export type ActionPickerLayout = MediaCardPickerLayout;

export interface ActionPickerProps {
  /** The actions to choose from, each already titled in the reader's language. */
  actions: readonly Action[];
  /** The chosen action's id; nothing is chosen when it matches none. */
  value: string | null;
  onChange: (actionId: string) => void;
  /** Names the group for assistive technology. */
  label: string;
  /** `row` in the installed app, where the picker scrolls sideways; `grid` in the cockpit. */
  layout: ActionPickerLayout;
  /** Turns every card off while choosing cannot happen. */
  disabled?: boolean;
  /** Holds the actions' place while they load. */
  loading?: boolean;
  className?: string;
}

export function ActionPicker({
  actions,
  value,
  onChange,
  label,
  layout,
  disabled,
  loading,
  className,
}: ActionPickerProps) {
  const { formatMessage } = useIntl();

  const options: MediaCardPickerOption[] = actions.map((action) => {
    const domain = action.domain !== null ? DOMAIN_CONFIG[action.domain] : undefined;
    // The same count Submit Work holds a work to (getMinRequiredWorkImages).
    const minPhotos = action.mediaInfo?.required ? (action.mediaInfo.minImageCount ?? 1) : 0;
    return {
      value: action.id,
      title: action.title,
      media: (
        <ImageWithFallback
          src={action.media[0] ?? ""}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          backgroundFallback={<ActionBannerFallback domain={action.domain} title={action.title} />}
        />
      ),
      mediaLabel: domain ? formatMessage({ id: domain.labelId }) : undefined,
      details:
        minPhotos > 0
          ? formatMessage({ id: "app.actions.picker.photosRequired" }, { count: minPhotos })
          : formatMessage({ id: "app.actions.picker.photosOptional" }),
    };
  });

  return (
    <MediaCardPicker
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      layout={layout}
      disabled={disabled}
      loading={loading}
      className={className}
    />
  );
}
