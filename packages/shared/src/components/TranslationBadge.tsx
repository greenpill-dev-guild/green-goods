import { useContext } from "react";
import { AppContext } from "../providers/app";
import { browserTranslator } from "../modules/translation/browser-translator";

export function TranslationBadge() {
  const { locale } = useContext(AppContext);

  if (locale === "en" || !browserTranslator.isSupported) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-bg-soft px-2 py-1 text-xs text-text-soft">
      <span>🌐</span>
      <span>Auto-translated</span>
    </div>
  );
}

export function UnsupportedTranslationNotice() {
  const { locale, switchLanguage } = useContext(AppContext);

  if (locale === "en" || browserTranslator.isSupported) {
    return null;
  }

  return (
    <div className="rounded-md bg-bg-soft p-3 text-sm text-text-sub">
      <p>
        Translation not available in your browser.{" "}
        <button
          type="button"
          onClick={() => switchLanguage("en")}
          className="text-green-600 hover:underline ml-1"
        >
          Switch to English
        </button>
      </p>
    </div>
  );
}
