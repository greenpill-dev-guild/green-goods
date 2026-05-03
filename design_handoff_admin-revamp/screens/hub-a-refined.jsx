/* global React, HubAtoms */
const { useState, useEffect, useCallback, useRef } = React;
const {
  AppBar, NavBar, CategoryBadge, PhotoCollage, StatusTag,
  I, WORK, STATUS, TAB_STATUSES,
} = HubAtoms;

// ─────────────────────────────────────────────────────────────────────────────
// VARIATION A — Refined
// Status replaces pipeline dots; status chips per tab; tab transitions;
// empty / error states; tweakable surfaces.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "review",  label: "Review",  count: 12 },
  { id: "assess",  label: "Assess",  count: 5  },
  { id: "certify", label: "Certify", count: 3  },
  { id: "history", label: "History" },
];

const CATS = ["All", "Agro", "Waste", "Solar", "Water"];

function HubARefined({
  theme = "light",
  variant = "solid",
  density = "regular",
  photoEmphasis = "balanced",
  typeScale = 100,
  cornerStyle = "rounded",
  accentSaturation = 100,
  contentState = "default",  // "default" | "empty" | "error"
  breakpoint = "desktop",     // "desktop" | "tablet" | "mobile"
}) {
  const [activeTab, setActiveTab] = useState("review");
  const [activeCat, setActiveCat] = useState("All");
  const [activeStatus, setActiveStatus] = useState("all");
  const [openWork, setOpenWork] = useState(null);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Reset status filter when switching tabs
  useEffect(() => { setActiveStatus("all"); }, [activeTab]);

  const closeSheet = useCallback(() => {
    setSheetClosing(true);
    setTimeout(() => { setOpenWork(null); setSheetClosing(false); }, 240);
  }, []);

  useEffect(() => {
    if (!openWork) return;
    const onKey = (e) => { if (e.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openWork, closeSheet]);

  // Filter work for current tab + filters
  const filteredWork = WORK.filter((w) => {
    if (activeCat !== "All" && w.cat !== activeCat) return false;
    if (activeStatus !== "all" && activeTab !== "history") {
      if (w[activeTab] !== activeStatus) return false;
    }
    return true;
  }).slice(0, 6);

  return (
    <div
      className={`canvas hub-a hub-a-refined`}
      data-theme={theme}
      data-variant={variant}
      data-density={density}
      data-photo={photoEmphasis}
      data-corner={cornerStyle}
      data-bp={breakpoint}
      style={{
        "--type-scale": typeScale / 100,
        "--accent-sat": accentSaturation / 100,
      }}
    >
      <AppBar garden="Milpa Alta" mode={breakpoint === "mobile" ? "mobile" : "desktop"} />

      <main className="mainsheet">
        <header className="hub-header hub-header-tight">
          <div className="hub-title-row">
            <h1 className="hub-title">Hub</h1>
            <p className="hub-subtitle">Milpa Alta · impact pipeline</p>
          </div>
        </header>

        {/* Mobile-only: full-width search above tabs */}
        {breakpoint === "mobile" && (
          <label className="search search-mobile">
            <I.search />
            <input placeholder="Search Work" />
          </label>
        )}

        {/* Tabs */}
        <div className="seg-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab"
              className={`seg-tab ${activeTab === t.id ? "is-active" : ""}`}
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}>
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`tab-count ${activeTab === t.id ? "is-active" : ""}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filter row — varies by breakpoint */}
        {breakpoint === "desktop" && (
          <div className="filter-row filter-row-merged">
            <div className="filter-cluster" role="group" aria-label="Domain filter">
              <span className="cluster-label">Domain</span>
              <div className="chip-group">
                {CATS.map((c) => (
                  <button key={c}
                    className={`chip ${c === activeCat ? "is-active" : ""}`}
                    onClick={() => setActiveCat(c)}>
                    {c !== "All" && <span className="chip-icon">{CAT_ICON(c)}</span>}
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            </div>

            {activeTab !== "history" && TAB_STATUSES[activeTab].length > 0 && (
              <React.Fragment>
                <div className="cluster-divider" aria-hidden="true" />
                <div className="filter-cluster" role="group" aria-label="Status filter">
                  <span className="cluster-label">Status</span>
                  <div className="chip-group">
                    <button
                      className={`status-chip ${activeStatus === "all" ? "is-active" : ""}`}
                      onClick={() => setActiveStatus("all")}>
                      All
                    </button>
                    {TAB_STATUSES[activeTab].map((s) => (
                      <button key={s}
                        className={`status-chip status-chip-${s} ${activeStatus === s ? "is-active" : ""}`}
                        onClick={() => setActiveStatus(s)}>
                        <span className="status-dot" aria-hidden="true" />
                        <span>{STATUS[s].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            )}

            <div className="filter-row-spacer" />

            <label className="search search-compact">
              <I.search />
              <input placeholder="Search" />
              <kbd className="kbd">⌘K</kbd>
            </label>

            <button className="sort-btn">
              <I.sort />
              <span>Newest</span>
              <I.chevDown />
            </button>
          </div>
        )}

        {breakpoint === "tablet" && (
          <div className="filter-row filter-row-tablet">
            <div className="filter-cluster" role="group" aria-label="Domain filter">
              <div className="chip-group">
                {CATS.map((c) => (
                  <button key={c}
                    className={`chip chip-tablet ${c === activeCat ? "is-active" : ""}`}
                    onClick={() => setActiveCat(c)}>
                    {c !== "All" && c === activeCat && <span className="chip-icon">{CAT_ICON(c)}</span>}
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            </div>

            {activeTab !== "history" && TAB_STATUSES[activeTab].length > 0 && (
              <React.Fragment>
                <div className="cluster-divider" aria-hidden="true" />
                <div className="filter-cluster" role="group" aria-label="Status filter">
                  <div className="chip-group">
                    <button
                      className={`status-chip status-chip-tablet ${activeStatus === "all" ? "is-active" : ""}`}
                      onClick={() => setActiveStatus("all")}>
                      All
                    </button>
                    {TAB_STATUSES[activeTab].map((s) => (
                      <button key={s}
                        className={`status-chip status-chip-tablet status-chip-${s} ${activeStatus === s ? "is-active" : ""}`}
                        onClick={() => setActiveStatus(s)}>
                        <span className="status-dot" aria-hidden="true" />
                        <span>{STATUS[s].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            )}

            <div className="filter-row-spacer" />

            <button className="iconbtn" aria-label="Search">
              <I.search />
            </button>

            <button className="iconbtn" aria-label="Sort">
              <I.sort />
            </button>
          </div>
        )}

        {breakpoint === "mobile" && (
          <div className="filter-row filter-row-mobile">
            <FilterDropdown
              label="Domain"
              value={activeCat}
              open={domainOpen}
              onToggle={() => setDomainOpen((v) => !v)}
              onClose={() => setDomainOpen(false)}
              options={CATS.map((c) => ({ id: c, label: c }))}
              onPick={(id) => { setActiveCat(id); setDomainOpen(false); }}
            />
            {activeTab !== "history" && TAB_STATUSES[activeTab].length > 0 && (
              <FilterDropdown
                label="Status"
                value={activeStatus === "all" ? "All" : STATUS[activeStatus].label}
                open={statusOpen}
                onToggle={() => setStatusOpen((v) => !v)}
                onClose={() => setStatusOpen(false)}
                options={[
                  { id: "all", label: "All" },
                  ...TAB_STATUSES[activeTab].map((s) => ({ id: s, label: STATUS[s].label, dot: s })),
                ]}
                onPick={(id) => { setActiveStatus(id); setStatusOpen(false); }}
              />
            )}
            <button className="sort-btn sort-btn-icon" aria-label="Sort">
              <I.sort />
            </button>
          </div>
        )}

        {/* Content area — min-height; cross-fade tab content */}
        <ContentArea
          tabKey={`${activeTab}-${activeCat}-${activeStatus}-${contentState}-${breakpoint}`}
          state={contentState}
          work={filteredWork}
          onOpen={(w) => setOpenWork(w)}
          activeTab={activeTab}
          breakpoint={breakpoint}
        />
      </main>

      <NavBar active="Hub" mode={breakpoint === "mobile" ? "mobile" : "desktop"} />

      {openWork && (
        <RightSheet
          work={openWork}
          activeTab={activeTab}
          closing={sheetClosing}
          onClose={closeSheet}
          breakpoint={breakpoint}
        />
      )}
    </div>
  );
}

// ─── Filter dropdown ───────────────────────────────────────────────────────
function FilterDropdown({ label, value, open, onToggle, onClose, options, onPick, compact = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  return (
    <div className={`fdd ${compact ? "fdd-compact" : ""}`} ref={ref}>
      <button className={`fdd-btn ${open ? "is-open" : ""}`} onClick={onToggle}>
        {!compact && <span className="fdd-label">{label}</span>}
        {!compact && <span className="fdd-sep" aria-hidden="true">·</span>}
        <span className="fdd-value">{value}</span>
        <I.chevDown />
      </button>
      {open && (
        <div className="fdd-menu" role="listbox">
          {options.map((o) => (
            <button key={o.id} role="option" className="fdd-option"
              onClick={() => onPick(o.id)}>
              {o.dot && <span className={`status-dot status-${o.dot}-dot`} aria-hidden="true" />}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
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

// ─── Content area with cross-fade transitions ──────────────────────────────
function ContentArea({ tabKey, state, work, onOpen, activeTab, breakpoint = "desktop" }) {
  const [displayKey, setDisplayKey] = useState(tabKey);
  const [phase, setPhase] = useState("idle"); // "idle" | "out" | "in"

  useEffect(() => {
    if (tabKey === displayKey) return;
    setPhase("out");
    const t = setTimeout(() => {
      setDisplayKey(tabKey);
      setPhase("in");
      const t2 = setTimeout(() => setPhase("idle"), 260);
      return () => clearTimeout(t2);
    }, 160);
    return () => clearTimeout(t);
  }, [tabKey, displayKey]);

  const gridCls = breakpoint === "mobile" ? "card-list" :
                  breakpoint === "tablet" ? "card-grid-2" : "card-grid-3";

  return (
    <div className="content-area">
      <div
        key={displayKey}
        className={`content-stage phase-${phase}`}
      >
        {state === "empty" && <EmptyState activeTab={activeTab} />}
        {state === "error" && <ErrorState />}
        {state === "default" && work.length === 0 && <EmptyState activeTab={activeTab} />}
        {state === "default" && work.length > 0 && (
          <div className={gridCls}>
            {work.map((w) => (
              breakpoint === "mobile"
                ? <WorkRow key={w.id} w={w} activeTab={activeTab} onOpen={() => onOpen(w)} />
                : <WorkCard key={w.id} w={w} activeTab={activeTab} onOpen={() => onOpen(w)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ activeTab }) {
  const copy = {
    review:  { title: "No Work to review",  body: "When Operators submit Work, it'll show up here." },
    assess:  { title: "Nothing to assess",  body: "Approved Work moves into Assess once it's ready." },
    certify: { title: "Nothing to certify", body: "Evaluated Work moves into Certify when it qualifies." },
    history: { title: "No history yet",     body: "Closed and certified Work will appear here." },
  };
  const c = copy[activeTab] || copy.review;
  return (
    <div className="state-card">
      <div className="state-illus" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="10" y="14" width="44" height="38" rx="6" />
          <path d="M10 24h44" />
          <circle cx="18" cy="19" r="1.2" fill="currentColor" />
          <circle cx="22" cy="19" r="1.2" fill="currentColor" />
          <path d="M22 36h20M22 42h12" opacity="0.5" />
        </svg>
      </div>
      <h3 className="state-title">{c.title}</h3>
      <p className="state-body">{c.body}</p>
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────
function ErrorState() {
  return (
    <div className="state-card state-error">
      <div className="state-illus state-illus-error" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 8 6 54h52L32 8Z" />
          <path d="M32 26v12" />
          <circle cx="32" cy="46" r="1.6" fill="currentColor" />
        </svg>
      </div>
      <h3 className="state-title">Couldn't load Work</h3>
      <p className="state-body">Something went wrong on our end. Check your connection or try again.</p>
      <button className="state-action">
        <span>Try again</span>
        <I.arrowRight />
      </button>
    </div>
  );
}

// ─── Work card ─────────────────────────────────────────────────────────────
function WorkCard({ w, activeTab, onOpen }) {
  // status to show: depends on tab; in history we show review status as fallback
  const status = activeTab === "history" ? (w.review === "approved" ? "approved" : w.review)
    : w[activeTab] || "pending";
  return (
    <article
      className={`wcard state-${w.state}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
    >
      <div className="wcard-edge" />
      <div className="wcard-media">
        <PhotoCollage images={w.images} count={w.count} total={w.total} />
        <div className="wcard-cat"><CategoryBadge kind={w.cat} /></div>
      </div>
      <div className="wcard-body">
        <h3 className="wcard-title">{w.title}</h3>
        <div className="wcard-meta-row">
          <span className="wcard-meta">{w.author} · {w.garden}</span>
          <span className="wcard-time">{w.age}</span>
        </div>
        <div className="wcard-foot">
          <StatusTag status={status} />
        </div>
      </div>
    </article>
  );
}

// ─── Work row (mobile list variant) ────────────────────────────────────────
function WorkRow({ w, activeTab, onOpen }) {
  const status = activeTab === "history" ? (w.review === "approved" ? "approved" : w.review)
    : w[activeTab] || "pending";
  return (
    <article
      className={`wrow state-${w.state}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
    >
      <div className="wrow-edge" />
      <div className="wrow-thumb">
        <div className="wrow-thumb-img" style={{ backgroundImage: `url(${w.images[0]})` }} />
        {w.total > 1 && <span className="wrow-thumb-count">+{w.total - 1}</span>}
      </div>
      <div className="wrow-body">
        <div className="wrow-top-row">
          <h3 className="wrow-title">{w.title}</h3>
        </div>
        <div className="wrow-meta-row">
          <CategoryBadge kind={w.cat} onPhoto={false} compact />
          <span className="wrow-meta">{w.author} · {w.garden}</span>
        </div>
        <div className="wrow-foot">
          <StatusTag status={status} />
          <span className="wrow-time">{w.age}</span>
        </div>
      </div>
    </article>
  );
}

// ─── RightSheet ────────────────────────────────────────────────────────────
function RightSheet({ work, activeTab, closing, onClose, breakpoint = "desktop" }) {
  const status = activeTab === "history" ? work.review : (work[activeTab] || "pending");
  const isMobile = breakpoint === "mobile";
  return (
    <div className={`sheet-layer ${isMobile ? "sheet-layer-bottom" : ""} ${closing ? "is-closing" : "is-opening"}`}>
      <div className="sheet-scrim" onClick={onClose} />
      <aside className={`sheet ${isMobile ? "sheet-bottom" : ""}`} role="dialog" aria-label={`Detail: ${work.title}`}>
        {isMobile && <div className="sheet-grabber" aria-hidden="true" />}        <header className="sheet-header">
          <div className="sheet-eyebrow">
            <CategoryBadge kind={work.cat} onPhoto={false} />
            <span className="sheet-time">{work.age}</span>
          </div>
          <button className="sheet-close iconbtn" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="sheet-hero">
          <PhotoCollage images={work.images} count={work.count} total={work.total} />
        </div>

        <div className="sheet-body">
          <h2 className="sheet-title">{work.title}</h2>
          <p className="sheet-author">{work.author} · {work.garden}</p>

          <div className="sheet-pipe-row">
            <StatusTag status={status} />
            <span className="sheet-stage-context">
              in {activeTab === "history" ? "History" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </span>
          </div>

          <dl className="sheet-meta">
            <div><dt>Submitted</dt><dd>{work.age}</dd></div>
            <div><dt>Garden</dt><dd>{work.garden}</dd></div>
            <div><dt>Category</dt><dd>{work.cat}</dd></div>
            <div><dt>Photos</dt><dd>{work.total}</dd></div>
          </dl>

          <p className="sheet-note">
            Operator notes appear here — observations from the field, links to evidence, and
            assessor comments that surface as the Work moves through the pipeline.
          </p>
        </div>

        <footer className="sheet-foot">
          <button className="btn-ghost">Flag for follow-up</button>
          <button className="btn-primary">
            <span>{primaryActionLabel(activeTab, status)}</span>
            <I.arrowRight />
          </button>
        </footer>
      </aside>
    </div>
  );
}

function primaryActionLabel(tab, status) {
  if (tab === "review")  return status === "pending" ? "Approve" : "Re-review";
  if (tab === "assess")  return status === "draft" ? "Publish" : status === "published" ? "Evaluate" : "View";
  if (tab === "certify") return status === "draft" ? "Publish" : status === "published" ? "Certify" : "View";
  return "View";
}

window.HubARefined = HubARefined;
