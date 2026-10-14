import { useMemo } from "react";
import { useIntl } from "react-intl";
import type { Action } from "../../types/domain";
import { localizeAction } from "../../utils/action/translations";

/** The action as the page shows it: in the language on screen where it stores a reviewed translation. */
export function useActionTranslation(action: Action | null) {
  const { locale } = useIntl();

  const translatedAction = useMemo(() => {
    return action ? localizeAction(action, locale) : null;
  }, [action, locale]);

  return {
    translatedAction,
    isTranslating: false,
  };
}
