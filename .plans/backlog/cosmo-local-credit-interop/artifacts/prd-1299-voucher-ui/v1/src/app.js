/* The review page: views, the frame stage, walks, notes and the generated tables. */
(function () {
  var S = { view: "review", lang: "en", ftheme: "light", screen: "M01", state: "default", walk: "W1", step: 0, mfr: "phone", sfr: "desk" };
  var VIEWS = [["review", "Start Here"], ["map", "Journey Map"], ["architecture", "Architecture"], ["member", "Member App"], ["steward", "Steward Cockpit"], ["states", "Screens and States"], ["roles", "Roles and Actions"], ["copy", "Copy and Terms"], ["access", "Accessibility"], ["handoff", "Handoff"]];
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var KIND = { default: "Default", loading: "Loading", empty: "Empty", unavailable: "Unavailable", stale: "Stale", paused: "Paused", rejected: "Rejected", delayed: "Delayed", failure: "Failure", recovery: "Recovery", success: "Success", offline: "Offline", pending: "Pending", blocked: "Blocked", permission: "Permission" };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem("gg-prd1299-v1-" + k); localStorage.setItem("gg-prd1299-v1-" + k, v); } catch (e) { return null; } }
  function tags(list) { return '<span class="tags">' + (list || []).map(function (k) { var tg = GG.TAGS[k]; return tg ? '<span class="tag ' + tg[0] + '">' + tg[1] + "</span>" : ""; }).join("") + "</span>"; }
  function announce(msg) { var el = $("#live"); if (el) { el.textContent = ""; setTimeout(function () { el.textContent = msg; }, 30); } }
  function scr(id) { return GG.screens[id]; }
  function stateMeta(id, st) { var d = scr(id); return d.states.filter(function (x) { return x[0] === st; })[0] || d.states[0]; }
  function link(target, label) { return '<a href="#' + (scr(target.split("@")[0]).surface === "member" ? "member" : "steward") + '" data-open="' + target + '"><code>' + (label || target) + "</code></a>"; }

  /* ---------- Frames ---------- */
  function renderFrame(kind) {
    var d = scr(S.screen), member = d.surface === "member";
    GG.lang = S.lang;
    var cls = member ? (kind === "wide" ? "frame wide" : "frame phone" + (kind === "w360" ? " w360" : "")) : (kind === "phone" ? "frame phone ck cph" : "frame desk ck");
    var html;
    try { html = d.render(S.state, { phone: kind === "phone", wide: kind === "wide" }); } catch (e) { html = '<div style="padding:24px">Render error: ' + GG.esc(e.message) + "</div>"; }
    var cap = member ? (kind === "wide" ? "App at 1024 × 720 (tablet and desktop)" : kind === "w360" ? "Phone 360 × 800" : "Phone 390 × 844") : (kind === "phone" ? "Cockpit phone 390 × 844" : "Cockpit desktop 1280 × 800");
    return '<div class="fwrap" data-kind="' + kind + '"><div class="fcap">' + cap + " · " + S.lang.toUpperCase() + " · " + S.ftheme + '</div><div class="fscale"><div class="' + cls + '" data-theme="' + S.ftheme + '" lang="' + S.lang + '">' + html + "</div></div></div>";
  }
  function frameKinds() {
    var member = scr(S.screen).surface === "member";
    if (member) return S.mfr === "both" ? ["phone", "w360"] : S.mfr === "wide" ? ["wide"] : S.mfr === "trio" ? ["phone", "wide"] : ["phone"];
    return S.sfr === "both" ? ["desk", "phone"] : S.sfr === "phone" ? ["phone"] : ["desk"];
  }
  function fitFrames() {
    var stage = $(".view:not([hidden]) .stage"); if (!stage) return;
    var wraps = stage.querySelectorAll(".fwrap"); if (!wraps.length) return;
    var avail = stage.clientWidth - 32 - (wraps.length - 1) * 20, total = 0, maxH = Math.max(560, window.innerHeight - 150);
    wraps.forEach(function (w) { var f = w.querySelector(".frame"); total += f.offsetWidth; });
    wraps.forEach(function (w) {
      var f = w.querySelector(".frame"), sc = Math.min(1, avail / total, maxH / f.offsetHeight);
      if (window.innerWidth < 700) sc = Math.min(1, (stage.clientWidth - 28) / f.offsetWidth);
      var box = w.querySelector(".fscale"); box.style.transform = "scale(" + sc + ")"; box.style.width = f.offsetWidth + "px"; box.style.height = f.offsetHeight + "px";
      w.style.width = Math.ceil(f.offsetWidth * sc) + "px"; w.style.height = Math.ceil(f.offsetHeight * sc + 22) + "px";
    });
  }

  /* ---------- Prototype views ---------- */
  function screenList(surface) {
    var groups = {};
    Object.keys(GG.screens).forEach(function (id) { var d = GG.screens[id]; if (d.surface !== surface) return; (groups[d.journey] = groups[d.journey] || []).push(d); });
    var h = '<nav class="slist" aria-label="Screens">';
    Object.keys(GG.JOURNEYS).forEach(function (j) {
      if (!groups[j]) return;
      h += "<h4>" + GG.JOURNEYS[j] + "</h4>" + groups[j].map(function (d) { return '<button type="button" data-open="' + d.id + "@" + d.states[0][0] + '" aria-current="' + (d.id === S.screen) + '"><span class="sid">' + d.id + "</span><span>" + d.title + (d.entry ? " ·&nbsp;entry" : "") + "</span></button>"; }).join("");
    });
    return h + "</nav>";
  }
  function walkBar(surface) {
    var opts = GG.WALKS.filter(function (w) { return w.surface === surface || w.surface === "both"; });
    if (!opts.some(function (w) { return w.id === S.walk; })) { S.walk = opts[0].id; S.step = 0; }
    var w = GG.WALKS.filter(function (x) { return x.id === S.walk; })[0];
    var cur = w.steps[S.step] || w.steps[0];
    return '<div class="walk"><label class="sr" for="walksel-' + surface + '">Walk</label><select id="walksel-' + surface + '" data-walk>' + opts.map(function (o) { return '<option value="' + o.id + '"' + (o.id === S.walk ? " selected" : "") + ">" + o.id + " · " + o.title + "</option>"; }).join("") + "</select>" +
      '<button type="button" data-step="-1" aria-label="Previous step">←</button><button type="button" class="primary" data-step="1" aria-label="Next step">→</button>' +
      '<span class="cap"><b>' + (S.step + 1) + " / " + w.steps.length + "</b> · " + GG.esc(cur[1]) + "</span></div>";
  }
  function frameControls(member) {
    var opts = member ? [["phone", "390"], ["both", "390 + 360"], ["wide", "Tablet / desktop"], ["trio", "390 + wide"]] : [["desk", "Desktop"], ["phone", "Phone"], ["both", "Both"]];
    var cur = member ? S.mfr : S.sfr;
    return '<span class="seg" role="group" aria-label="Frames"><span class="lbl">Frames</span>' + opts.map(function (o) { return '<button type="button" data-frames="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</span>";
  }
  function notesPanel() {
    var d = scr(S.screen), sm = stateMeta(S.screen, S.state), n = d.notes || {}, sn = (d.stateNotes || {})[S.state] || {};
    var decs = (n.dec || []).map(function (id) { var x = GG.DECISIONS.filter(function (y) { return y.id === id; })[0] || GG.TERMS.filter(function (y) { return y.id === id; })[0]; return x ? '<li><b>' + id + "</b> " + GG.esc(x.t || x.term) + "</li>" : ""; }).join("");
    return '<aside class="notes" aria-label="Design notes"><div><h4>' + d.id + " · " + GG.esc(d.prd) + "</h4><b>" + GG.esc(d.title) + '</b></div><div>' + tags(d.notes.tags) + "</div>" +
      '<div class="live"><h4>This state · ' + KIND[sm[2]] + "</h4><p style=\"margin:4px 0 0\">" + GG.esc(sn.say || sm[1]) + '</p><p class="muted" style="margin:6px 0 0"><b>Screen reader:</b> ' + GG.esc(sn.sr || "None.") + "</p></div>" +
      "<dl><div><dt>Actor and account</dt><dd>" + GG.esc(n.who || "") + "</dd></div><div><dt>Preconditions and evidence</dt><dd>" + GG.esc(n.pre || "") + "</dd></div><div><dt>Reviews and authorizes</dt><dd>" + GG.esc(n.auth || "") + "</dd></div><div><dt>Pending, success, failure</dt><dd>" + GG.esc(n.out || "") + "</dd></div><div><dt>Recovery and who</dt><dd>" + GG.esc(n.rec || "") + "</dd></div><div><dt>Contract and projection facts</dt><dd>" + GG.esc(n.facts || "") + "</dd></div></dl>" +
      (decs ? '<div><h4>Decisions</h4><ul style="margin:6px 0 0;padding-left:18px">' + decs + "</ul></div>" : "") + "</aside>";
  }
  function protoView(surface) {
    var d = scr(S.screen);
    if (d.surface !== surface) { var first = Object.keys(GG.screens).filter(function (k) { return GG.screens[k].surface === surface; })[0]; S.screen = first; S.state = GG.screens[first].states[0][0]; d = scr(S.screen); }
    var states = d.states.map(function (x) { return '<button type="button" data-state="' + x[0] + '" aria-pressed="' + (x[0] === S.state) + '"><span class="k">' + KIND[x[2]] + "</span>" + GG.esc(x[1]) + "</button>"; }).join("");
    var wide = frameKinds().some(function (k) { return k === "desk" || k === "wide"; });
    return '<div class="proto' + (wide ? " wide" : "") + '">' + screenList(surface) + '<div class="stagecol"><div class="stagehead"><div class="t"><b>' + GG.esc(d.title) + "</b><code>" + d.id + "@" + S.state + "</code>" + tags(d.notes.tags) + '</div><div class="states" role="group" aria-label="States">' + states + "</div>" +
      walkBar(surface) + '<div class="globals">' + frameControls(surface === "member") + "</div></div>" +
      '<div class="stage" aria-label="Rendered frames">' + frameKinds().map(renderFrame).join("") + "</div></div>" + notesPanel() + "</div>";
  }

  /* ---------- Static views ---------- */
  function reviewView() {
    var afo = GG.DECISIONS.filter(function (d) { return d.afo; });
    var counts = { member: 0, steward: 0, states: 0 };
    Object.keys(GG.screens).forEach(function (k) { var d = GG.screens[k]; counts[d.surface]++; counts.states += d.states.length; });
    return '<div class="grid2"><section class="panel prose"><div class="kicker">Named version for approval</div><h2>' + GG.VERSION.name + " (" + GG.VERSION.date + ")</h2>" +
      "<p>The member and steward experience for Cosmo-Local vouchers and the cross-garden personal G$ purchase, built on the 18 to 21 October PWA and cockpit locks. It covers " + counts.member + " member screens and " + counts.steward + " steward screens with " + counts.states + " states, each with notes and EN/ES/PT copy. Afo approves this version; Gui's member and Portuguese review belongs to PRD-1312.</p>" +
      '<h3>Review sequence</h3><ol class="steps-ol">' +
      "<li><a href=\"#architecture\">Architecture</a>: the chain boundaries, the contract inventory and both routes.</li>" +
      "<li><a href=\"#member\" data-walkopen=\"W1\">W1</a> then <a href=\"#steward\" data-walkopen=\"W2\">W2</a>: the G$ purchase from both sides; <a href=\"#member\" data-walkopen=\"W3\">W3</a> for its exceptions.</li>" +
      "<li><a href=\"#member\" data-walkopen=\"W4\">W4</a> and <a href=\"#steward\" data-walkopen=\"W5\">W5</a>: the voucher service; <a href=\"#member\" data-walkopen=\"W6\">W6</a> for races and recovery. Stop on M10, the irreversible split.</li>" +
      "<li><a href=\"#member\" data-walkopen=\"W7\">W7</a>, <a href=\"#member\" data-walkopen=\"W8\">W8</a>, <a href=\"#steward\" data-walkopen=\"W9\">W9</a>, <a href=\"#member\" data-walkopen=\"W10\">W10</a>: holdings, exchange, linked rewards, issuer policy, where purchases live.</li>" +
      "<li><a href=\"#roles\">Roles and Actions</a>, then <a href=\"#copy\">Copy and Terms</a>, then the decisions below.</li></ol>" +
      '<h3>How to read the prototype</h3><p>Use the walk arrows or the ← → keys, or press buttons inside a frame. The notes beside each frame give the actor and account, evidence, outcomes, recovery, the screen-reader announcement and the contract facts. Switch language and frame theme in the bar; frames render at real size and scale to fit.</p></section>' +
      '<section class="panel"><div class="kicker">Needs Afo</div><h2>Decisions</h2><div class="dec">' + afo.map(function (d) { return "<article><h4>" + d.id + ". " + GG.esc(d.t) + '</h4><p><span class="rec">Recommended:</span> ' + GG.esc(d.rec) + '</p><p class="muted">' + GG.esc(d.why) + "</p></article>"; }).join("") +
      '<article><h4>T2 to T5. Voucher wording</h4><p><span class="rec">Recommended:</span> adopt earn, buy, swap and use; "voucher exchange" for a Cosmo-Local pool; "vale" in Spanish and Portuguese; "kept" for promises and "used" for vouchers. Portuguese goes to Gui.</p></article></div></section></div>' +
      '<section class="sect" style="margin-top:20px"><h2>What each fact rests on</h2><div class="tablewrap"><table class="mx"><thead><tr><th>Status</th><th>What</th><th>Source</th></tr></thead><tbody>' + GG.SOURCES.map(function (r) { return "<tr><td>" + tags([r[0]]) + "</td><td>" + GG.esc(r[1]) + '</td><td class="muted">' + GG.esc(r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
      '<section class="sect"><h2>Evidence and its limits</h2><div class="callout"><p style="margin:0">' + GG.esc(GG.EVIDENCE) + "</p></div></section>";
  }
  function mapView() {
    function cell(list) { return (list || []).map(function (x) { return x.indexOf("@") > 0 || /^[MS]\d/.test(x) ? link(x.indexOf("@") > 0 ? x : x + "@" + scr(x).states[0][0], x) : '<span class="muted">' + GG.esc(x) + "</span>"; }).join("<br>"); }
    function grid(m) {
      return '<section class="sect"><h2>' + m.title + '</h2><p class="muted" style="margin:0 0 8px">' + m.sub + '</p><div class="tablewrap"><table class="mx"><thead><tr><th>Who</th>' + m.stages.map(function (s) { return "<th>" + s + "</th>"; }).join("") + "</tr></thead><tbody>" +
        m.lanes.map(function (l) { return "<tr><th scope=\"row\">" + l[0] + "</th>" + l.slice(1).map(function (c) { return "<td>" + cell(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></section>";
    }
    return GG.MAPS.map(grid).join("");
  }
  function archView() {
    return '<section class="sect"><h2>Who owns what</h2><p class="muted" style="max-width:80ch">Arbitrum owns promises, parties, consent and authorization. Celo owns G$ custody and transfers. Gnosis owns vouchers, pool swaps and voucher escrow. Messages communicate authorization and results; G$ is not bridged. This inventory stays in the handoff and never appears as technical clutter in member screens.</p><div class="diagram">' + GG.svg.architecture() + '</div><div class="legend"><span style="color:var(--dg-upg)"><i></i>Upgraded</span><span style="color:var(--dg-new)"><i></i>New Green Goods contract</span><span style="color:var(--dg-reuse)"><i></i>Reused, no change in this scope</span><span style="color:var(--dg-ext)"><i style="border-style:dashed"></i>Reused CLC component</span></div></section>' +
      '<section class="sect"><h2>Cross-garden personal G$ purchase</h2><div class="diagram">' + GG.svg.strip(GG.STRIP_GD) + '</div><div class="diagram" style="margin-top:12px">' + GG.svg.sequence(GG.SEQ_GD) + '</div><div class="legend"><span>Solid: signed transaction</span><span>Dashed: cross-chain message</span><span>Dotted: evidence read</span><span>Dash-dot: outside Green Goods</span></div></section>' +
      '<section class="sect"><h2>Revised voucher setup and settlement</h2><div class="diagram">' + GG.svg.strip(GG.STRIP_VS) + '</div><div class="diagram" style="margin-top:12px">' + GG.svg.sequence(GG.SEQ_VS) + "</div></section>";
  }
  function statesView() {
    var counts = {}; Object.keys(KIND).forEach(function (k) { counts[k] = 0; });
    var rows = Object.keys(GG.screens).map(function (id) {
      var d = GG.screens[id];
      d.states.forEach(function (x) { counts[x[2]]++; });
      return '<tr><td class="id">' + id + "</td><td>" + (d.surface === "member" ? "Member app" : "Cockpit") + "</td><td>" + GG.esc(d.title) + (d.entry ? ' <span class="tag neu">entry</span>' : "") + "</td><td>" + GG.esc(d.prd) + "</td><td>" + d.states.map(function (x) { return link(id + "@" + x[0], x[0]) + ' <span class="muted">' + KIND[x[2]].toLowerCase() + "</span>"; }).join("<br>") + "</td><td>" + tags(d.notes.tags) + "</td></tr>";
    }).join("");
    var total = Object.keys(GG.screens).reduce(function (a, k) { return a + GG.screens[k].states.length; }, 0);
    return '<section class="sect"><h2>Screen and state inventory</h2><p class="muted">' + Object.keys(GG.screens).length + " screens, " + total + " states. Kinds covered: " + Object.keys(counts).filter(function (k) { return counts[k]; }).map(function (k) { return KIND[k] + " " + counts[k]; }).join(" · ") + '.</p><div class="tablewrap"><table class="mx"><thead><tr><th>ID</th><th>Surface</th><th>Screen</th><th>Owner</th><th>States</th><th>Status</th></tr></thead><tbody>' + rows + "</tbody></table></div></section>";
  }
  function rolesView() {
    return '<section class="sect"><h2>Role and action matrix</h2><p class="muted" style="max-width:85ch">Every consequential action with its actor and account, preconditions and evidence, what is reviewed and authorized, its pending, success and failure states, and who can recover. Source state, destination execution and acknowledgment stay distinct: a sent message is never shown as completed.</p><div class="tablewrap"><table class="mx" style="min-width:1500px"><thead><tr><th>Action</th><th>Actor</th><th>Account</th><th>Preconditions</th><th>Evidence</th><th>Reviews and authorizes</th><th>Pending</th><th>Success</th><th>Failure</th><th>Recovery and who</th><th>Screens</th><th>Status</th></tr></thead><tbody>' +
      GG.ROLES.map(function (r) { return "<tr><td><b>" + GG.esc(r.a) + "</b></td><td>" + GG.esc(r.who) + "</td><td>" + GG.esc(r.acct) + "</td><td>" + GG.esc(r.pre) + "</td><td>" + GG.esc(r.ev) + "</td><td>" + GG.esc(r.auth) + "</td><td>" + GG.esc(r.pend) + "</td><td>" + GG.esc(r.ok) + "</td><td>" + GG.esc(r.fail) + "</td><td>" + GG.esc(r.rec) + '</td><td class="id">' + GG.esc(r.scr) + "</td><td>" + tags(r.tags) + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
  }
  function copyView() {
    var keys = Object.keys(GG.strings);
    var long = keys.map(function (k) { var r = GG.strings[k]; var en = r[0].length; return [k, Math.max((r[1] || "").length, (r[2] || "").length) / Math.max(1, en), r]; }).filter(function (x) { return x[2][0].length > 18; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
    return '<section class="sect"><h2>Terminology decisions</h2><div class="tablewrap"><table class="mx"><thead><tr><th>ID</th><th>Term</th><th>Status</th><th>English</th><th>Spanish</th><th>Portuguese (for Gui)</th><th>Note</th></tr></thead><tbody>' +
      GG.TERMS.map(function (x) { return '<tr><td class="id">' + x.id + "</td><td><b>" + GG.esc(x.term) + "</b></td><td>" + GG.esc(x.st) + "</td><td>" + GG.esc(x.en) + "</td><td>" + GG.esc(x.es) + "</td><td>" + GG.esc(x.pt) + '</td><td class="muted">' + GG.esc(x.note) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
      '<section class="sect"><h2>Longest translations</h2><p class="muted">Strings whose Spanish or Portuguese runs longest against English: the ones to watch at 360px.</p><div class="tablewrap"><table class="mx"><thead><tr><th>Key</th><th>Ratio</th><th>English</th><th>Longest</th></tr></thead><tbody>' + long.map(function (x) { var r = x[2]; return '<tr><td class="id">' + x[0] + "</td><td>" + x[1].toFixed(2) + "</td><td>" + GG.esc(r[0]) + "</td><td>" + GG.esc((r[1] || "").length > (r[2] || "").length ? r[1] : r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
      '<section class="sect"><h2>All product strings (' + keys.length + ')</h2><p class="muted">User-authored content (titles, descriptions, garden and people names) stays in its author\'s language and isn\'t listed. Portuguese is a proposal for Gui\'s review in PRD-1312.</p><label for="copyfilter" class="kicker">Filter</label> <input id="copyfilter" type="search" placeholder="key or text" style="height:32px;border-radius:10px;border:1px solid var(--lab-line);padding:0 10px;background:var(--lab-panel);color:var(--lab-fg);margin:6px 0 10px"><div class="tablewrap"><table class="mx" id="copytable"><thead><tr><th>Key</th><th>English</th><th>Spanish</th><th>Portuguese (for Gui)</th></tr></thead><tbody>' +
      keys.map(function (k) { var r = GG.strings[k]; return '<tr><td class="id">' + k + "</td><td>" + GG.esc(r[0]) + "</td><td>" + GG.esc(r[1] || "(content, not translated)") + "</td><td>" + GG.esc(r[2] || "(content, not translated)") + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
  }
  function contrast(a, b) {
    function lum(h) { h = h.replace("#", ""); var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
    var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function accessView() {
    var pairs = [["Light", "Ink on canvas", "#292524", "#FAF8F5"], ["Light", "Muted on card", "#6B655F", "#FFFFFF"], ["Light", "Filled action", "#FFFFFF", "#1A7544"], ["Light", "Danger action (Freeze Split)", "#FFFFFF", "#B91C1C"], ["Light", "Warning pill", "#92400E", "#FEF3C7"], ["Light", "Error pill", "#991B1B", "#FEE2E2"], ["Light", "Info pill", "#1E40AF", "#DBEAFE"], ["Light", "Success pill", "#166534", "#DCFCE7"], ["Light", "Rehearsal banner", "#78350F", "#FEF3C7"], ["Light", "Cockpit garden action", "#FFFFFF", "#166534"],
      ["Dark", "Ink on card", "#FAFAF9", "#2A231C"], ["Dark", "Muted on card", "#A8A29E", "#2A231C"], ["Dark", "Mint action", "#0C0A09", "#C2F5DA"], ["Dark", "Danger action", "#FFFFFF", "#B91C1C"]];
    var srRows = []; Object.keys(GG.screens).forEach(function (id) { var sn = GG.screens[id].stateNotes || {}; Object.keys(sn).forEach(function (st) { if (sn[st].sr && sn[st].sr !== "None." && sn[st].sr !== "None") srRows.push([id + "@" + st, sn[st].sr]); }); });
    return '<div class="grid2"><section class="panel prose"><h2>Keyboard and focus</h2><ul><li>Every act is a real button; rows that open records are buttons with the whole row as target (AdminListRow, item row).</li><li>Sheets and dialogs trap focus, return it to the opener, and close on Escape except while signing (preventClose in flight).</li><li>Step flows move focus to the step heading on Next and Back; the stepper marks <code>aria-current="step"</code>.</li><li>Disabled primaries keep a description (<code>aria-describedby</code>) pointing at the failed check or notice that explains why.</li><li>Freeze Split: focus lands on the first checkbox, not on the destructive action; Enter on the action requires both boxes checked.</li><li>Scope chips are toggle buttons with <code>aria-pressed</code>; tabs use the tablist pattern with arrow keys.</li><li>Focus ring: one solid 2px ring in the surface\'s focus role (approved token slice, step 3).</li></ul>' +
      "<h2>Reduced motion and time</h2><ul><li>Sheets keep the DL-033 motion; with reduced motion they appear without sliding. Spinners stop and the status text carries the state.</li><li>Quote timers announce at 10 seconds left and at expiry, not every second. Acceptance windows show dates, never a countdown; no streak or urgency mechanics.</li></ul>" +
      "<h2>Long text</h2><ul><li>Titles truncate to one line in rows (locked card pick); full titles show on the record page and as the accessible name.</li><li>Notices wrap to as many lines as needed; fixed bars never wrap a button to a second row (DL-042 pattern): two acts become stacked full-width buttons below 640px.</li><li>Spanish and Portuguese escrow wording (depósito de garantía / em garantia) was checked at 360px; see Copy and Terms.</li></ul></section>" +
      '<section class="panel"><h2>Contrast of the state pairs</h2><div class="tablewrap"><table class="mx" style="min-width:0"><thead><tr><th>Theme</th><th>Pair</th><th>Ratio</th></tr></thead><tbody>' + pairs.map(function (p) { var r = contrast(p[2], p[3]); return "<tr><td>" + p[0] + "</td><td>" + p[1] + ' <span class="mono muted">' + p[2] + " on " + p[3] + "</span></td><td>" + r.toFixed(2) + ":1 " + (r >= 4.5 ? '<span class="tag req">AA</span>' : '<span class="tag gap">below AA</span>') + "</td></tr>"; }).join("") + '</tbody></table></div><p class="muted">Status never rests on color alone: every pill carries its word, the split bar carries its numbers and a text label, and the diagrams label each color.</p></section></div>' +
      '<section class="sect" style="margin-top:20px"><h2>Screen-reader announcements by state</h2><div class="tablewrap"><table class="mx"><thead><tr><th>State</th><th>Announcement</th></tr></thead><tbody>' + srRows.map(function (r) { return '<tr><td class="id">' + link(r[0]) + "</td><td>" + GG.esc(r[1]) + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
  }
  function handoffView() {
    return '<section class="sect prose"><h2>Implementation handoff</h2><p>The repository holds the full handoff beside this file: <code>handoff.md</code> (scope, slices, contract and projection facts, dependencies, evidence), <code>matrices.md</code> and <code>copy-sheet.md</code> (generated from this prototype\'s data, so they match it).</p></section>' +
      '<section class="sect"><h2>Screens by owner</h2><div class="tablewrap"><table class="mx"><thead><tr><th>Owner</th><th>Screens</th><th>What it delivers</th><th>Blocked by</th></tr></thead><tbody>' + GG.OWNERS.map(function (o) { return "<tr><td><b>" + o[0] + "</b></td><td>" + o[1].split(", ").map(function (x) { return link(x + "@" + scr(x).states[0][0], x); }).join(" ") + "</td><td>" + GG.esc(o[2]) + '</td><td class="muted">' + GG.esc(o[3]) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
      '<section class="sect"><h2>All decisions and dependencies</h2><div class="tablewrap"><table class="mx"><thead><tr><th>ID</th><th>Question</th><th>Recommended</th><th>Why</th><th>Owner</th></tr></thead><tbody>' + GG.DECISIONS.map(function (d) { return '<tr><td class="id">' + d.id + (d.afo ? ' <span class="tag open">Afo</span>' : "") + "</td><td>" + GG.esc(d.t) + "</td><td>" + GG.esc(d.rec) + '</td><td class="muted">' + GG.esc(d.why) + "</td><td>" + GG.esc(d.owner) + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
  }

  /* ---------- Render and events ---------- */
  function render() {
    VIEWS.forEach(function (v) { var el = document.getElementById("view-" + v[0]); if (el) el.hidden = v[0] !== S.view; });
    document.querySelectorAll(".tabs a").forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("href") === "#" + S.view ? "page" : "false"); });
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-lang") === S.lang); });
    document.querySelectorAll("[data-ftheme]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-ftheme") === S.ftheme); });
    var el = document.getElementById("view-" + S.view);
    GG.lang = S.lang;
    if (S.view === "member" || S.view === "steward") el.innerHTML = protoView(S.view);
    else if (!el.getAttribute("data-built") || S.view === "copy" || S.view === "access" || S.view === "states") {
      el.innerHTML = { review: reviewView, map: mapView, architecture: archView, states: statesView, roles: rolesView, copy: copyView, access: accessView, handoff: handoffView }[S.view]();
      el.setAttribute("data-built", "1");
    }
    requestAnimationFrame(fitFrames);
  }
  function open(target) {
    var p = target.split("@"), id = p[0] || S.screen;
    S.screen = id; S.state = p[1] || scr(id).states[0][0]; S.view = scr(id).surface === "member" ? "member" : "steward";
    var key = S.screen + "@" + S.state, surface = scr(id).surface;
    var w = GG.WALKS.filter(function (x) { return x.id === S.walk; })[0];
    var idx = w ? w.steps.findIndex(function (s) { return s[0] === key; }) : -1;
    if (idx < 0) {
      var fits = GG.WALKS.filter(function (x) { return (x.surface === surface || x.surface === "both") && x.steps.some(function (s) { return s[0] === key; }); });
      if (!fits.length) fits = GG.WALKS.filter(function (x) { return (x.surface === surface || x.surface === "both") && x.steps.some(function (s) { return s[0].split("@")[0] === id; }); });
      if (fits.length) { w = fits[0]; S.walk = w.id; idx = w.steps.findIndex(function (s) { return s[0] === key; }); if (idx < 0) idx = w.steps.findIndex(function (s) { return s[0].split("@")[0] === id; }); }
    }
    if (idx >= 0) S.step = idx;
    try { if (location.hash !== "#" + S.view) history.replaceState(null, "", "#" + S.view); } catch (e) { /* frame may refuse */ }
    render();
    announce("Showing " + id + ", " + stateMeta(id, S.state)[1]);
  }
  function stepWalk(delta) {
    var w = GG.WALKS.filter(function (x) { return x.id === S.walk; })[0];
    S.step = Math.max(0, Math.min(w.steps.length - 1, S.step + delta));
    open(w.steps[S.step][0]);
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-open],[data-state],[data-step],[data-frames],[data-lang],[data-ftheme],[data-walkopen],.tabs a");
    if (!t) return;
    if (t.hasAttribute("data-walkopen")) { e.preventDefault(); S.walk = t.getAttribute("data-walkopen"); S.step = 0; open(GG.WALKS.filter(function (x) { return x.id === S.walk; })[0].steps[0][0]); return; }
    if (t.matches(".tabs a")) { e.preventDefault(); S.view = t.getAttribute("href").slice(1); try { history.replaceState(null, "", "#" + S.view); } catch (x) { /* ignore */ } render(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute("data-go")) { var g = t.getAttribute("data-go"); if (!g || t.disabled) return; e.preventDefault(); open(g.charAt(0) === "@" ? S.screen + g : g); return; }
    if (t.hasAttribute("data-open")) { e.preventDefault(); open(t.getAttribute("data-open")); return; }
    if (t.hasAttribute("data-state")) { S.state = t.getAttribute("data-state"); open(S.screen + "@" + S.state); return; }
    if (t.hasAttribute("data-step")) { stepWalk(Number(t.getAttribute("data-step"))); return; }
    if (t.hasAttribute("data-frames")) { if (scr(S.screen).surface === "member") S.mfr = t.getAttribute("data-frames"); else S.sfr = t.getAttribute("data-frames"); store("frames-" + scr(S.screen).surface, t.getAttribute("data-frames")); render(); return; }
    if (t.hasAttribute("data-lang")) { S.lang = t.getAttribute("data-lang"); store("lang", S.lang); document.querySelectorAll(".view").forEach(function (v) { if (v.id === "view-copy") v.removeAttribute("data-built"); }); render(); return; }
    if (t.hasAttribute("data-ftheme")) { S.ftheme = t.getAttribute("data-ftheme"); store("ftheme", S.ftheme); render(); return; }
  });
  document.addEventListener("change", function (e) {
    if (e.target.matches("[data-walk]")) { S.walk = e.target.value; S.step = 0; open(GG.WALKS.filter(function (x) { return x.id === S.walk; })[0].steps[0][0]); }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id !== "copyfilter") return;
    var q = e.target.value.toLowerCase();
    document.querySelectorAll("#copytable tbody tr").forEach(function (tr) { tr.hidden = q && tr.textContent.toLowerCase().indexOf(q) < 0; });
  });
  document.addEventListener("keydown", function (e) {
    if (!(S.view === "member" || S.view === "steward")) return;
    if (/input|select|textarea/i.test((e.target.tagName || ""))) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stepWalk(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); stepWalk(-1); }
  });
  window.addEventListener("resize", function () { requestAnimationFrame(fitFrames); });

  var lang = store("lang"); if (lang && GG.LANGS.indexOf(lang) >= 0) S.lang = lang;
  var ft = store("ftheme"); if (ft === "dark" || ft === "light") S.ftheme = ft;
  var mf = store("frames-member"); if (mf) S.mfr = mf;
  var sf = store("frames-steward"); if (sf) S.sfr = sf;
  var h = (location.hash || "").slice(1);
  if (VIEWS.some(function (v) { return v[0] === h; })) S.view = h;
  if (S.view === "steward") { S.screen = "S01"; S.state = "default"; S.walk = "W2"; }
  GG.app = { open: open, state: S, render: render, setView: function (v) { S.view = v; render(); } };
  render();
})();
