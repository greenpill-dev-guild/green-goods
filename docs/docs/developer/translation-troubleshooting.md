# Translation System Troubleshooting

## Issue: Actions Not Auto-Translating

If actions aren't translating when you change languages, follow these steps:

### Step 1: Check Browser Support

The translation system requires **Chrome 125+ or Edge 125+**.

**Check your browser:**
1. Open DevTools Console (F12)
2. Type: `'translation' in self`
3. Should return: `true`

**If false:**
- ❌ Your browser doesn't support the Translation API
- ✅ **Solution**: Update to Chrome 125+ or Edge 125+, or content will show in English

### Step 2: Run Diagnostics

Open DevTools Console and run:

```javascript
// Check support
console.log('Translation API:', 'translation' in self);

// Check current locale
console.log('Current locale:', localStorage.getItem('gg-language'));

// Test translation
const api = self.translation;
if (api) {
  api.createTranslator({ sourceLanguage: 'en', targetLanguage: 'es' })
    .then(translator => translator.translate('Hello'))
    .then(result => console.log('Translation test:', result));
}
```

### Step 3: Check Console for Errors

Look for these errors:

**1. "Translation API not available"**
```
Solution: Browser doesn't support Translation API
- Update browser to Chrome 125+ or Edge 125+
- Or use a supported browser
```

**2. "CancelledError" or Query errors**
```
Solution: These are harmless dev warnings
- Ignore in development
- Won't appear in production
```

**3. "MISSING_TRANSLATION" errors**
```
Solution: Missing i18n keys (not translation API issue)
- Report the missing key
- It will be added to language files
```

### Step 4: Verify Translation Setup

**Check if translation hooks are being used:**

```typescript
// In Garden/index.tsx - should have these lines:
const { translatedAction } = useActionTranslation(action);
const { translatedGarden } = useGardenTranslation(garden);

// Then use translated versions:
translatedAction.title  // NOT action.title
translatedGarden.name   // NOT garden.name
```

### Step 5: Clear Cache and Retry

If translations are stale:

```javascript
// Clear translation cache
indexedDB.deleteDatabase('green-goods-translations');

// Reload page
location.reload();
```

## Common Issues

### Issue: Translations Show Original English

**Cause**: Browser doesn't support Translation API

**Solutions:**
1. Use Chrome 125+ or Edge 125+
2. Check `browserTranslator.isSupported` in console
3. Verify Translation API: `'translation' in self`

### Issue: Translations Are Slow First Time

**Expected Behavior**: 
- First translation: 200-500ms (API call)
- Subsequent: &lt;5ms (cached)

**This is normal** - browser downloads language models on first use.

### Issue: Some Content Translates, Some Doesn't

**Cause**: Not all components use translation hooks

**Check:**
1. Component imports `useActionTranslation` or `useGardenTranslation`
2. Component uses `translatedAction` not `action`
3. Translation hook is called with non-null data

### Issue: Console Shows "Translation API object: undefined"

**Cause**: Browser doesn't support Translation API

**Solutions:**
1. Update browser to Chrome 125+ or Edge 125+
2. Use Edge (Chromium-based)
3. Content will fallback to English automatically

## Browser Compatibility Matrix

| Browser | Version | Translation API | Status |
|---------|---------|----------------|--------|
| Chrome | 125+ | ✅ Supported | Works |
| Chrome | &lt;125 | ❌ Not available | English only |
| Edge | 125+ | ✅ Supported | Works |
| Edge | &lt;125 | ❌ Not available | English only |
| Firefox | Any | ⏳ Coming soon | English only |
| Safari | Any | ⏳ Coming soon | English only |

## Manual Testing Steps

### Test 1: Language Selection
1. Go to Profile → Account Settings
2. Change language to "Español"
3. Navigate to Gardens
4. **Expected**: Garden names translate
5. **If not**: Check browser version

### Test 2: Action Translation
1. Select Spanish in settings
2. Go to Home → Select Garden
3. Click "Submit Work"
4. **Expected**: Action title/description translate
5. **If not**: Check console for errors

### Test 3: Cache Performance
1. Select Spanish (first time)
2. Note translation delay (~300ms)
3. Refresh page
4. **Expected**: Instant translation (&lt;10ms)
5. **If not**: Check IndexedDB in DevTools

## Force Enable Translation (Development)

For testing, you can mock the Translation API:

```javascript
// In browser console
if (!('translation' in self)) {
  self.translation = {
    async createTranslator({ sourceLanguage, targetLanguage }) {
      return {
        async translate(text) {
          // Mock translation (just adds language prefix)
          return `[${targetLanguage}] ${text}`;
        }
      };
    }
  };
  console.log('✅ Mock Translation API enabled');
}
```

## Still Not Working?

### Collect Debug Info

Run in console:
```javascript
const debug = {
  browser: navigator.userAgent,
  hasAPI: 'translation' in self,
  locale: localStorage.getItem('gg-language'),
  isSupported: window.browserTranslator?.isSupported,
};
console.log('Debug Info:', JSON.stringify(debug, null, 2));
```

### Report Issue

Include:
1. Browser name and version
2. Debug info from above
3. Console errors (if any)
4. What content isn't translating

## Quick Fixes

**Problem**: Actions not translating
**Fix**: Update to Chrome 125+

**Problem**: Missing translation errors
**Fix**: Report missing keys (we'll add them)

**Problem**: Slow translations
**Fix**: Normal on first use, caches after

**Problem**: Want to disable auto-translate
**Fix**: Keep language set to English




