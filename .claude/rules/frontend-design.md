---
paths:
  - "packages/admin/**/*.{ts,tsx}"
  - "packages/client/**/*.{ts,tsx}"
---

# Frontend Design Rules

Rules for all frontend code in admin and client packages.

## Rule 1: Header Consistency (admin canvas routes)

Admin views render their header through `CanvasRouteFrame` + `CanvasRouteHeader` (PageHeader
under the hood — views no longer import `PageHeader` directly). Never hand-roll h1/p headers.
Client views use the client shell patterns (`SiteHeader` / `AppShell`), not PageHeader.

```tsx
// Bad
<h1 className="text-2xl font-bold">{title}</h1>
<p className="text-gray-500">{description}</p>

// Good — canvas route composition
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout";
<CanvasRouteFrame>
  <CanvasRouteHeader title={title} description={description} />
  {/* route content */}
</CanvasRouteFrame>
```

## Rule 2: Action Bar Separation

Actions go in the header's `actions` slot (a separate row, never beside the title). View-level
actions flow through `ViewAction` + `AdminViewActions` on desktop and the same action set via
`useViewActions` for the tablet/mobile FAB speed dial — do not duplicate them inline in route
bodies.

```tsx
// Bad — actions beside title
<div className="flex items-center justify-between">
  <h1>{title}</h1>
  <button>Create</button>
</div>

// Good — actions in the header slot
<CanvasRouteHeader title={title} actions={<AdminViewActions actions={viewActions} />} />
```

## Rule 3: Container Queries

Use `@container` / `@[Npx]:` for width-responsive components, not viewport breakpoints, when the component's layout depends on its own container width.

```tsx
// Bad — viewport breakpoint for card internal layout
"sm:flex-row sm:w-56"

// Good — container query
"@[480px]:flex-row @[480px]:w-56"
```

## Rule 4: Text Overflow

All user-generated text MUST have `truncate` or `line-clamp-*` AND a `title` attribute for hover tooltip.

```tsx
// Bad
<p className="truncate">{gardenName}</p>

// Good
<p className="truncate" title={gardenName}>{gardenName}</p>
```

## Rule 5: No Action Duplication

View-level actions in the `CanvasRouteHeader` `actions` slot / `AdminViewActions` (or the tab bar) are canonical. Do not create shortcut cards that duplicate them.

## Rule 6: Flex Height

Use `flex-1` on cards that should expand vertically within a flex container.

## Rule 7: Filter Alignment (card header rows)

`AdminCardHeader` (and the legacy shared `Card.Header`, now client-only — admin retired shared `Card` on 2026-08-30) defaults to `items-center`; when stacking with `flex-col`, always add `items-start`.

```tsx
<AdminCardHeader className="flex-col items-start gap-3">
```

## Rule 8: Thumbnails

Entity references in lists (gardens, actions) include small thumbnails — 40px for generic lists — using `ImageWithFallback` or letter fallbacks. Shipped variants are sanctioned: `GardenChip`'s 22px avatar and `HubWorkCard`'s media mosaic.

## Rule 9: Typography Utilities

Use `label-md`, `body-md` utilities from theme.css instead of raw Tailwind text sizes for form labels and body text. In admin these utilities resolve through the remapped cockpit scale (14px body/labels · 12px meta · 11px chips-only). Mind the role split: `label-xs text-text-soft` is the **eyebrow / metadata** token (card overlines, definition-list keys, section meta) — it is **not** a form-field label. The title that labels a control goes through `FormField` / `AdminSettingRow` (see Rule 15).

## Rule 10: Icon Sizing Convention

- `h-3.5 w-3.5` — inline badges only
- `h-4 w-4` — standard UI icons (buttons, menu items, list icons)
- `h-5 w-5` — prominent icons (stat cards, section headers, nav items)
- `h-6 w-6` — large icons (empty states, main nav)

## Rule 11: Grid Breakpoints

Always include `sm:` breakpoint. Never skip from single-column to `md:` 2-column.

```tsx
// Bad
"grid-cols-1 md:grid-cols-3"

// Good
"grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
```

## Rule 12: Accessibility — Status Indicators

Status indicators must not rely on color alone. Use icons alongside color (WCAG 1.4.1). Use `StatusBadge` for generic status. `HubWorkCard`'s semantic status chip pairs are the sanctioned Hub exception — colors there are always icon/text-paired or text-labeled, never color-only.

## Rule 13: Dark Mode — Semantic Tokens Only

Never use raw Tailwind colors (`bg-neutral-*`, `text-gray-*`). Always use semantic tokens (`bg-bg-sub`, `text-text-strong`; in admin, the role tokens `--admin-surface-0` / `--m3-*` / `--tone-*`).

## Rule 14: Modal Mobile Safety

Use the project dialog primitives — they own mobile safety. `AdminDialog` (admin) and
`DialogShell` (client/shared) already cap width to the viewport and present as a bottom sheet
on narrow viewports; consumers must NOT restate `max-w-*` overrides (the admin
`AdminDialogStandard.guard` test fails ad-hoc `max-w-*` on AdminDialog). Only a hand-rolled
modal (avoid building these) needs `max-w-[calc(100vw-2rem)] sm:max-w-lg` to survive 375px.

## Rule 15: Form Fields

**Admin**: fields ride the admin field family — `AdminTextField` / `AdminTextArea` /
`AdminSelect` for single controls, `AdminInlineField` for the 32px inline axis, and
`AdminFieldGroup` for group-shaped fields (checkbox grids, repeating rows, upload wells).
Shared `FormField`/`TextInput`/`Textarea`/`NativeSelect` renders in `packages/admin/src` fail
the wrapper-adoption sweep in `check:design-tokens`. For an inline **setting row** (field title
left, `Switch` or compact control right), use `AdminSettingRow`.

**Client**: use the `FormField` component from `@green-goods/shared` for label+input+error
patterns, with the shared `TextInput`, `Textarea`, `NativeSelect`, `Switch`,
`FormattedAmountInput`, `DatePicker`, and `FileUploadField` as the controls — never a raw
`<input>`, `<textarea>`, or `<select>` with its own classes (Rule 19). Fields are 16px on the
default surface and an underline on the public editorial surface (DL-022, DL-024). Mark required fields in both surfaces (the admin family renders
its own aria-hidden asterisk from `required` — never hardcode `" *"` into label strings).

**A field-input label is never a hand-rolled eyebrow.** Labelling an input, toggle, or
selectable-card group with `label-xs text-text-soft` (the eyebrow/metadata token) makes that
field read visibly smaller and greyer than the family labels next to it — the Garden Profile
dialog regressed exactly this way. Route every admin field label through the field family
(`AdminTextField`/`AdminFieldGroup`/`AdminSettingRow`); client labels go through `FormField`.

```tsx
// Bad — hand-rolled eyebrow token as a field label
<p className="label-xs text-text-soft">Open joining</p>
<Switch ... />

<label>Name</label>
<input {...register('name')} />
{errors.name && <p>{errors.name.message}</p>}

// Good — canonical admin field family
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { AdminTextField } from "@/components/AdminTextField";

<AdminTextField label="Name" required error={errors.name?.message} {...register("name")} />

<AdminFieldGroup label="Forms of capital" required error={error} contentClassName="grid grid-cols-2 gap-2">
  {options.map(...)}
</AdminFieldGroup>

<AdminSettingRow labelId="open-joining" label="Open joining" description="…">
  <Switch aria-labelledby="open-joining" ... />
</AdminSettingRow>
```

## Rule 16: Alert/Error Boxes

Use the `Alert` component from `@green-goods/shared` for all error/warning/info boxes. Never use inline styled divs.

```tsx
// Bad
<div className="bg-warning-lighter border border-warning-light rounded-md p-4">
  <svg>...</svg>
  <p>Something went wrong</p>
</div>

// Good
<Alert variant="warning" title="Connection Issue">
  Something went wrong
</Alert>
```

## Rule 17: Don't redeclare context the chrome already declares

Persistent chrome (`AppBar` GardenChip, workspace title bar, breadcrumb) is the canonical declaration of which entity the steward is in. Views, page headers, toolbars, list rows, and cards must not restate that same entity. Re-declaration steals vertical space, dilutes the chrome's authority, and trains the eye to ignore the very element that should be ground truth.

```tsx
// Bad — AppBar GardenChip already shows "Tech and Sun Hub"
<PageHeader
  title="Work"
  description="Review work flowing through Tech and Sun Hub."
  metadata={<MetaStrip items={[{ label: garden.name }]} />}
/>
<WorkbenchRow eyebrow={garden.name} title={...} />
<Card>
  <p>{gardenName}</p>  {/* visible-body duplication */}
</Card>

// Good — header speaks to the stage; rows speak to their own status; chrome owns the garden context
<PageHeader title="Work" description="Review and triage pending submissions." />
<WorkbenchRow eyebrow="Review" title={...} />
<Card>
  {/* Garden context inherited from chrome; no body line needed. Keep it in
      hover-title for accessibility if the card may be detached from chrome. */}
</Card>
```

When to redeclare:
- A list **mixes entities** (cross-garden feed, multi-workspace dashboard) — then the row must name its garden because chrome can't.
- A card may be **detached** from chrome (PDF export, email digest, screenshot share) — keep an accessible `title=""` attribute even if the visible line is removed for in-app contexts.
- The body **disambiguates** (e.g., "the garden's vault is X, the parent DAO's vault is Y") — declaring the qualifier is the whole point of the line.

Otherwise: trust the chrome. Anti-pattern guard for review: search the rendered DOM for the active garden / workspace / entity name; if it appears more than once outside chrome, justify it or remove it.

## Rule 18: Cockpit M3 1a Invariants (admin)

The six enforceable invariants of the admin cockpit finish — treat violations as design regressions:

- **Single elevation ladder** — `--m3-elevation-0/1/2` plus `--admin-chrome-shadow` (floating nav/FAB chrome) are the only shadows.
- **Admin radius set** — 4/8/12/16/9999px only; no 20/24/28px radii (`rounded-xl`/`rounded-2xl` remap to 16px in admin).
- **Four-use tone budget** — workspace tone appears only in the active tab underline/label, the active nav pill, one filled `--tone-action` header action, and the nav-shell FAB fill (plus the faint canvas wash).
- **Hover rule** — hovers are an elevation step-up or the neutral ink layer `rgb(var(--m3-on-surface) / 0.08)`; never translate/scale lifts or hue shifts.
- **AdminButton only** — pill shape, one 14px label at every size, Title Case action labels (en; DL-012); admin views never render the shared `Button` (`gg-button`; `EmptyState` takes an `AdminButton` element as its action). Control heights ride the DL-011 compact metric (buttons 28/32/40 with a 44px finger box on every tier, fields 44 on touch widths and 40 from 640px, pills and tabs 36; DL-029).
- **Shared pieces ride the shared family** — the shared components the cockpit renders (FileUploadField, DatePicker, ConfidenceSelector, AudioRecorder, ImagePreviewDialog, toast actions, AssetSelector, AddressDisplay, Alert) keep their shared `Button` / `IconButton` / `Chip` / control anatomy, and `index.css` sets the family's `--gg-*` tokens so they land on the cockpit metric: pills, one 14px label, lg and md on 40, sm on 32, compact on 28, a 44px finger box, and the responsive field tier through `surface="admin"` (DL-030). Never restyle a shared piece from admin; move the token.

## Rule 19: Client Buttons and Controls Come From the Shared Family

In `packages/client`, every action is the shared `Button` (`emphasis` primary / secondary /
tertiary), `IconButton`, or `Chip`, and every field a shared field primitive (`TextInput`,
`Textarea`, `NativeSelect`, `Switch`, `FormattedAmountInput`, `DatePicker`, `FileUploadField`;
DL-025, DL-030). The primitive owns the corner, one per surface for every emphasis: the 16px field
corner in the app and no corner on the public website (DL-026, DL-028). The height comes from
`size` on the shared scale 48 / 44 / 40 / 32 (DL-023). Never pass a radius, height, or vertical
padding class to them, and never a `variant`: the legacy class contract is gone.

A raw element is allowed only when it declares why: a `<button>` with a `role` of `tab`, `switch`,
or `radio`, or a `data-pressable` of `card`, `row`, `scrim`, `media`, `trigger`, `fab`, or `tab` (a
whole card or list row that opens something, a sheet scrim, a photo, the trigger for a hidden
picker or popover, a floating action button and its speed-dial choices, a tab without tab ARIA);
an `<input>` of type `file`, `radio`, `checkbox`, `hidden`, or `range`. A link that looks like a
button is `<Button asChild>`. Radii stay on the scale: no `rounded-sm`, `rounded-3xl`, or
`rounded-4xl` in client source.

`bun run check --only react-patterns` enforces this rule (`rule-19-client-shared-controls` in
`scripts/quality/check-react-patterns.js`) and fails on any hit; there is no baseline.

```tsx
// Bad — a hand-rolled secondary that drifts from the system
<button className="rounded-lg border px-4 py-2.5 text-sm">{formatMessage({ id: "app.common.retry" })}</button>
<input className="w-full rounded-md border px-3 py-2" value={amount} onChange={onChange} />

// Good
import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";

<Button emphasis="secondary" onClick={retry}>{formatMessage({ id: "app.common.retry" })}</Button>
<IconButton aria-label={formatMessage({ id: "app.common.close" })} icon={<RiCloseLine />} onClick={close} />
<TextInput value={amount} onChange={onChange} aria-label={formatMessage({ id: "app.send.amount" })} />

// Good — a whole card that opens a detail view declares itself
<button type="button" data-pressable="card" onClick={openWork} className="rounded-lg ...">…</button>
```

> Full surface context: [.claude/context/client.md](../context/client.md) / [.claude/context/admin.md](../context/admin.md); implementation runbook: [.claude/skills/design/implementation.md](../skills/design/implementation.md).
