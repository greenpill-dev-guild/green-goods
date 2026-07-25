// Hi-fi dialect CSS, shipped as one string into the artifact <style>.
// Scope contract: every rule lives under .hf + a dialect class (.sc client /
// .sa admin / .se editorial) with LOCAL custom properties — the artifact's
// document chrome never inherits kit styles and dialects never cross.
// Token values mirror packages/shared/src/styles/theme.css (Warm Earth):
// canvas #FAF8F5 · card #FFF · ink #292524 · stone #78716C · accent #1FC16B
// (≤3% of pixels) · action green #1A7544 · radius 8/16/20/24/9999 (concentric)
// · springs per the 6 motion tokens. Fonts fall back to the system stack —
// artifacts allow no external requests; Inter's metrics are SF-adjacent.

export const HIFI_CSS = `
/* Six motion tokens projected from theme.css. Component motion below derives
   from these values so reduced-motion can remove animation without leaving
   one-off timing curves behind. */
.hf.s-client,.hf.s-admin,.hf.s-public{
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

/* phone bezel + screen (390pt, concentric radii 44 → 32) */
.hf .phone{width:390px;max-width:100%;background:var(--bezel);border-radius:44px;padding:12px;
  box-shadow:0 18px 48px rgba(14,18,27,.18),0 2px 8px rgba(14,18,27,.12)}
[data-theme="dark"] .hf .phone{box-shadow:0 18px 48px rgba(0,0,0,.5)}
/* Phone screen: capped to the viewport, with fixed device chrome around an
   AppShell-like owned scroll surface. Height stays consistent across screens;
   --dev-cap is inherited from the artifact :root. */
.hf .scr{background:var(--cv);border-radius:32px;display:flex;flex-direction:column;
  height:calc(var(--dev-cap) - 50px);min-height:0;overflow:hidden;
  position:relative;font-size:15px;line-height:1.45}
.hf .statusbar{display:flex;justify-content:space-between;align-items:center;
  padding:14px 24px 6px;font:600 13px/1 inherit;color:var(--ink);
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
.hf .hdr .hback{width:44px;height:44px;border-radius:99px;border:0;background:transparent;color:var(--ink);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;margin-left:-8px}
.hf .hdr .hback:active{background:var(--stone-bg)}
.hf .hdr h1{font-size:21px;font-weight:650;margin:0;letter-spacing:-.01em;text-wrap:balance;line-height:1.2;min-width:0}
.hf .hdr .hx{margin-left:auto;flex:none}
.hf .hsub{padding:0 16px;color:var(--stone);font-size:13px;margin-top:-2px}

/* garden detail tab row */
.hf .gtabs{display:flex;gap:2px;padding:2px 12px 0;border-bottom:1px solid var(--ln)}
.hf .gtab{min-height:44px;padding:9px 12px 10px;font:600 14px inherit;color:var(--stone);border:0;background:none;
  cursor:pointer;position:relative;border-radius:8px 8px 0 0}
.hf .gtab.on{color:var(--ink)}
.hf .gtab.on::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2.5px;
  border-radius:99px;background:var(--act)}

/* bottom app bar (installed PWA chrome) */
.hf .abar{flex:none;background:var(--card);border-top:1px solid var(--ln);border-radius:16px 16px 0 0;
  display:flex;justify-content:space-evenly;align-items:center;height:69px;padding:7px 0 2px}
.hf .abar .atab{display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;
  color:var(--stone);font:500 12px inherit;cursor:pointer;padding:2px 14px;position:relative;min-height:44px}
.hf .abar .atab.on{color:var(--gr)}
.hf .abar .atab .ic{width:24px;height:24px}
.hf .abar .badge{position:absolute;top:-2px;right:8px;min-width:16px;height:16px;border-radius:99px;
  background:var(--gr);color:var(--on-accent);font:700 10px/16px inherit;text-align:center;padding:0 4px}
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
  font:600 12px inherit;background:var(--stone-bg);color:var(--stone);white-space:nowrap}
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
  font:600 15px inherit;min-height:44px;padding:10px 20px;border-radius:9999px;color:var(--ink);
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
.hf .meter .mrow{display:flex;justify-content:space-between;font-size:12.5px;color:var(--stone)}

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

/* stat tiles */
.hf .stats{display:flex;gap:10px}
.hf .stat{flex:1;background:var(--card);border:1px solid var(--ln);border-radius:20px;padding:12px 14px}
.hf .stat .n{font-size:22px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.hf .stat .l{font-size:12.5px;color:var(--stone);margin-top:1px}

/* segmented filter chips */
.hf .seg{display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none}
.hf .seg .sg{border:0;background:var(--stone-bg);color:var(--stone);border-radius:99px;padding:6px 13px;
  font:600 13px inherit;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center}
.hf .seg .sg.on{background:var(--ink);color:var(--cv)}
.hf .seg .sg[disabled],.hf .gtab[disabled],.hf .tabrail .trtab[disabled]{opacity:1;cursor:default}

/* forms (W3 grammar) */
.hf .fld{display:flex;flex-direction:column;gap:5px}
.hf fieldset.fld{border:0;padding:0;margin:0;min-width:0}
.hf .fld .fl{font:600 14px/1.35 inherit;color:var(--ink);letter-spacing:0}
.hf .inp{border:1px solid var(--ln2);background:var(--card);border-radius:12px;min-height:46px;
  padding:11px 13px;font:500 15px inherit;color:var(--ink);display:flex;align-items:center;gap:8px}
.hf .inp input,.hf .inp select{appearance:none;border:0;outline:0;background:transparent;color:inherit;font:inherit;
  min-width:0;width:100%;padding:0;margin:0}
.hf .inp input::placeholder{color:var(--stone);font-weight:400;opacity:1}
.hf .inp select:disabled{color:inherit;opacity:1;-webkit-text-fill-color:currentColor}
.hf .inp.sel::after{content:"";margin-left:auto;border:5px solid transparent;border-top-color:var(--stone);translate:0 3px}
.hf .radio{display:flex;flex-direction:column;gap:8px}
.hf .ro{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--ln);border-radius:14px;
  padding:11px 13px;cursor:pointer;background:var(--card);min-height:44px}
.hf .ro .rdot{appearance:none;width:20px;height:20px;border:0;border-radius:99px;box-shadow:inset 0 0 0 2px var(--ln2);flex:none;margin-top:1px;background:transparent;opacity:1}
.hf .ro.on,.hf .ro:has(.rdot:checked){border-color:var(--act);box-shadow:inset 0 0 0 1px var(--act)}
.hf .ro.on .rdot,.hf .ro .rdot:checked{box-shadow:inset 0 0 0 6px var(--act)}
.hf .ro .rl{display:block;font-size:14.5px;font-weight:550}
.hf .ro .rm{display:block;font-size:12.5px;color:var(--stone)}
.hf .stepdots{display:flex;gap:6px;align-items:center}
.hf .stepdots i{width:7px;height:7px;border-radius:99px;background:var(--ln2);display:block}
.hf .stepdots i.on{background:var(--act)}
.hf .stepdots i.done{background:color-mix(in srgb,var(--act) 45%,var(--ln2))}

/* key-value stat rows */
.hf .kv{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;padding:3px 0}
.hf .kv .k{color:var(--stone)}
.hf .kv .v{font-weight:550;text-align:right;font-variant-numeric:tabular-nums}

/* in-phone bottom sheet (W2a / W4) */
.hf .sheetstage{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.hf .sheetstage .behind{filter:saturate(.9);opacity:.9;pointer-events:none;flex:1;display:flex;flex-direction:column}
.hf .sheetstage .scrimm{position:absolute;inset:0;background:var(--scrim);border-radius:0}
.hf .sheet{position:absolute;left:0;right:0;bottom:0;background:var(--card);border-radius:16px 16px 0 0;
  border-bottom:0;padding:8px 16px 14px;display:flex;flex-direction:column;gap:10px;
  box-shadow:0 -12px 40px rgba(14,18,27,.20),0 -2px 8px rgba(14,18,27,.10)}
/* drag handle only on gesture sheets (PwaSheet); tinted tone-primary/32%.
   Tabbed drawers (ModalDrawer / WalletDrawer) omit .drag entirely. */
.hf .sheet .drag{width:36px;height:5px;border-radius:99px;background:color-mix(in srgb,var(--act) 32%,transparent);margin:2px auto 4px}
.hf .sheet .sh-t{font-size:18px;font-weight:650;letter-spacing:-.01em;text-wrap:balance}

/* disclosure (progressive disclosure on W2) */
.hf details.disc{border:1px solid var(--ln);border-radius:14px;background:var(--card)}
.hf details.disc summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;
  padding:11px 13px;font:600 14px inherit;min-height:44px}
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

/* ---------- admin dialect (.s-admin) — restrained M3 operator cockpit ---------- */
.hf.s-admin{
  --cv:#FAF9F7; --card:#FFFFFF; --ink:#26241F; --stone:#6E6862; --ln:#E9E4DC;
  --ln2:#D3CCC1; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --err:#C2352B; --amb:#9A6A10; --amb-bg:#F8F0DC; --sky:#2458BF; --sky-bg:#EBF1FD;
  --gr-bg:#E9F3EC; --stone-bg:#F1EEE9; --scrim:rgba(24,22,18,.4);
  font-family:"Plus Jakarta Sans",-apple-system,"Segoe UI",system-ui,sans-serif;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .hf.s-admin{
  --cv:#151310; --card:#201D19; --ink:#F0EEEA; --stone:#A39C93; --ln:#2E2A25;
  --ln2:#46403A; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#1F8A50; --acth:#25A05E;
  --err:#F08A82; --amb:#DFAA45; --amb-bg:#2E2512; --sky:#84ABF2; --sky-bg:#182337;
  --gr-bg:#13291B; --stone-bg:#2A2621; --scrim:rgba(0,0,0,.55);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-admin{
    --cv:#151310; --card:#201D19; --ink:#F0EEEA; --stone:#A39C93; --ln:#2E2A25;
    --ln2:#46403A; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#1F8A50; --acth:#25A05E;
    --err:#F08A82; --amb:#DFAA45; --amb-bg:#2E2512; --sky:#84ABF2; --sky-bg:#182337;
    --gr-bg:#13291B; --stone-bg:#2A2621; --scrim:rgba(0,0,0,.55);
  }
}

/* Derived surfaces (auto-adapt to light/dark via the per-theme tokens above):
   card-low = M3 surface-container-low (elevated cards sit a hair off the route
   card); surface-quiet = the segmented tab-rail well; chrome-border = the glass
   dock hairline. */
.hf.s-admin{--card-low:color-mix(in srgb,var(--ink) 3.5%,var(--card));
  --surface-quiet:var(--stone-bg);--chrome-border:color-mix(in srgb,var(--ink) 10%,transparent);
  --card-high:var(--card)}
/* Per-workspace tone — mirrors packages/admin/src/index.css [data-tone].
   --tone-fill: filled-action bg (stays deep so white text passes AA in both
   themes) · --tone-ink: accent text / active state (adapts) · --tone-soft:
   container tint · --canvas-a/b: the vertical gradient stops (mixed at low
   alpha into --cv so the tint reads subtle in light AND dark). */
.hf [data-tone="garden"]{--tone-fill:var(--act);--tone-ink:var(--gr-ink);--tone-soft:var(--gr-bg);--canvas-a:var(--gr);--canvas-b:var(--act)}
.hf [data-tone="hub"]{--tone-fill:var(--sky);--tone-ink:var(--sky);--tone-soft:var(--sky-bg);--canvas-a:var(--sky);--canvas-b:var(--sky)}
.hf [data-tone="community"]{--tone-fill:var(--amb);--tone-ink:var(--amb);--tone-soft:var(--amb-bg);--canvas-a:var(--amb);--canvas-b:var(--amb)}
.hf [data-tone="actions"]{--tone-fill:var(--err);--tone-ink:var(--err);--tone-soft:color-mix(in srgb,var(--err) 13%,transparent);--canvas-a:var(--err);--canvas-b:var(--err)}

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
.hf .wsgrid{position:relative;flex:1;min-height:0;display:grid;grid-template-rows:auto 1fr;isolation:isolate;
  overflow:hidden;background:linear-gradient(180deg,var(--card) 0%,
    color-mix(in srgb,var(--canvas-a,var(--gr)) 6%,var(--cv)) 55%,
    color-mix(in srgb,var(--canvas-b,var(--act)) 11%,var(--cv)) 100%)}

/* Row 1 — transparent AppBar (h-14): GardenChip left, icon buttons right. No tabs. */
.hf .appbar{grid-row:1;display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 18px;background:transparent}
.hf .gchip{display:inline-flex;align-items:center;gap:7px;border-radius:9999px;padding:6px 12px;max-width:60%;
  background:var(--card);border:1px solid var(--ln2);font-weight:600;font-size:13.5px;color:var(--ink)}
.hf .gchip:disabled{opacity:1;cursor:default}
.hf .gchip .leaf{position:relative;display:inline-flex;flex:none;color:var(--tone-fill,var(--act))}
.hf .gchip .leaf .ic{width:15px;height:15px}
.hf .gchip .leaf .dot{position:absolute;top:-2px;right:-3px;width:7px;height:7px;border-radius:99px;
  background:var(--tone-fill,var(--act));box-shadow:0 0 0 1.5px var(--card)}
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

/* Opaque route card — solid M3 surface, radius-xl, elevation-2 (route tint lives
   on the canvas behind it, never on this surface). */
.hf .routecard{background:var(--card);border-radius:20px;padding:16px 18px 22px;min-height:calc(100% - 6px);
  display:flex;flex-direction:column;gap:14px;box-shadow:0 1px 2px rgba(14,18,27,.05),0 10px 30px rgba(14,18,27,.10)}
@media (min-width:720px){.hf .routecard{padding:20px 24px 26px}}

/* PageHeader — big bold h1, sticky under the AppBar, with slots. */
.hf .pghead{position:sticky;top:0;z-index:3;background:var(--card);display:flex;flex-direction:column;gap:7px;padding:2px 0 4px}
.hf .pghead .ph-row{display:flex;align-items:flex-start;gap:12px}
.hf .pghead .ph-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.hf .pghead .eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)}
/* !important defeats the artifact's own #screens/#play h1 ID rule (higher
   specificity than any class chain) — the oversized bold title is the redesign's
   signature and must not be clamped to the document's 21px. */
.hf .pghead h1{margin:0 !important;font-size:clamp(25px,3.3vw,30px) !important;font-weight:700;line-height:1.13;letter-spacing:-.018em;color:var(--ink);text-wrap:balance}
.hf .pghead .ph-desc{font-size:13.5px;line-height:1.45;color:var(--stone);max-width:64ch}
.hf .pghead .ph-meta{font-size:12.5px;color:var(--stone);display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:1px}
.hf .pghead .ph-meta .num{font-variant-numeric:tabular-nums}
.hf .pghead .ph-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;flex:none}
.hf .pghead .ph-toolbar{margin-top:1px;border-top:1px solid var(--ln);padding-top:9px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.hf .pghead .ph-toolbar .grow{flex:1;min-width:0}

/* AdminTabRail — segmented card (grid), surface-quiet well, 40px tabs, active
   raised + elevation (NOT underline). Count chip greens/tints on active. */
.hf .tabrail{display:grid;gap:6px;padding:6px;background:var(--surface-quiet);border-radius:14px}
.hf .tabrail .trhit{height:44px;display:flex;align-items:center;min-width:0}
.hf .tabrail .trtab{height:40px;border:0;border-radius:10px;background:transparent;color:var(--stone);
  font:600 13.5px inherit;letter-spacing:-.005em;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  gap:6px;padding:0 10px;min-width:0}
.hf .tabrail .trhit .trtab{width:100%}
.hf .tabrail span.trtab{cursor:default}
.hf .tabrail .trtab .lbl{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf .tabrail .trtab.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(14,18,27,.10),0 1px 3px rgba(14,18,27,.10)}
.hf .tabrail .trtab .cnt{flex:none;min-width:20px;height:18px;border-radius:99px;padding:0 6px;font:600 10.5px inherit;
  font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;justify-content:center;
  background:var(--card);color:var(--stone);border:1px solid var(--ln2)}
.hf .tabrail .trtab.on .cnt{background:var(--tone-soft,var(--gr-bg));color:var(--tone-ink,var(--gr-ink));border-color:transparent}

/* Floating glass nav dock — the app's ONLY backdrop-blur. Absolute to the
   window (position:relative deskwin), never fixed to the artifact viewport. */
.hf .navdock{position:absolute;left:50%;bottom:16px;translate:-50% 0;z-index:6;display:flex;gap:3px;padding:5px 7px;
  border-radius:20px;border:1px solid var(--chrome-border);
  background:color-mix(in srgb,var(--card) 76%,transparent);
  -webkit-backdrop-filter:blur(12px) saturate(1.14);backdrop-filter:blur(12px) saturate(1.14);
  box-shadow:0 16px 40px rgba(64,52,32,.18)}
[data-theme="dark"] .hf .navdock{box-shadow:0 16px 40px rgba(0,0,0,.5)}
.hf .navdock .nditem{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:62px;border:0;background:transparent;
  color:var(--stone);font:500 10.5px inherit;cursor:pointer;border-radius:16px;padding:5px 6px 6px}
.hf .navdock .nditem:disabled{opacity:1;cursor:default}
.hf .navdock .nditem .ndic{width:34px;height:34px;border-radius:99px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--ink) 3%,transparent)}
.hf .navdock .nditem .ndic .ic{width:18px;height:18px}
.hf .navdock .nditem.on{color:var(--tone-ink,var(--act))}
.hf .navdock .nditem.on .ndic{background:var(--tone-soft,var(--gr-bg));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tone-fill,var(--act)) 26%,transparent)}

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
/* AdminCard — M3 elevated SOLID surface (radius 12dp, elevation shadow, not a
   1px border). Sits a hair off the white route card via --card-low. */
.hf .acard{background:var(--card-low);border-radius:12px;padding:14px 16px;
  display:flex;flex-direction:column;gap:9px;box-shadow:0 1px 2px rgba(14,18,27,.05),0 1px 3px rgba(14,18,27,.09)}
/* admin skeleton = M3 card geometry (radius 12, no client border) */
.hf.s-admin .sk{border-radius:12px;border:0;background:var(--card-low);box-shadow:0 1px 2px rgba(14,18,27,.05),0 1px 3px rgba(14,18,27,.09)}
/* admin empty/recovery state sits on the route card, not a bordered panel */
.hf.s-admin .empty{padding:26px 18px 18px}
/* card action row — lifecycle/dialog-trigger buttons + chips beneath a card's
   meta. Children stay content-sized (mirrors .arow > *) so nowrap chips never
   flex-shrink below their text. */
.hf .actrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:3px}
/* Triage summary row (uiux-spec §6.2 layout addendum). Production maps to
   MetaStrip + buildHubHeaderStats; each count names the queue that owns it. */
.hf .sumrow{display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap}
.hf .sumcell{display:flex;align-items:baseline;gap:7px;border:0;cursor:pointer;font:inherit;color:var(--ink);
  background:var(--card);box-shadow:inset 0 0 0 1px var(--ln);border-radius:14px;padding:9px 13px;min-height:44px}
.hf .sumcell .n{font-weight:700;font-size:15px}
.hf .sumcell .l{color:var(--stone);font-size:12px}
/* Route-local scope chips for the commitments list — Open · Confirmed · Past
   (uiux-spec §6.2 addendum, Garden OverviewTab precedent). Maps to AdminFilterChip. */
.hf .scopechips{display:flex;gap:6px;flex-wrap:wrap}
.hf .scopechips .sc-chip{border:0;cursor:pointer;font:600 12px inherit;color:var(--stone);border-radius:99px;
  padding:7px 12px;min-height:36px;background:transparent;box-shadow:inset 0 0 0 1px var(--ln)}
.hf .scopechips .sc-chip.on{color:var(--tone-ink,var(--act));background:var(--tone-soft,var(--gr-bg));box-shadow:none}
.hf .actrow > *{flex:none}
/* The kit chip dot-modifier uses class "dot", which collides with the artifact's
   own journey-nav .dot rule (width:8px) and squishes dotted chips to 8px (text
   overflows). Restore auto width on the admin/editorial surfaces. */
.hf.s-admin .ch,.hf.s-public .ch{width:auto}
/* flow form column — a step form sits directly on the route card (no card-on-card) */
.hf .flowform{max-width:640px;display:flex;flex-direction:column;gap:11px}
.hf .acard .ahead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hf .acard .ahead .at{font-weight:700;font-size:13.5px;flex:none}
.hf .acard .ahead .ax{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.hf .acard .ahead .ax > *{flex:none}
.hf .arow{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--ln);min-height:40px;flex-wrap:wrap}
.hf .arow > *{flex:none}
.hf .arow > .grow{flex:1 1 auto}
.hf .arow:last-child{border-bottom:0}

/* admin buttons: denser */
.hf.s-admin .b{min-height:44px;padding:7px 16px;font-size:13px}
.hf.s-admin .b.pri{border-radius:9999px}
.hf.s-admin .b.sec{border-radius:12px}
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

/* AdminDialog — own scrim (on-surface/32%), 28dp corners, SOLID
   surface-container-high, centered on desktop; header (hairline-bottom) / body
   (scroll) / footer (hairline-top, raised, right-aligned). Mirrors
   packages/admin/src/components/AdminDialog.tsx. */
.hf .dlgstage{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.hf .dlgstage > .dlg-behind{flex:1;min-height:0;display:flex}
.hf .dlgstage > .dlg-behind > .wsgrid{flex:1}
.hf .dlgstage .scrimm{position:absolute;inset:0;background:rgb(0 0 0/0.32);z-index:7}
.hf .adlg{position:absolute;left:50%;top:50%;translate:-50% -50%;z-index:8;width:min(560px,calc(100% - 40px));
  max-height:calc(100% - 40px);background:var(--card-high);border-radius:28px;overflow:hidden;
  display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(14,18,27,.30)}
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
    border-radius:28px 28px 0 0}
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
.hf .adlg.flow .dlg-head .eyebrow{font:600 11px inherit;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)}
.hf .adlg.flow .dlg-head .dclose{position:absolute;right:12px;top:12px}
.hf .flowrow{flex:1;min-height:0;display:flex}
.hf .steprail{flex:0 0 210px;border-right:1px solid var(--ln);padding:14px 12px;display:flex;
  flex-direction:column;gap:2px;overflow-y:auto}
.hf .steprail .srow{display:flex;gap:10px;align-items:flex-start;padding:8px 7px;border-radius:12px}
.hf .steprail .srow.on{background:var(--tone-soft,var(--gr-bg))}
.hf .steprail .sdot{flex:none;width:20px;height:20px;border-radius:99px;border:1px solid var(--ln2);
  display:flex;align-items:center;justify-content:center;font:600 10px inherit;color:var(--stone);margin-top:1px}
.hf .steprail .srow.on .sdot,.hf .steprail .srow.done .sdot{background:var(--tone-action,var(--act));
  border-color:transparent;color:var(--on-act)}
.hf .steprail .st{display:block;font:600 12.5px inherit;color:var(--ink);line-height:1.35}
.hf .steprail .sd{display:block;font:12px inherit;color:var(--stone);line-height:1.35}
.hf .adlg.flow .dlg-body{flex:1;padding:18px 22px}
.hf .adlg.flow .dlg-body > .flowform{max-width:640px;width:100%;margin:0 auto}
.hf .adlg.flow .dlg-foot{justify-content:space-between}
.hf .adlg.flow .dlg-foot .fend{display:flex;gap:8px}
@media (max-width:900px){.hf .steprail{display:none}}

/* quiet confirmation row (admin never celebrates) */
.hf .quietok{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--gr-ink)}
.hf .quietok .ic{width:15px;height:15px}

/* ---------- editorial dialect (.s-public) — public website ---------- */
.hf.s-public{
  --cv:#FBF8F2; --card:#FFFFFF; --ink:#2A2722; --stone:#6E6857; --ln:#E4DDD0;
  --ln2:#CFC6B6; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --amb:#9A6A10; --amb-bg:#F8F0DC; --stone-bg:#F2EEE5; --gr-bg:#E9F3EC;
  --serif:"Fraunces",ui-serif,Georgia,Cambria,"Times New Roman",serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-family:Inter,-apple-system,"Segoe UI",system-ui,sans-serif;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .hf.s-public,
:root:not([data-theme="light"]) .hf.s-public{}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-public{
    --cv:#171511; --card:#211E19; --ink:#F0EDE6; --stone:#A69F90; --ln:#2F2B24;
    --ln2:#4A443A; --gr-ink:#4ADE80; --amb:#DFAA45; --amb-bg:#2E2512;
    --stone-bg:#292520; --gr-bg:#13291B;
  }
}
[data-theme="dark"] .hf.s-public{
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
.hf .sitehdr .install{flex:none;background:var(--act);color:var(--on-act);border:0;border-radius:9999px;padding:8px 15px;font:600 13px inherit;cursor:pointer;min-height:44px}
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
  display:inline-flex;gap:6px;align-items:center;cursor:pointer;background:none;border-top:0;border-left:0;border-right:0;font:600 15px inherit;padding:0;min-height:44px}
.hf .pipe{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hf .pipe .pstage{border:1px solid var(--ln2);border-radius:2px;padding:7px 13px;font-family:var(--mono);
  font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:var(--card)}
.hf .pipe .pstage.new{border-color:var(--gr-ink);color:var(--gr-ink)}
.hf .pipe .parr{color:var(--stone)}

/* device entrance (state/step swaps) */
@media (prefers-reduced-motion: no-preference){
  .device .phone,.device .deskwin,.device .webwin,.device pre.ascii{animation:devin var(--spring-spatial) both}
  @keyframes devin{from{opacity:.35;transform:translateY(5px)}to{opacity:1;transform:none}}
}

/* hotspot affordances on hi-fi elements (journey/explorer classes).
   Cue hierarchy: .primary pulses (canonical advance) · .choice/.nav2 solid ring
   (real alternatives) · .quiet/.info2 carry a faint always-on dashed ring so every
   registered hotspot reads as live (Fix 2a/3) · .flash rings every hotspot on a
   mis-click to reveal the options (Fix 2b). Reduced-motion keeps the static rings
   and drops the animations. */
.hf [data-hot]{cursor:pointer}
.hf [data-hot][role="button"]{display:inline-flex;align-items:center;box-sizing:border-box;min-width:44px;min-height:44px}
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
