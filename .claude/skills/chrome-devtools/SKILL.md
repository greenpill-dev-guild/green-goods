# Chrome DevTools Skill

Browser automation and debugging through Chrome DevTools.

## Activation

Use when:
- Debugging PWA/Service Worker issues
- Automating browser interactions
- Taking screenshots
- Inspecting network requests
- Testing offline behavior

## Capabilities

- **Navigation** - Open URLs, manage tabs
- **DOM interaction** - Click, fill forms, execute JS
- **Debugging** - Console, network, storage inspection
- **Screenshots** - Visual captures
- **Waits** - Pause until conditions met

## Green Goods Use Cases

### Service Worker Debugging

```javascript
// Check Service Worker registration
const registration = await navigator.serviceWorker.getRegistration();
console.log("SW State:", registration?.active?.state);
console.log("SW Scope:", registration?.scope);

// Force update
await registration?.update();

// Unregister (for testing)
await registration?.unregister();
```

**DevTools location**: Application > Service Workers

### IndexedDB Inspection

```javascript
// List databases
const databases = await indexedDB.databases();
console.log("Databases:", databases);

// Check Green Goods database
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open("green-goods");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
console.log("Object stores:", Array.from(db.objectStoreNames));
```

**DevTools location**: Application > IndexedDB

### Network Inspection

**DevTools location**: Network tab

Key things to check:
- Failed requests (red)
- Slow requests (waterfall)
- Request/response payloads
- CORS issues

### Offline Testing

**DevTools location**: Network tab > Throttling

1. Set to "Offline"
2. Test application behavior
3. Check job queue functionality
4. Verify graceful degradation

### Console Debugging

```javascript
// Enable debug mode in Green Goods
const { setDebugMode } = window.__GREEN_GOODS_STORE__;
setDebugMode(true);

// Check store state
console.log(window.__GREEN_GOODS_STORE__.getState());
```

### Local Storage / Session Storage

**DevTools location**: Application > Storage

Check for:
- Auth tokens
- User preferences
- Cached data

### Performance Profiling

**DevTools location**: Performance tab

1. Click Record
2. Perform actions
3. Stop recording
4. Analyze flame chart

Look for:
- Long tasks (>50ms)
- Layout thrashing
- Excessive re-renders

## Automation Patterns

### Screenshot Capture

```bash
# Using Playwright (if available)
npx playwright screenshot https://localhost:3001 screenshot.png
```

### Batch Operations

Optimize by batching commands:

```javascript
// ❌ Slow: Multiple browser launches
await page.goto(url1);
await page.screenshot();
await page.goto(url2);
await page.screenshot();

// ✅ Fast: Single session
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url1);
await page.screenshot({ path: 'shot1.png' });
await page.goto(url2);
await page.screenshot({ path: 'shot2.png' });
await browser.close();
```

## Common Debugging Workflows

### "App not loading"

1. Check Console for errors
2. Check Network for failed requests
3. Check Service Worker status
4. Try hard refresh (Ctrl+Shift+R)

### "Data not syncing"

1. Check Network for API calls
2. Check IndexedDB for pending jobs
3. Check Console for sync errors
4. Verify online status

### "Offline not working"

1. Set Network to Offline
2. Check Service Worker is active
3. Check cached resources in Application > Cache Storage
4. Verify IndexedDB has required data

### "Slow performance"

1. Open Performance tab
2. Record user flow
3. Identify long tasks
4. Check for memory leaks in Memory tab

## DevTools Shortcuts

| Action | Shortcut |
|--------|----------|
| Open DevTools | F12 or Cmd+Opt+I |
| Console | Cmd+Opt+J |
| Elements | Cmd+Opt+C |
| Network | Cmd+Opt+E |
| Hard refresh | Cmd+Shift+R |
| Clear cache & refresh | Cmd+Shift+R (hold) |

## Useful Console Commands

```javascript
// Copy object to clipboard
copy(someObject);

// Monitor function calls
monitor(functionName);

// Time operations
console.time('operation');
// ... operation ...
console.timeEnd('operation');

// Table display
console.table(arrayOfObjects);

// Group logs
console.group('Group Name');
console.log('Log 1');
console.log('Log 2');
console.groupEnd();
```

## Output

When debugging with DevTools:
1. Describe issue found
2. Show relevant console output
3. Include screenshots if helpful
4. Provide fix recommendations
