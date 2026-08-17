// Hi-fi dialect CSS, shipped as one string into the artifact <style>.
// Scope contract: every rule lives under .hf + a dialect class (.sc client /
// .sa admin / .se editorial) with LOCAL custom properties — the artifact's
// document chrome never inherits kit styles and dialects never cross.
// Token values mirror packages/shared/src/styles/theme.css (Warm Earth):
// canvas #FAF8F5 · card #FFF · ink #292524 · stone #78716C · accent #1FC16B
// (≤3% of pixels) · action green #1A7544 · radius 8/16/20/24/9999 (concentric)
// · springs per the 6 motion tokens. Fonts fall back to the system stack —
// artifacts allow no external requests; Inter's metrics are SF-adjacent.

export const PHONE_VIEWPORT_WIDTH = 390;
export const PHONE_VIEWPORT_HEIGHT = 844;
export const PHONE_BEZEL = 12;
export const PHONE_SHELL_WIDTH = PHONE_VIEWPORT_WIDTH + PHONE_BEZEL * 2;
export const PHONE_SHELL_HEIGHT = PHONE_VIEWPORT_HEIGHT + PHONE_BEZEL * 2;

export const HIFI_CSS = `
/* Six motion tokens projected from theme.css. Component motion below derives
   from these values so reduced-motion can remove animation without leaving
   one-off timing curves behind. */
.hf.s-client,.hf.s-admin,.hf.s-editorial{
  --spring-spatial-duration:300ms;--spring-spatial-easing:cubic-bezier(0.16,1,0.3,1);
  --spring-spatial-fast-duration:200ms;--spring-spatial-fast-easing:cubic-bezier(0.34,1.56,0.64,1);
  --spring-spatial-slow-duration:400ms;--spring-spatial-slow-easing:cubic-bezier(0.16,1,0.3,1);
  --spring-effects-duration:250ms;--spring-effects-easing:cubic-bezier(0.2,0,0,1);
  --spring-effects-fast-duration:150ms;--spring-effects-fast-easing:cubic-bezier(0.2,0,0,1);
  --spring-effects-slow-duration:500ms;--spring-effects-slow-easing:cubic-bezier(0.2,0,0,1);
  --spring-spatial:var(--spring-spatial-duration) var(--spring-spatial-easing);
  --spring-spatial-fast:var(--spring-spatial-fast-duration) var(--spring-spatial-fast-easing);
  --spring-spatial-slow:var(--spring-spatial-slow-duration) var(--spring-spatial-slow-easing);
  --spring-effects:var(--spring-effects-duration) var(--spring-effects-easing);
  --spring-effects-fast:var(--spring-effects-fast-duration) var(--spring-effects-fast-easing);
  --spring-effects-slow:var(--spring-effects-slow-duration) var(--spring-effects-slow-easing);
  --on-act:#FFFFFF;--on-accent:#04290F;--bezel:#101010;
}
/* ---------- client dialect (.sc) — Warm Earth PWA ---------- */
.hf.s-client{
  --cv:#FAF8F5; --card:#FFFFFF; --ink:#292524; --stone:#78716C; --ln:#EBE7E0;
  --ln2:#D6D3D1; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --err:#E11D2E; --amb:#B45309; --amb-bg:#FBF3E4; --sky:#2563EB; --sky-bg:#EBF1FD;
  --gr-bg:#E9F5EC; --stone-bg:#F3F1EE; --scrim:rgba(12,10,9,.34);
  font-family:Inter,-apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .hf.s-client{
  --cv:#0F0E0C; --card:#1C1917; --ink:#F5F5F4; --stone:#A8A29E; --ln:#2B2825;
  --ln2:#44403C; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#25A05E; --acth:#2DBF70;
  --err:#F87171; --amb:#E7A93F; --amb-bg:#2E2412; --sky:#7CA9F9; --sky-bg:#182337;
  --gr-bg:#12291A; --stone-bg:#262320; --scrim:rgba(0,0,0,.5);--on-act:#04290F;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-client{
    --cv:#0F0E0C; --card:#1C1917; --ink:#F5F5F4; --stone:#A8A29E; --ln:#2B2825;
    --ln2:#44403C; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#25A05E; --acth:#2DBF70;
    --err:#F87171; --amb:#E7A93F; --amb-bg:#2E2412; --sky:#7CA9F9; --sky-bg:#182337;
    --gr-bg:#12291A; --stone-bg:#262320; --scrim:rgba(0,0,0,.5);--on-act:#04290F;
  }
}

/* device wrapper: hi-fi frames drop the ascii panel look */
.device.f-phone{border:0;background:transparent;padding:18px 8px 8px;display:flex;justify-content:center}
.device.f-phone .mftag{right:8px}

/* Phone preview contract: the app owns a fixed 390×844 logical viewport.
   .phonefit may uniformly scale the complete shell for the review canvas, but
   it must never change this aspect ratio or make the app reflow at a fake
   width. The 12px bezel sits outside that logical viewport. */
.hf .phonefit{position:relative;flex:none;width:${PHONE_SHELL_WIDTH}px;height:${PHONE_SHELL_HEIGHT}px;
  --phone-scale:1}
.hf .phone{position:absolute;top:0;left:0;width:${PHONE_SHELL_WIDTH}px;height:${PHONE_SHELL_HEIGHT}px;
  max-width:none;background:var(--bezel);border-radius:44px;padding:${PHONE_BEZEL}px;
  transform:scale(var(--phone-scale));transform-origin:top left;
  box-shadow:0 18px 48px rgba(14,18,27,.18),0 2px 8px rgba(14,18,27,.12)}
[data-theme="dark"] .hf .phone{box-shadow:0 18px 48px rgba(0,0,0,.5)}
.hf .scr{background:var(--cv);border-radius:32px;display:flex;flex-direction:column;
  width:${PHONE_VIEWPORT_WIDTH}px;height:${PHONE_VIEWPORT_HEIGHT}px;min-height:0;overflow:hidden;
  position:relative;font-size:15px;line-height:1.45}
.hf .statusbar{display:flex;justify-content:space-between;align-items:center;
  padding:14px 24px 6px;font-weight:600;font-size:13px;line-height:1;color:var(--ink);
  flex:none;z-index:3;background:var(--cv)}
.hf .statusbar .sbr{display:flex;gap:5px;align-items:center}
.hf .sb-sig{display:flex;gap:2px;align-items:flex-end}
.hf .sb-sig i{width:3px;background:var(--ink);border-radius:1px;display:block}
.hf .sb-batt{width:22px;height:11px;border:1px solid var(--stone);border-radius:3.5px;position:relative}
.hf .sb-batt::after{content:"";position:absolute;inset:1.5px;right:5px;background:var(--ink);border-radius:1.5px}
.hf .homebar{height:24px;display:flex;align-items:center;justify-content:center;flex:none}
.hf .homebar i{width:134px;height:5px;border-radius:99px;background:var(--ink);opacity:.28;display:block}

/* screen body + scroll column */
.hf .appscroll{flex:1;display:flex;flex-direction:column;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
.hf .appscroll::-webkit-scrollbar{display:none}
.hf .body{flex:1;display:flex;flex-direction:column;min-height:0}
.hf .pagepad{padding:4px 16px 16px;display:flex;flex-direction:column;gap:12px}

/* header */
.hf .hdr{display:flex;align-items:center;gap:10px;padding:8px 16px 4px;min-height:44px}
/* Fixed flow chrome (uiux §5.4 Submit Work pattern): a header rendered via
   phoneFrame's header slot sits above the scroll; .fbar sits below it. */
.hf .hdr.fixed{flex:none;background:var(--cv);border-bottom:1px solid var(--ln);padding-bottom:8px}
.hf .fbar{flex:none;background:var(--cv);border-top:1px solid var(--ln);padding:10px 16px 12px;display:flex;flex-direction:row;align-items:center;gap:10px}
.hf .fbar .brow{margin:0}
.hf .fbar .b.full{width:auto;flex:1}
.hf .byline{display:flex;align-items:center;gap:6px;margin:2px 0}
.hf .byline .avatar{width:20px;height:20px;border-radius:50%;background:var(--act);color:var(--on-act);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex:none}
.hf .hdr.fixed h1{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hf .fprog{display:flex;align-items:center;gap:3px;color:var(--stone);flex:none}
.hf .fprog .fpstep{width:18px;height:18px;border-radius:99px;border:1px solid var(--ln2);display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:10.5px;color:var(--stone);flex:none;background:var(--card)}
.hf .fprog .fpstep.done{background:var(--gr-bg);border-color:transparent;color:var(--gr-ink)}
.hf .fprog .fpstep.cur{border-color:var(--act);color:var(--act);box-shadow:0 0 0 3px color-mix(in srgb,var(--act) 20%,transparent)}
.hf .fprog .fpline{width:8px;height:1px;background:var(--ln2);flex:none}
.hf .fprog .fpline.done{background:var(--gr)}
.hf .fprog .fpsep{display:inline-flex;color:var(--ln2)}
.hf .kgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hf .kcard{border:1px solid var(--ln);border-radius:16px;background:var(--card);padding:14px 12px;display:flex;flex-direction:column;gap:4px;min-height:108px;cursor:pointer}
.hf .kcard.on{background:var(--gr-bg);border-color:var(--act);box-shadow:inset 0 0 0 1px var(--act)}
.hf .kcard .ic{color:var(--act)}
.hf .kcard .kl{font-weight:600;font-size:15px;color:var(--ink)}
.hf .kcard .km{font-size:12.5px;color:var(--stone);line-height:1.35}
.hf .teamstrip{display:flex;align-items:center;gap:8px;padding:2px 0}
.hf .teamstrip .avatar{width:24px;height:24px;border-radius:50%;background:var(--act);color:var(--on-act);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex:none;box-shadow:0 0 0 2px var(--card)}
.hf .teamstrip .avatar+.avatar{margin-left:-10px}
.hf .hdr .hback{width:44px;height:44px;border-radius:99px;border:0;background:transparent;color:var(--ink);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;margin-left:-8px}
.hf .hdr .hback:active{background:var(--stone-bg)}
.hf .hdr h1{font-size:21px;font-weight:650;margin:0;letter-spacing:-.01em;text-wrap:balance;line-height:1.2;min-width:0}
.hf .hdr .hx{margin-left:auto;flex:none}
.hf .hsub{padding:0 16px;color:var(--stone);font-size:13px;margin-top:-2px}

/* garden detail tab row */
.hf .gtabs{display:flex;gap:2px;padding:2px 12px 0;border-bottom:1px solid var(--ln)}
.hf .gtab{min-height:44px;padding:9px 12px 10px;font-weight:600;font-size:14px;color:var(--stone);border:0;background:none;
  cursor:pointer;position:relative;border-radius:8px 8px 0 0}
.hf .gtab.on{color:var(--ink)}
.hf .gtab.on::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2.5px;
  border-radius:99px;background:var(--act)}

/* bottom app bar (installed PWA chrome) */
.hf .abar{flex:none;background:var(--card);border-top:1px solid var(--ln);border-radius:16px 16px 0 0;
  display:flex;justify-content:space-evenly;align-items:center;height:69px;padding:7px 0 2px}
.hf .abar .atab{display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;
  color:var(--stone);font-weight:500;font-size:12px;cursor:pointer;padding:2px 14px;position:relative;min-height:44px}
.hf .abar .atab.on{color:var(--gr)}
.hf .abar .atab .ic{width:24px;height:24px}
.hf .abar .badge{position:absolute;top:-2px;right:8px;min-width:16px;height:16px;border-radius:99px;
  background:var(--gr);color:var(--on-accent);font-weight:700;font-size:10px;line-height:16px;text-align:center;padding:0 4px}
.hf .syncbar{margin:0 16px 8px;border:1px dashed var(--ln2);background:var(--stone-bg);color:var(--stone);
  border-radius:12px;padding:7px 12px;font-size:12.5px;display:flex;gap:8px;align-items:center}

/* icons */
.hf .ic{width:20px;height:20px;fill:currentColor;flex:none}
.hf .ic.s{width:16px;height:16px}
.hf .ic.l{width:24px;height:24px}

/* cards — radius by role, mirroring the real kit: list/detail = CardBase
   rounded-2xl (24px); stat/surface = 20px; inset/action = 16px. */
.hf .card{background:var(--card);border:1px solid var(--ln);border-radius:24px;padding:14px;
  display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 3px rgba(14,18,27,.04)}
.hf .card.flat{box-shadow:none}
.hf .card.surface{border-radius:20px}
.hf .card.inset{border-radius:16px}
/* commitment-direction edge (2026-08-14) — inset stripe: offers green, requests
   sky. Direction reads at scroll speed; the chip stays the labelled signal. */
/* Direction edges (3px inset stripes) retired 2026-08-16 — the Offer/Request
   chip already says the direction in words, and the stripe gave otherwise
   identical commitment cards two silhouettes. */

/* Read-surface sections (2026-08-16 round 10) — the shipped work view's shape:
   a quiet label on the canvas, its content in a card beneath. */
.hf.s-client .h6s{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--stone);margin:14px 0 6px}
.hf.s-client .card.sect{padding:0;overflow:hidden;gap:0}
.hf.s-client .card.sect.flush{padding:10px}
.hf.s-client .drow{display:flex;justify-content:space-between;gap:12px;padding:9px 12px;
  border-bottom:1px solid var(--ln);font-size:12.5px}
.hf.s-client .drow:last-child{border-bottom:0}
.hf.s-client .drow .dk{color:var(--stone);flex:none}
.hf.s-client .drow .dv{font-weight:600;text-align:right;min-width:0;overflow-wrap:anywhere}
/* Evidence as real thumbnails rather than text rows with an image icon. */
.hf.s-client .mstrip{display:flex;gap:7px;overflow-x:auto;padding:10px;scrollbar-width:none}
.hf.s-client .mstrip::-webkit-scrollbar{display:none}
.hf.s-client .mtile{width:60px;height:78px;border-radius:10px;flex:none;display:flex;
  align-items:center;justify-content:center;font-size:10px;background:#EAEFE2;color:#3E5532}
.hf.s-client .mtile.waste{background:#F4E8E2;color:#9B3C2D}
.hf.s-client .mtile.garden,.hf.s-client .mtile.quiet{background:var(--stone-bg);color:var(--stone)}
.hf.s-client .mtile.note{background:var(--card);border:1px dashed var(--ln2);color:var(--stone)}

/* COMMITMENT CARD (option E, 2026-08-16 round 9). Text column left, square right.
   The square is sized in px rather than stretched: align-self:stretch with
   aspect-ratio:1 makes the media's width follow its height while its height
   follows the card's — a loop the browser resolves by inflating both (it drew
   275px squares). A definite size is predictable, and 56px is the height of the
   three text rows beside it, so the square still reads as full-bleed. */
/* flex-direction:row is explicit — the base .card is a column, so without it
   the square stacks under the text instead of sitting beside it.
   The card carries a DEFINITE min-height per variant, which is what lets the
   square below use align-self:stretch + aspect-ratio:1 without the sizing loop
   that inflated it to 275px: the height resolves from the card, the width from
   the ratio. Compact by design — this is the chat mockup's geometry. */
.hf .card.pcard2{display:flex;flex-direction:row;gap:10px;align-items:stretch;
  padding:9px 10px;min-height:74px}
.hf .card.pcard2.cyc{min-height:92px}
.hf .pcbody{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;
  gap:3px;justify-content:center}
.hf .pcbody .t-title{font-size:13.5px;font-weight:600;letter-spacing:-.005em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hf .pcbody .t-meta{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Square, and exactly the height of the text beside it — 50px for the commitment
   card's three rows, 66px for the cycle card's four. Explicit px rather than
   aspect-ratio + stretch, which loops (height from the row, width from the
   ratio, row from the width) and inflated the square to 275px. Centred, so a
   card carrying a note keeps the square in the middle rather than jammed to
   the top. */
.hf .pmedia{flex:none;align-self:stretch;aspect-ratio:1;width:auto;max-width:96px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;font-size:10px;letter-spacing:.02em}
/* No image: the slot still occupies its column, so nothing on the left shifts
   between a commitment with a photo and one without (2026-08-16, Afo). */
.hf .pmedia.none{background:transparent}
/* Media tints reuse the existing domain palette rather than inventing a second
   one — a commitment's picture and its domain tag should not disagree on colour. */
.hf.s-client .pmedia.agro{background:#EAEFE2;color:#3E5532}
.hf.s-client .pmedia.waste{background:#F4E8E2;color:#9B3C2D}
.hf.s-client .pmedia.garden{background:var(--stone-bg);color:var(--stone)}
.hf.s-client .pmedia.quiet{background:var(--stone-bg);color:var(--stone)}
/* One line, always. Priority order decides what survives; the overflow count
   is the release valve so a commitment carrying eight tags still draws one row. */
/* Clipping is the backstop, not the plan — the priority cap does the real work.
   The fade makes a clipped tail read as "there is more" rather than as a chip
   that got cut in half, which matters in narrow columns (the gallery) where a
   capped row can still outrun its container. */
/* Card tags run one step smaller than the dense admin chip — they are a label
   on a thing you are scanning, not a control. */
.hf .ptags .ch{font-size:10.5px;padding:1.5px 7px;border-radius:7px}
.hf .ptags{display:flex;gap:4px;flex-wrap:nowrap;overflow:hidden;margin-top:1px;
  mask-image:linear-gradient(to right,#000 calc(100% - 16px),transparent);
  -webkit-mask-image:linear-gradient(to right,#000 calc(100% - 16px),transparent)}
.hf .ptags .ch{flex:none}
/* The overflow count is a chip like any other — a border here would make it 2px
   taller than its neighbours and put two heights back into the list. */
.hf .ptags .ch.more{background:var(--stone-bg);color:var(--stone)}

/* skeleton — "loading preserves layout": card-shaped placeholders with a sheen */
.hf .sk{background:var(--card);border:1px solid var(--ln);border-radius:24px;padding:14px;
  display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 3px rgba(14,18,27,.04)}
.hf .sk.flat{box-shadow:none;border-style:dashed}
.hf .skbar{height:12px;border-radius:99px;background:var(--stone-bg)}
.hf .skbar.t{height:17px}
.hf .skbar.sm{height:10px}
.hf .skcircle{width:44px;height:44px;border-radius:99px;background:var(--stone-bg);flex:none}
.hf .skrow{display:flex;align-items:center;gap:12px}
@media (prefers-reduced-motion: no-preference){
  .hf .skbar,.hf .skcircle{background:linear-gradient(90deg,var(--stone-bg) 25%,var(--ln) 37%,var(--stone-bg) 63%);
    background-size:400% 100%;animation:sksheen calc(var(--spring-effects-slow-duration) * 2.8) var(--spring-effects-slow-easing) infinite}
  @keyframes sksheen{0%{background-position:100% 0}100%{background-position:-100% 0}}
}

/* centered recovery / empty state (not-found · read-error · scope-named empty) */
.hf .empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:30px 18px 20px}
.hf .empty .emptyIc{width:52px;height:52px;border-radius:99px;background:var(--stone-bg);color:var(--stone);
  display:flex;align-items:center;justify-content:center;margin-bottom:2px}
.hf .empty .emptyIc .ic{width:26px;height:26px}
.hf .empty .t-title{font-size:16px}
.hf .empty .t-meta{max-width:34ch}
.hf .empty .brow{margin-top:6px}
/* Wraps rather than collides: at 390pt the reward row's meta ("20 G$ from the
   garden's Celo account") ran into its status chip. */
.hf .cardrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hf .cardrow > .ch,.hf .cardrow > .sbadge{flex:0 0 auto}
.hf .grow{flex:1;min-width:0}
.hf .t-title{font-size:15.5px;font-weight:600;letter-spacing:-.005em}
.hf .t-body{font-size:14.5px}
.hf .t-meta{font-size:13px;color:var(--stone)}
.hf .t-sec{font-size:16.5px;font-weight:650;margin:6px 0 -2px;letter-spacing:-.01em;display:flex;align-items:center;gap:8px}
.hf .t-sec .hx{margin-left:auto}
.hf .num{font-variant-numeric:tabular-nums}

/* chips */
.hf .ch{display:inline-flex;align-items:center;gap:4px;border-radius:8px;padding:2.5px 8px;
  font-weight:600;font-size:12px;background:var(--stone-bg);color:var(--stone);white-space:nowrap}
.hf .ch.offer{background:var(--gr-bg);color:var(--gr-ink)}
.hf .ch.request{background:var(--sky-bg);color:var(--sky)}
.hf .ch.domain{background:var(--amb-bg);color:var(--amb)}
.hf .ch.ok{background:var(--gr-bg);color:var(--gr-ink)}
.hf .ch.warn{background:var(--amb-bg);color:var(--amb)}
.hf .ch.err{background:transparent;color:var(--err);box-shadow:inset 0 0 0 1px var(--err)}
.hf .ch.ink{background:var(--ink);color:var(--cv)}
.hf .ch.queued{background:transparent;color:var(--stone);box-shadow:inset 0 0 0 1px var(--ln2);border-style:dashed}
.hf .ch.dot::before{content:"";width:6px;height:6px;border-radius:99px;background:currentColor}

/* buttons — shared skeleton; per-dialect anatomy below (admin keeps its pill) */
.hf .b{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;
  font-weight:600;font-size:15px;min-height:44px;padding:10px 20px;border-radius:9999px;color:var(--ink);
  background:transparent;transition:transform var(--spring-spatial-fast),background var(--spring-effects-fast)}
.hf .b:active{transform:scale(.985)}
.hf .b.pri{background:var(--act);color:var(--on-act)}
.hf .b.pri:hover{background:var(--acth)}
.hf .b.sec{border-radius:20px;background:var(--card);color:var(--ink);box-shadow:inset 0 0 0 1px var(--ln2)}
.hf .b.ghost{color:var(--gr-ink);min-height:44px}
.hf .b.danger{color:var(--err);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--err) 45%,transparent);border-radius:20px}
.hf .b.full{width:100%}
.hf .b.sm{min-height:44px;padding:6px 14px;font-size:13.5px}
.hf .b[disabled]{opacity:.45;cursor:default}
.hf .brow{display:flex;gap:10px;flex-wrap:wrap}
.hf .brow .b{flex:1;min-width:max-content}
/* client buttons mirror the real gg-button: a 20px squircle for BOTH primary and
   secondary (gg-button-shape-regular = radius-xl). Hierarchy is fill-green vs
   stroke, never shape. A true capsule is opt-in via .pill (genuine pills only). */
.hf.s-client .b{border:1px solid transparent;border-radius:20px;font-size:14px;min-height:44px;padding:9px 18px}
.hf.s-client .b.pri{background:var(--act);color:var(--on-act)}
.hf.s-client .b.pri:hover{background:var(--acth)}
.hf.s-client .b.sec{background:var(--card);color:var(--ink);border-color:var(--ln2);box-shadow:none}
.hf.s-client .b.sec:hover{background:var(--stone-bg)}
.hf.s-client .b.ghost{background:transparent;color:var(--gr-ink);min-height:44px}
.hf.s-client .b.ghost:hover{background:var(--stone-bg)}
.hf.s-client .b.danger{background:var(--card);color:var(--err);border-color:color-mix(in srgb,var(--err) 45%,transparent);box-shadow:none}
.hf.s-client .b.pill{border-radius:9999px}
.hf.s-client .b.sm{min-height:44px;padding:7px 14px;font-size:13.5px}

/* progress meter (ConvictionMeter grammar) */
.hf .meter{display:flex;flex-direction:column;gap:5px}
.hf .meter .tr{height:6px;border-radius:99px;background:var(--stone-bg);position:relative;overflow:visible}
.hf .meter .fi{height:100%;border-radius:99px;background:var(--gr);transition:width var(--spring-effects-slow)}
.hf .meter .tick{position:absolute;top:-3px;width:2px;height:12px;background:var(--ink);opacity:.55;border-radius:1px}
.hf .meter .mtrow{display:flex;justify-content:space-between;font-size:12.5px;color:var(--stone)}

/* state timeline (StateTimeline grammar) */
.hf .tl{display:flex;flex-direction:column}
.hf .tl .te{display:flex;gap:10px;position:relative;padding:0 0 12px}
.hf .tl .te:last-child{padding-bottom:0}
.hf .tl .td{width:10px;height:10px;border-radius:99px;background:var(--gr);flex:none;margin-top:4px;position:relative;z-index:1}
.hf .tl .te.open .td{background:var(--card);box-shadow:inset 0 0 0 2px var(--ln2)}
.hf .tl .te.warn .td{background:var(--amb)}
.hf .tl .te::before{content:"";position:absolute;left:4px;top:14px;bottom:-2px;width:2px;background:var(--ln)}
.hf .tl .te:last-child::before{display:none}
.hf .tl .tb{font-size:13.5px;min-width:0}
.hf .tl .tb b{font-weight:600}
.hf .tl .tb .tm{color:var(--stone);font-size:12.5px}

/* list rows */
.hf .lr{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--ln);min-height:44px}
.hf .lr:last-child{border-bottom:0}
.hf .lr .ic{color:var(--stone)}
.hf .lr .lp{font-size:14.5px;font-weight:550;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf .lr .lm{font-size:12.5px;color:var(--stone)}
.hf .lr .tail{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none;color:var(--stone)}

/* banners */
.hf .ban{border-radius:12px;padding:10px 12px;font-size:13.5px;display:flex;gap:9px;align-items:flex-start}
.hf .ban .ic{margin-top:1px}
.hf .ban.amber{background:var(--amb-bg);color:var(--amb)}
.hf .ban.stone{background:var(--stone-bg);color:var(--stone)}
.hf .ban.green{background:var(--gr-bg);color:var(--gr-ink)}
.hf .ban.error{background:color-mix(in srgb,var(--err) 9%,transparent);color:var(--err)}

/* segmented filter chips */
.hf .seg{display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none}
.hf .seg .sg{border:0;background:var(--stone-bg);color:var(--stone);border-radius:99px;padding:6px 13px;
  font-weight:600;font-size:13px;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center}
.hf .seg .sg.on{background:var(--ink);color:var(--cv)}
.hf .seg .sg[disabled],.hf .gtab[disabled],.hf .tabrail .trtab[disabled]{opacity:1;cursor:default}
.hf .sg .nbadge{margin-left:6px;min-width:16px;height:16px;border-radius:99px;background:var(--act);color:var(--on-act);
  font-weight:700;font-size:10.5px;line-height:16px;display:inline-block;text-align:center;padding:0 4px;vertical-align:1px}

/* season + campaigns rail (2026-08-14) — bleeds to the screen edge inside
   .pagepad so the next slide peeks; the Season slide leads wider. */
.hf .crail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:2px 16px 4px;scrollbar-width:none}
.hf .crail::-webkit-scrollbar{display:none}
/* Every slide is the same width (2026-08-16, Afo). The season used to be wider
   than the campaigns beside it, which made peers look like a parent and a pair
   of children. Wider slides also mean the next card bleeds in less — enough
   edge to say "swipe", not enough to read as a half-shown card. */
.hf .crail .cslide{flex:0 0 88%;scroll-snap-align:start;display:flex}
.hf .crail .cslide > .card{flex:1;min-width:0}

/* domain row (2026-08-14 second pass) — domains leave the top chip row for
   their own equal-weight row: every involved domain listed, none privileged.
   Tints mirror theme.css --domain-*-rgb (agro moss, edu harbour, solar amber,
   waste terracotta); the real build renders DomainBadge with its icons. */
.hf .dmrow{display:flex;flex-wrap:wrap;gap:6px}
.hf .dm{border-radius:99px;padding:2.5px 9px;font-weight:600;font-size:11.5px;line-height:1.4;letter-spacing:.01em}
.hf.s-client .dm.agro{background:#EAEFE2;color:#3E5532}
.hf.s-client .dm.edu{background:#E2EAF0;color:#2E4F6B}
.hf.s-client .dm.solar{background:#F8EDE0;color:#7A5A13}
.hf.s-client .dm.waste{background:#F4E8E2;color:#9B3C2D}
[data-theme="dark"] .hf.s-client .dm.agro{background:#26301F;color:#A9C68C}
[data-theme="dark"] .hf.s-client .dm.edu{background:#1D2933;color:#9FBFDA}
[data-theme="dark"] .hf.s-client .dm.solar{background:#322A18;color:#E0B65C}
[data-theme="dark"] .hf.s-client .dm.waste{background:#33211C;color:#E09A85}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-client .dm.agro{background:#26301F;color:#A9C68C}
  :root:not([data-theme="light"]) .hf.s-client .dm.edu{background:#1D2933;color:#9FBFDA}
  :root:not([data-theme="light"]) .hf.s-client .dm.solar{background:#322A18;color:#E0B65C}
  :root:not([data-theme="light"]) .hf.s-client .dm.waste{background:#33211C;color:#E09A85}
}

/* whole-card open affordance (2026-08-14 second pass) — the WorkCard grammar:
   the card is the navigation, footer buttons are reserved for claim acts. */
.hf [data-hot].cardlink{cursor:pointer}

/* ONE section-title style in the client (2026-08-17, Afo: "we need the section
   title style match across what you're offering, the how much, add details,
   review and commit"). The flow's early steps used .t-sec — 16.5px sentence
   case — while its later steps and every read surface used .h6s, the 11px
   uppercase label that mirrors WorkView's <h6>. The shipped component decides
   it: .t-sec takes the h6 metric inside the client dialect. Admin keeps its own,
   where .t-sec is a genuine card heading rather than a section label. */
.hf.s-client .t-sec{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--stone);margin:10px 0 -2px}
.hf.s-client .t-sec .hx{margin-left:auto;text-transform:none;letter-spacing:0}

/* A truncated unit label keeps its full text in its title attribute — cut, never lost. */
.hf .ulab{border-bottom:1px dotted var(--ln2);cursor:help}

/* The commitment's identity card (2026-08-17 round 21) — one object where the
   top of the screen used to be four ungrouped rows. */
.hf .card.idcard{gap:8px;padding:14px 16px}
.hf .idcard .idt{font-size:19px;font-weight:650;line-height:1.25;letter-spacing:-.01em;color:var(--ink)}
.hf .idcard .idrule{height:1px;background:var(--ln);margin:2px -16px}
.hf .idcard .idp{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--ink)}
.hf .idcard .idp .avatar{width:26px;height:26px;border-radius:50%;background:var(--act);color:var(--on-act);
  display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex:none}
.hf .idcard .idteam{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--act);padding-left:35px}
.hf .idcard .idteam .ic{flex:none}
/* Requirement rows carry bars because approved work is what advances readiness.
   Everything under the hairline does not, and has no bar — that absence is the
   signal, per the 2026-08-17 alignment. */
.hf .idcard .prow{display:flex;align-items:center;gap:8px}
.hf .idcard .prow .meter{flex:1;min-width:0}
.hf .idcard .prow .pdone{color:var(--gr-ink);flex:none}
.hf .idcard .phair{height:1px;background:var(--ln);margin:4px 0 2px}
.hf .idcard .pflat{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--stone)}
.hf .idcard .pflat .ic{color:var(--stone);flex:none}

/* Member tile — the added-team carousel on the details step. A compact form of
   the Gardeners row: avatar over name, tapped to open. */
.hf .mtrail{display:flex;gap:8px;overflow-x:auto;margin:0 -16px;padding:2px 16px 4px;scrollbar-width:none}
.hf .mtrail::-webkit-scrollbar{display:none}
.hf .mtile{flex:0 0 96px;border:1px solid var(--ln);border-radius:14px;background:var(--card);
  padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.hf .mtile .avatar{width:40px;height:40px;border-radius:50%;background:var(--act);color:var(--on-act);
  display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;flex:none}
.hf .mtile .mtn{font-weight:600;font-size:12.5px;color:var(--ink);max-width:100%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf .mtile .mts{font-size:11px;color:var(--stone);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The add tile closes the rail rather than sitting apart from it. */
.hf .mtile.addtile{border-style:dashed;justify-content:center;color:var(--act)}
.hf .mtile.addtile .ic{color:var(--act)}

/* FormCard — the shipped review's per-detail card (FormCard.tsx:19): an icon +
   label head above a rule, the value beneath. Stacked one per detail under an
   h6, which is what WorkView does and therefore what every review here does. */
.hf .fcard{border:1px solid var(--ln);border-radius:14px;background:var(--card);overflow:hidden}
.hf .fcard+.fcard{margin-top:8px}
.hf .fcard .fch{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--ln)}
.hf .fcard .fch .ic{color:var(--act);flex:none}
.hf .fcard .fch span{font-weight:600;font-size:13.5px;color:var(--ink)}
.hf .fcard .fcv{padding:8px 12px 12px 16px;font-size:13px;color:var(--stone);line-height:1.45}

/* The action rail's count row: anchored at the card's foot with the description
   held to a fixed two-line box above it, so a rail of cards shows every quantity
   at the same height (2026-08-17). */
.hf.s-client .selrail .acard .abody{min-height:96px}
.hf.s-client .selrail .acard .abody .am{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;min-height:calc(2 * 1.4em)}
.hf.s-client .selrail .acard .acount{margin-top:auto;align-self:flex-start;border-radius:8px;padding:2.5px 8px;
  font-weight:600;font-size:12px;background:var(--gr-bg);color:var(--gr-ink)}
.hf.s-client .selrail .acard .acount.off{background:var(--stone-bg);color:var(--stone)}

/* MemberRow — mirrors the shipped garden Gardeners item (Gardeners.tsx:74):
   full-width tappable row, 40px avatar, name over subline over a registered
   line, badge pinned top-right. The select dot replaces that component's
   navigation affordance when the row is being picked rather than opened. */
.hf .mbrow{position:relative;display:flex;align-items:center;gap:12px;width:100%;text-align:left;
  border:1px solid var(--ln);border-radius:14px;background:var(--card);padding:8px;
  box-shadow:0 1px 2px color-mix(in srgb,var(--ink) 6%,transparent)}
.hf .mbrow+.mbrow{margin-top:8px}
.hf .mbrow.picked{border-color:var(--act);box-shadow:inset 0 0 0 1px var(--act)}
.hf .mbrow .avatar{width:40px;height:40px;border-radius:50%;background:var(--act);color:var(--on-act);
  display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;flex:none}
.hf .mbrow .mn{font-weight:600;font-size:14.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* A wallet address stands in for the name only when nothing better is on file,
   so it reads as an identifier rather than as a person's name. */
.hf .mbrow .mn.addr{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.hf .mbrow .ms{font-size:12px;color:var(--stone);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf .mbrow .mj{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--stone);margin-top:1px}
.hf .mbrow .mj .ic{color:var(--act);flex:none}
.hf .mbrow .mbadge{position:absolute;top:8px;right:8px;border-radius:99px;padding:2.5px 8px;
  font-weight:600;font-size:12px;background:var(--stone-bg);color:var(--stone)}
.hf .mbrow .msel{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--ln2);flex:none;align-self:center}
.hf .mbrow .msel.on{border-color:var(--act);background:var(--act);
  box-shadow:inset 0 0 0 3px var(--card),inset 0 0 0 20px var(--act)}

/* browse filter row (2026-08-14) — direction chips + the personal Mine toggle */
.hf .filters{display:flex;align-items:center;gap:8px}
.hf .filters .seg{flex:1 1 auto;min-width:0}
/* One chip metric across the whole row (2026-08-16, Afo). The direction pills
   inherited the tab-sized .seg .sg metric — 13px type in a 44px box — and sat
   next to a 12.5px Mine toggle, so the row rendered two chip heights side by
   side. Both now take the Mine metric. The outline is an inset shadow rather
   than a border so it adds no height, and the tap target is restored by a
   transparent ::after rather than by growing the pill. */
.hf .filters .seg .sg,.hf .filters .mine{position:relative;flex:none;border:0;border-radius:99px;
  padding:6px 12px;min-height:0;font-weight:600;font-size:12.5px;line-height:1.2;
  display:inline-flex;align-items:center;white-space:nowrap}
.hf .filters .seg .sg::after,.hf .filters .mine::after{content:"";position:absolute;inset:-9px 0}
.hf .filters .mine{background:none;color:var(--stone);box-shadow:inset 0 0 0 1px var(--ln2)}
.hf .filters .mine.on{background:var(--ink);color:var(--cv);box-shadow:none}

/* Submit Work grounding (2026-08-14) — mirrors the shipping flow's anatomy:
   FormInfo section headers (client FormInfo.tsx) and the image-topped
   selection cards in horizontal Carousel rails (ActionCard/GardenCard,
   height "selection", media strip on top, body below, selected ring). */
.hf.s-client .finfo{display:flex;gap:12px;align-items:center;background:var(--stone-bg);border:1px solid var(--ln);border-radius:14px;padding:12px 14px}
.hf.s-client .finfo .fic{width:48px;height:48px;border-radius:99px;background:var(--card);border:1px solid var(--ln2);display:inline-flex;align-items:center;justify-content:center;flex:none}
.hf.s-client .finfo .ic{color:var(--act)}
.hf.s-client .finfo .ft{font-weight:650;font-size:15px}
.hf.s-client .finfo .fi{font-size:12.5px;color:var(--stone)}
.hf.s-client .selrail{display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:2px 16px 4px;scrollbar-width:none}
.hf.s-client .selrail::-webkit-scrollbar{display:none}
/* scoped to the client dialect (PR #710 review): an unscoped .acard would be
   overridden by the later admin .acard rule, whose --card-low does not exist
   in .s-client. */
.hf.s-client .selrail .acard{flex:0 0 200px;border:1px solid var(--ln);border-radius:14px;overflow:hidden;background:var(--card);padding:0;gap:0;box-shadow:none;display:flex;flex-direction:column}
.hf.s-client .selrail .acard .amedia{height:80px;display:flex;align-items:flex-end;padding:8px 11px;color:#FFF;font-weight:650;font-size:13px;letter-spacing:.01em}
.hf.s-client .selrail .acard .abody{padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.hf.s-client .selrail .acard .abody .at{font-weight:650;font-size:14px}
.hf.s-client .selrail .acard .abody .am{font-size:12px;color:var(--stone);line-height:1.4}
.hf.s-client .selrail .acard.on{border-color:var(--act);box-shadow:inset 0 0 0 1.5px var(--act)}
.hf.s-client .amedia.agro{background:#3E5532}
.hf.s-client .amedia.waste{background:#9B3C2D}
.hf.s-client .amedia.edu{background:#2E4F6B}
.hf.s-client .amedia.solar{background:#8A6420}
.hf.s-client .amedia.garden{background:#5C6E4E}
.hf.s-client .inp.ta{height:auto}
.hf.s-client .inp.ta textarea{resize:none;background:none;border:0;font:inherit;color:inherit;width:100%}
/* commitment slides — the intro's third rail (2026-08-14): compact commitment
   cards riding the same horizontal grammar as the action/garden rails, so
   holding many commitments costs no extra vertical space. */
.hf .pcard{flex:0 0 218px;border-radius:14px;padding:11px 12px;gap:3px}
.hf .pcard .t-title{font-size:14px;line-height:1.3}

/* floating creation entry (2026-08-14) — shared FabButton mirror above the AppBar */
.hf .fabwrap{position:absolute;right:14px;bottom:106px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;z-index:5}
.hf .fabbtn{width:52px;height:52px;border-radius:18px;border:0;background:var(--act);color:var(--on-act);
  display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(14,18,27,.26);cursor:pointer}
.hf .fabbtn .ic{width:24px;height:24px}
.hf .fabbtn.x{background:var(--card);color:var(--ink);border:1px solid var(--ln2)}
.hf .fabscrim{position:absolute;inset:0;background:var(--scrim);z-index:4;border-radius:inherit}
.hf .fabdoor{border:0;border-radius:99px;padding:11px 20px;font-weight:600;font-size:14.5px;line-height:1.2;background:var(--card);color:var(--ink);
  box-shadow:0 4px 14px rgba(14,18,27,.2);cursor:pointer}

/* forms (W3 grammar) */
.hf .fld{display:flex;flex-direction:column;gap:5px}
.hf fieldset.fld{border:0;padding:0;margin:0;min-width:0}
.hf .fld .fl{font-weight:600;font-size:14px;line-height:1.35;color:var(--ink);letter-spacing:0}
.hf .inp{border:1px solid var(--ln2);background:var(--card);border-radius:12px;min-height:46px;
  padding:11px 13px;font-weight:500;font-size:15px;color:var(--ink);display:flex;align-items:center;gap:8px}
.hf .inp input,.hf .inp select{appearance:none;border:0;outline:0;background:transparent;color:inherit;font:inherit;
  min-width:0;width:100%;padding:0;margin:0}
.hf .inp input::placeholder{color:var(--stone);font-weight:400;opacity:1}
.hf .inp select:disabled{color:inherit;opacity:1;-webkit-text-fill-color:currentColor}
.hf .inp.sel::after{content:"";margin-left:auto;border:5px solid transparent;border-top-color:var(--stone);translate:0 3px}
.hf .radio{display:flex;flex-direction:column;gap:8px}
.hf .ro{display:flex;gap:10px;align-items:center;min-height:64px;border:1px solid var(--ln);border-radius:14px;
  padding:11px 13px;cursor:pointer;background:var(--card);min-height:44px}
.hf .ro .rdot{appearance:none;width:20px;height:20px;border:0;border-radius:99px;box-shadow:inset 0 0 0 2px var(--ln2);flex:none;margin-top:1px;background:transparent;opacity:1}
.hf .ro.on,.hf .ro:has(.rdot:checked){border-color:var(--act);box-shadow:inset 0 0 0 1px var(--act)}
.hf .ro.on .rdot,.hf .ro .rdot:checked{box-shadow:inset 0 0 0 6px var(--act)}
.hf .ro .rl{display:block;font-size:14.5px;font-weight:550}
.hf .ro .rm{display:block;font-size:12.5px;color:var(--stone)}

/* key-value stat rows */
.hf .kv{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;padding:3px 0}
.hf .kv .k{color:var(--stone)}
.hf .kv .v{font-weight:550;text-align:right;font-variant-numeric:tabular-nums}

/* in-phone bottom sheet (W2a / W4) */
.hf .sheetstage{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.hf .sheetstage .behind{filter:saturate(.9);opacity:.9;pointer-events:none;flex:1;display:flex;flex-direction:column}
.hf .sheetstage .scrimm{position:absolute;inset:0;background:var(--scrim);border-radius:0}
.hf .sheet{position:absolute;left:0;right:0;bottom:0;background:var(--card);border-radius:16px 16px 0 0;
  border-bottom:0;padding:8px 16px 14px;display:flex;flex-direction:column;gap:10px;min-height:0;
  max-height:88%;
  box-shadow:0 -12px 40px rgba(14,18,27,.20),0 -2px 8px rgba(14,18,27,.10)}
/* Tabbed drawers are a fixed panel: moving between Cookies / Tokens /
   Commitments must not resize the surface under the reader's thumb. */
.hf .sheet.drawer{height:88%}
/* Only the body scrolls — the handle and title stay put. The negative margin
   puts the scrollbar at the sheet's edge rather than inside its padding. */
.hf .sheet .sh-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
  display:flex;flex-direction:column;gap:10px;margin:0 -16px;padding:0 16px 2px;scrollbar-width:none}
.hf .sheet .sh-body::-webkit-scrollbar{display:none}
/* Children must NOT shrink. A column flex container compresses its items by
   default, so tall content silently squashed to fit instead of overflowing —
   which is why the sheet could never scroll, only clip. */
.hf .sheet .sh-body > *{flex:0 0 auto}
/* drag handle only on gesture sheets (PwaSheet); tinted tone-primary/32%.
   Tabbed drawers (ModalDrawer / WalletDrawer) omit .drag entirely. */
.hf .sheet .drag{width:36px;height:5px;border-radius:99px;background:color-mix(in srgb,var(--act) 32%,transparent);margin:2px auto 4px}
.hf .sheet .sh-t{font-size:18px;font-weight:650;letter-spacing:-.01em;text-wrap:balance}
/* FormInfo anatomy for a sheet header — badge, title, meaning. */
.hf.s-client .sheet .sh-head{display:flex;gap:12px;align-items:center}
.hf.s-client .sheet .sh-head .fic{width:44px;height:44px;border-radius:99px;background:var(--stone-bg);
  border:1px solid var(--ln);display:inline-flex;align-items:center;justify-content:center;flex:none}
.hf.s-client .sheet .sh-head .ic{color:var(--act)}
.hf.s-client .sheet .sh-head .fi{font-size:12.5px;color:var(--stone);line-height:1.35;margin-top:2px}

/* disclosure (progressive disclosure on W2) */
.hf details.disc{border:1px solid var(--ln);border-radius:14px;background:var(--card)}
.hf details.disc summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;
  padding:11px 13px;font-weight:600;font-size:14px;min-height:44px}
.hf details.disc summary::-webkit-details-marker{display:none}
.hf details.disc summary .cnt{color:var(--stone);font-weight:500;font-size:12.5px}
.hf details.disc summary .caret{margin-left:auto;transition:rotate var(--spring-spatial-fast);color:var(--stone)}
.hf details.disc[open] summary .caret{rotate:90deg}
.hf details.disc .dbody{padding:0 13px 12px;display:flex;flex-direction:column;gap:8px}

/* hero (fulfilled) */
.hf .hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:18px 8px 8px}
.hf .hero .halo{width:64px;height:64px;border-radius:99px;background:var(--gr-bg);color:var(--gr-ink);
  display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(31,193,107,.18)}
.hf .hero .halo .ic{width:30px;height:30px}
.hf .hero .ht{font-size:19px;font-weight:650;letter-spacing:-.01em}
.hf .hero .hm{font-size:13.5px;color:var(--stone);max-width:30ch}
@media (prefers-reduced-motion: no-preference){
  .hf .hero .halo{animation:hfpop var(--spring-spatial-slow) both}
  @keyframes hfpop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
}

/* StatusBadge — icon + colour pill (WCAG 1.4.1, uiux-spec §12); client-only */
.hf .sbadge{display:inline-flex;align-items:center;gap:4px;border-radius:9999px;border:1px solid transparent;
  padding:3px 8px;font-weight:600;font-size:11px;line-height:1;white-space:nowrap}
.hf .sbadge .ic{width:12px;height:12px}
.hf .sbadge.success{background:var(--gr-bg);color:var(--gr-ink);border-color:color-mix(in srgb,var(--gr-ink) 28%,transparent)}
.hf .sbadge.warning{background:var(--amb-bg);color:var(--amb);border-color:color-mix(in srgb,var(--amb) 30%,transparent)}
.hf .sbadge.error{background:color-mix(in srgb,var(--err) 12%,transparent);color:var(--err);border-color:color-mix(in srgb,var(--err) 32%,transparent)}
.hf .sbadge.info{background:var(--sky-bg);color:var(--sky);border-color:color-mix(in srgb,var(--sky) 28%,transparent)}
.hf .sbadge.neutral{background:var(--stone-bg);color:var(--stone);border-color:var(--ln2)}

/* client form label — large text-label-lg strong ink (FormFieldWrapper), not an eyebrow */
.hf.s-client .fld{gap:6px}
.hf.s-client .fld .fl{font-size:16px;font-weight:600;color:var(--ink);letter-spacing:-.01em}

/* ConvictionMeter fidelity — action-green fill · 14px×2px threshold tick */
.hf.s-client .meter .fi{background:var(--act)}
.hf.s-client .meter .tick{height:14px;width:2px;top:-4px}

/* garden-detail header — image banner (h-36, rounded-b 24px) + title + meta */
.hf .ghead{display:flex;flex-direction:column}
.hf .gbanner{position:relative;height:132px;border-radius:0 0 24px 24px;overflow:hidden;
  background:linear-gradient(135deg,color-mix(in srgb,var(--amb-bg) 78%,var(--card)),color-mix(in srgb,var(--stone-bg) 72%,var(--amb-bg)))}
.hf .gback{position:absolute;top:14px;left:12px;width:44px;height:44px;border-radius:99px;border:0;cursor:pointer;
  background:color-mix(in srgb,var(--card) 86%,transparent);color:var(--ink);display:inline-flex;align-items:center;justify-content:center}
.hf .gtitle{padding:12px 16px 8px;display:flex;flex-direction:column;gap:6px}
.hf .gtitle h1{margin:0;font-size:21px;font-weight:650;line-height:1.2;letter-spacing:-.01em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hf .gmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13.5px;color:var(--stone)}
.hf .gmeta .gm{display:inline-flex;align-items:center;gap:5px;min-width:0}
.hf .gmeta .gm .ic{width:15px;height:15px;color:var(--gr-ink)}
.hf .gmeta .gsep{color:var(--ln2)}
/* Garden tabs stick to the top of the owned app scroll (the status bar now sits
   outside it), matching sticky StandardTabs without leaving a phantom gap. */
.hf.s-client .gtabs{position:sticky;top:0;z-index:2;background:var(--cv);box-shadow:0 1px 3px rgba(14,18,27,.06)}
.hf.s-client .abar{z-index:2}

/* Home header — h4 title + trailing icon-button row */
.hf .hhead{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 10px}
.hf .hhead .hh-title{margin:0;flex:1;font-size:19px;font-weight:650;letter-spacing:-.01em}
.hf .hhead .hh-actions{display:flex;align-items:center;gap:8px}
.hf .hhead .hh-ic{width:44px;height:44px;border-radius:12px;border:1px solid var(--ln);background:var(--card);
  color:var(--stone);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}

/* ---------- admin dialect (.s-admin) — Cockpit M3, finished (1a) ----------
   Re-synced 2026-08-15 to the shipped redesign (PR #713): linen canvas
   #FAF8F5, warm stone neutrals (ink 12·10·9 / sub 87·83·78 / border
   226·222·213 / chip 236·233·226), one 2-level elevation ladder, tone in
   exactly three places. */
.hf.s-admin{
  --cv:#FAF8F5; --card:#FFFFFF; --ink:#0C0A09; --stone:#57534E; --ln:#E2DED5;
  --ln2:#D6D3D1; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --err:#C2352B; --amb:#9A6A10; --amb-bg:#F8F0DC; --sky:#2547D0; --sky-bg:#D5E2FF;
  --sky-deep:#182F8B; --gr-bg:#E9F3EC; --stone-bg:#ECE9E2; --scrim:rgba(24,22,18,.4);
  font-family:"Plus Jakarta Sans",-apple-system,"Segoe UI",system-ui,sans-serif;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .hf.s-admin{
  --cv:#110C08; --card:#201913; --ink:#F0EEEA; --stone:#A39C93; --ln:#2E2A25;
  --ln2:#46403A; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#1F8A50; --acth:#25A05E;
  --err:#F08A82; --amb:#DFAA45; --amb-bg:#2E2512; --sky:#84ABF2; --sky-bg:#182337;
  --sky-deep:#C0D5FF; --gr-bg:#13291B; --stone-bg:#2A2621; --scrim:rgba(0,0,0,.55);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-admin{
    --cv:#110C08; --card:#201913; --ink:#F0EEEA; --stone:#A39C93; --ln:#2E2A25;
    --ln2:#46403A; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#1F8A50; --acth:#25A05E;
    --err:#F08A82; --amb:#DFAA45; --amb-bg:#2E2512; --sky:#84ABF2; --sky-bg:#182337;
    --sky-deep:#C0D5FF; --gr-bg:#13291B; --stone-bg:#2A2621; --scrim:rgba(0,0,0,.55);
  }
}

/* Derived surfaces (auto-adapt to light/dark via the per-theme tokens above):
   card-low = a hair off white for pinned dialog footers; chrome-border = the
   glass dock hairline. Cards themselves are WHITE on the linen canvas (1a) —
   the old segmented tab-rail well is gone (underline tabs carry no surface). */
.hf.s-admin{--card-low:color-mix(in srgb,var(--ink) 3.5%,var(--card));
  --chrome-border:color-mix(in srgb,var(--ink) 8%,transparent);
  --card-high:var(--card)}
/* Per-workspace tone — mirrors [data-tone] in admin-m3-tokens.css. Tone shows
   in exactly three places (1a): active tab underline/label + active nav pill
   (--tone-soft container + --tone-on-soft), the single filled action
   (--tone-fill), and the faint top canvas wash (--canvas-a at 5%, fading out
   by ~320px). --tone-ink is the contrast-safe accent text step. */
.hf [data-tone="garden"]{--tone-fill:var(--act);--tone-ink:var(--gr-ink);--tone-soft:var(--gr-bg);--tone-on-soft:var(--gr-ink);--canvas-a:var(--gr)}
.hf [data-tone="hub"]{--tone-fill:var(--sky);--tone-ink:var(--sky);--tone-soft:var(--sky-bg);--tone-on-soft:var(--sky-deep);--canvas-a:var(--sky)}
.hf [data-tone="community"]{--tone-fill:var(--amb);--tone-ink:var(--amb);--tone-soft:var(--amb-bg);--tone-on-soft:var(--amb);--canvas-a:var(--amb)}
.hf [data-tone="actions"]{--tone-fill:var(--err);--tone-ink:var(--err);--tone-soft:color-mix(in srgb,var(--err) 13%,transparent);--tone-on-soft:var(--err);--canvas-a:var(--err)}

.device.f-desktop{border:0;background:transparent;padding:14px 0 6px;display:flex;justify-content:center}
/* The browser window is the outer VIEWER frame (it is a web app; S1 scales it);
   position:relative anchors the floating glass nav dock to the window, not the
   artifact viewport. */
.hf .deskwin{width:100%;max-width:1040px;background:var(--cv);border:1px solid var(--ln);border-radius:14px;
  overflow:hidden;box-shadow:0 12px 36px rgba(14,18,27,.12);display:flex;flex-direction:column;position:relative;
  min-height:0;max-height:calc(var(--dev-cap) - 20px);font-size:13.5px;line-height:1.5}
.hf .winbar{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--ln);background:var(--card)}
.hf .winbar .dots{display:flex;gap:6px;flex:none}
.hf .winbar .dots i{width:10px;height:10px;border-radius:99px;background:var(--ln2);display:block}
.hf .winbar .url{flex:1;text-align:center;font-size:12px;color:var(--stone);background:var(--stone-bg);
  border-radius:8px;padding:3.5px 12px;margin:0 40px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ===== Real Canvas cockpit (CanvasLayout.tsx) — replaces the invented tab-bar =====
   Full-viewport 2-row grid inside the window: transparent AppBar (row 1) above a
   scrolling canvas that floats an opaque route card; the glass nav dock floats
   over the window bottom. Mirrors packages/{shared,admin} Canvas/* + index.css. */
/* Constant linen ground + the faint tone wash (1a, tone use 3 of 3): the
   workspace hue sits at 5% over the TOP of the canvas and fades out by
   ~320px — never a bottom-heavy atmosphere gradient. */
.hf .wsgrid{position:relative;flex:1;min-height:0;display:grid;grid-template-rows:auto 1fr;isolation:isolate;
  overflow:hidden;background:linear-gradient(180deg,
    color-mix(in srgb,var(--canvas-a,var(--act)) 5%,var(--cv)) 0,
    var(--cv) 320px)}
[data-theme="dark"] .hf .wsgrid{background:linear-gradient(180deg,
  color-mix(in srgb,var(--canvas-a,var(--act)) 10%,var(--cv)) 0,
  var(--cv) 320px)}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf .wsgrid{background:linear-gradient(180deg,
    color-mix(in srgb,var(--canvas-a,var(--act)) 10%,var(--cv)) 0,
    var(--cv) 320px)}
}

/* Row 1 — transparent AppBar (h-14): GardenChip left, icon buttons right. No tabs. */
.hf .appbar{grid-row:1;display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 18px;background:transparent}
.hf .gchip{display:inline-flex;align-items:center;gap:8px;border-radius:9999px;height:34px;padding:0 13px 0 7px;max-width:60%;
  background:var(--card);border:1px solid var(--ln);font-weight:500;font-size:13.5px;color:var(--ink)}
.hf .gchip:disabled{opacity:1;cursor:default}
/* 1a switcher: a 22px round mint avatar carries the seedling — no tone dot. */
.hf .gchip .leaf{position:relative;display:inline-flex;flex:none;align-items:center;justify-content:center;
  width:22px;height:22px;border-radius:9999px;background:#D0FBE9;color:#0F5132}
.hf .gchip .leaf .ic{width:13px;height:13px}
.hf .gchip .leaf .dot{display:none}
.hf .gchip .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf .gchip .caret{flex:none;color:var(--stone);margin-left:1px}
.hf .appbar-actions{display:flex;align-items:center;gap:1px;flex:none}
.hf .iconbtn{width:44px;height:44px;border-radius:9999px;border:0;background:transparent;color:var(--ink);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.hf .iconbtn:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.hf .iconbtn .ic{width:19px;height:19px}

/* Row 2 — scrolling canvas; the route card floats on it. Extra bottom padding
   clears the floating dock (real: --admin-main-bottom-clearance). */
.hf .mainscroll{grid-row:2;min-height:0;overflow-y:auto;overflow-x:hidden;padding:4px 18px 96px;position:relative}
@media (max-width:560px){.hf .mainscroll{padding:4px 12px 96px}}

/* Transparent route frame (1a) — the linen canvas IS the page ground; route
   header, tab rail, and cards sit directly on it. White cards at elevation
   level 1 carry the raised surfaces. */
.hf .routecard{background:transparent;border-radius:16px;padding:10px 14px 22px;min-height:calc(100% - 6px);
  display:flex;flex-direction:column;gap:14px}
@media (min-width:720px){.hf .routecard{padding:12px 24px 26px}}

/* PageHeader — title-large (22/28 @600, no display ramp), sticky under the
   AppBar, transparent over the canvas wash. */
.hf .pghead{position:sticky;top:0;z-index:3;background:transparent;display:flex;flex-direction:column;gap:7px;padding:2px 0 4px}
.hf .pghead .ph-row{display:flex;align-items:flex-start;gap:12px}
.hf .pghead .ph-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.hf .pghead .eyebrow{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)}
/* !important defeats the artifact's own #screens/#play h1 ID rule (higher
   specificity than any class chain). 1a: the route title sits on the M3 scale —
   title-large 22/28 at weight 600, no responsive display ramp. */
.hf .pghead h1{margin:0 !important;font-size:22px !important;font-weight:600;line-height:1.28;letter-spacing:0;color:var(--ink);text-wrap:balance}
.hf .pghead .ph-desc{font-size:13.5px;line-height:1.45;color:var(--stone);max-width:64ch}
.hf .pghead .ph-meta{font-size:12.5px;color:var(--stone);display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:1px}
.hf .pghead .ph-meta .num{font-variant-numeric:tabular-nums}
.hf .pghead .ph-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;flex:none}
.hf .pghead .ph-toolbar{margin-top:1px;border-top:1px solid var(--ln);padding-top:9px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.hf .pghead .ph-toolbar .grow{flex:1;min-width:0}

/* AdminTabRail — underline tabs (1a): flex rail on a hairline stone bottom
   rule; the active tab carries a 2px accent underline + weight 600 in the
   workspace accent (tone use 1 of 3). Inactive tabs are weight 500 sub ink;
   hover darkens text only. Count chips: neutral stone pill, flipping to the
   tone container pair on the active tab. */
.hf .tabrail{display:flex;gap:4px;padding:0;background:transparent;border-radius:0;
  border-bottom:1px solid var(--ln);overflow-x:auto}
.hf .tabrail .trhit{display:flex;align-items:stretch;min-width:0}
.hf .tabrail .trtab{border:0;border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:0;background:transparent;color:var(--stone);
  font-weight:500;font-size:13.5px;letter-spacing:-.005em;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  gap:7px;padding:9px 14px 10px;min-width:0}
.hf .tabrail .trhit .trtab{width:100%}
.hf .tabrail span.trtab{cursor:default}
.hf .tabrail .trtab:hover{color:var(--ink)}
.hf .tabrail .trtab .lbl{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf .tabrail .trtab.on{background:transparent;box-shadow:none;font-weight:600;
  color:var(--tone-ink,var(--act));border-bottom-color:var(--tone-ink,var(--act))}
.hf .tabrail .trtab .cnt{flex:none;min-width:20px;height:18px;border-radius:99px;padding:0 7px;font-weight:600;font-size:11px;
  font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;justify-content:center;
  background:var(--stone-bg);color:var(--stone);border:0}
.hf .tabrail .trtab.on .cnt{background:var(--tone-soft,var(--gr-bg));color:var(--tone-on-soft,var(--tone-ink,var(--gr-ink)))}

/* Floating glass nav dock — the app's ONLY backdrop-blur. Absolute to the
   window (position:relative deskwin), never fixed to the artifact viewport. */
/* 1a dock: flat 85% card + 12px blur, warm ambient shadow + 1px ink ring —
   the only sanctioned shadow outside the 2-level ladder. Active item = tone
   container pill (on-container icon) + weight-600 ink label; inactive items
   have a TRANSPARENT icon well and dim to 75% on hover. */
.hf .navdock{position:absolute;left:50%;bottom:16px;translate:-50% 0;z-index:6;display:flex;gap:2px;padding:4px 6px;
  border-radius:9999px;border:1px solid var(--chrome-border);
  background:color-mix(in srgb,var(--card) 85%,transparent);
  -webkit-backdrop-filter:blur(12px) saturate(1.14);backdrop-filter:blur(12px) saturate(1.14);
  box-shadow:0 18px 44px rgba(133,109,70,.14),0 0 0 1px rgba(0,0,0,.05)}
[data-theme="dark"] .hf .navdock{box-shadow:0 20px 48px rgba(30,22,14,.44),0 0 0 1px rgba(240,238,234,.08)}
.hf .navdock .nditem{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:62px;border:0;background:transparent;
  color:var(--stone);font-weight:500;font-size:10.5px;cursor:pointer;border-radius:9999px;padding:4px 6px 5px}
.hf .navdock .nditem:disabled{opacity:1;cursor:default}
.hf .navdock .nditem:hover:not(.on){opacity:.75}
.hf .navdock .nditem .ndic{width:38px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;
  background:transparent}
.hf .navdock .nditem .ndic .ic{width:17px;height:17px}
.hf .navdock .nditem.on{color:var(--ink);font-weight:600}
.hf .navdock .nditem.on .ndic{background:var(--tone-soft,var(--gr-bg));color:var(--tone-on-soft,var(--tone-ink,var(--act)))}

/* Dense data table — hairline row dividers, no cell borders, no zebra. */
.hf .visually-hidden{position:absolute!important;clip-path:inset(50%)!important;overflow:hidden!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;white-space:nowrap!important}
.hf table.dtab{border-collapse:collapse;width:100%;min-width:0;font-size:13px;text-align:left}
.hf table.dtab th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--stone);
  padding:0 10px 7px;font-weight:650}
.hf table.dtab td{padding:9px 10px;border-top:1px solid var(--ln);vertical-align:middle;font-variant-numeric:tabular-nums}
.hf table.dtab tbody tr:first-child td{border-top:0}
.hf table.dtab td .b{min-height:44px;padding:4px 12px;font-size:12.5px}

/* Tone-aware filled buttons (Hub blue, Garden green, …) inside the tone scope;
   admin-only so client buttons keep --act. */
.hf.s-admin .b.pri{background:var(--tone-fill,var(--act))}
.hf.s-admin .b.pri:hover{background:var(--tone-fill,var(--act));filter:brightness(.93)}

/* admin cards + tables (M3 solid, radius 12, dense) */
/* AdminCard — the WHITE card on the linen canvas (1a): radius 12dp, single
   M3 ladder elevation level 1 (hover steps to level 2 in the app). */
.hf .acard{background:var(--card);border-radius:12px;padding:14px 16px;
  display:flex;flex-direction:column;gap:9px;box-shadow:0 1px 2px rgba(0,0,0,.3),0 1px 3px 1px rgba(0,0,0,.15)}
/* admin skeleton = M3 card geometry (radius 12, level-1 shadow) */
.hf.s-admin .sk{border-radius:12px;border:0;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.3),0 1px 3px 1px rgba(0,0,0,.15)}
/* admin empty/recovery state sits on the route card, not a bordered panel */
.hf.s-admin .empty{padding:26px 18px 18px}
/* card action row — lifecycle/dialog-trigger buttons + chips beneath a card's
   meta. Children stay content-sized (mirrors .arow > *) so nowrap chips never
   flex-shrink below their text. */
/* Action clusters are END-ALIGNED, always (interaction-patterns §1 — header
   rows, dialog footers, card acts, sheet footers all share the rule). */
.hf .actrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end;margin-top:3px}
/* Workspace-tab two-column split (2026-08-16 decision 2): left = focused
   objects and acts, right rail = container status + quick actions + activity.
   Collapses to one column below 900px; rail content stacks after the main
   column — nothing disappears (admin-ux-brief responsive rules). */
.hf .wsrow{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.hf .wsmain,.hf .wsrail{display:flex;flex-direction:column;gap:12px;min-width:0}
@media (max-width:900px){.hf .wsrow{grid-template-columns:minmax(0,1fr)}}
.hf.f-phone .wsrow{grid-template-columns:minmax(0,1fr)}
/* Triage stats (uiux-spec §6.2 layout addendum; redesigned 2026-08-16 round 4).
   These are STATS, not buttons: one card, hairline-separated columns, the
   number leading in tabular figures with its label beneath. They stay
   keyboard-operable because each one jumps to the queue that owns it — the
   affordance is the hover/focus treatment, not button chrome. */
.hf .sumrow{display:flex;margin:0;background:var(--card);border-radius:12px;padding:2px;
  box-shadow:0 1px 2px rgba(0,0,0,.3),0 1px 3px 1px rgba(0,0,0,.15);flex-wrap:wrap}
/* Stacked is the default — number over label, which stays legible when the
   label is two or three words (the inline cast wrapped "Awaiting Confirmation"
   into the number's line, 2026-08-16 round 6). Inline remains available where a
   strip must cost one line. */
.hf .sumcell{flex:1 1 0;min-width:118px;display:flex;flex-direction:column;align-items:flex-start;gap:1px;
  border:0;background:transparent;cursor:pointer;font:inherit;color:var(--ink);text-align:left;
  padding:10px 14px;border-radius:10px;position:relative}
.hf .sumcell + .sumcell::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:1px;background:var(--ln)}
.hf .sumcell .n{font-weight:700;font-size:22px;line-height:1.12;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.hf .sumcell .l{color:var(--stone);font-size:12px;line-height:1.3}
.hf .sumrow.inline .sumcell{flex-direction:row;align-items:baseline;gap:7px;padding:9px 14px}
.hf .sumrow.inline .sumcell .n{font-size:19px}
.hf .sumcell.static{cursor:default}
.hf .sumcell:not(.static):hover{background:var(--stone-bg)}
.hf .sumcell:not(.static):hover .l{color:var(--ink)}
/* Zero is calm — a count of nothing must not read as an alert. */
.hf .sumcell.zero .n{color:var(--stone);font-weight:600}
/* Rail action stacks: quick actions are equal-width, full-bleed buttons so the
   rail never shows three ragged widths (2026-08-16 round 4). */
.hf .actstack{display:flex;flex-direction:column;gap:8px;margin-top:3px}
.hf .actstack .b{width:100%;justify-content:center}
/* Commitment/queue row — ONE anatomy everywhere (interaction-patterns §5):
   line 1 title + chips, line 2 calm meta, ONE trailing act. Two lines keep a
   busy row from wrapping its buttons in the narrower main column. */
.hf .prow{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--ln);min-height:52px}
.hf .prow:last-child{border-bottom:0}
.hf .prow > .pmain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.hf .prow .ptop{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.hf .prow .ptop b{font-size:13.5px}
.hf .prow .pmeta{font-size:12px;color:var(--stone);line-height:1.35}
.hf .prow > .pact{flex:none;display:flex;gap:6px;align-items:center}
/* A card whose HEADER IS ITS OBJECT (2026-08-16 round 6). The season names the
   card instead of sitting inside it as a second header — so there is one title
   bar, not two stacked ones. */
.hf .objcard .objhead{display:flex;align-items:flex-start;gap:10px;padding-bottom:2px}
.hf .objcard .objtitle{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}
.hf .objcard .objtitle .ptop{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.hf .objcard .objtitle .ptop b{font-size:15px;letter-spacing:-.01em}
.hf .objcard .objacts{flex:none;display:flex;gap:6px;align-items:center}
/* Section divider inside a card: quiet label left, optional section act right. */
.hf .cardsub{display:flex;align-items:center;gap:10px;font-weight:600;font-size:12px;color:var(--stone);
  padding-top:9px;margin-top:2px;border-top:1px solid var(--ln)}
.hf .cardsub .subact{margin-left:auto;display:flex;gap:6px;align-items:center}
/* What the pool holds. The quantity IS the row title, so it takes tabular
   figures and a touch more weight — a column of holdings should be readable as
   a column of amounts. Each row is one exact unit label; they are never summed,
   so nothing here draws a total line. */
.hf .holdlist .prow .ptop b{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.hf .holdlist .prow{min-height:44px;padding:7px 2px}
/* Setup checklist lines — a statement with its state, not a label/value pair
   ("How it works: agreed ✓" read as a data row about nothing). */
.hf .checkline{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink);padding:1px 0}
.hf .checkline .ic{width:14px;height:14px;flex:none;color:var(--stone)}
/* Route-local scope chips for the commitments list — Open · Confirmed · Past
   (uiux-spec §6.2 addendum, Garden OverviewTab precedent). Maps to AdminFilterChip. */
.hf .scopechips{display:flex;gap:6px;flex-wrap:wrap}
.hf .scopechips .sc-chip{border:0;cursor:pointer;font-weight:600;font-size:12px;color:var(--stone);border-radius:99px;
  padding:7px 12px;min-height:36px;background:transparent;box-shadow:inset 0 0 0 1px var(--ln)}
.hf .scopechips .sc-chip.on{color:var(--tone-ink,var(--act));background:var(--tone-soft,var(--gr-bg));box-shadow:none}
.hf .actrow > *{flex:none}
/* The kit chip dot-modifier uses class "dot", which collides with the artifact's
   own journey-nav .dot rule (width:8px) and squishes dotted chips to 8px, so the
   label overflows and the next chip lands on top of it. Surface-agnostic on
   purpose: this was scoped to two surfaces, so renaming one silently dropped the
   fix, and the client surface never had it at all. */
/* …and the SAME collision sets height:44px, which made every dotted state chip
   twice the height of the plain kind chip beside it (2026-08-16 round 5: the
   original patch fixed width only, so the symptom moved instead of leaving).
   Reset the whole box the chrome rule touches, not one property of it. */
.hf .ch{width:auto;height:auto;min-width:0;min-height:0;padding:2.5px 8px;border-radius:8px}
/* flow form column — a step form sits directly on the route card (no card-on-card) */
.hf .flowform{max-width:640px;display:flex;flex-direction:column;gap:11px}
.hf .acard .ahead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hf .acard .ahead .at{font-weight:700;font-size:13.5px;flex:none}
.hf .acard .ahead .ax{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.hf .acard .ahead .ax > *{flex:none}
.hf .arow{display:flex;align-items:center;gap:10px 10px;padding:8px 2px;border-bottom:1px solid var(--ln);min-height:40px;flex-wrap:wrap;align-content:center;row-gap:8px}
.hf .arow > *{flex:none}
.hf .arow > .grow{flex:1 1 auto;min-width:0}
.hf .arow:last-child{border-bottom:0}

/* admin buttons: denser */
.hf.s-admin .b{min-height:44px;padding:7px 16px;font-size:13px}
.hf.s-admin .b.pri{border-radius:9999px}
.hf.s-admin .b.sec{border-radius:9999px}
.hf.s-admin .b.ghost{min-height:44px}
.hf.s-admin .inp{min-height:44px;padding:7px 11px;font-size:13px;border-radius:10px}
.hf.s-admin .fld .fl{font-size:11.5px}
.hf.s-admin .ro{padding:9px 11px;border-radius:11px}
.hf.s-admin .ro .rl{font-size:13px}
.hf.s-admin .ro .rm{font-size:11.5px}
.hf.s-admin .ch{font-size:11.5px}

/* stage stepper (cycles console) */
.hf .stages{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:11.5px;color:var(--stone)}
.hf .stages .st1{display:flex;align-items:center;gap:4px}
.hf .stages .st1 i{width:7px;height:7px;border-radius:99px;background:var(--ln2);display:block}
.hf .stages .st1.done i{background:color-mix(in srgb,var(--act) 45%,var(--ln2))}
.hf .stages .st1.on{color:var(--ink);font-weight:650}
.hf .stages .st1.on i{background:var(--act)}
.hf .stages .sep{width:14px;height:1px;background:var(--ln2)}

/* AdminDialog — own scrim (on-surface/32%), 16dp corners (the 1a shape scale
   tops at 16), SOLID surface, level-2 elevation over the scrim, centered on
   desktop; header (hairline-bottom) / body
   (scroll) / footer (hairline-top, raised, right-aligned). Mirrors
   packages/admin/src/components/AdminDialog.tsx. */
.hf .dlgstage{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.hf .dlgstage > .dlg-behind{flex:1;min-height:0;display:flex}
.hf .dlgstage > .dlg-behind > .wsgrid{flex:1}
.hf .dlgstage .scrimm{position:absolute;inset:0;background:rgb(0 0 0/0.32);z-index:7}
.hf .adlg{position:absolute;left:50%;top:50%;translate:-50% -50%;z-index:8;width:min(560px,calc(100% - 40px));
  max-height:calc(100% - 40px);background:var(--card-high);border-radius:16px;overflow:hidden;
  display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(0,0,0,.3),0 2px 6px 2px rgba(0,0,0,.15)}
.hf .adlg .dlg-head{display:flex;align-items:flex-start;gap:10px;padding:15px 18px;border-bottom:1px solid var(--ln)}
.hf .adlg .dlg-head .dt{flex:1;min-width:0;font-size:16px;font-weight:700;letter-spacing:-.01em;line-height:1.3}
.hf .adlg .dlg-head .dclose{flex:none;width:44px;height:44px;border-radius:99px;border:0;background:transparent;
  color:var(--stone);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.hf .adlg .dlg-head .dclose:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.hf .adlg .dlg-body{min-height:0;overflow-y:auto;padding:15px 18px;display:flex;flex-direction:column;gap:11px}
.hf .adlg .dlg-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;
  border-top:1px solid var(--ln);background:var(--card-low)}
@media (max-width:639px){
  .hf .adlg{left:0;right:0;top:auto;bottom:0;translate:none;width:100%;max-height:calc(100% - 16px);
    border-radius:16px 16px 0 0}
}

/* Flow dialog — ActionFlowShell inside AdminDialog variant="flow" +
   ADMIN_FLOW_DIALOG_CLASS. Pinned header (context + title, right padding
   reserved for the close button), a labelled vertical step rail on desktop, a
   centred reading column, and a pinned footer matching the shipping callers:
   ONE leading button that morphs (Cancel on step one, Back after) beside the
   primary; the dialog X is the constant exit, and the left slot mirrors the
   real footer's progress/status slot (empty — no in-flight state is drawn).
   Drawing these flows as bare route pages is what left every admin multi-step
   form with no way back and no way out. */
.hf .adlg.flow{width:min(880px,calc(100% - 40px));height:85%;max-height:85%}
.hf .adlg.flow .dlg-head{flex-direction:column;align-items:stretch;gap:1px;position:relative;padding-right:62px}
.hf .adlg.flow .dlg-head .eyebrow{font-weight:600;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)}
.hf .adlg.flow .dlg-head .dclose{position:absolute;right:12px;top:12px}
.hf .flowrow{flex:1;min-height:0;display:flex}
.hf .steprail{flex:0 0 210px;border-right:1px solid var(--ln);padding:14px 12px;display:flex;
  flex-direction:column;gap:2px;overflow-y:auto}
.hf .steprail .srow{display:flex;gap:10px;align-items:flex-start;padding:8px 7px;border-radius:12px}
.hf .steprail .srow.on{background:var(--tone-soft,var(--gr-bg))}
.hf .steprail .sdot{flex:none;width:20px;height:20px;border-radius:99px;border:1px solid var(--ln2);
  display:flex;align-items:center;justify-content:center;font-weight:600;font-size:10px;color:var(--stone);margin-top:1px}
.hf .steprail .srow.on .sdot,.hf .steprail .srow.done .sdot{background:var(--tone-action,var(--act));
  border-color:transparent;color:var(--on-act)}
.hf .steprail .st{display:block;font-weight:600;font-size:12.5px;color:var(--ink);line-height:1.35}
.hf .steprail .sd{display:block;font:12px inherit;color:var(--stone);line-height:1.35}
.hf .adlg.flow .dlg-body{flex:1;padding:18px 22px}
.hf .adlg.flow .dlg-body > .flowform{max-width:640px;width:100%;margin:0 auto}
.hf .adlg.flow .dlg-foot{justify-content:space-between}
.hf .adlg.flow .dlg-foot .fend{display:flex;gap:8px}
@media (max-width:900px){.hf .steprail{display:none}}

/* quiet confirmation row (admin never celebrates) */
.hf .quietok{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--gr-ink)}
.hf .quietok .ic{width:15px;height:15px}

/* ---------- editorial dialect (.s-editorial) — public website ---------- */
.hf.s-editorial{
  --cv:#FBF8F2; --card:#FFFFFF; --ink:#2A2722; --stone:#6E6857; --ln:#E4DDD0;
  --ln2:#CFC6B6; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --amb:#9A6A10; --amb-bg:#F8F0DC; --stone-bg:#F2EEE5; --gr-bg:#E9F3EC;
  --serif:"Fraunces",ui-serif,Georgia,Cambria,"Times New Roman",serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-family:Inter,-apple-system,"Segoe UI",system-ui,sans-serif;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .hf.s-editorial,
:root:not([data-theme="light"]) .hf.s-editorial{}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-editorial{
    --cv:#171511; --card:#211E19; --ink:#F0EDE6; --stone:#A69F90; --ln:#2F2B24;
    --ln2:#4A443A; --gr-ink:#4ADE80; --amb:#DFAA45; --amb-bg:#2E2512;
    --stone-bg:#292520; --gr-bg:#13291B;
  }
}
[data-theme="dark"] .hf.s-editorial{
  --cv:#171511; --card:#211E19; --ink:#F0EDE6; --stone:#A69F90; --ln:#2F2B24;
  --ln2:#4A443A; --gr-ink:#4ADE80; --amb:#DFAA45; --amb-bg:#2E2512;
  --stone-bg:#292520; --gr-bg:#13291B;
}
.device.f-browser{border:0;background:transparent;padding:14px 0 6px;display:flex;justify-content:center}
.hf .webwin{width:100%;max-width:900px;background:var(--cv);border:1px solid var(--ln);border-radius:14px;
  overflow:hidden;box-shadow:0 12px 36px rgba(14,18,27,.1);display:flex;flex-direction:column;
  min-height:0;max-height:calc(var(--dev-cap) - 20px);font-size:15px;line-height:1.6}
/* SiteHeader (packages/client/src/components/Navigation/SiteHeader.tsx) — logo +
   nav (Gardens · Impact · Fund · Actions) + Install CTA. Real header is
   transparent over the hero and fades on scroll; these editorial sections sit
   mid-page where it has already faded, so a restrained top bar carries the site
   context and the panels below own the page. */
.hf .sitehdr{display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:14px clamp(20px,5vw,44px);border-bottom:1px solid var(--ln)}
.hf .sitehdr .brand{display:flex;align-items:center;gap:7px;font-weight:700;font-size:15px;color:var(--ink);flex:none}
.hf .sitehdr .brand .ic{color:var(--gr-ink);width:19px;height:19px}
.hf .sitehdr nav{display:flex;gap:2px;flex-wrap:wrap;justify-content:center}
.hf .sitehdr nav a{padding:6px 11px;border-radius:8px;color:var(--stone);text-decoration:none;font-size:14px;font-weight:500;cursor:pointer;min-height:44px;display:inline-flex;align-items:center}
.hf .sitehdr nav a.on{color:var(--ink)}
.hf .sitehdr nav a:hover{color:var(--ink)}
.hf .sitehdr .install{flex:none;background:var(--act);color:var(--on-act);border:0;border-radius:9999px;padding:8px 15px;font-weight:600;font-size:13px;cursor:pointer;min-height:44px}
.hf .sitehdr .install:hover{background:var(--acth)}
.hf .webbody{flex:1;min-height:0;overflow-y:auto;padding:34px clamp(24px,6vw,64px) 44px;display:flex;flex-direction:column;gap:18px}
.hf .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--stone)}
.hf .serif-h{font-family:var(--serif);font-size:clamp(22px,3.2vw,30px);font-weight:600;line-height:1.18;
  letter-spacing:-.01em;text-wrap:balance;margin:0}
.hf .serif-n{font-family:var(--serif);font-size:34px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.hf .epanel{background:var(--card);border:1px solid var(--ln);border-radius:2px;padding:22px 24px;
  display:flex;flex-direction:column;gap:12px;box-shadow:0 2px 14px rgba(14,18,27,.05)}
.hf .erule{height:1px;background:var(--ln);border:0;margin:2px 0}
.hf .estatrow{display:flex;gap:28px;flex-wrap:wrap}
.hf .estat .l{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--stone);margin-top:4px}
.hf .elink{color:var(--gr-ink);font-weight:600;text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--gr-ink) 40%,transparent);
  display:inline-flex;gap:6px;align-items:center;cursor:pointer;background:none;border-top:0;border-left:0;border-right:0;font-weight:600;font-size:15px;padding:0;min-height:44px}
.hf .pipe{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hf .pipe .pstage{border:1px solid var(--ln2);border-radius:2px;padding:7px 13px;font-family:var(--mono);
  font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:var(--card)}
.hf .pipe .pstage.new{border-color:var(--gr-ink);color:var(--gr-ink)}
.hf .pipe .parr{color:var(--stone)}

/* device entrance (state/step swaps) */
@media (prefers-reduced-motion: no-preference){
  .device .phonefit,.device .deskwin,.device .webwin,.device pre.ascii{animation:devin var(--spring-spatial) both}
  @keyframes devin{from{opacity:.35;transform:translateY(5px)}to{opacity:1;transform:none}}
}

/* hotspot affordances on hi-fi elements (journey/explorer classes).
   Cue hierarchy: .primary pulses (canonical advance) · .choice/.nav2 solid ring
   (real alternatives) · .quiet/.info2 carry a faint always-on dashed ring so every
   registered hotspot reads as live (Fix 2a/3) · .flash rings every hotspot on a
   mis-click to reveal the options (Fix 2b). Reduced-motion keeps the static rings
   and drops the animations. */
.hf [data-hot]{cursor:pointer}
/* Tap-target floor only (2026-08-14 third pass): the old display:inline-flex +
   align-items:center here re-centered any button-less hotspot CONTAINER the
   player promoted to role="button" — whole cards and the filter row included.
   Block containers honor min-height without a display change. */
.hf [data-hot][role="button"]{box-sizing:border-box;min-width:44px;min-height:44px}
.hf :is(button,a)[data-hot]{box-sizing:border-box;min-width:44px;min-height:44px}
.hf [data-hot].primary{outline:2px solid var(--gr);outline-offset:2px}
@media (prefers-reduced-motion: no-preference){
  .hf [data-hot].primary{animation:hfpulse calc(var(--spring-effects-slow-duration) * 3.2) var(--spring-effects-slow-easing) infinite}
  @keyframes hfpulse{0%,100%{outline-color:var(--gr)}50%{outline-color:transparent}}
}
.hf [data-hot].choice{outline:2px solid var(--gr-ink);outline-offset:2px}
.hf [data-hot].nav2{outline:2px solid var(--gr-ink);outline-offset:2px}
.hf [data-hot].quiet,.hf [data-hot].info2{outline:1px dashed color-mix(in srgb,var(--gr) 42%,transparent);outline-offset:1px}
.hf [data-hot].quiet:hover,.hf [data-hot].info2:hover,
.hf [data-hot].quiet:focus-visible,.hf [data-hot].info2:focus-visible{outline-color:color-mix(in srgb,var(--gr-ink) 66%,transparent)}
.hf [data-hot].flash{outline:2px solid var(--gr);outline-offset:2px}
@media (prefers-reduced-motion: no-preference){
  .hf [data-hot].flash{animation:hfflash calc(var(--spring-effects-slow-duration) * 1.25) var(--spring-effects-easing) both}
  @keyframes hfflash{0%,100%{outline-color:transparent}45%{outline-color:var(--gr)}}
}
.hf .marked{background:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--amb) 75%,transparent);border-radius:10px}
`;
