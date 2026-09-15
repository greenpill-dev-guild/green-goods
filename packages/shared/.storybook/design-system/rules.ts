/**
 * The button and control rules of each surface, as expectations the specimens
 * grade against. Sources: language.md § Button Corners and Emphasis and
 * § Button System (DL-023, DL-026), DESIGN.browser.md § Buttons and Fields
 * (DL-024), packages/admin/DESIGN.md § Cockpit M3 1a Invariants (DL-011,
 * Rule 18), and frontend-design.md Rules 15, 18, 19.
 */
import type { Expectation } from "./measure";

export type AppSize = "lg" | "md" | "sm" | "compact";
export type AdminSize = "sm" | "md" | "lg";

export const APP_SIZES: AppSize[] = ["lg", "md", "sm", "compact"];
export const ADMIN_SIZES: AdminSize[] = ["sm", "md", "lg"];

const APP_HEIGHT: Record<AppSize, number> = { lg: 48, md: 44, sm: 40, compact: 32 };
const ADMIN_HEIGHT: Record<AdminSize, number> = { sm: 28, md: 32, lg: 40 };

/** Installed app (PWA): the 16px field corner, 12px pressed, weight 400, 48/44/40/32. */
export const APP = {
  name: "Installed app",
  family: "Inter",
  cornerRest: 16,
  cornerPressed: 12,
  weight: 400,
  rules: [
    "Every button: the 16px field corner, 12px while pressed, label weight 400 (DL-026, DL-028)",
    "Heights 48 / 44 / 40 / 32; sm and compact keep a 48px hit area (DL-023)",
    "Icon buttons are circles, chips are 32px capsules with a 44px hit area",
    "Fields: 16px corner, a single-line field is exactly its step (DL-022)",
    "Inter, from the shared primitives only (DL-025, Rule 19)",
  ],
  button: (size: AppSize): Expectation => ({
    height: APP_HEIGHT[size],
    radius: 16,
    weight: 400,
    labelSize: size === "lg" || size === "md" ? 16 : 14,
    family: "Inter",
    hit: size === "sm" || size === "compact" ? 48 : APP_HEIGHT[size],
  }),
  iconButton: (size: AppSize): Expectation => ({
    height: APP_HEIGHT[size],
    radius: "circle",
    hit: size === "sm" || size === "compact" ? 48 : APP_HEIGHT[size],
  }),
  chip: (size: "compact" | "sm" = "compact"): Expectation => ({
    height: size === "compact" ? 32 : 40,
    radius: "pill",
    labelSize: 14,
    weight: 400,
    hit: 44,
  }),
  field: (size: "sm" | "md" | "lg" = "md"): Expectation => ({
    height: { sm: 40, md: 44, lg: 48 }[size],
    radius: 16,
    family: "Inter",
  }),
};

/** Public website: the same primitives inside data-site="website", square. */
export const WEBSITE = {
  name: "Public website",
  family: "Inter",
  cornerRest: 0,
  cornerPressed: 0,
  weight: 600,
  rules: [
    "Every button: square, no press morph, label weight 600 (DL-026, DL-028)",
    "Same heights as the app: 48 hero, 44 section and dialog, 40 row actions (DL-024)",
    "Fields on editorial sections: underline, serif text (surface=\"editorial\")",
    "Dialogs, cards, panels, and buttons are all square; icon buttons stay circles, chips capsules",
  ],
  button: (size: AppSize): Expectation => ({
    height: APP_HEIGHT[size],
    radius: 0,
    weight: 600,
    labelSize: size === "lg" || size === "md" ? 16 : 14,
    family: "Inter",
    hit: size === "sm" || size === "compact" ? 48 : APP_HEIGHT[size],
  }),
  iconButton: APP.iconButton,
  chip: APP.chip,
  field: APP.field,
  editorialField: (): Expectation => ({
    height: 44,
    radius: "none",
    family: "Fraunces",
    underline: true,
  }),
};

/** Admin cockpit: pills on the DL-011 compact metric. */
export const ADMIN = {
  name: "Admin cockpit",
  family: "Plus Jakarta Sans",
  corners: [4, 8, 12, 16, 9999],
  rules: [
    "AdminButton pills at 28 / 32 / 40, each with a 44px finger box (DL-011, DL-029)",
    "One 14px label on every button size; 11px only inside chips",
    "Fields 44px / 16px text on touch widths, 40px / 14px from 640px, 12px floating label (DL-029)",
    "Inline fields 32px; toolbar pills and tabs 36px; chips 32px with 8px corners; identity pill 36px",
    "Corners only from 4 / 8 / 12 / 16 / 9999px; rounded-xl and rounded-2xl land on 16px",
    "Plus Jakarta Sans; admin views use the Admin* family, never the shared Button (Rule 18)",
    "Shared pieces ride the shared family, which takes this metric from tokens in index.css: lg and md land on 40, sm on 32, compact on 28, with the 44px finger box (DL-030)",
  ],
  button: (size: AdminSize): Expectation => ({
    height: ADMIN_HEIGHT[size],
    radius: "pill",
    labelSize: 14,
    weight: 500,
    family: "Plus Jakarta Sans",
    hit: 44,
  }),
  iconButton: (size: AdminSize): Expectation => ({
    height: ADMIN_HEIGHT[size],
    radius: "circle",
    hit: 44,
  }),
  /** 44px below 640px (touch), 40px from 640px; the specimen's own viewport decides. */
  fieldContainer: (): Expectation => ({
    height: typeof window !== "undefined" && window.innerWidth < 640 ? 44 : 40,
    radius: 8,
  }),
  fieldLabel: (): Expectation => ({ labelSize: 12, family: "Plus Jakarta Sans" }),
  fieldInput: (): Expectation => ({
    labelSize: typeof window !== "undefined" && window.innerWidth < 640 ? 16 : 14,
    family: "Plus Jakarta Sans",
  }),
  inlineField: (): Expectation => ({ height: 32 }),
  tab: (): Expectation => ({ height: 36, labelSize: 14, family: "Plus Jakarta Sans" }),
  toolbar: (): Expectation => ({ height: 36, radius: "pill" }),
  chip: (): Expectation => ({ height: 32, radius: 8, labelSize: 14, hit: 44 }),
  identityPill: (): Expectation => ({ height: 36, radius: "pill" }),
  close: (): Expectation => ({ height: 40, radius: "circle", hit: 44 }),
  checkbox: (): Expectation => ({ hit: 44 }),
  /** A shared field's title above the control (`gg-field-label`): the setting-row title. */
  fieldTitle: (): Expectation => ({ labelSize: 14, weight: 500, family: "Plus Jakarta Sans" }),
  /** The shared Button at its sm size, which the cockpit lands on the 32px md pill (DL-030). */
  sharedButton: (): Expectation => ({
    height: 32,
    radius: "pill",
    labelSize: 14,
    weight: 500,
    family: "Plus Jakarta Sans",
    hit: 44,
  }),
  /** Shared chips keep their capsule in the cockpit (AssetSelector, ConfidenceSelector). */
  sharedChip: (): Expectation => ({ height: 32, radius: "pill", labelSize: 14, hit: 44 }),
  /** The shared Switch on the admin surface: the M3 52 × 32 track with a 44px hit box. */
  sharedSwitch: (): Expectation => ({ height: 32, hit: 44 }),
};

/** Storybook story ids the pages link to (existing per-component stories). */
export const STORY_LINKS = {
  sharedButton: "shared-primitives-button--emphasis-catalog",
  sharedButtonWebsite: "shared-primitives-button--website-surface",
  sharedIconButton: "shared-primitives-iconbutton--emphasis-catalog",
  sharedChip: "shared-primitives-chip--filter-toggle",
  sharedControls: "shared-form-controlprimitives--default-surface-sizes",
  sharedAmount: "shared-form-formattedamountinput--shared-field",
  editorialAtoms: "client-public-editorial-atoms--buttons",
  editorialTokens: "client-public-editorial-tokens--docs",
  adminButton: "admin-primitives-adminbutton--state-catalog",
  adminIconButtons: "admin-primitives-adminbutton--icon-buttons",
  adminTextField: "admin-primitives-admintextfield--state-catalog",
  adminInlineField: "admin-primitives-admininlinefield--aligns-with-button",
  adminTabRail: "admin-primitives-admintabrail--state-catalog",
  adminFilterChip: "admin-primitives-adminfilterchip--state-catalog",
  adminChoiceGroup: "admin-primitives-adminchoicegroup--theme-choices",
  adminSelectableCard: "admin-primitives-adminselectablecard--toggle-group",
  adminCheckbox: "admin-primitives-admincheckbox--state-catalog",
  adminSettingRow: "admin-primitives-adminsettingrow--default",
  adminSearchToolbar: "admin-primitives-adminsearchtoolbar--state-catalog",
  adminSortSelect: "admin-primitives-adminsortselect--default",
  adminDialog: "admin-primitives-admindialog--close-button-geometry",
  adminSideSheet: "admin-primitives-adminsidesheet--default",
  adminAppBar: "admin-shell-appbar--docs",
  sharedTokens: "shared-tokens-foundation--docs",
};
