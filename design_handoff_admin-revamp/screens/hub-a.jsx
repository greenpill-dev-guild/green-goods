/* global React, HubAtoms */
const { AppBar, NavBar, PipelineDots, CategoryBadge, PhotoCollage, I, WORK } = HubAtoms;

// ─────────────────────────────────────────────────────────────────────────────
// VARIATION A — "Reference grammar, refined"
// Photo-collage cards · 3-col comfortable · pill chip group filters
// Header: title + numeric context strip (no KPI tiles)
// ─────────────────────────────────────────────────────────────────────────────

function HubA({ theme = "light" }) {
  const tabs = [
    { id: "review",  label: "Review",  count: 12, active: true },
    { id: "assess",  label: "Assess",  count: 5  },
    { id: "certify", label: "Certify", count: 3  },
    { id: "history", label: "History" },
  ];
  const cats = ["All", "Agro", "Waste", "Solar", "Water", "Habitat"];

  return (
    <div className={`canvas hub-a`} data-theme={theme}>
      <AppBar garden="Milpa Alta" />

      <main className="mainsheet">
        {/* Header — minimal: title + subtitle + numeric context strip */}
        <header className="hub-header">
          <div className="hub-title-row">
            <h1 className="hub-title">Hub</h1>
            <p className="hub-subtitle">Milpa Alta — impact pipeline</p>
          </div>
          <div className="hub-context-strip">
            <span><strong>12</strong> in review</span>
            <span className="strip-sep">·</span>
            <span><strong>5</strong> assessing</span>
            <span className="strip-sep">·</span>
            <span><strong>3</strong> to certify</span>
            <span className="strip-sep">·</span>
            <span className="muted">Synced 2 minutes ago</span>
          </div>
        </header>

        {/* Segmented tabs (full-width, mint-tinted active) */}
        <div className="seg-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab"
              className={`seg-tab ${t.active ? "is-active" : ""}`}
              aria-selected={!!t.active}>
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`tab-count ${t.active ? "is-active" : ""}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filter row — search + category chips + sort */}
        <div className="filter-row">
          <label className="search">
            <I.search />
            <input placeholder="Search Work" />
            <kbd className="kbd">⌘K</kbd>
          </label>

          <div className="chip-group" role="group" aria-label="Category filter">
            {cats.map((c, i) => (
              <button key={c} className={`chip ${i === 0 ? "is-active" : ""}`}>
                {c !== "All" && <span className="chip-icon">{CAT_ICON(c)}</span>}
                <span>{c}</span>
              </button>
            ))}
          </div>

          <button className="sort-btn">
            <I.sort />
            <span>Newest</span>
            <I.chevDown />
          </button>
        </div>

        {/* Card grid — 3-column comfortable */}
        <div className="card-grid-3">
          {WORK.slice(0, 6).map((w) => (
            <WorkCard key={w.id} w={w} />
          ))}
        </div>
      </main>

      <NavBar active="Hub" />
    </div>
  );
}

function CAT_ICON(kind) {
  if (kind === "Agro") return <I.leaf />;
  if (kind === "Waste") return <I.recycle />;
  if (kind === "Solar") return <I.sun />;
  if (kind === "Water") return <I.droplet />;
  return <I.leaf />;
}

function WorkCard({ w }) {
  return (
    <article className={`wcard state-${w.state}`} tabIndex={0}>
      {/* state edge — single colored top border */}
      <div className="wcard-edge" />

      {/* photo collage */}
      <div className="wcard-media">
        <PhotoCollage images={w.images} count={w.count} total={w.total} />
        <div className="wcard-cat"><CategoryBadge kind={w.cat} /></div>
      </div>

      {/* meta */}
      <div className="wcard-body">
        <h3 className="wcard-title">{w.title}</h3>
        <div className="wcard-meta-row">
          <span className="wcard-meta">{w.author} · {w.garden}</span>
          <span className="wcard-time">{w.age}</span>
        </div>
        <div className="wcard-foot">
          <PipelineDots stage={w.stage} flagged={w.state === "flag"} />
          <span className="stage-label">
            {w.stage === 1 ? "Review" : w.stage === 2 ? "Assess" : w.stage === 3 ? "Certify" : "Done"}
          </span>
        </div>
      </div>
    </article>
  );
}

window.HubA = HubA;
