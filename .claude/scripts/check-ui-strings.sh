#!/bin/bash
# Green Goods UI String Checker
# Reminds about i18n requirements when editing UI components

FILE_PATH="$1"

# Check if the file contains potential hardcoded strings
if grep -qE '>[A-Z][a-zA-Z\s]+<|"[A-Z][a-zA-Z\s]+"|placeholder="[^{]' "$FILE_PATH" 2>/dev/null; then
  echo ""
  echo "🌿 Cultivator's Reminder ─────────────────────────────"
  echo "This component may contain UI strings."
  echo "Ensure all user-facing text uses intl.formatMessage():"
  echo ""
  echo "  import { useIntl } from 'react-intl';"
  echo "  const intl = useIntl();"
  echo "  intl.formatMessage({ id: 'app.feature.action' })"
  echo ""
  echo "Add keys to ALL THREE files:"
  echo "  - packages/shared/src/i18n/en.json"
  echo "  - packages/shared/src/i18n/es.json"
  echo "  - packages/shared/src/i18n/pt.json"
  echo "─────────────────────────────────────────────────────"
fi
