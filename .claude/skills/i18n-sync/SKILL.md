# i18n Sync Skill

Keep translations complete and consistent across all supported languages.

## Activation

Use when:
- Adding new UI strings
- Checking translation completeness
- User requests i18n validation
- Before PR with UI changes

## Supported Languages

| Code | Language | File |
|------|----------|------|
| en | English | `packages/shared/src/i18n/locales/en.json` |
| es | Spanish | `packages/shared/src/i18n/locales/es.json` |
| pt | Portuguese | `packages/shared/src/i18n/locales/pt.json` |

## Process

### Phase 1: Run Completeness Check

```bash
node .claude/scripts/check-i18n-completeness.js
```

This will identify:
- Keys in en.json missing from es.json/pt.json
- Keys in es.json/pt.json not in en.json (orphans)
- Empty or placeholder values

### Phase 2: Identify Missing Keys

```bash
# Compare en.json with other locales
diff <(jq 'keys' packages/shared/src/i18n/locales/en.json | sort) \
     <(jq 'keys' packages/shared/src/i18n/locales/es.json | sort)
```

### Phase 3: Semantic Key Validation

Keys should follow naming convention:

```
[namespace].[section].[item]
```

Examples:
- `common.buttons.submit`
- `garden.details.title`
- `work.submission.success`
- `error.network.offline`

**Invalid patterns**:
- `submit` (too short)
- `gardenDetailsTitle` (camelCase)
- `SUBMIT_BUTTON` (screaming case)

### Phase 4: Generate Missing Translations

For each missing key, suggest translations:

```json
// en.json
"work.approval.pending": "Pending Approval"

// es.json (suggested)
"work.approval.pending": "Pendiente de Aprobación"

// pt.json (suggested)
"work.approval.pending": "Aprovação Pendente"
```

### Phase 5: Detect Hardcoded Strings

Search for UI strings not using i18n:

```bash
# Find potential hardcoded strings in JSX
grep -rn ">[A-Z][a-z].*<" packages/client/src packages/admin/src \
  --include="*.tsx" | grep -v "i18n\|t("
```

Common patterns to flag:
- Button text: `<Button>Submit</Button>`
- Labels: `<label>Name</label>`
- Headings: `<h1>Dashboard</h1>`
- Error messages: `toast.error("Something went wrong")`

### Phase 6: Update Translation Files

When adding new keys:

1. Add to en.json first (source of truth)
2. Add to es.json with translation
3. Add to pt.json with translation

```json
// en.json
{
  "existing.key": "value",
  "new.key": "New Value"
}

// es.json
{
  "existing.key": "valor",
  "new.key": "Nuevo Valor"
}

// pt.json
{
  "existing.key": "valor",
  "new.key": "Novo Valor"
}
```

### Phase 7: Validate Structure

Ensure all files have same structure:

```bash
# Check JSON validity
jq '.' packages/shared/src/i18n/locales/en.json > /dev/null
jq '.' packages/shared/src/i18n/locales/es.json > /dev/null
jq '.' packages/shared/src/i18n/locales/pt.json > /dev/null
```

### Phase 8: Generate Report

```markdown
# i18n Completeness Report

## Summary
- Total keys: N
- English: N (100%)
- Spanish: M (X%)
- Portuguese: P (Y%)

## Missing in Spanish
- `new.feature.title`
- `new.feature.description`

## Missing in Portuguese
- `new.feature.title`
- `new.feature.description`

## Hardcoded Strings Found
| File | Line | String |
|------|------|--------|
| `src/views/Home.tsx` | 42 | "Welcome" |

## Orphan Keys (unused)
- `old.removed.feature`

## Actions Required
1. Add missing keys to es.json
2. Add missing keys to pt.json
3. Extract hardcoded strings
4. Remove orphan keys
```

## Key Naming Conventions

### Namespaces

| Namespace | Usage |
|-----------|-------|
| `common` | Shared across app (buttons, labels) |
| `garden` | Garden-related UI |
| `work` | Work submission/approval |
| `profile` | User profile |
| `auth` | Authentication |
| `error` | Error messages |
| `admin` | Admin dashboard |

### Structure

```json
{
  "common": {
    "buttons": {
      "submit": "Submit",
      "cancel": "Cancel"
    }
  },
  "garden": {
    "create": {
      "title": "Create Garden",
      "description": "Enter garden details"
    }
  }
}
```

## Using Translations in Code

```typescript
import { useTranslation } from "@green-goods/shared";

function MyComponent() {
  const { t } = useTranslation();

  return (
    <Button>{t("common.buttons.submit")}</Button>
  );
}
```

## Output

Present to user:
1. Completeness percentage per language
2. List of missing keys
3. Suggested translations
4. Hardcoded strings to extract
