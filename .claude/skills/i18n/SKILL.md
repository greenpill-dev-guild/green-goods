---
name: i18n
user-invocable: false
description: Internationalization - react-intl, Browser Translation API, locale detection, RTL support. Use for translation workflows, multi-language UI, and locale-aware formatting.
---

# i18n Skill

Internationalization guide: hybrid translation with react-intl (primary) and Browser Translation API (dynamic content), locale-aware formatting, and multi-language support.

---

## Activation

When invoked:
- Check if the feature has user-facing strings that need translation.
- Use `react-intl` (`useIntl`, `FormattedMessage`) for static UI strings.
- Use the `useTranslation` hook for dynamic user-generated content.
- Load `.claude/context/shared.md` for hook patterns.

## Part 1: Architecture Overview

### Green Goods Translation Approach

Green Goods uses a **hybrid approach** — `react-intl` for static UI strings and the Browser Translation API for dynamic content:

```
Static UI Strings (buttons, labels, headings):
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Message ID   │────→│   react-intl     │────→│  Translated  │
│  (en/es/pt)   │     │   IntlProvider   │     │    Text      │
└──────────────┘     └──────────────────┘     └──────────────┘

Dynamic Content (garden descriptions, work titles):
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Source Text  │────→│ Browser Translator│────→│ Translated   │
│  (English)    │     │    API            │     │   Text       │
└──────────────┘     └──────────────────┘     └──────────────┘
                            │
                     Fallback: original text
                     if API unavailable
```

**Why this hybrid approach:**
- **react-intl**: Battle-tested, full ICU message syntax, works offline with bundled JSON
- **Browser Translation API**: Translates user-generated content without maintaining locale files
- Graceful degradation — English fallback is always available
- Supports 3 bundled locales (en, es, pt) with Browser API for additional languages

### Key Files

```
packages/shared/src/
├── i18n/
│   ├── en.json                    # English messages (~55KB)
│   ├── es.json                    # Spanish messages (~59KB)
│   └── pt.json                    # Portuguese messages (~57KB)
├── hooks/translation/
│   └── useTranslation.ts          # Browser Translation API hook (dynamic content)
├── modules/translation/
│   └── browser-translator/        # Browser Translation API wrapper
├── providers/
│   └── App.tsx                    # IntlProvider setup
```

### When to Use Which

| Content Type | Tool | Example |
|-------------|------|---------|
| Button labels, headings, form labels | `react-intl` (`FormattedMessage`, `useIntl`) | "Submit Work", "Garden Details" |
| Error messages, toast text | `react-intl` (message IDs) | "Work submitted successfully" |
| User-generated descriptions | `useTranslation` hook | Garden description, action title |
| Numbers, dates, currencies | `Intl` APIs (see Part 5) | "1,234.56", "February 8, 2026" |

## Part 2: react-intl (Static UI Strings)

### Basic Usage

```typescript
import { useIntl, FormattedMessage } from "react-intl";

// Option 1: Component-based (in JSX)
function SubmitButton() {
  return (
    <button>
      <FormattedMessage id="work.submit" defaultMessage="Submit Work" />
    </button>
  );
}

// Option 2: Imperative (for attributes, toast, etc.)
function WorkForm() {
  const intl = useIntl();

  return (
    <input
      placeholder={intl.formatMessage({
        id: "work.title.placeholder",
        defaultMessage: "Enter work title",
      })}
    />
  );
}
```

### Adding New Messages

1. Add the message ID and default text to `packages/shared/src/i18n/en.json`
2. Add translations to `es.json` and `pt.json`
3. Use in components via `FormattedMessage` or `useIntl`

```json
// en.json
{ "garden.join.button": "Join Garden" }

// es.json
{ "garden.join.button": "Unirse al Jardín" }

// pt.json
{ "garden.join.button": "Entrar no Jardim" }
```

### ICU Message Syntax

```typescript
// Interpolation
<FormattedMessage id="garden.members" defaultMessage="{count} members" values={{ count: 5 }} />

// Pluralization
<FormattedMessage
  id="work.pending"
  defaultMessage="{count, plural, one {# pending work} other {# pending works}}"
  values={{ count }}
/>
```

## Part 3: Browser Translation API (Dynamic Content)

### Basic Usage

```typescript
import { useTranslation } from "@green-goods/shared";

function GardenDescription({ description, sourceLang = "en" }) {
  const { translated, isTranslating, isSupported } = useTranslation(
    description,
    sourceLang
  );

  if (isTranslating) return <Skeleton />;

  return <p>{translated}</p>;
}
```

### Translating Complex Objects

The hook recursively translates strings within objects and arrays:

```typescript
const action = {
  title: "Plant native trees",
  description: "Document planting of indigenous species",
  steps: ["Prepare soil", "Plant seedling", "Water thoroughly"],
};

const { translated } = useTranslation(action, "en");
// translated.title → "Plantar árboles nativos" (in Spanish browser)
// translated.steps[0] → "Preparar el suelo"
```

### Domain-Specific Hooks

```typescript
import { useActionTranslation, useGardenTranslation } from "@green-goods/shared";

// Translate action titles and descriptions
function ActionCard({ action }) {
  const { title, description } = useActionTranslation(action);
  return (
    <Card>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
}

// Translate garden names and descriptions
function GardenHeader({ garden }) {
  const { name, description } = useGardenTranslation(garden);
  return <h1>{name}</h1>;
}
```

## Part 3: Browser Support

### Detection

```typescript
import { browserTranslator } from "@green-goods/shared";

// Check if translation is available
if (browserTranslator.isSupported) {
  // Chrome, Edge, Firefox with Translation API
} else {
  // Fallback: show original text
}
```

### Supported Browsers

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 120+ | Full | Best support |
| Edge 120+ | Full | Chromium-based |
| Firefox 130+ | Partial | May require flag |
| Safari | No | Falls back to English |

### Graceful Degradation

The translation system **never blocks rendering**:

```typescript
// If browser doesn't support translation:
// - isSupported = false
// - translated = original text (passthrough)
// - isTranslating = false (instant)
// No error thrown, no UI break
```

## Part 4: UI Patterns for i18n

### Loading States

```typescript
function TranslatedContent({ text }) {
  const { translated, isTranslating } = useTranslation(text, "en");

  return (
    <span className={isTranslating ? "opacity-50" : ""}>
      {translated}
    </span>
  );
}
```

### Language Indicator

Show users when content has been translated:

```typescript
function TranslatedBadge({ isTranslated }) {
  if (!isTranslated) return null;
  return (
    <span className="text-xs text-muted-foreground">
      Translated
    </span>
  );
}
```

### RTL Support

For right-to-left languages (Arabic, Hebrew, Persian):

```typescript
// Use the dir attribute for RTL content
function BiDirectionalText({ text, lang }) {
  const dir = ["ar", "he", "fa", "ur"].includes(lang) ? "rtl" : "ltr";
  return <p dir={dir}>{text}</p>;
}
```

**CSS considerations for RTL:**

```css
/* Use logical properties instead of physical */
/* ✅ Correct: Works in both LTR and RTL */
.card {
  margin-inline-start: 1rem;  /* replaces margin-left */
  padding-inline-end: 0.5rem; /* replaces padding-right */
}

/* ❌ Wrong: Breaks in RTL */
.card {
  margin-left: 1rem;
  padding-right: 0.5rem;
}
```

## Part 5: Number and Date Formatting

### Locale-Aware Numbers

```typescript
// Use Intl.NumberFormat for locale-aware numbers
function FormattedNumber({ value, locale }) {
  const formatted = new Intl.NumberFormat(locale).format(value);
  return <span>{formatted}</span>;
}

// Examples:
// en-US: 1,234.56
// de-DE: 1.234,56
// fr-FR: 1 234,56
```

### Locale-Aware Dates

```typescript
function FormattedDate({ date, locale }) {
  const formatted = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  return <time dateTime={date.toISOString()}>{formatted}</time>;
}
```

### Currency (for future use)

```typescript
function FormattedCurrency({ amount, currency = "USD", locale }) {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
  return <span>{formatted}</span>;
}
```

## Part 6: Testing Translations

### Unit Testing

```typescript
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

// Mock the browser translator
vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual("@green-goods/shared");
  return {
    ...actual,
    browserTranslator: {
      isSupported: true,
      translate: vi.fn((text) => `[translated] ${text}`),
    },
  };
});

test("useTranslation translates text", async () => {
  const { result } = renderHook(() => useTranslation("Hello", "en"));

  await waitFor(() => {
    expect(result.current.translated).toBe("[translated] Hello");
  });
});

test("useTranslation falls back when unsupported", () => {
  browserTranslator.isSupported = false;
  const { result } = renderHook(() => useTranslation("Hello", "en"));
  expect(result.current.translated).toBe("Hello");
});
```

## Anti-Patterns

- **Never hardcode English-only strings in components** — use `FormattedMessage` or `useIntl`
- **Never block rendering on Browser Translation** — show original text while translating
- **Never use physical CSS properties** — use logical properties for RTL support
- **Never assume LTR layout** — test with RTL languages
- **Never format numbers/dates manually** — use `Intl` APIs
- **Never use Browser Translation API for static UI** — use react-intl with message files instead
- **Never forget to add translations to all 3 locale files** — en.json, es.json, pt.json

## Quick Reference Checklist

### Before Adding UI Text

- [ ] User-facing strings wrapped in `useTranslation` or domain hooks
- [ ] Loading state shown during translation
- [ ] Fallback to original text if API unavailable
- [ ] RTL-aware CSS (logical properties)
- [ ] Numbers formatted with `Intl.NumberFormat`
- [ ] Dates formatted with `Intl.DateTimeFormat`
- [ ] Tests cover both supported and unsupported browser scenarios

## Decision Tree

```
What i18n work?
│
├─► New UI text? ──────────────► Part 2: Translation Hook
│                                 → Wrap in useTranslation()
│                                 → Show original while translating
│                                 → Never block rendering
│
├─► Domain content? ───────────► Part 2: Domain Hooks
│   (garden/action data)          → useGardenTranslation()
│                                 → useActionTranslation()
│
├─► RTL layout issue? ─────────► Part 4: RTL Support
│                                 → CSS logical properties
│                                 → dir="rtl" attribute
│                                 → Test with Arabic/Hebrew
│
├─► Number/date formatting? ───► Part 5: Intl APIs
│                                 → Intl.NumberFormat (numbers)
│                                 → Intl.DateTimeFormat (dates)
│                                 → Never format manually
│
├─► Browser doesn't support? ──► Part 3: Graceful Degradation
│                                 → Safari: show English (passthrough)
│                                 → Never throw on unsupported
│                                 → isSupported flag for UI hints
│
└─► Testing translations? ─────► Part 6: Testing
                                  → Mock browserTranslator
                                  → Test both supported + unsupported
```

## Related Skills

- `ui-compliance` — Accessibility requirements for translated content
- `react` — Component patterns for translated UI
- `frontend-design:frontend-design` — Visual design with multi-language text
- `testing` — Testing translation hooks and fallbacks
