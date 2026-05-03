/* global React */
const { useState } = React;

// ─── Tiny icon set (subset; matches existing icon style) ──────────────────────
const RVI = {
  bell:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  cog:     () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .67.39 1.27 1 1.51H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  user:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  search:  () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  plus:    () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  vote:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12 9 6l4 4 8-8"/><path d="M21 8V2h-6"/><rect x="3" y="14" width="18" height="7" rx="2"/></svg>,
  edit:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>,
  invite:  () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>,
  send:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>,
  message: () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  leaf:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/></svg>,
  layer:   () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>,
};

// ─── PageHeader (NEUTRAL — same anatomy across views) ─────────────────────────
function PageHeader({ eyebrow, title, sub, stats, actions }) {
  return (
    <header className="rv-header">
      <div className="rv-header-left">
        {eyebrow && <span className="rv-eyebrow">{eyebrow}</span>}
        <h1 className="rv-title">{title}</h1>
        {sub && <span className="rv-sub">{sub}</span>}
        {stats && stats.length > 0 && (
          <div className="rv-stats" style={{ marginTop: 4 }}>
            {stats.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="rv-stats-sep">·</span>}
                <span><strong>{s.value}</strong> {s.label}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="rv-header-actions">{actions}</div>}
    </header>
  );
}

// ─── MockScreen ───────────────────────────────────────────────────────────────
const VIEW_CONFIG = {
  hub: {
    eyebrow: "Workbench",
    title: "Hub",
    sub: "Milpa Alta · impact pipeline",
    stats: [{ value: "12", label: "Review" }, { value: "5", label: "Assess" }, { value: "3", label: "Certify" }],
    tabs: [{ id: "review", label: "Review", count: 12 }, { id: "assess", label: "Assess", count: 5 }, { id: "certify", label: "Certify", count: 3 }, { id: "history", label: "History" }],
    chips: ["All", "Agro", "Waste", "Solar", "Water"],
    fabActions: [
      { icon: "edit",   label: "Submit work",   primary: true },
      { icon: "vote",   label: "Review next" },
      { icon: "leaf",   label: "Quick log" },
    ],
    layout: "grid",
  },
  garden: {
    eyebrow: "Garden",
    title: "Milpa Alta",
    sub: "milpa.alta.eth · 23 gardeners · public",
    stats: [{ value: "Spring 2026", label: "season" }, { value: "8", label: "open work" }, { value: "$43,440", label: "pool" }],
    tabs: [{ id: "overview", label: "Overview" }, { id: "members", label: "Members", count: 23 }, { id: "settings", label: "Settings" }, { id: "treasury", label: "Treasury", count: 3 }],
    chips: ["All", "Operators", "Reviewers", "Gardeners", "Pending"],
    fabActions: [
      { icon: "invite", label: "Invite member", primary: true },
      { icon: "vote",   label: "Draft proposal" },
      { icon: "send",   label: "Send distribution" },
    ],
    layout: "grid",
  },
  community: {
    eyebrow: "Engagement",
    title: "Community",
    sub: "Milpa Alta · 23 gardeners · 1,243 supporters",
    stats: [{ value: "4", label: "open proposals" }, { value: "8", label: "milestones · month" }, { value: "23", label: "discussions" }],
    tabs: [{ id: "activity", label: "Activity" }, { id: "proposals", label: "Proposals", count: 4 }, { id: "people", label: "People", count: 1268 }],
    chips: ["All", "Work", "Proposals", "Milestones", "Discussions"],
    fabActions: [
      { icon: "vote",    label: "New proposal", primary: true },
      { icon: "message", label: "Start discussion" },
    ],
    layout: "list",
  },
  actions: {
    eyebrow: "Catalog",
    title: "Action templates",
    sub: "Work-types operators enable per garden",
    stats: [{ value: "24", label: "templates" }, { value: "18", label: "active" }, { value: "6", label: "drafts" }],
    tabs: null, // Actions has no tabs in current implementation
    chips: ["All", "Active", "Draft", "Deprecated"],
    fabActions: [
      { icon: "layer", label: "Create template", primary: true },
    ],
    layout: "grid",
  },
};

function MockScreen({
  view,
  toneStrength = "default",
  bp = "desktop",
  showFabDial = false,
  onToggleDial = () => {},
}) {
  const cfg = VIEW_CONFIG[view];
  const isSpeedDial = cfg.fabActions.length > 1;
  const showFabUi = bp !== "desktop";

  return (
    <div className="rv-screen" data-tone={view} data-tone-strength={toneStrength} data-bp={bp}>
      {/* AppBar */}
      <div className="rv-appbar">
        <span className="rv-pill">
          <span className="rv-pill-leaf"><RVI.leaf /></span>
          <span>Milpa Alta</span>
        </span>
        <div className="rv-appbar-icons">
          <button className="rv-iconbtn"><RVI.bell /></button>
          <button className="rv-iconbtn"><RVI.cog /></button>
          <button className="rv-iconbtn"><RVI.user /></button>
        </div>
      </div>

      {/* Main */}
      <div className="rv-main">
        <PageHeader
          eyebrow={cfg.eyebrow}
          title={cfg.title}
          sub={cfg.sub}
          stats={cfg.stats}
          actions={(() => {
            // Primary on the FAR RIGHT — sort secondaries first, primary last.
            const ordered = [...cfg.fabActions].sort((a, b) => (a.primary ? 1 : 0) - (b.primary ? 1 : 0));
            return ordered.map((a, i) => {
              const Icon = RVI[a.icon];
              return a.primary ? (
                <button key={i} className="rv-btn-primary"><Icon /> <span>{a.label}</span></button>
              ) : (
                <button key={i} className="rv-btn-ghost"><Icon /> <span>{a.label}</span></button>
              );
            });
          })()}
        />

        {cfg.tabs && (
          <div className="rv-tabs" style={{ "--rv-tab-count": cfg.tabs.length }}>
            {cfg.tabs.map((t, i) => {
              const isActive = i === 0;
              return (
                <button key={t.id} className={`rv-tab ${isActive ? "is-active" : ""}`}>
                  <span>{t.label}</span>
                  {t.count !== undefined && (
                    <span className={`rv-tab-count ${isActive ? "is-active" : ""}`}>{t.count.toLocaleString()}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="rv-filter-row">
          <div className="rv-chip-row">
            {cfg.chips.map((c, i) => (
              <button key={c} className={`rv-chip ${i === 0 ? "is-active" : ""}`}>{c}</button>
            ))}
          </div>
          <label className="rv-search">
            <RVI.search />
            <input placeholder="Search" readOnly />
          </label>
        </div>

        {cfg.layout === "grid" ? <GridContent /> : <ListContent />}
      </div>

      {/* NavBar — floating bottom pill (matches hub.css .navbar-wrap / .navbar) */}
      <div className="rv-navbar-wrap">
        <div className="rv-navbar">
          {["Hub", "Garden", "Community", "Actions"].map((n) => {
            const isActive = (view === "hub" && n === "Hub")
              || (view === "garden" && n === "Garden")
              || (view === "community" && n === "Community")
              || (view === "actions" && n === "Actions");
            return (
              <button key={n} className={`rv-navbtn ${isActive ? "is-active" : ""}`}>
                <span className="rv-navicon"><RVI.leaf /></span>
                <span>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FAB — only on tablet/mobile */}
      {showFabUi && (
        <React.Fragment>
          {showFabDial && isSpeedDial && (
            <React.Fragment>
              <div className="rv-fab-scrim" onClick={onToggleDial} />
              <div className="rv-fab-dial">
                {cfg.fabActions.map((a, i) => {
                  const Icon = RVI[a.icon];
                  return (
                    <div key={i} className="rv-fab-action">
                      <span className="rv-fab-action-label">{a.label}</span>
                      <button className="rv-fab-mini" style={a.primary ? {
                        background: "var(--g-action)", color: "var(--g-on-action)", borderColor: "transparent",
                      } : {}}>
                        <Icon />
                      </button>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          )}
          <button
            className={`rv-fab ${showFabDial ? "is-open" : ""}`}
            onClick={() => isSpeedDial ? onToggleDial() : null}
          >
            <RVI.plus />
          </button>
        </React.Fragment>
      )}
    </div>
  );
}

function GridContent() {
  return (
    <div className="rv-content">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <article key={i} className="rv-content-card">
          <div className="rv-content-thumb" />
          <div className="rv-content-line" />
          <div className="rv-content-line short" />
          <span className="rv-content-tag">Status</span>
        </article>
      ))}
    </div>
  );
}

function ListContent() {
  return (
    <div className="rv-content-list">
      {[0, 1, 2, 3].map((i) => (
        <article key={i} className="rv-content-list-item">
          <div className="rv-content-line" />
          <div className="rv-content-line short" />
        </article>
      ))}
    </div>
  );
}

// ─── HeaderDiagnosis card (current state per view) ────────────────────────────
function HeaderDiagnosis({ view, currentLabel, issues = [] }) {
  const cfg = VIEW_CONFIG[view];
  return (
    <div className="rv-diag" data-tone={view}>
      <span className="rv-diag-tone">{cfg.title}</span>
      <h3 className="rv-diag-title">Current header</h3>
      <p className="rv-diag-current">{currentLabel}</p>
      <ul className="rv-diag-issues">
        {issues.map((iss, i) => (
          <li key={i} className={`rv-diag-issue is-${iss.kind}`}>
            <span className="rv-diag-mark">
              {iss.kind === "good" ? "✓" : iss.kind === "warn" ? "!" : "×"}
            </span>
            <span>{iss.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Tone palette card ────────────────────────────────────────────────────────
function TonePaletteCard({ view }) {
  const names = { hub: "Hub", garden: "Garden", community: "Community", actions: "Actions" };
  const roles = {
    hub:       "Workbench · operator pipeline",
    garden:    "Identity · treasury",
    community: "Engagement · proposals",
    actions:   "Catalog · templates",
  };
  return (
    <div className="rv-tone-card" data-tone={view}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="rv-tone-name">{names[view]}</span>
        <span className="rv-pill-leaf"><RVI.leaf /></span>
      </div>
      <span className="rv-tone-role">{roles[view]}</span>

      <div className="rv-tone-mock">
        <span className="rv-tone-mock-eyebrow">Section</span>
        <span className="rv-tone-mock-title">{names[view]}</span>
        <span className="rv-tone-mock-rule" />
        <span className="rv-tone-mock-tab" />
      </div>

      <div className="rv-tone-swatches">
        <span className="rv-tone-sw" style={{ background: "var(--tone-canvas)" }} />
        <span className="rv-tone-sw" style={{ background: "var(--tone-pill-bg)" }} />
        <span className="rv-tone-sw" style={{ background: "var(--tone-edge)" }} />
        <span className="rv-tone-sw" style={{ background: "var(--tone-active)" }} />
      </div>
    </div>
  );
}

// ─── Conviction voting visualisations ─────────────────────────────────────────
// Conviction voting in Green Goods = members SPLIT THEIR WEIGHT across active
// proposals. Each member has 100% to allocate. As weight stays on a proposal,
// conviction accrues over time. The proposal passes when conviction ≥ threshold.

function ConvictionMeter({ conviction, threshold, accrual, state }) {
  const fillPct = Math.min(conviction, 100);
  const stateLabel = state === "passing" ? "Passing" : "Accruing";
  return (
    <div className="rv-conviction">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className={`rv-conv-state is-${state}`}>
          <span className="rv-conv-state-dot" /> {stateLabel}
        </span>
        <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--on-surface-muted)" }}>
          +{accrual.toFixed(1)}% / day
        </span>
      </div>
      <div className="rv-conv-track">
        <span className="rv-conv-fill" style={{ width: `${fillPct}%` }} />
        <span className="rv-conv-threshold" style={{ left: `${threshold}%` }}>
          <span className="rv-conv-threshold-label">threshold {threshold}%</span>
        </span>
      </div>
      <div className="rv-conv-meta">
        <span><strong>{conviction}%</strong> conviction</span>
        <span>{state === "passing"
          ? `funding triggered`
          : `${Math.max(0, Math.ceil((threshold - conviction) / accrual))} days to threshold at current rate`}</span>
      </div>
    </div>
  );
}

function ProposalCardConviction({ p }) {
  const state = p.conviction >= p.threshold ? "passing" : "accruing";
  return (
    <article className="rv-content-list-item" style={{ gap: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--on-surface-soft)" }}>{p.id}</span>
          <span style={{ font: "700 14px/1.2 var(--font-sans)", color: "var(--ink)" }}>{p.title}</span>
        </div>
        <span style={{ font: "500 11px/1 var(--font-sans)", color: "var(--on-surface-soft)" }}>
          {p.supporters} supporters
        </span>
      </div>
      <p style={{ margin: 0, font: "500 12px/1.5 var(--font-sans)", color: "var(--on-surface-muted)" }}>
        {p.summary}
      </p>
      <ConvictionMeter
        conviction={p.conviction}
        threshold={p.threshold}
        accrual={p.dailyAccrual}
        state={state}
      />
    </article>
  );
}

// Old card — for the side-by-side
function OldTallyCard({ p }) {
  const total = p.forV + p.againstV + p.abstainV;
  const fp = (p.forV / total) * 100;
  const ap = (p.againstV / total) * 100;
  return (
    <article className="rv-content-list-item" style={{ gap: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--on-surface-soft)" }}>{p.id}</span>
          <span style={{ font: "700 14px/1.2 var(--font-sans)", color: "var(--ink)" }}>{p.title}</span>
        </div>
        <span style={{ font: "500 11px/1 var(--font-sans)", color: "var(--on-surface-soft)" }}>2d 14h left</span>
      </div>
      <p style={{ margin: 0, font: "500 12px/1.5 var(--font-sans)", color: "var(--on-surface-muted)" }}>
        {p.summary}
      </p>
      {/* The current TallyBar style — split into For / Against / Abstain */}
      <div style={{ display: "flex", height: 8, borderRadius: 9999, overflow: "hidden", background: "var(--surface-quiet)" }}>
        <span style={{ width: `${fp}%`, background: "var(--g-action)" }} />
        <span style={{ width: `${ap}%`, background: "#B45309" }} />
      </div>
      <div style={{ display: "flex", gap: 14, font: "500 11px/1 var(--font-sans)", color: "var(--on-surface-muted)" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: "var(--g-action)", marginRight: 5 }} /> For <strong style={{ color: "var(--ink)" }}>{p.forV}</strong></span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: "#B45309", marginRight: 5 }} /> Against <strong style={{ color: "var(--ink)" }}>{p.againstV}</strong></span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: "var(--on-surface-soft)", marginRight: 5 }} /> Abstain <strong style={{ color: "var(--ink)" }}>{p.abstainV}</strong></span>
        <span style={{ marginLeft: "auto", font: "500 11px/1 var(--font-mono)", color: "var(--on-surface-soft)" }}>{total} of 248</span>
      </div>
    </article>
  );
}

// Weight allocator — the affordance for splitting your 100% across proposals
function WeightAllocator({ proposals, allocations }) {
  const total = allocations.reduce((s, n) => s + n, 0);
  const isOver = total > 100;
  return (
    <div className="rv-allocator">
      <div className="rv-allocator-head">
        <span className="rv-allocator-title">Your conviction weight</span>
        <span className={`rv-allocator-total ${isOver ? "is-over" : ""}`}>{total}% / 100%</span>
      </div>
      {proposals.map((p, i) => (
        <div key={p.id} className="rv-allocator-row">
          <div className="rv-allocator-prop">
            <span className="rv-allocator-prop-id">{p.id}</span>
            <span className="rv-allocator-prop-title">{p.title}</span>
          </div>
          <div className="rv-allocator-bar">
            <span className="rv-allocator-bar-fill" style={{ width: `${allocations[i]}%` }} />
          </div>
          <span className="rv-allocator-pct">{allocations[i]}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── FAB audit table ──────────────────────────────────────────────────────────
function FabAuditTable() {
  const rows = [
    {
      view: "Hub",
      flows: [
        <code>Submit work</code>,
        <code>Review next</code>,
        <code>Quick log</code>,
      ],
      rec: { type: "dial", label: "Speed dial · 3" },
    },
    {
      view: "Garden",
      flows: [
        <code>Invite member</code>,
        <code>Draft proposal</code>,
        <code>Send distribution</code>,
      ],
      rec: { type: "dial", label: "Speed dial · 3" },
    },
    {
      view: "Community",
      flows: [
        <code>New proposal</code>,
        <code>Start discussion</code>,
      ],
      rec: { type: "dial", label: "Speed dial · 2" },
    },
    {
      view: "Actions",
      flows: [
        <code>Create template</code>,
      ],
      rec: { type: "single", label: "Single FAB" },
    },
  ];
  return (
    <table className="rv-fab-audit">
      <thead>
        <tr>
          <th>View</th>
          <th>Creation flows</th>
          <th>Mobile / tablet FAB</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.view}>
            <td>{r.view}</td>
            <td>
              <ul>
                {r.flows.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </td>
            <td>
              <span className={`rv-fab-rec is-${r.rec.type}`}>{r.rec.label}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
Object.assign(window, {
  MockScreen,
  HeaderDiagnosis,
  TonePaletteCard,
  ConvictionMeter,
  ProposalCardConviction,
  OldTallyCard,
  WeightAllocator,
  FabAuditTable,
  VIEW_CONFIG,
  RVI,
});
