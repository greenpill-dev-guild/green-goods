/* Shared kit: translation, icons and the product components the screens compose.
   Components mirror shipped names where one exists (noted beside each); the rest are flagged
   as proposals in the handoff, never invented silently. */
var GG = (typeof GG !== "undefined" && GG) || {};
GG.lang = "en";
GG.strings = {};
GG.LANGS = ["en", "es", "pt"];

/* Register strings: { key: [en, es, pt] }. A later key with the same name is a build error. */
GG.T = function (obj) {
  Object.keys(obj).forEach(function (k) {
    if (GG.strings[k]) throw new Error("Duplicate string key: " + k);
    GG.strings[k] = obj[k];
  });
};
GG.t = function (key, vars) {
  var row = GG.strings[key];
  if (!row) return "⟦" + key + "⟧";
  var idx = GG.LANGS.indexOf(GG.lang);
  var s = row[idx] || row[0];
  if (vars) Object.keys(vars).forEach(function (v) { s = s.split("{" + v + "}").join(vars[v]); });
  return s;
};
var t = GG.t;

GG.esc = function (s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

/* Numbers in the reader's language: 1,240.50 in en, 1.240,50 in es and pt. */
GG.num = function (n, dp) {
  var locale = GG.lang === "en" ? "en-US" : GG.lang === "es" ? "es-ES" : "pt-BR";
  return Number(n).toLocaleString(locale, { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0, useGrouping: "always" });
};
GG.gd = function (n) { return GG.num(n, 2) + " G$"; };

GG.ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
  plant: '<path d="M12 21v-7"/><path d="M12 14c0-4 2.5-6.5 7-6.5 0 4-2.5 6.5-7 6.5z"/><path d="M12 14c0-4-2.5-6.5-7-6.5 0 4 2.5 6.5 7 6.5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  bell: '<path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h2"/>',
  promise: '<path d="M7 12.5 10.5 9a2 2 0 0 1 2.8 0l.7.7"/><path d="m3 11 4-4 3 1 4-1 3 3"/><path d="m21 11-4 4-1.5-1.5"/><path d="m8 15 2 2 1-1 1.5 1.5 2-2"/>',
  work: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5V3h6v1.5"/><path d="M9 11h6M9 15h4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevr: '<path d="m9 6 6 6-6 6"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  xcirc: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  coins: '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M10 15.5c.9 1.2 2.7 2 5 2 2.8 0 5-1.1 5-2.5V11c0-1.4-2.2-2.5-5-2.5"/>',
  ticket: '<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2.5a1.5 1.5 0 0 0 0 3V16a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2.5a1.5 1.5 0 0 0 0-3z"/><path d="M10 9v6" stroke-dasharray="1.5 2"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M16 7l2 2M14 9l1.5 1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ext: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
  offer: '<path d="M3 12.5h3.5l3 2.5h4a1.5 1.5 0 0 1 0 3H9"/><path d="M13.5 18H17l3.5-3a1.4 1.4 0 0 0-1.8-2.1L15 15"/><path d="M14.5 4.5c1-1 2.6-1 3.5 0 1 1 1 2.5 0 3.5L15 11l-3-3c-1-1-1-2.5 0-3.5 1-1 2.5-1 3.5 0"/>',
  request: '<path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',
  send: '<path d="M7 17 17 7M9 7h8v8"/>',
  people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><path d="M15 14.5c3 0 5.5 1.8 5.5 5"/>',
  hub: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  community: '<circle cx="12" cy="7" r="3"/><circle cx="5.5" cy="12" r="2.3"/><circle cx="18.5" cy="12" r="2.3"/><path d="M7 20c0-3 2.2-5 5-5s5 2 5 5"/>',
  actions: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  spark: '<path d="M12 3.5 13.8 9l5.7 1.5-5.7 1.6L12 17.5l-1.8-5.4L4.5 10.5 10.2 9z"/><path d="M18.5 16v4M16.5 18h4"/>',
  seed: '<path d="M12 20c-4.5 0-7-3-7-7 5 0 7 2.5 7 7z"/><path d="M12 20c4.5 0 7-3 7-7-5 0-7 2.5-7 7z"/><path d="M12 13V5"/><circle cx="12" cy="5" r="1.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  dot: '<circle cx="12" cy="12" r="3.5"/>',
  minus: '<path d="M6 12h12"/>'
};
GG.ic = function (name, size) {
  size = size || 20;
  return '<svg class="i" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' + (GG.ICONS[name] || GG.ICONS.dot) + "</svg>";
};
var ic = GG.ic;

/* data-go makes a control navigate the prototype: "M05@ready" or "@state" for the same screen. */
GG.go = function (target) { return target ? ' data-go="' + target + '"' : ""; };

/* ---------- PWA components ---------- */
GG.pill = function (kind, text) { return '<span class="pill ' + kind + '">' + text + "</span>"; };
/* Button (shared Button: 48 page primary, 44 sheet default, 32 compact; 16px corner) */
GG.btn = function (label, o) {
  o = o || {};
  var cls = "btn" + (o.kind ? " " + o.kind : "") + (o.compact ? " compact" : "");
  return '<button type="button" class="' + cls + '"' + GG.go(o.go) + (o.disabled ? " disabled" : "") + (o.aria ? ' aria-label="' + GG.esc(o.aria) + '"' : "") + ">" + (o.icon ? ic(o.icon, 18) : "") + "<span>" + label + "</span></button>";
};
/* Item row (the locked 88px item card: one-line title, status pill under it, one detail line) */
GG.row = function (o) {
  var tile = o.photo ? '<div class="tile" style="background:' + o.photo + '"></div>' : '<div class="tile ' + (o.tileKind || "") + '">' + ic(o.icon || "promise", 28) + "</div>";
  return '<button type="button" class="row"' + GG.go(o.go) + ">" + (o.edge ? '<span class="edge ' + o.edge + '"></span>' : "") + tile +
    '<div class="body"><div class="title">' + o.title + "</div>" + (o.pill ? GG.pill(o.pill[0], o.pill[1]) : "") +
    (o.detail ? '<div class="detail">' + o.detail + "</div>" : "") + "</div>" +
    '<div class="slot">' + (o.slot || ic("chevr", 18)) + "</div></button>";
};
/* Notice (DL-057 anatomy: icon and title on one line, reason under it, actions below) */
GG.notice = function (kind, icon, title, body, acts) {
  return '<div class="notice ' + (kind || "") + '" role="status"><div class="nt">' + ic(icon || "info", 18) + "<span>" + title + "</span></div>" +
    (body ? "<p>" + body + "</p>" : "") + (acts ? '<div class="acts">' + acts + "</div>" : "") + "</div>";
};
/* Facts: label beside its value, divided rows (locked card pick "Facts") */
GG.facts = function (rows, cls) {
  return '<div class="facts">' + rows.filter(Boolean).map(function (r) {
    return '<div class="fact' + (r[3] ? " " + r[3] : "") + '"><span class="k">' + r[0] + '</span><span class="v"><span>' + r[1] + "</span>" + (r[2] ? "<small>" + r[2] + "</small>" : "") + "</span></div>";
  }).join("") + "</div>";
};
GG.card = function (inner, cls) { return '<div class="card ' + (cls || "") + '">' + inner + "</div>"; };
/* Status ladder (client CommitmentStateLadder, extended with per-step source lines) */
GG.ladder = function (steps) {
  var mark = { done: "check", now: "clock", warn: "alert", fail: "xcirc", skip: "minus", todo: "dot" };
  return '<ol class="ladder" style="list-style:none;margin:0;padding:4px 0">' + steps.map(function (s) {
    return '<li class="lstep ' + s.s + '"><span class="lmark">' + ic(mark[s.s] || "dot", 16) + '</span><span class="ltxt"><b>' + s.t + "</b>" + (s.m ? "<span>" + s.m + "</span>" : "") + "</span></li>";
  }).join("") + "</ol>";
};
GG.sec = function (title, link) {
  return '<div class="sec"><h2>' + title + "</h2>" + (link || "") + "</div>";
};
/* Sheet (PwaSheet: one header, tiers compact/half/tall/full, pinned SheetActions) */
GG.sheet = function (o) {
  return '<div class="scrim"></div><section class="sheet ' + (o.tier || "tall") + '" role="dialog" aria-modal="true" aria-label="' + GG.esc(o.title.replace(/<[^>]+>/g, "")) + '">' +
    '<div class="grip" aria-hidden="true"></div><div class="shead"><div><h2 class="stitle">' + o.title + "</h2>" + (o.desc ? '<p class="sdesc">' + o.desc + "</p>" : "") + "</div>" +
    '<button type="button" class="close" aria-label="' + t("c.close") + '"' + GG.go(o.closeGo) + ">" + ic("close", 20) + "</button></div>" +
    (o.tabs || "") + '<div class="sbody">' + o.body + "</div>" + (o.acts ? '<div class="sacts">' + o.acts + "</div>" : "") + "</section>";
};
GG.stabs = function (tabs, on) {
  return '<div class="stabs" role="tablist">' + tabs.map(function (tb, i) {
    return '<span role="tab" aria-selected="' + (i === on) + '" class="' + (i === on ? "on" : "") + '"><span class="tl">' + tb[0] + "</span>" + (tb[1] ? '<span class="cnt">' + tb[1] + "</span>" : "") + "</span>";
  }).join("") + "</div>";
};
GG.fixedbar = function (btns) { return '<div class="fixedbar' + (btns.length === 2 ? " two" : "") + '">' + btns.join("") + "</div>"; };
GG.appbar = function (on) {
  var tabs = [["home", "c.tab.home"], ["plant", "c.tab.garden"], ["user", "c.tab.profile"]];
  return '<nav class="appbar" aria-label="App">' + tabs.map(function (x, i) {
    return '<span class="tabb' + (i === on ? " on" : "") + '"><span class="pillbg">' + ic(x[0], 22) + "</span>" + t(x[1]) + "</span>";
  }).join("") + "</nav>";
};
GG.homeHeader = function (o) {
  o = o || {};
  function launcher(icon, label, badge, go) {
    return '<button type="button" class="hit" aria-label="' + label + '"' + GG.go(go) + '><span class="ic">' + ic(icon, 18) + (badge ? '<span class="badge">' + badge + "</span>" : "") + "</span></button>";
  }
  return '<header class="hdr"><button type="button" class="gchip"><span class="av">' + (o.av || "RC") + '</span><span class="lbl">' + (o.garden || GG.D.home) + "</span>" + ic("chevd", 16) + "</button>" +
    '<div class="launchers">' + launcher("wallet", t("c.wallet"), o.wb, o.wgo) + launcher("promise", t("c.promises"), o.pb, o.pgo) + launcher("work", t("c.yourwork"), o.yb) + launcher("bell", t("c.notifications"), o.bb) + "</div></header>";
};
GG.topnav = function (title, backGo) {
  return '<header class="topnav"><button type="button" class="hit" aria-label="' + t("c.back") + '"' + GG.go(backGo) + '><span class="ic">' + ic("back", 18) + '</span></button><div class="mid">' + (title || "") + "</div></header>";
};
GG.stepper = function (labels, on) {
  return '<div class="stepper" aria-label="Steps">' + labels.map(function (l, i) {
    var cls = i === on ? "on" : i < on ? "done" : "";
    return '<div class="st ' + cls + '"' + (i === on ? ' aria-current="step"' : "") + '><span class="dot">' + (i < on ? ic("check", 14) : i + 1) + "</span>" + l + "</div>";
  }).join("") + "</div>";
};
GG.acct = function (o) {
  return '<div class="acct"><span class="av2' + (o.gno ? " gno" : "") + '">' + ic(o.icon || "user", 20) + '</span><div style="min-width:0"><span>' + o.role + "</span><b>" + o.who + "</b><code>" + o.addr + "</code>" + (o.note ? "<span>" + o.note + "</span>" : "") + "</div></div>";
};
GG.chk = function (on, text, go) {
  return '<button type="button" class="chk' + (on ? " on" : "") + '" role="checkbox" aria-checked="' + !!on + '"' + GG.go(go) + ' style="border:0;width:100%;text-align:left;cursor:pointer"><span class="box">' + (on ? ic("check", 14) : "") + "</span><span>" + text + "</span></button>";
};
GG.choice = function (o) {
  return '<div class="choice' + (o.on ? " on" : "") + (o.off ? " off" : "") + '" role="radio" aria-checked="' + !!o.on + '"' + (o.off ? ' aria-disabled="true"' : "") + GG.go(o.go) + '><span class="radio"></span><div class="ct"><b>' + o.title + "</b>" + (o.sub ? "<span>" + o.sub + "</span>" : "") + "</div>" + (o.chip ? '<span class="rolechip" style="margin-left:auto">' + o.chip + "</span>" : "") + "</div>";
};
GG.splitbar = function (a, b, total, la, lb) {
  var pa = Math.round((a / total) * 100), pb = 100 - pa;
  return '<div class="split"><div class="splitbar" role="img" aria-label="' + GG.esc(la + ": " + a + ". " + lb + ": " + b + ".") + '">' +
    (a ? '<span class="a" style="width:' + pa + '%">' + a + "</span>" : "") + (b ? '<span class="b" style="width:' + pb + '%">' + b + "</span>" : "") + "</div></div>";
};
GG.leg = function (title, pillHtml, sub) {
  return '<div class="leg"><b>' + title + "</b>" + pillHtml + (sub ? "<span>" + sub + "</span>" : "") + "</div>";
};
GG.rehearsal = function (text) { return '<div class="reh">' + ic("alert", 16) + "<span>" + text + "</span></div>"; };
GG.tech = function (lines) { return '<div class="tech">' + lines.join("") + "</div>"; };
GG.offline = function () { return '<div class="offl">' + ic("globe", 14) + t("c.offline") + "</div>"; };

/* ---------- Cockpit components ---------- */
GG.sb = function (kind, text) { return '<span class="sbadge ' + kind + '">' + text + "</span>"; };
GG.abtn = function (label, o) {
  o = o || {};
  return '<button type="button" class="abtn' + (o.fill ? " fill" : "") + (o.dang ? " dang" : "") + (o.lg ? " lg" : "") + '"' + GG.go(o.go) + (o.disabled ? " disabled" : "") + ">" + (o.icon ? ic(o.icon, 16) : "") + label + "</button>";
};
/* AdminCard with its subject as the title */
GG.acard = function (o) {
  return '<section class="acard"><div class="ah"><div><h2>' + o.title + "</h2>" + (o.sub ? "<p>" + o.sub + "</p>" : "") + "</div>" + (o.act || "") + "</div>" + (o.top ? '<div class="ab">' + o.top + "</div>" : "") + (o.rows || "") + (o.body ? '<div class="ab">' + o.body + "</div>" : "") + "</section>";
};
/* Record or decision row (interaction-patterns §5): chips on line one, meta on line two, acts end-aligned */
GG.arow = function (o) {
  return '<div class="arow' + (o.dir ? " dir-" + o.dir : "") + '"><div class="l1"><span class="nm">' + o.name + "</span>" + (o.chips || "") + '</div><div class="acts">' + (o.acts || "") + '</div><div class="l2">' + (o.meta || "") + "</div></div>";
};
GG.afacts = function (rows) {
  return '<div class="afacts">' + rows.filter(Boolean).map(function (r) {
    return '<div class="afact"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + (r[2] ? "<small>" + r[2] + "</small>" : "") + "</span></div>";
  }).join("") + "</div>";
};
GG.checkrow = function (kind, text, small) {
  var m = { ok: "check", no: "close", wait: "clock", pol: "alert" }[kind];
  return '<div class="checkrow ' + kind + '"><span class="cm">' + ic(m, 14) + "</span><span>" + text + (small ? "<small>" + small + "</small>" : "") + "</span></div>";
};
/* PoolTarget: "Writing to"; the protocol pool is set apart as a warning (DL-066) */
GG.target = function (text, protocol) { return '<div class="target' + (protocol ? " protocol" : "") + '">' + ic(protocol ? "alert" : "dot", 14) + "<span>" + text + "</span></div>"; };
/* FlowStatusRow: one height through ready, approving, sending, done, failed (DL-072) */
GG.flowrow = function (kind, icon, text) { return '<div class="flowrow ' + (kind || "") + '" role="status">' + (icon === "spin" ? '<span class="spin" aria-hidden="true"></span>' : ic(icon || "info", 16)) + "<span>" + text + "</span></div>"; };
GG.adlg = function (o) {
  return '<div class="dscrim"></div><section class="adlg' + (o.lg ? " lg" : "") + '" role="' + (o.alert ? "alertdialog" : "dialog") + '" aria-modal="true" aria-label="' + GG.esc(o.title) + '">' +
    '<div class="dh"><div><h2>' + o.title + "</h2>" + (o.sub ? "<p>" + o.sub + "</p>" : "") + '</div><button type="button" class="close" aria-label="' + t("c.close") + '" style="color:var(--strong)">' + ic("close", 20) + "</button></div>" +
    (o.split ? o.body : '<div class="db">' + o.body + "</div>") + '<div class="df">' + (o.note ? '<span class="note">' + o.note + "</span>" : "") + (o.foot || "") + "</div></section>";
};
GG.ckShell = function (o) {
  var ws = [["hub", "c.ws.hub"], ["plant", "c.ws.garden"], ["community", "c.ws.community"], ["actions", "c.ws.actions"]];
  var on = { hub: 0, garden: 1, community: 2, actions: 3 }[o.ws || "garden"];
  return '<div class="wash"></div><header class="c-app"><span class="gchip"><span class="av">' + (o.av || "GG") + '</span><span class="lbl">' + o.garden + "</span>" + ic("chevd", 16) + "</span>" +
    '<span class="c-icons"><span>' + ic("search", 20) + "</span><span>" + ic("bell", 20) + "</span><span>" + ic("gear", 20) + "</span></span></header>" +
    '<div class="c-route"><div class="c-head"><div><h1>' + o.title + "</h1>" + (o.sub ? "<p>" + o.sub + "</p>" : "") + "</div>" + (o.actions || "") + "</div>" +
    (o.tabs ? '<div class="c-tabs" role="tablist">' + o.tabs.map(function (x, i) { return '<span role="tab" class="' + (i === o.tab ? "on" : "") + '">' + x + "</span>"; }).join("") + "</div>" : "") +
    '<div class="c-grid"><div class="c-col">' + (o.main || "") + '</div><div class="c-col">' + (o.rail || "") + "</div></div></div>" +
    '<nav class="dock" aria-label="Workspaces">' + ws.map(function (x, i) { return '<span class="ni' + (i === on ? " on" : "") + '"><span class="ic">' + ic(x[0], 20) + "</span>" + t(x[1]) + "</span>"; }).join("") + "</nav>" +
    (o.dialog || "");
};
