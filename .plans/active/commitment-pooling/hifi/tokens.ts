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
/* ---------- client dialect (.sc) — Warm Earth PWA ---------- */
.hf.s-client{
  --cv:#FAF8F5; --card:#FFFFFF; --ink:#292524; --stone:#78716C; --ln:#EBE7E0;
  --ln2:#D6D3D1; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --err:#E11D2E; --amb:#B45309; --amb-bg:#FBF3E4; --sky:#2563EB; --sky-bg:#EBF1FD;
  --gr-bg:#E9F5EC; --stone-bg:#F3F1EE; --scrim:rgba(12,10,9,.34);
  --sp:cubic-bezier(0.16,1,0.3,1); --spf:cubic-bezier(0.34,1.56,0.64,1);
  --se:cubic-bezier(0.2,0,0,1);
  font-family:Inter,-apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .hf.s-client{
  --cv:#0F0E0C; --card:#1C1917; --ink:#F5F5F4; --stone:#A8A29E; --ln:#2B2825;
  --ln2:#44403C; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#1F8A50; --acth:#25A05E;
  --err:#F87171; --amb:#E7A93F; --amb-bg:#2E2412; --sky:#7CA9F9; --sky-bg:#182337;
  --gr-bg:#12291A; --stone-bg:#262320; --scrim:rgba(0,0,0,.5);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .hf.s-client{
    --cv:#0F0E0C; --card:#1C1917; --ink:#F5F5F4; --stone:#A8A29E; --ln:#2B2825;
    --ln2:#44403C; --gr:#1FC16B; --gr-ink:#4ADE80; --act:#1F8A50; --acth:#25A05E;
    --err:#F87171; --amb:#E7A93F; --amb-bg:#2E2412; --sky:#7CA9F9; --sky-bg:#182337;
    --gr-bg:#12291A; --stone-bg:#262320; --scrim:rgba(0,0,0,.5);
  }
}

/* device wrapper: hi-fi frames drop the ascii panel look */
.device.f-phone{border:0;background:transparent;padding:18px 8px 8px;display:flex;justify-content:center}
.device.f-phone .mftag{right:8px}

/* phone bezel + screen (390pt, concentric radii 44 → 32) */
.hf .phone{width:390px;max-width:100%;background:#101010;border-radius:44px;padding:12px;
  box-shadow:0 18px 48px rgba(14,18,27,.18),0 2px 8px rgba(14,18,27,.12)}
[data-theme="dark"] .hf .phone{box-shadow:0 18px 48px rgba(0,0,0,.5)}
.hf .scr{background:var(--cv);border-radius:32px;overflow:hidden;display:flex;flex-direction:column;
  min-height:730px;position:relative;font-size:15px;line-height:1.45}
.hf .statusbar{display:flex;justify-content:space-between;align-items:center;
  padding:14px 24px 6px;font:600 13px/1 inherit;color:var(--ink)}
.hf .statusbar .sbr{display:flex;gap:5px;align-items:center}
.hf .sb-sig{display:flex;gap:2px;align-items:flex-end}
.hf .sb-sig i{width:3px;background:var(--ink);border-radius:1px;display:block}
.hf .sb-batt{width:22px;height:11px;border:1px solid var(--stone);border-radius:3.5px;position:relative}
.hf .sb-batt::after{content:"";position:absolute;inset:1.5px;right:5px;background:var(--ink);border-radius:1.5px}
.hf .homebar{height:24px;display:flex;align-items:center;justify-content:center;flex:none}
.hf .homebar i{width:134px;height:5px;border-radius:99px;background:var(--ink);opacity:.28;display:block}

/* screen body + scroll column */
.hf .body{flex:1;display:flex;flex-direction:column;min-height:0}
.hf .pagepad{padding:4px 16px 16px;display:flex;flex-direction:column;gap:12px}

/* header */
.hf .hdr{display:flex;align-items:center;gap:10px;padding:8px 16px 4px;min-height:44px}
.hf .hdr .hback{width:36px;height:36px;border-radius:99px;border:0;background:transparent;color:var(--ink);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;margin-left:-8px}
.hf .hdr .hback:active{background:var(--stone-bg)}
.hf .hdr h1{font-size:21px;font-weight:650;margin:0;letter-spacing:-.01em;text-wrap:balance;line-height:1.2;min-width:0}
.hf .hdr .hx{margin-left:auto;flex:none}
.hf .hsub{padding:0 16px;color:var(--stone);font-size:13px;margin-top:-2px}

/* garden detail tab row */
.hf .gtabs{display:flex;gap:2px;padding:2px 12px 0;border-bottom:1px solid var(--ln)}
.hf .gtab{padding:9px 12px 10px;font:600 14px inherit;color:var(--stone);border:0;background:none;
  cursor:pointer;position:relative;border-radius:8px 8px 0 0}
.hf .gtab.on{color:var(--ink)}
.hf .gtab.on::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2.5px;
  border-radius:99px;background:var(--act)}

/* bottom app bar (installed PWA chrome) */
.hf .abar{flex:none;background:var(--card);border-top:1px solid var(--ln);border-radius:16px 16px 0 0;
  display:flex;justify-content:space-evenly;align-items:center;padding:9px 0 2px;margin-top:auto}
.hf .abar .atab{display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;
  color:var(--stone);font:500 12px inherit;cursor:pointer;padding:2px 14px;position:relative}
.hf .abar .atab.on{color:var(--gr)}
.hf .abar .atab .ic{width:24px;height:24px}
.hf .abar .badge{position:absolute;top:-2px;right:8px;min-width:16px;height:16px;border-radius:99px;
  background:var(--gr);color:#04290F;font:700 10px/16px inherit;text-align:center;padding:0 4px}
.hf .syncbar{margin:0 16px 8px;border:1px dashed var(--ln2);background:var(--stone-bg);color:var(--stone);
  border-radius:12px;padding:7px 12px;font-size:12.5px;display:flex;gap:8px;align-items:center}

/* icons */
.hf .ic{width:20px;height:20px;fill:currentColor;flex:none}
.hf .ic.s{width:16px;height:16px}
.hf .ic.l{width:24px;height:24px}

/* cards */
.hf .card{background:var(--card);border:1px solid var(--ln);border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 3px rgba(14,18,27,.04)}
.hf .card.flat{box-shadow:none}
.hf .cardrow{display:flex;align-items:center;gap:10px}
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

/* buttons — capsule primary vs squircle secondary (shape = hierarchy) */
.hf .b{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;
  font:600 15px inherit;min-height:44px;padding:10px 20px;border-radius:9999px;color:var(--ink);
  background:transparent;transition:transform .2s var(--spf),background .15s var(--se)}
.hf .b:active{transform:scale(.985)}
.hf .b.pri{background:var(--act);color:#fff}
.hf .b.pri:hover{background:var(--acth)}
.hf .b.sec{border-radius:20px;background:var(--card);color:var(--ink);box-shadow:inset 0 0 0 1px var(--ln2)}
.hf .b.ghost{color:var(--gr-ink);min-height:40px}
.hf .b.danger{color:var(--err);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--err) 45%,transparent);border-radius:20px}
.hf .b.full{width:100%}
.hf .b.sm{min-height:36px;padding:6px 14px;font-size:13.5px}
.hf .b[disabled]{opacity:.45;cursor:default}
.hf .brow{display:flex;gap:10px;flex-wrap:wrap}
.hf .brow .b{flex:1;min-width:max-content}

/* progress meter (ConvictionMeter grammar) */
.hf .meter{display:flex;flex-direction:column;gap:5px}
.hf .meter .tr{height:6px;border-radius:99px;background:var(--stone-bg);position:relative;overflow:visible}
.hf .meter .fi{height:100%;border-radius:99px;background:var(--gr);transition:width .5s var(--se)}
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
.hf .stat{flex:1;background:var(--card);border:1px solid var(--ln);border-radius:16px;padding:12px 14px}
.hf .stat .n{font-size:22px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.hf .stat .l{font-size:12.5px;color:var(--stone);margin-top:1px}

/* segmented filter chips */
.hf .seg{display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none}
.hf .seg .sg{border:0;background:var(--stone-bg);color:var(--stone);border-radius:99px;padding:6px 13px;
  font:600 13px inherit;cursor:pointer;white-space:nowrap}
.hf .seg .sg.on{background:var(--ink);color:var(--cv)}

/* forms (W3 grammar) */
.hf .fld{display:flex;flex-direction:column;gap:5px}
.hf .fld .fl{font:600 12.5px inherit;color:var(--stone);letter-spacing:.02em}
.hf .inp{border:1px solid var(--ln2);background:var(--card);border-radius:12px;min-height:46px;
  padding:11px 13px;font:500 15px inherit;color:var(--ink);display:flex;align-items:center;gap:8px}
.hf .inp .ph{color:var(--stone);font-weight:400}
.hf .inp.sel::after{content:"";margin-left:auto;border:5px solid transparent;border-top-color:var(--stone);translate:0 3px}
.hf .radio{display:flex;flex-direction:column;gap:8px}
.hf .ro{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--ln);border-radius:14px;
  padding:11px 13px;cursor:pointer;background:var(--card)}
.hf .ro .rdot{width:20px;height:20px;border-radius:99px;box-shadow:inset 0 0 0 2px var(--ln2);flex:none;margin-top:1px}
.hf .ro.on{border-color:var(--act);box-shadow:inset 0 0 0 1px var(--act)}
.hf .ro.on .rdot{box-shadow:inset 0 0 0 6px var(--act)}
.hf .ro .rl{font-size:14.5px;font-weight:550}
.hf .ro .rm{font-size:12.5px;color:var(--stone)}
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
.hf .sheet{position:absolute;left:0;right:0;bottom:0;background:var(--card);border-radius:24px 24px 0 0;
  padding:8px 16px 14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 -8px 32px rgba(14,18,27,.16)}
.hf .sheet .drag{width:40px;height:5px;border-radius:99px;background:var(--ln2);margin:2px auto 2px}
.hf .sheet .sh-t{font-size:18px;font-weight:650;letter-spacing:-.01em;text-wrap:balance}

/* disclosure (progressive disclosure on W2) */
.hf details.disc{border:1px solid var(--ln);border-radius:14px;background:var(--card)}
.hf details.disc summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;
  padding:11px 13px;font:600 14px inherit}
.hf details.disc summary::-webkit-details-marker{display:none}
.hf details.disc summary .cnt{color:var(--stone);font-weight:500;font-size:12.5px}
.hf details.disc summary .caret{margin-left:auto;transition:rotate .2s var(--se);color:var(--stone)}
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
  .hf .hero .halo{animation:hfpop .6s var(--spf) both}
  @keyframes hfpop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
}

/* ---------- admin dialect (.s-admin) — restrained M3 operator cockpit ---------- */
.hf.s-admin{
  --cv:#FAF9F7; --card:#FFFFFF; --ink:#26241F; --stone:#6E6862; --ln:#E9E4DC;
  --ln2:#D3CCC1; --gr:#1FC16B; --gr-ink:#15803D; --act:#1A7544; --acth:#16643B;
  --err:#C2352B; --amb:#9A6A10; --amb-bg:#F8F0DC; --sky:#2458BF; --sky-bg:#EBF1FD;
  --gr-bg:#E9F3EC; --stone-bg:#F1EEE9; --scrim:rgba(24,22,18,.4);
  --sp:cubic-bezier(0.16,1,0.3,1); --spf:cubic-bezier(0.34,1.56,0.64,1);
  --se:cubic-bezier(0.2,0,0,1);
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

.device.f-desktop{border:0;background:transparent;padding:14px 0 6px;display:flex;justify-content:center}
.hf .deskwin{width:100%;max-width:980px;background:var(--cv);border:1px solid var(--ln);border-radius:14px;
  overflow:hidden;box-shadow:0 12px 36px rgba(14,18,27,.12);display:flex;flex-direction:column;min-height:600px;
  font-size:13.5px;line-height:1.5}
.hf .winbar{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--ln);background:var(--card)}
.hf .winbar .dots{display:flex;gap:6px;flex:none}
.hf .winbar .dots i{width:10px;height:10px;border-radius:99px;background:var(--ln2);display:block}
.hf .winbar .url{flex:1;text-align:center;font-size:12px;color:var(--stone);background:var(--stone-bg);
  border-radius:8px;padding:3.5px 12px;margin:0 40px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hf .adminbar{display:flex;align-items:center;gap:18px;padding:10px 20px 0;background:transparent}
.hf .adminbar .brand{font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:7px}
.hf .adminbar .brand .ic{color:var(--gr)}
.hf .wstabs{display:flex;gap:2px;margin-left:8px}
.hf .wstab{border:0;background:none;color:var(--stone);font:600 13px inherit;cursor:pointer;
  padding:8px 12px 10px;position:relative;border-radius:8px 8px 0 0}
.hf .wstab.on{color:var(--ink)}
.hf .wstab.on::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2.5px;border-radius:99px;background:var(--act)}
.hf .adminbar .acct{margin-left:auto;width:28px;height:28px;border-radius:99px;background:var(--stone-bg);
  color:var(--stone);display:flex;align-items:center;justify-content:center;font:700 11px inherit}
.hf .vhead{display:flex;align-items:baseline;gap:12px;padding:16px 24px 4px}
.hf .vhead h2{font-size:18px;font-weight:700;margin:0;letter-spacing:-.01em}
.hf .vhead .vm{color:var(--stone);font-size:12.5px}
.hf .vhead .vx{margin-left:auto;display:flex;gap:8px;align-items:center}
.hf .canvasbody{flex:1;padding:10px 24px 22px;display:flex;flex-direction:column;gap:12px;position:relative}

/* admin cards + tables (M3 solid, radius 12, dense) */
.hf .acard{background:var(--card);border:1px solid var(--ln);border-radius:12px;padding:14px 16px;
  display:flex;flex-direction:column;gap:9px}
.hf .acard .ahead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hf .acard .ahead .at{font-weight:700;font-size:13.5px;flex:none}
.hf .acard .ahead .ax{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.hf .acard .ahead .ax > *{flex:none}
.hf table.atab{border-collapse:collapse;width:100%;font-size:13px;min-width:0}
.hf table.atab th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--stone);
  padding:6px 10px;border-bottom:1px solid var(--ln);font-weight:650}
.hf table.atab td{padding:8.5px 10px;border-bottom:1px solid var(--ln);vertical-align:middle;
  font-variant-numeric:tabular-nums}
.hf table.atab tr:last-child td{border-bottom:0}
.hf table.atab td .b{min-height:32px;padding:4px 12px;font-size:12.5px}
.hf .arow{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--ln);min-height:40px;flex-wrap:wrap}
.hf .arow > *{flex:none}
.hf .arow > .grow{flex:1 1 auto}
.hf .arow:last-child{border-bottom:0}

/* admin buttons: denser */
.hf.s-admin .b{min-height:36px;padding:7px 16px;font-size:13px}
.hf.s-admin .b.pri{border-radius:9999px}
.hf.s-admin .b.sec{border-radius:12px}
.hf.s-admin .b.ghost{min-height:32px}
.hf.s-admin .inp{min-height:38px;padding:7px 11px;font-size:13px;border-radius:10px}
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

/* centered admin dialog over dimmed canvas */
.hf .dlgstage{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.hf .dlgstage .behind{opacity:.9;pointer-events:none;flex:1;display:flex;flex-direction:column}
.hf .dlgstage .scrimm{position:absolute;inset:0;background:var(--scrim)}
.hf .adlg{position:absolute;left:50%;top:44px;translate:-50% 0;width:min(560px,calc(100% - 48px));
  background:var(--card);border:1px solid var(--ln);border-radius:16px;padding:18px 20px;
  display:flex;flex-direction:column;gap:11px;box-shadow:0 18px 48px rgba(14,18,27,.22)}
.hf .adlg .dt{font-size:15.5px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}
.hf .adlg .dt .hx{margin-left:auto}
.hf .adlg .dact{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}

/* admin FAB (Controlled Chrome glass allowed on FAB only) */
.hf .afab{position:absolute;right:22px;bottom:20px;min-height:40px;border-radius:14px;border:0;cursor:pointer;
  background:color-mix(in srgb,var(--act) 92%,#fff);color:#fff;font:600 13px inherit;padding:9px 16px;
  display:inline-flex;align-items:center;gap:7px;box-shadow:0 6px 20px rgba(26,117,68,.32)}
.hf .afab .ic{width:17px;height:17px}

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
  overflow:hidden;box-shadow:0 12px 36px rgba(14,18,27,.1);display:flex;flex-direction:column;min-height:520px;
  font-size:15px;line-height:1.6}
.hf .webbody{flex:1;padding:34px clamp(24px,6vw,64px) 44px;display:flex;flex-direction:column;gap:18px}
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
  display:inline-flex;gap:6px;align-items:center;cursor:pointer;background:none;border-top:0;border-left:0;border-right:0;font:600 15px inherit;padding:0}
.hf .pipe{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hf .pipe .pstage{border:1px solid var(--ln2);border-radius:2px;padding:7px 13px;font-family:var(--mono);
  font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:var(--card)}
.hf .pipe .pstage.new{border-color:var(--gr-ink);color:var(--gr-ink)}
.hf .pipe .parr{color:var(--stone)}

/* device entrance (state/step swaps) */
@media (prefers-reduced-motion: no-preference){
  .device .phone,.device .deskwin,.device .webwin,.device pre.ascii{animation:devin .32s cubic-bezier(0.16,1,0.3,1) both}
  @keyframes devin{from{opacity:.35;transform:translateY(5px)}to{opacity:1;transform:none}}
}

/* hotspot affordances on hi-fi elements (journey/explorer classes) */
.hf [data-hot]{cursor:pointer}
.hf [data-hot].primary{outline:2px solid var(--gr);outline-offset:2px;border-radius:12px}
@media (prefers-reduced-motion: no-preference){
  .hf [data-hot].primary{animation:hfpulse 1.6s ease-in-out infinite}
  @keyframes hfpulse{0%,100%{outline-color:var(--gr)}50%{outline-color:transparent}}
}
.hf [data-hot].choice{outline:2px solid var(--gr-ink);outline-offset:2px;border-radius:12px}
.hf [data-hot].nav2{outline:2px solid var(--gr-ink);outline-offset:2px;border-radius:12px}
.hf [data-hot].info2{box-shadow:0 0 0 0 transparent}
.hf .marked{background:none;box-shadow:0 0 0 2px color-mix(in srgb,#D9A514 75%,transparent);border-radius:10px}
`;
