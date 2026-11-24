/* Inline SVG diagrams drawn from data, so they render the same in the repository file and the
   published artifact. Color always repeats a text label (status tags, line styles in the legend). */
GG.svg = {};
GG.svg.esc = GG.esc;
GG.svg.text = function (x, y, s, o) {
  o = o || {};
  return '<text x="' + x + '" y="' + y + '" font-size="' + (o.size || 12) + '" font-weight="' + (o.weight || 400) + '"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") + (o.fill ? ' style="fill:' + o.fill + '"' : "") + ">" + GG.esc(s) + "</text>";
};
GG.svg.wrap = function (s, max) {
  var words = String(s).split(" "), lines = [], cur = "";
  words.forEach(function (w) { if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
  if (cur) lines.push(cur);
  return lines;
};

/* Architecture: three chains, each with its responsibility and its contracts by status. */
GG.svg.architecture = function () {
  var ST = { UPG: ["Upgraded", "var(--dg-upg)"], NEW: ["New", "var(--dg-new)"], REUSE: ["Reused", "var(--dg-reuse)"], CLC: ["Reused CLC", "var(--dg-ext)"] };
  var cols = [
    { x: 16, title: "Arbitrum", sub: "Promises, parties, consent and authorization", c: "var(--dg-arb)", boxes: [
      ["CommitmentPooling", "UPG", "Opted-in service offers; voucher acceptance guard"],
      ["SettlementModule", "UPG", "Personal G$ funding; exclusive payout or refund"],
      ["VoucherEntitlementModule", "NEW", "Voucher terms, consent, setup and entitlements"],
      ["VoucherRedemptionModule", "NEW", "Escrow evidence, activation, final split"],
      ["CommitmentRegistry · Hats", "REUSE", "Promise identity, roles and authority"],
      ["CCIP router", "REUSE", "Authenticated messages, no token transfer"]] },
    { x: 392, title: "Celo", sub: "G$ custody and transfers", c: "var(--dg-celo)", boxes: [
      ["CeloSettlementExecutor", "REUSE", "Runs authenticated payout and refund commands"],
      ["Registered garden Safes", "REUSE", "Buyer garden's Safe holds the member's G$"],
      ["Canonical G$", "REUSE", "Never bridged; token fee read at send"]] },
    { x: 768, title: "Gnosis", sub: "Vouchers, pool swaps and voucher escrow", c: "var(--dg-gno)", boxes: [
      ["GnosisVoucherAdapter", "NEW", "Authenticated reward delivery from the issuer reserve"],
      ["GnosisVoucherEscrow", "NEW", "One escrow per promise; one immutable final split"],
      ["Issuer Safe and reserve", "REUSE", "Approves setups; receives released vouchers"],
      ["CLC GiftableToken", "CLC", "Each issuer's voucher"],
      ["CLC SwapPool and pool policy", "CLC", "Quoter, limiter, registry; bounded direct swaps"]] }
  ];
  var W = 1120, H = 600, s = "";
  s += '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="arch-t"><title id="arch-t">Contract architecture by chain: Arbitrum owns promises and authorization, Celo owns G$ custody, Gnosis owns vouchers and escrow. Messages cross chains; G$ is not bridged.</title>';
  s += '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" style="fill:var(--lab-muted)"/></marker></defs>';
  cols.forEach(function (col) {
    var y0 = 16, w = 336;
    s += '<rect x="' + col.x + '" y="' + y0 + '" width="' + w + '" height="' + (H - 120) + '" rx="16" style="fill:var(--lab-panel);stroke:' + col.c + ';stroke-width:2"/>';
    s += GG.svg.text(col.x + 16, y0 + 28, col.title, { size: 16, weight: 700, fill: col.c });
    s += GG.svg.text(col.x + 16, y0 + 46, col.sub, { size: 12, fill: "var(--lab-muted)" });
    col.boxes.forEach(function (b, i) {
      var by = y0 + 62 + i * 70, st = ST[b[1]];
      s += '<rect x="' + (col.x + 12) + '" y="' + by + '" width="' + (w - 24) + '" height="60" rx="10" style="fill:var(--lab-bg);stroke:' + st[1] + ';stroke-width:2' + (b[1] === "CLC" ? ";stroke-dasharray:5 4" : "") + '"/>';
      s += GG.svg.text(col.x + 24, by + 22, b[0], { size: 13, weight: 700 });
      s += GG.svg.text(col.x + w - 24, by + 22, st[0], { size: 11, weight: 700, anchor: "end", fill: st[1] });
      s += GG.svg.text(col.x + 24, by + 42, b[2], { size: 11.5, fill: "var(--lab-muted)" });
    });
  });
  var yA = H - 88;
  s += GG.svg.text(180, yA + 8, "Arbitrum ⇄ Celo: payout and refund commands; execution acknowledgments", { size: 12, anchor: "start" });
  s += GG.svg.text(180, yA + 28, "Arbitrum ⇄ Gnosis: setup, activation, final split and legs; escrow evidence and acknowledgments", { size: 12, anchor: "start" });
  s += GG.svg.text(180, yA + 48, "Messages carry authorization and results. No G$ or voucher crosses a chain.", { size: 12, weight: 700, anchor: "start" });
  s += '<line x1="140" y1="' + (yA + 4) + '" x2="170" y2="' + (yA + 4) + '" style="stroke:var(--lab-muted);stroke-width:1.6;stroke-dasharray:6 4"/>';
  s += "</svg>";
  return s;
};

/* Sequence: participants as columns; messages numbered. kind: tx (signed transaction, solid),
   msg (cross-chain message, dashed), read (evidence read, dotted), ext (outside Green Goods). */
GG.svg.sequence = function (def) {
  var P = def.parts, n = P.length, colW = def.colW || 150, left = 20, top = 16;
  var W = left * 2 + colW * n, rowH = 40, rows = 0;
  def.steps.forEach(function (st) { rows += st.kind === "group" ? 0.9 : st.kind === "note" ? 1.1 : 1; });
  var H = top + 70 + rows * rowH + 24;
  var x = function (id) { var i = P.findIndex(function (p) { return p.id === id; }); return left + colW * i + colW / 2; };
  var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="' + def.id + '-t"><title id="' + def.id + '-t">' + GG.esc(def.title) + "</title>";
  s += '<defs><marker id="' + def.id + '-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" style="fill:var(--lab-fg)"/></marker></defs>';
  P.forEach(function (p, i) {
    var cx = left + colW * i + colW / 2;
    s += '<rect x="' + (cx - colW / 2 + 6) + '" y="' + top + '" width="' + (colW - 12) + '" height="48" rx="10" style="fill:var(--lab-panel);stroke:' + (p.c || "var(--lab-line)") + ';stroke-width:2"/>';
    s += GG.svg.text(cx, top + 20, p.label, { size: 12, weight: 700, anchor: "middle" });
    s += GG.svg.text(cx, top + 37, p.sub || "", { size: 10.5, anchor: "middle", fill: "var(--lab-muted)" });
    s += '<line x1="' + cx + '" y1="' + (top + 48) + '" x2="' + cx + '" y2="' + (H - 12) + '" style="stroke:var(--lab-line);stroke-width:1.5"/>';
  });
  var y = top + 76, num = 0;
  def.steps.forEach(function (st) {
    if (st.kind === "group") {
      s += '<rect x="' + (left + 2) + '" y="' + (y - 14) + '" width="' + (W - left * 2 - 4) + '" height="22" rx="6" style="fill:var(--lab-soft)"/>' + GG.svg.text(left + 12, y + 1, st.label, { size: 11.5, weight: 700, fill: "var(--lab-accent)" });
      y += rowH * 0.9; return;
    }
    if (st.kind === "note") {
      var x1 = x(st.from), x2 = x(st.to || st.from), lo = Math.min(x1, x2) - colW / 2 + 10, hi = Math.max(x1, x2) + colW / 2 - 10;
      s += '<rect x="' + lo + '" y="' + (y - 16) + '" width="' + (hi - lo) + '" height="30" rx="6" style="fill:var(--lab-open-bg);stroke:var(--lab-open);stroke-width:1"/>' + GG.svg.text((lo + hi) / 2, y + 3, st.label, { size: 11.5, anchor: "middle" });
      y += rowH * 1.1; return;
    }
    num++;
    var a = x(st.from), b = x(st.to), dash = st.kind === "msg" ? ";stroke-dasharray:7 5" : st.kind === "read" ? ";stroke-dasharray:2 4" : st.kind === "ext" ? ";stroke-dasharray:10 3 2 3" : "";
    if (a === b) {
      s += '<path d="M' + a + " " + (y - 6) + " h28 v14 h-26" + '" style="fill:none;stroke:var(--lab-fg);stroke-width:1.5' + dash + '" marker-end="url(#' + def.id + '-a)"/>';
      s += GG.svg.text(a + 34, y + 4, num + ". " + st.label, { size: 11.5 });
    } else {
      s += '<line x1="' + a + '" y1="' + y + '" x2="' + (b + (b > a ? -3 : 3)) + '" y2="' + y + '" style="stroke:var(--lab-fg);stroke-width:1.5' + dash + '" marker-end="url(#' + def.id + '-a)"/>';
      s += GG.svg.text((a + b) / 2, y - 6, num + ". " + st.label, { size: 11.5, anchor: "middle" });
    }
    y += rowH;
  });
  return s + "</svg>";
};

GG.SEQ_GD = {
  id: "seq-gd", title: "Cross-garden personal G$ purchase: sequence", colW: 158,
  parts: [
    { id: "buyer", label: "Buyer", sub: "Green Goods account", c: "var(--dg-arb)" },
    { id: "safe", label: "Buyer garden Safe", sub: "Celo", c: "var(--dg-celo)" },
    { id: "bst", label: "Buyer-garden steward", sub: "wallet, Arbitrum", c: "var(--dg-arb)" },
    { id: "arb", label: "Pooling + Settlement", sub: "Arbitrum (upgraded)", c: "var(--dg-upg)" },
    { id: "prov", label: "Provider steward", sub: "wallet, Arbitrum", c: "var(--dg-arb)" },
    { id: "exec", label: "Celo executor", sub: "Celo (reused)", c: "var(--dg-celo)" },
    { id: "ext", label: "Access system", sub: "outside Green Goods", c: "var(--dg-ext)" }
  ],
  steps: [
    { kind: "tx", from: "buyer", to: "arb", label: "Agree to exact terms; pledge" },
    { kind: "tx", from: "buyer", to: "safe", label: "Send G$ (gross, fee, net)" },
    { kind: "read", from: "bst", to: "safe", label: "Read the transfer" },
    { kind: "tx", from: "bst", to: "arb", label: "Record deposit (attestation)" },
    { kind: "tx", from: "prov", to: "arb", label: "Guarded acceptance" },
    { kind: "tx", from: "bst", to: "arb", label: "Apply deposit" },
    { kind: "ext", from: "prov", to: "ext", label: "Set up access; report status" },
    { kind: "tx", from: "buyer", to: "arb", label: "Confirm kept" },
    { kind: "group", label: "Outcome A: payout under the existing plan" },
    { kind: "tx", from: "bst", to: "arb", label: "Finalize payout plan; dispatch" },
    { kind: "msg", from: "arb", to: "exec", label: "Payout command" },
    { kind: "tx", from: "exec", to: "safe", label: "Safe pays contributors by recognition" },
    { kind: "msg", from: "exec", to: "arb", label: "Acknowledgment; funding closed" },
    { kind: "group", label: "Outcome B (exclusive): decline, withdrawal, cancellation or expiry" },
    { kind: "tx", from: "bst", to: "arb", label: "Queue refund of the full recorded amount" },
    { kind: "msg", from: "arb", to: "exec", label: "Refund command" },
    { kind: "tx", from: "exec", to: "buyer", label: "Safe refunds the immutable refund account" },
    { kind: "note", from: "safe", to: "exec", label: "G$ never leaves Celo. Verification is a steward's attestation." }
  ]
};
GG.SEQ_VS = {
  id: "seq-vs", title: "Voucher service: setup, guarded acceptance and final settlement", colW: 152,
  parts: [
    { id: "gg", label: "Holder", sub: "Green Goods account", c: "var(--dg-arb)" },
    { id: "gw", label: "Holder", sub: "Gnosis wallet", c: "var(--dg-gno)" },
    { id: "arb", label: "Pooling + voucher modules", sub: "Arbitrum", c: "var(--dg-upg)" },
    { id: "prov", label: "Provider steward", sub: "wallet, Arbitrum", c: "var(--dg-arb)" },
    { id: "iss", label: "Issuer Safe", sub: "Gnosis", c: "var(--dg-gno)" },
    { id: "esc", label: "Voucher escrow", sub: "Gnosis (new)", c: "var(--dg-new)" },
    { id: "res", label: "Issuer reserve", sub: "Gnosis", c: "var(--dg-gno)" }
  ],
  steps: [
    { kind: "tx", from: "gg", to: "arb", label: "Exact consent; setup prepared" },
    { kind: "msg", from: "arb", to: "esc", label: "Setup command" },
    { kind: "tx", from: "iss", to: "esc", label: "Issuer approves the setup" },
    { kind: "tx", from: "gw", to: "esc", label: "Allowance and deposit (exact amount)" },
    { kind: "msg", from: "esc", to: "arb", label: "Authenticated escrow evidence" },
    { kind: "group", label: "Before acceptance: cancel → authenticated abort → setup refund. One outcome only." },
    { kind: "tx", from: "prov", to: "arb", label: "Guarded acceptance (consent, evidence, window)" },
    { kind: "msg", from: "arb", to: "esc", label: "Activate; acknowledgment back" },
    { kind: "tx", from: "prov", to: "arb", label: "Delivery evidence; proposed split" },
    { kind: "tx", from: "iss", to: "esc", label: "Authorize the return" },
    { kind: "tx", from: "gg", to: "arb", label: "Approve delivered units; freeze split" },
    { kind: "msg", from: "arb", to: "esc", label: "Frozen allocation: 40 release, 60 refund" },
    { kind: "tx", from: "esc", to: "res", label: "Release leg: 40 (reuse within budget)" },
    { kind: "tx", from: "esc", to: "gw", label: "Refund leg: 60" },
    { kind: "msg", from: "esc", to: "arb", label: "Per-leg results; closed when both settle" },
    { kind: "note", from: "arb", to: "res", label: "Closure doesn't mark the promise kept or turn on an outside service." }
  ]
};

/* State strips: facts that stay separate, left to right, with exits beneath. */
GG.svg.strip = function (def) {
  var w = def.w || 132, gap = 18, W = 20 + def.main.length * (w + gap), H = def.exits ? 196 : 110;
  var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="' + def.id + '-t"><title id="' + def.id + '-t">' + GG.esc(def.title) + "</title>";
  s += '<defs><marker id="' + def.id + '-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" style="fill:var(--lab-muted)"/></marker></defs>';
  def.main.forEach(function (m, i) {
    var x = 10 + i * (w + gap), y = 20;
    s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="56" rx="10" style="fill:var(--lab-panel);stroke:' + (m[2] || "var(--lab-line)") + ';stroke-width:2"/>';
    GG.svg.wrap(m[0], 17).forEach(function (ln, j) { s += GG.svg.text(x + w / 2, y + 22 + j * 15, ln, { size: 12, weight: 700, anchor: "middle" }); });
    if (m[1]) s += GG.svg.text(x + w / 2, y + 72, m[1], { size: 10.5, anchor: "middle", fill: "var(--lab-muted)" });
    if (i < def.main.length - 1) s += '<line x1="' + (x + w + 2) + '" y1="' + (y + 28) + '" x2="' + (x + w + gap - 2) + '" y2="' + (y + 28) + '" style="stroke:var(--lab-muted);stroke-width:1.6" marker-end="url(#' + def.id + '-a)"/>';
  });
  (def.exits || []).forEach(function (e) {
    var fx = 10 + e.from * (w + gap) + w / 2, tx = 10 + e.at * (w + gap), y = 140;
    s += '<path d="M' + fx + " 98 V " + (y - 2) + '" style="fill:none;stroke:var(--lab-open);stroke-width:1.6;stroke-dasharray:6 4" marker-end="url(#' + def.id + '-a)"/>';
    s += '<rect x="' + tx + '" y="' + y + '" width="' + (e.w || w * 1.6) + '" height="44" rx="10" style="fill:var(--lab-open-bg);stroke:var(--lab-open);stroke-width:1.5"/>';
    s += GG.svg.text(tx + 10, y + 18, e.label, { size: 12, weight: 700 });
    s += GG.svg.text(tx + 10, y + 34, e.sub || "", { size: 10.5, fill: "var(--lab-muted)" });
  });
  return s + "</svg>";
};
GG.STRIP_GD = { id: "st-gd", title: "Separate facts in a personal G$ purchase", w: 128, main: [
  ["Request and pledge", "consent", "var(--dg-arb)"], ["Payment sent", "Celo transfer", "var(--dg-celo)"], ["Deposit recorded", "steward attestation", "var(--dg-arb)"],
  ["Provider accepted", "guarded", "var(--dg-arb)"], ["Deposit applied", "funding consumed", "var(--dg-upg)"], ["Access active", "external report", "var(--dg-ext)"],
  ["Confirmed kept", "buyer", "var(--dg-arb)"], ["Paid out", "plan, acknowledged", "var(--dg-celo)"]],
  exits: [{ from: 2, at: 2, label: "Refund of the full recorded amount", sub: "after decline, withdrawal, cancel or expiry; never after kept", w: 330 }, { from: 0, at: 0, label: "Withdrawn", sub: "before any deposit", w: 150 }] };
GG.STRIP_VS = { id: "st-vs", title: "Voucher escrow lifecycle", w: 116, main: [
  ["Consent", "exact revision", "var(--dg-arb)"], ["Setup approved", "issuer", "var(--dg-gno)"], ["Deposited", "holder wallet", "var(--dg-gno)"], ["Evidence received", "authenticated", "var(--dg-new)"],
  ["Accepted", "guarded", "var(--dg-arb)"], ["Active", "on Gnosis", "var(--dg-new)"], ["Delivered units approved", "holder", "var(--dg-arb)"], ["Split frozen", "immutable", "var(--dg-new)"], ["Both legs settled", "closure", "var(--dg-gno)"]],
  exits: [{ from: 3, at: 1, label: "Setup abort → setup refund (before acceptance only)", sub: "cancel or expiry needs an authenticated abort; acceptance and abort resolve to one outcome", w: 470 }, { from: 7, at: 6, label: "Remedy in the split", sub: "after acceptance; no setup cancel", w: 230 }] };
