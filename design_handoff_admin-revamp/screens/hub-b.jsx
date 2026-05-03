/* global React, HubAtoms */
const { AppBar, NavBar, PipelineDots, CategoryBadge, I, WORK } = HubAtoms;

// ─────────────────────────────────────────────────────────────────────────────
// VARIATION B — "Operator's desk"
// Compressed list-rows · compact density · LeftSheet filter rail (persistent)
// Header: title + tab rail merged
// ─────────────────────────────────────────────────────────────────────────────

function HubB({ theme = "light" }) {
  const tabs = [
    { id: "review",  label: "Review",  count: 12, active: true },
    { id: "assess",  label: "Assess",  count: 5  },
    { id: "certify", label: "Certify", count: 3  },
    { id: "history", label: "History" },
  ];

  const savedFilters = [
    { id: "all", label: "All Work", count: 12, active: true },
    { id: "mine", label: "Assigned to me", count: 4 },
    { id: "flagged", label: "Flagged", count: 1 },
    { id: "older", label: "Older than 24h", count: 3 },
  ];
  const categories = [
    { id: "agro", label: "Agro", count: 7, on: true,  icon: <I.leaf /> },
    { id: "waste", label: "Waste", count: 2, on: true, icon: <I.recycle /> },
    { id: "solar", label: "Solar", count: 1, on: true, icon: <I.sun /> },
    { id: "water", label: "Water", count: 2, on: false, icon: <I.droplet /> },
    { id: "habitat", label: "Habitat", count: 1, on: false, icon: <I.leaf /> },
  ];
  const gardens = [
    { id: "all", label: "All Gardens", count: 12, on: true },
    { id: "milpa", label: "Milpa Alta", count: 6, on: true },
    { id: "xochi", label: "Xochimilco", count: 4, on: true },
    { id: "tepoz", label: "Tepoztlán", count: 2, on: false },
  ];

  return (
    <div className="canvas hub-b" data-theme={theme}>
      <AppBar garden="All Gardens" />

      <main className="mainsheet hub-b-grid">
        {/* LeftSheet filter rail — persistent saved filters */}
        <aside className="filter-rail">
          <div className="rail-section">
            <div className="rail-title">Saved</div>
            <ul className="rail-list">
              {savedFilters.map((f) => (
                <li key={f.id}>
                  <button className={`rail-item ${f.active ? "is-active" : ""}`}>
                    <span className="rail-item-icon"><I.bookmark /></span>
                    <span className="rail-item-label">{f.label}</span>
                    <span className="rail-item-count">{f.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-section">
            <div className="rail-title">Action</div>
            <ul className="rail-list">
              {categories.map((c) => (
                <li key={c.id}>
                  <label className={`rail-check ${c.on ? "is-on" : ""}`}>
                    <input type="checkbox" defaultChecked={c.on} />
                    <span className="check-box" aria-hidden="true" />
                    <span className="rail-item-icon">{c.icon}</span>
                    <span className="rail-item-label">{c.label}</span>
                    <span className="rail-item-count">{c.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-section">
            <div className="rail-title">Garden</div>
            <ul className="rail-list">
              {gardens.map((g) => (
                <li key={g.id}>
                  <label className={`rail-check ${g.on ? "is-on" : ""}`}>
                    <input type="checkbox" defaultChecked={g.on} />
                    <span className="check-box" aria-hidden="true" />
                    <span className="rail-item-label">{g.label}</span>
                    <span className="rail-item-count">{g.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-foot">
            <button className="btn-ghost-sm">Reset filters</button>
          </div>
        </aside>

        {/* Main content — title + tabs merged, then dense rows */}
        <section className="hub-b-main">
          <header className="hub-b-header">
            <div className="hub-b-title">
              <h1>Hub</h1>
              <span className="muted">12 work items match</span>
            </div>

            <div className="seg-tabs hub-b-tabs" role="tablist">
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

            <div className="hub-b-toolbar">
              <label className="search compact">
                <I.search />
                <input placeholder="Search Work, authors, attestations" />
              </label>
              <button className="sort-btn"><I.sort /><span>Newest</span><I.chevDown /></button>
            </div>
          </header>

          <ul className="row-list">
            {WORK.map((w) => <WorkRow key={w.id} w={w} />)}
          </ul>
        </section>
      </main>

      <NavBar active="Hub" />
    </div>
  );
}

function WorkRow({ w }) {
  return (
    <li className={`wrow state-${w.state}`} tabIndex={0}>
      <span className="wrow-edge" aria-hidden="true" />
      <div className="wrow-thumb" style={{ backgroundImage: `url(${w.images[0]})` }}>
        {w.total > 1 && <span className="wrow-thumb-count">+{w.total - 1}</span>}
      </div>
      <div className="wrow-cat-col">
        <CategoryBadge kind={w.cat} onPhoto={false} />
      </div>
      <div className="wrow-title-col">
        <div className="wrow-title">{w.title}</div>
        <div className="wrow-meta">{w.author} · {w.garden}</div>
      </div>
      <div className="wrow-pipe-col">
        <PipelineDots stage={w.stage} flagged={w.state === "flag"} />
        <span className="stage-label">
          {w.stage === 1 ? "Review" : w.stage === 2 ? "Assess" : w.stage === 3 ? "Certify" : "Done"}
        </span>
      </div>
      <div className="wrow-time-col">
        <I.clock /><span>{w.age}</span>
      </div>
      <div className="wrow-arrow"><I.arrowRight /></div>
    </li>
  );
}

window.HubB = HubB;
