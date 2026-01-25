import type { Meta, StoryObj } from "@storybook/react";

/**
 * TranslationBadge requires AppContext to function.
 * These stories show the visual appearance of the badge component.
 */
const meta: Meta = {
  title: "Components/TranslationBadge",
  tags: ["autodocs"],
};

export default meta;

/**
 * Visual representation of the TranslationBadge component.
 * In the app, this appears when auto-translation is active.
 */
export const TranslationBadgeVisual: StoryObj = {
  render: () => (
    <div className="inline-flex items-center gap-1 rounded-md bg-bg-soft px-2 py-1 text-xs text-text-soft">
      <span>🌐</span>
      <span>Auto-translated</span>
    </div>
  ),
};

/**
 * Visual representation of the UnsupportedTranslationNotice.
 * Shown when browser translation is not supported.
 */
export const UnsupportedNotice: StoryObj = {
  render: () => (
    <div className="rounded-md bg-bg-soft p-3 text-sm text-text-sub">
      <p>
        Translation not available in your browser.{" "}
        <button type="button" className="text-green-600 hover:underline ml-1">
          Switch to English
        </button>
      </p>
    </div>
  ),
};

/**
 * Both components together in context
 */
export const InContext: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="p-4 border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Garden Description</h3>
          <div className="inline-flex items-center gap-1 rounded-md bg-bg-soft px-2 py-1 text-xs text-text-soft">
            <span>🌐</span>
            <span>Auto-translated</span>
          </div>
        </div>
        <p className="text-sm text-text-sub-600">
          Un jardín comunitario dedicado a plantas nativas y prácticas de cultivo sostenible.
        </p>
      </div>
    </div>
  ),
};
