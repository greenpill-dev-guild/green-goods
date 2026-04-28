import { useContext, useMemo } from "react";
import { AppContext } from "../../providers/App";
import type { Action } from "../../types/domain";
import { localizeAction } from "../../utils/action/translations";

export function useActionTranslation(action: Action | null) {
  const { locale } = useContext(AppContext);

  const translatedAction = useMemo(() => {
    return action ? localizeAction(action, locale) : null;
  }, [action, locale]);

  return {
    translatedAction,
    isTranslating: false,
  };
}
