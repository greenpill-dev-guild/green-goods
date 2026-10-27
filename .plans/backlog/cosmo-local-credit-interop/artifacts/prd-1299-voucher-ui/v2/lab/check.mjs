// Checks for the voucher lab, run after node build.mjs:
// 1. self-test: every screen in every state draws; pilot screens in every state and language, with no missing copy;
// 2. fit: every view fits the stage at four window sizes with no sideways scroll, and at desktop sizes the side panel
//    holds its controls without scrolling;
// 3. text: no pilot screen clips or truncates text, or lets content run past its frame, in EN, ES or PT;
// 4. names and focus: every link, button, checkbox and dialog in a pilot screen has an accessible name, no control behind an
//    open dialog or inside hidden content takes focus, and every icon exists in the sprite;
// 5. contrast: text in pilot screens meets WCAG AA contrast in light and dark;
// 6. dials: every option of every lab dial draws on each screen it applies to, under the same checks.
// Usage: node check.mjs. Uses the repo's @playwright/test; set CHROMIUM_PATH to use a specific Chromium build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
// The checks load the built page exactly as a reviewer opens it, so they see the document it really is
const labUrl = pathToFileURL(path.join(dir, '..', 'voucher-lab.html')).href;

const { chromium } = await import('@playwright/test').catch(() => import('playwright'));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
const notes = [];

// 1 and 2: self-test, then fit at four sizes
const views = [['openFlow', 's-earn', 0], ['openFlow', 's-redeem', 10], ['openFlow', 's-redeem', 4], ['openFlow', 's-exchange', 1], ['openFlow', 's-partial', 3], ['openFlow', 's-gd', 5],
  ['openFlow', 's-issue', 0], ['openFlow', 's-issue', 2], ['openFlow', 's-issue', 10], ['openFlow', 's-project', 4], ['openFlow', 's-project', 14], ['openScreen', 'SIssuers'],
  ['openFlow', 's-wrong', 8], ['openPair', 'p-pay'], ['openPair', 'p-split'], ['openQuestion', 'offer'], ['openScreen', 'SIssuer'], ['openDoc', 'scenarios'], ['openDoc', 'crosswalk'], ['openDoc', 'answers'], ['openDoc', 'changes']];
for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => problems.push(`${width}x${height} page error: ${e.message}`));
  await page.goto(labUrl);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* storage unavailable */ } });
  if (width === 1440) {
    const mode = await page.evaluate(() => ({ compat: document.compatMode, viewport: !!document.querySelector('meta[name="viewport"]') }));
    if (mode.compat !== 'CSS1Compat' || !mode.viewport) problems.push('the built lab is not a standards document with a viewport meta: ' + JSON.stringify(mode));
    for (const e of await page.evaluate(() => window.__labSelfTest())) problems.push('self-test: ' + e);
    notes.push('Plus Jakarta Sans loaded: ' + await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Plus Jakarta Sans"'); }));
  }
  for (const v of views) {
    const r = await page.evaluate((v) => {
      window.__lab[v[0]](v[1], v[2]);
      return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const st = document.getElementById('stage').getBoundingClientRect();
        const outside = [...document.querySelectorAll('.lab-scale')].map((e) => e.getBoundingClientRect())
          .filter((f) => f.left < st.left - 1 || f.right > st.right + 1 || f.top < st.top - 1 || f.bottom > st.bottom + 1).length;
        // A document must fit the stage's width too, or its text is clipped where nobody can scroll to it
        const docClipped = [...document.querySelectorAll('.lab-doc')].some((d) => d.getBoundingClientRect().right > st.right + 1);
        const panel = document.getElementById('panel');
        res({ outside, docClipped, stageBelowFold: v[0] !== 'openDoc' && st.bottom > innerHeight + 1, sideways: document.documentElement.scrollWidth > innerWidth,
          panelOver: Math.max(0, panel.scrollHeight - panel.clientHeight) });
      })));
    }, v);
    // The side panel's controls must fit a desktop window without scrolling; narrower windows stack and scroll by design
    const panelFails = width >= 1024 && (v[0] === 'openFlow' || v[0] === 'openPair' || v[0] === 'openScreen') && r.panelOver > 0;
    if (r.outside || r.docClipped || r.stageBelowFold || r.sideways || panelFails) problems.push(`${width}x${height} ${v.join(':')}: ${JSON.stringify(r)}`);
  }
  // Below 1200px the contents are a drawer: closed, nothing in it takes focus; open, it holds focus with the page
  // behind it inert; Escape closes it and hands focus back to the Contents button.
  if (width < 1200) {
    const d = await page.evaluate(async () => {
      const frame = () => new Promise((res) => requestAnimationFrame(res));
      const nav = document.getElementById('nav'), btn = document.getElementById('contents-btn');
      const closed = { inert: nav.inert, hidden: nav.getAttribute('aria-hidden') };
      btn.focus(); btn.click(); await frame();
      const open = { focusInNav: nav.contains(document.activeElement), navInert: nav.inert, mainInert: document.getElementById('main').inert, panelInert: document.getElementById('panel').inert };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await frame();
      return { closed, open, back: document.activeElement && document.activeElement.id };
    });
    const ok = d.closed.inert && d.closed.hidden === 'true' && d.open.focusInNav && !d.open.navInert && d.open.mainInert && d.open.panelInert && d.back === 'contents-btn';
    if (!ok) problems.push(`${width}x${height} contents drawer: ${JSON.stringify(d)}`);
  }
  await page.close();
}

// 3, 4 and 5: every pilot screen state, mounted at its own size, in every language; contrast in light and dark
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(labUrl);
await page.evaluate(async () => { await document.fonts.ready; });
const sweep = await page.evaluate(() => {
  const out = { clipped: [], overflow: [], names: [], contrast: [], combos: 0 };
  // Colors arrive as rgb()/rgba() in 0 to 255, or as color(srgb r g b / a) in 0 to 1.
  const rgba = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const k = c.startsWith('color(') ? 255 : 1; return [+m[0] * k, +m[1] * k, +m[2] * k, m.length > 3 ? +m[3] : 1]; };
  const lum = ([r, g, b]) => [r, g, b].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
  // Composite translucent backgrounds from the nearest opaque one, or the page, down to the element.
  const bgOf = (el, page) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    let base = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop() : page;
    while (layers.length) { const c = layers.pop(); base = [0, 1, 2].map((i) => c[i] * c[3] + base[i] * (1 - c[3])); }
    return base;
  };
  const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:0;top:0;z-index:-1'; document.body.append(box);
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  const inspect = (id, props, tag) => {
    const sm = window.__lab.screenMeta(id), dark = !!props.dark;
    const host = document.createElement('div');
    host.style.cssText = `position:relative;width:${sm.w}px;height:${sm.h}px;overflow:hidden`;
    box.append(host);
    window.__lab.mount(id, props, host);
    out.combos++;
    const hr = host.getBoundingClientRect();
    const page = dark ? [12, 10, 9] : [255, 255, 255];
    const modal = host.querySelector('[role="dialog"][aria-modal="true"]');
    for (const u of host.querySelectorAll('use')) { const h = u.getAttribute('href'); if (h && h[0] === '#' && !document.getElementById(h.slice(1))) out.names.push([id, tag, 'icon missing from the sprite: ' + h]); }
    for (const el of host.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (el.closest('details:not([open]) > :not(summary)')) continue;
      // The page behind an open sheet or dialog is context under a scrim, not content to read,
      // but it must not take keyboard focus: hidden content has to be inert as well.
      if (el.matches(FOCUSABLE) && !el.closest('[inert]')) {
        const what = el.tagName.toLowerCase() + ' "' + el.textContent.trim().slice(0, 30) + '"';
        if (el.closest('[aria-hidden="true"]')) out.names.push([id, tag, 'focusable inside hidden content: ' + what]);
        else if (modal && !modal.contains(el)) out.names.push([id, tag, 'focusable behind an open dialog: ' + what]);
      }
      if (el.closest('[aria-hidden="true"], [inert]')) continue;
      // An item row's one-line title and its detail line end in an ellipsis or drop whole details by design (DL-102), and a
      // dialog's target line truncates with its whole text in its title, as the shipped PoolTarget does; everything else
      // must show its whole text.
      const designedCut = el.matches('.gg-item-row-title') || !!el.closest('.gg-item-row-details') || (el.matches('.tgt dd') && el.title === el.textContent);
      if (!designedCut && s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.clipped.push([id, tag, '"' + el.textContent.trim().slice(0, 60) + '" (' + el.className + ')']);
      if ((el.matches('.btn, .abtn')) && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) out.clipped.push([id, tag, 'button "' + el.textContent.trim().slice(0, 60) + '"']);
      if (el.matches('.btn, .abtn, .pill, .jstep > span:last-child')) {
        // A label that wraps inside a button or pill reads as two items
        const range = document.createRange(); range.selectNodeContents(el);
        const tops = new Set([...range.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top / 4)));
        if (tops.size > 1) out.clipped.push([id, tag, 'label wraps: "' + el.textContent.trim().slice(0, 60) + '" (' + el.className + ')']);
      }
      const r = el.getBoundingClientRect();
      if (r.width && r.right > hr.right + 1 && !el.closest('.dock')) out.overflow.push([id, tag, el.className + ' "' + el.textContent.trim().slice(0, 40) + '"']);
      if (el.matches('a[href], button, [role="checkbox"], [role="radio"], [role="tab"]')) {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (!name) out.names.push([id, tag, 'unnamed ' + el.tagName.toLowerCase() + '.' + el.className]);
      }
      if (el.matches('[role="dialog"]')) {
        const lb = el.getAttribute('aria-labelledby'), lbl = lb ? host.querySelector('#' + CSS.escape(lb)) : null;
        if (!el.getAttribute('aria-label') && !(lbl && lbl.textContent.trim())) out.names.push([id, tag, 'dialog without a name']);
      }
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (own && !el.closest('.off, [disabled], [aria-disabled="true"]') && s.opacity !== '0') {
        const fg = rgba(s.color), bg = bgOf(el, page);
        if (fg && bg) {
          const f = [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
          const L1 = lum(f), L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 600;
          const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
          if (ratio < need) out.contrast.push([id, tag, ratio.toFixed(2) + ' "' + el.textContent.trim().slice(0, 40) + '" (' + el.className + ')']);
        }
      }
    }
    host.remove();
  };
  for (const id of window.__lab.pilotScreens()) {
    const m = window.__lab.screenMeta(id).meta;
    const dims = Object.keys(m).filter((k) => k[0] !== '$' && m[k] && m[k].editor === 'enum');
    let grid = [{}];
    for (const k of dims) grid = grid.flatMap((g) => m[k].options.map((o) => Object.assign({}, g, { [k]: o })));
    for (const lang of ['EN', 'ES', 'PT']) for (const dark of [false, true]) for (const g of grid) {
      if (dark && lang !== 'EN') continue;
      inspect(id, Object.assign({}, g, { lang, dark }), `${JSON.stringify(g)} ${lang}${dark ? ' dark' : ''}`);
    }
  }
  // 6. Every dial option, on each screen it applies to, at that screen's default state and a few telling ones
  const EXTRA = {
    SRedeem: [{ kind: 'Claude access', state: 'Approve split' }, { kind: 'Hub day', state: 'Approve split' }, { kind: 'Claude access', state: 'Transfers pending' }, { kind: 'Claude access', state: 'Return failed' }, { kind: 'Claude access', state: 'In progress' }, { kind: 'Hub day', state: 'Closed' }, { kind: 'Lesson', state: 'Approve split' }, { kind: 'Lesson', state: 'Closed' }, { kind: 'Lesson', state: 'Return proposed' }],
    SPay: [{ kind: 'Hub day', state: 'Pay or deposit' }, { kind: 'Hub day', state: 'Sent or deposited' }, { kind: 'Member lesson', state: 'Agree' }, { kind: 'Member lesson', state: 'Waiting for issuer' }],
    SIssuer: [{ state: 'Approve booking' }, { state: 'Accept' }, { state: 'Accept member booking' }, { state: 'Report visit' }, { state: 'Propose return' }, { state: 'Above terms' }, { state: 'Transfer failed' }, { state: 'Reserve short' }, { state: 'Raise allowance' }],
    SIssuers: [{ state: 'Prepare draft' }, { state: 'Awaiting Teo' }, { state: 'Owner Safe drafts' }, { state: 'Admitted' }, { state: 'Delist' }],
    SOnboard: [{ state: 'Approve' }, { state: 'Approved, setup pending' }, { state: 'Your setup' }, { state: 'Listed' }, { state: 'Draft changed' }],
    SMyService: [{ state: 'Approve booking' }, { state: 'Propose return' }, { state: 'Capacity full' }, { state: 'Delisted' }, { state: 'Reserve short' }],
    SServices: [{ state: 'Issuer paused' }, { state: 'Empty' }],
    SBrief: [{ state: 'One kept' }],
    SExchange: [{ pair: 'Maya to Teo', state: 'Quote' }, { pair: 'Maya to Teo', state: 'Done' }],
    SOffer: [{ kind: 'Claude access', state: 'Open' }, { kind: 'Hub day', state: 'Not enough' }, { kind: 'Member lesson', state: 'Open' }, { kind: 'Member lesson', state: 'Paused' }],
    SPurchase: [{ state: 'Access active' }, { state: 'Refund failed' }, { state: 'Terms changed' }, { state: 'Paid out' }],
    SRequests: [{ state: 'Accept' }, { state: 'Decline' }, { state: 'Mark ready' }, { state: 'Dispute' }],
    SFunds: [{ state: 'Check payment' }, { state: 'Assign payment' }, { state: 'Refund failed' }, { state: 'Reward payout failed' }],
    SReward: [{ kind: 'Vouchers only', state: 'Open' }, { kind: 'Vouchers + G$', state: 'Reserve short' }, { kind: 'Member voucher', state: 'Reserve short' }, { kind: 'Member voucher', state: 'Agree' }]
  };
  out.dialCombos = 0;
  for (const t of window.__lab.tweaks()) for (const o of t.options) {
    if (o === t.rec) continue;
    for (const id of (t.screens || window.__lab.pilotScreens())) {
      for (const g of [{}].concat(EXTRA[id] || [])) {
        const dark = t.key === 'darkcards';
        inspect(id, Object.assign({}, g, { lang: 'EN', dark, [t.key]: o }), `${t.code}=${o} ${JSON.stringify(g)}${dark ? ' dark' : ''}`);
        out.dialCombos++;
      }
    }
  }
  box.remove();
  return out;
});
await page.close();
await browser.close();

// Group each finding by screen and detail, so one fault across many states reads as one line.
for (const [k, label] of [['clipped', 'clipped text'], ['overflow', 'runs past its frame'], ['names', 'accessible name'], ['contrast', 'contrast']]) {
  const groups = new Map();
  for (const [id, tag, detail] of sweep[k]) { const key = id + ' ' + detail; const g = groups.get(key) || { n: 0, first: tag }; g.n++; groups.set(key, g); }
  for (const [key, g] of groups) problems.push(`${label}: ${key} in ${g.n} state${g.n > 1 ? 's' : ''}, first ${g.first}`);
}
notes.push(`Swept ${sweep.combos} pilot screen renders: every state in EN, ES and PT, every state in dark, and ${sweep.dialCombos} dial settings.`);
console.log(notes.join('\n'));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Lab check passed: self-test, fit at 1440, 1280, 1024 and 390 wide, no clipped or overflowing text, named controls and AA contrast.');
