/* global React, HubAtoms, ActionsAtoms, SheetSystem */
const { useState, useRef } = React;
const { AppBar: _AppBar, NavBar, I: HI } = HubAtoms;
const { AIcons, CATEGORIES, STATUSES, TEMPLATES, FIELD_ICONS, CATALOG_STATS } = ActionsAtoms;
const {
  LeftSheet, RightSheet,
  SheetHeader, SheetBody, SheetFooter, SheetDivider,
  NotificationsContent, ProfileContent, SettingsContent,
} = SheetSystem;

// ─── MemberAvatar ─────────────────────────────────────────────────────────────
const AVATAR_TONES = [
  { bg: "#E8DFD0", fg: "#5A4A2E" }, { bg: "#D8E4D0", fg: "#345C28" },
  { bg: "#E0D8E8", fg: "#4A3C5A" }, { bg: "#E8D8D0", fg: "#5C3828" },
  { bg: "#D0DEE4", fg: "#284A5C" }, { bg: "#E4DCC8", fg: "#5A4824" },
];
function MAv({ name = "AB", id = 0, size = 28 }) {
  const tone = AVATAR_TONES[id % AVATAR_TONES.length];
  const initials = name.split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "9999px",
      background: tone.bg, color: tone.fg,
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
      fontFamily: "var(--font-sans)",
    }}>{initials}</span>
  );
}

// ─── Category icon slot ───────────────────────────────────────────────────────
function CatIcon({ cat, theme = "light", size = 36 }) {
  const cfg = CATEGORIES[cat];
  if (!cfg) return null;
  const IconComp = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "10px",
      background: theme === "dark" ? cfg.tintDark : cfg.tintSoft,
      color: theme === "dark" ? cfg.tint.replace("1A", "4A") : cfg.tint,
      flexShrink: 0,
    }}>
      <IconComp style={{ color: cfg.tint }} />
    </span>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const chipStyles = {
    Active:     { bg: "rgba(26,117,68,0.10)",   fg: "#1A7544", bgD: "rgba(45,210,122,0.16)", fgD: "#6EE7AE" },
    Draft:      { bg: "rgba(217,119,6,0.10)",   fg: "#B45309", bgD: "rgba(245,158,11,0.18)", fgD: "#FCD34D" },
    Deprecated: { bg: "rgba(120,113,108,0.10)", fg: "#57534E", bgD: "rgba(168,162,158,0.14)", fgD: "#A8A29E" },
  };
  const s = chipStyles[status] || chipStyles.Deprecated;
  return (
    <span className={`act-status-chip act-status-${status.toLowerCase()}`}
      style={{ "--chip-bg": s.bg, "--chip-fg": s.fg, "--chip-bg-d": s.bgD, "--chip-fg-d": s.fgD }}>
      <span className="act-status-dot" />
      {status}
    </span>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────
function TemplateCard({ t, onOpen, selected, theme }) {
  const cfg = CATEGORIES[t.cat] || {};
  const statusCfg = STATUSES[t.status] || {};
  const edgeColor = theme === "dark" ? statusCfg.edgeDark : statusCfg.edgeLight;
  return (
    <article
      className={`act-card ${selected ? "is-selected" : ""} act-status-edge-${t.status.toLowerCase()}`}
      style={{ "--edge-color": edgeColor }}
      onClick={() => onOpen(t)}
      tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onOpen(t)}
      role="button"
      aria-label={`${t.name} — ${t.status}`}
    >
      <div className="act-card-edge" />
      <div className="act-card-header">
        <CatIcon cat={t.cat} theme={theme} size={36} />
        <StatusChip status={t.status} />
      </div>
      <div className="act-card-name">{t.name}</div>
      <div className="act-card-desc">{t.desc}</div>
      <div className="act-card-foot">
        <span className="act-stat">{t.uses} uses</span>
        <span className="act-stat-sep">·</span>
        <span className="act-stat">{t.gardens} gardens</span>
        <span className="act-stat-sep">·</span>
        <span className="act-stat act-stat-muted">
          {t.lastUsed ? `last used ${t.lastUsed}` : "never used"}
        </span>
      </div>
    </article>
  );
}

// ─── Template detail RightSheet content ──────────────────────────────────────
function TemplateDetailContent({ t, onClose, theme }) {
  const [openSections, setOpenSections] = useState(["identity"]);
  const toggle = (id) => setOpenSections(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  );
  const isOpen = (id) => openSections.includes(id);
  if (!t) return null;

  return (
    <>
      {/* Sheet header */}
      <div className="act-rs-header">
        <div className="act-rs-header-left">
          <CatIcon cat={t.cat} theme={theme} size={32} />
          <div>
            <div className="act-rs-title">{t.name}</div>
            <div className="act-rs-meta">{t.cat} · {t.version}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusChip status={t.status} />
          <button className="iconbtn" onClick={onClose} aria-label="Close"><AIcons.close /></button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="act-rs-body">
        <RSSection id="identity" label="Identity" open={isOpen("identity")} onToggle={toggle}>
          <div className="act-rs-field-row">
            <label className="act-rs-label">Name</label>
            <input className="act-rs-input" defaultValue={t.name} />
          </div>
          <div className="act-rs-field-row">
            <label className="act-rs-label">Short description</label>
            <textarea className="act-rs-textarea" defaultValue={t.desc} rows={3} />
          </div>
          <div className="act-rs-2col">
            <div className="act-rs-field-row">
              <label className="act-rs-label">Category</label>
              <select className="act-rs-select" defaultValue={t.cat}>
                {Object.keys(CATEGORIES).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="act-rs-field-row">
              <label className="act-rs-label">Status</label>
              <div className="act-rs-radio-group">
                {["Active","Draft","Deprecated"].map(s => (
                  <label key={s} className={`act-rs-radio ${t.status === s ? "is-selected" : ""}`}>
                    <input type="radio" name={`status-${t.id}`} defaultChecked={t.status === s} style={{ position:"absolute", opacity:0, pointerEvents:"none" }} />
                    <span className="act-rs-radio-dot" />
                    {s}
                    {s === "Deprecated" && <span className="act-rs-radio-consequence">Hides from gardeners</span>}
                    {s === "Active" && <span className="act-rs-radio-consequence">Visible in all assigned gardens</span>}
                    {s === "Draft" && <span className="act-rs-radio-consequence">Deployer-only, not submittable</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </RSSection>

        <RSSection id="parameters" label="Parameters" open={isOpen("parameters")} onToggle={toggle}>
          <div className="act-param-list">
            {t.fields.map((f, i) => {
              const FIcon = FIELD_ICONS[f.type] || AIcons.text;
              return (
                <div key={i} className="act-param-row">
                  <span className="act-param-grip"><AIcons.grip /></span>
                  <span className="act-param-type-icon"><FIcon /></span>
                  <span className="act-param-label-text">{f.label}</span>
                  <span className="act-param-type-tag">{f.type}</span>
                  {f.required ? <span className="act-param-req">required</span> : <span className="act-param-opt">optional</span>}
                  <button className="iconbtn iconbtn-xs" aria-label="Remove field"><AIcons.trash /></button>
                </div>
              );
            })}
          </div>
          <button className="act-add-field-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Add field
          </button>
        </RSSection>

        <RSSection id="evidence" label="Evidence requirements" open={isOpen("evidence")} onToggle={toggle}>
          <div className="act-ev-grid">
            <div className="act-ev-row"><span className="act-ev-label">Photos</span><span className="act-ev-val">min {t.evidence.photoMin} · max {t.evidence.photoMax}</span></div>
            <div className="act-ev-row"><span className="act-ev-label">Video</span><span className="act-ev-val">{t.evidence.videoAllowed ? "Allowed" : "Not required"}</span></div>
            <div className="act-ev-row"><span className="act-ev-label">Location pin</span><span className="act-ev-val">{t.evidence.locationRequired ? "Required" : "Optional"}</span></div>
            <div className="act-ev-row"><span className="act-ev-label">Narrative min</span><span className="act-ev-val">{t.evidence.narrativeMin} chars</span></div>
          </div>
        </RSSection>

        <RSSection id="impact" label="Impact dimensions" open={isOpen("impact")} onToggle={toggle}>
          {t.impact.length === 0
            ? <div className="act-rs-empty-inline">No impact dimensions defined.</div>
            : (
              <div className="act-impact-list">
                {t.impact.map((d, i) => (
                  <div key={i} className="act-impact-row">
                    <div className="act-impact-dim">{d.dim}</div>
                    <div className="act-impact-unit">{d.unit}</div>
                    <div className="act-impact-rule">{d.rule}</div>
                  </div>
                ))}
              </div>
            )
          }
        </RSSection>

        <RSSection id="usage" label="Usage" open={isOpen("usage")} onToggle={toggle}>
          <div className="act-usage-strip">
            <span className="act-usage-num">{t.uses}</span><span className="act-usage-label">uses</span>
            <span className="act-usage-sep" />
            <span className="act-usage-num">{t.gardens}</span><span className="act-usage-label">gardens</span>
            <span className="act-usage-sep" />
            <span className="act-usage-num act-usage-muted">{t.lastUsed || "—"}</span><span className="act-usage-label">last used</span>
          </div>
          {t.recentSubmissions.length > 0 && <div className="act-rs-sub-label">Recent submissions</div>}
          <ul className="act-recent-list">
            {t.recentSubmissions.map((s, i) => (
              <li key={i} className="act-recent-row">
                <MAv name={s.who} id={s.id} size={26} />
                <span className="act-recent-who">{s.who}</span>
                <span className="act-recent-garden">{s.garden}</span>
                <span className="act-recent-when">{s.when}</span>
              </li>
            ))}
          </ul>
        </RSSection>

        <RSSection id="lifecycle" label="Lifecycle" open={isOpen("lifecycle")} onToggle={toggle}>
          <div className="act-lc-grid">
            <div className="act-lc-row"><span className="act-lc-label">Created</span><span className="act-lc-val">{t.created}</span></div>
            <div className="act-lc-row"><span className="act-lc-label">Last edited</span><span className="act-lc-val">{t.edited}</span></div>
            <div className="act-lc-row"><span className="act-lc-label">Version</span><span className="act-lc-val">{t.version}</span></div>
          </div>
          <button className="act-lc-history-btn"><AIcons.history /> View version history</button>
        </RSSection>
      </div>

      <div className="act-rs-footer">
        <button className="btn-ghost-sm">Discard changes</button>
        <div style={{ flex: 1 }} />
        <button className="act-save-btn">Save changes</button>
      </div>
    </>
  );
}

// ─── RS collapsible section ───────────────────────────────────────────────────
function RSSection({ id, label, open, onToggle, children }) {
  return (
    <div className={`act-rs-section ${open ? "is-open" : ""}`}>
      <button className="act-rs-section-head" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="act-rs-section-label">{label}</span>
        <span className="act-rs-section-caret" aria-hidden="true">
          <AIcons.chevDown style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
        </span>
      </button>
      {open && <div className="act-rs-section-body">{children}</div>}
    </div>
  );
}

// ─── Create wizard LeftSheet content ──────────────────────────────────────────
function CreateWizardContent({ onClose, theme }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", cat: "Agro", desc: "", status: "Draft" });
  const totalSteps = 4;
  const stepLabels = ["Identity", "Parameters", "Impact", "Review"];

  return (
    <>
      {/* Sheet header */}
      <div className="act-ls-header">
        <div>
          <div className="act-ls-title">Create action template</div>
          <div className="act-ls-meta">Step {step} of {totalSteps} · {stepLabels[step - 1]}</div>
        </div>
        <button className="iconbtn" onClick={onClose} aria-label="Close"><AIcons.close /></button>
      </div>

      {/* Step track */}
      <div className="act-wizard-steps">
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "active" : "upcoming";
          return (
            <div key={n} className={`act-wstep act-wstep-${state}`}>
              <span className="act-wstep-dot">
                {state === "done" ? <AIcons.check /> : n}
              </span>
              <span className="act-wstep-label">{label}</span>
              {i < totalSteps - 1 && <span className="act-wstep-line" />}
            </div>
          );
        })}
      </div>

      {/* Step body */}
      <div className="act-ls-body">
        {step === 1 && (
          <div className="act-ls-step-body">
            <div className="act-rs-field-row">
              <label className="act-rs-label">Template name <span className="act-required">*</span></label>
              <input className="act-rs-input" placeholder="e.g. Plant native saplings"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="act-rs-field-row">
              <label className="act-rs-label">Short description <span className="act-required">*</span></label>
              <textarea className="act-rs-textarea" placeholder="What does this action capture?" rows={3}
                value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
            </div>
            <div className="act-rs-2col">
              <div className="act-rs-field-row">
                <label className="act-rs-label">Category <span className="act-required">*</span></label>
                <select className="act-rs-select" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}>
                  {Object.keys(CATEGORIES).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="act-rs-field-row">
                <label className="act-rs-label">Initial status</label>
                <select className="act-rs-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option>Draft</option><option>Active</option>
                </select>
              </div>
            </div>
            {form.cat && (
              <div className="act-cat-preview">
                <CatIcon cat={form.cat} theme={theme} size={40} />
                <div>
                  <div className="act-cat-preview-name">{form.cat}</div>
                  <div className="act-cat-preview-hint">Category icon shown on the template card</div>
                </div>
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="act-ls-step-body">
            <div className="act-ls-section-note">Define the fields gardeners fill out when submitting this action.</div>
            <div className="act-param-list">
              {[
                { type: "text", label: "Primary description", required: true },
                { type: "photo", label: "Photo evidence", required: true },
                { type: "number", label: "Quantity / count", required: false },
              ].map((f, i) => {
                const FIcon = FIELD_ICONS[f.type] || AIcons.text;
                return (
                  <div key={i} className="act-param-row">
                    <span className="act-param-grip"><AIcons.grip /></span>
                    <span className="act-param-type-icon"><FIcon /></span>
                    <span className="act-param-label-text">{f.label}</span>
                    <span className="act-param-type-tag">{f.type}</span>
                    {f.required ? <span className="act-param-req">required</span> : <span className="act-param-opt">optional</span>}
                    <button className="iconbtn iconbtn-xs" aria-label="Remove field"><AIcons.trash /></button>
                  </div>
                );
              })}
            </div>
            <button className="act-add-field-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Add field
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="act-ls-step-body">
            <div className="act-ls-section-note">Define what gets measured when this action is certified.</div>
            <div className="act-impact-list act-impact-list-edit">
              <div className="act-impact-row act-impact-row-head">
                <div className="act-impact-dim act-impact-head-cell">Dimension</div>
                <div className="act-impact-unit act-impact-head-cell">Unit</div>
                <div className="act-impact-rule act-impact-head-cell">Measurement rule</div>
              </div>
              {[{ dim: "CO₂ sequestered", unit: "kg / year", rule: "0.5 kg per unit" }].map((d, i) => (
                <div key={i} className="act-impact-row">
                  <input className="act-impact-input" defaultValue={d.dim} placeholder="Dimension name" />
                  <input className="act-impact-input" defaultValue={d.unit} placeholder="Unit" />
                  <input className="act-impact-input act-impact-input-rule" defaultValue={d.rule} placeholder="Rule description" />
                </div>
              ))}
            </div>
            <button className="act-add-field-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Add dimension
            </button>
          </div>
        )}
        {step === 4 && (
          <div className="act-ls-step-body">
            <div className="act-ls-section-note">Review before publishing. Active templates become submittable in all assigned gardens.</div>
            <div className="act-review-block">
              <div className="act-review-row">
                <CatIcon cat={form.cat || "Agro"} theme={theme} size={40} />
                <div>
                  <div className="act-review-name">{form.name || "(unnamed template)"}</div>
                  <div className="act-review-desc">{form.desc || "No description yet."}</div>
                </div>
              </div>
              <div className="act-review-meta-row">
                <span className="act-review-meta-item"><strong>Category</strong> {form.cat}</span>
                <span className="act-review-meta-item"><strong>Status</strong> {form.status}</span>
                <span className="act-review-meta-item"><strong>Fields</strong> 3 defined</span>
                <span className="act-review-meta-item"><strong>Impact dims</strong> 1 defined</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="act-ls-footer">
        <button className="btn-ghost-sm" onClick={onClose}>Save as draft</button>
        <div style={{ flex: 1 }} />
        {step > 1 && <button className="act-wizard-back-btn" onClick={() => setStep(s => s - 1)}>Back</button>}
        {step < totalSteps
          ? <button className="act-wizard-next-btn" onClick={() => setStep(s => s + 1)}>Next — {stepLabels[step]}</button>
          : <button className="act-publish-btn"><AIcons.publish /> Publish template</button>
        }
      </div>
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onClear }) {
  return (
    <div className="act-empty">
      <div className="act-empty-title">No templates match</div>
      <div className="act-empty-sub">
        <button className="act-empty-clear" onClick={onClear}>Clear filters</button> to see all templates.
      </div>
    </div>
  );
}

// ─── AppBar with sheet-aware icon buttons ─────────────────────────────────────
function ActionsAppBar({ garden = "Milpa Alta", headerSheet, onToggleSheet, unreadCount = 3 }) {
  return (
    <header className="appbar">
      <button className="garden-pill" aria-label="Switch Garden">
        <span className="garden-pill-leaf" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/>
          </svg>
        </span>
        <span className="garden-pill-label">{garden}</span>
        <HI.chevDown />
      </button>

      <div className="appbar-trailing">
        <span className="presence-dot" title="Synced" aria-label="Synced">
          <span className="presence-dot-inner" />
        </span>

        {/* Bell — notifications */}
        <div className="appbar-icon-wrap">
          <button
            className={`iconbtn ${headerSheet === "notifications" ? "is-sheet-active" : ""}`}
            aria-label="Notifications"
            onClick={() => onToggleSheet("notifications")}
          >
            <HI.bell />
          </button>
          {unreadCount > 0 && headerSheet !== "notifications" && (
            <span className="notif-badge">{unreadCount}</span>
          )}
        </div>

        {/* Gear — settings */}
        <button
          className={`iconbtn ${headerSheet === "settings" ? "is-sheet-active" : ""}`}
          aria-label="Settings"
          onClick={() => onToggleSheet("settings")}
        >
          <HI.settings />
        </button>

        {/* Avatar — profile */}
        <button
          className={`iconbtn ${headerSheet === "profile" ? "is-sheet-active" : ""}`}
          aria-label="Profile"
          onClick={() => onToggleSheet("profile")}
        >
          <HI.user />
        </button>
      </div>
    </header>
  );
}

// ─── Main ActionsA component ──────────────────────────────────────────────────
function ActionsA({
  theme = "light",
  showRightSheet = false,
  showWizard = false,
  showHeaderSheet = null, // "notifications" | "settings" | "profile" | null
}) {
  const [search, setSearch]               = useState("");
  const [sort, setSort]                   = useState("Recently edited");
  const [statusFilter, setStatusFilter]   = useState("All");
  const [catFilters, setCatFilters]       = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(showRightSheet ? TEMPLATES[0] : null);
  const [wizardOpen, setWizardOpen]       = useState(showWizard);
  const [headerSheet, setHeaderSheet]     = useState(showHeaderSheet); // null | "notifications" | "settings" | "profile"

  const toggleHeaderSheet = (name) => {
    setHeaderSheet(prev => prev === name ? null : name);
  };

  const toggleCat = (cat) => setCatFilters(prev =>
    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
  );

  const anySheetOpen = wizardOpen || headerSheet !== null;

  const filteredTemplates = TEMPLATES.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (catFilters.length > 0 && !catFilters.includes(t.cat)) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "Alphabetical") return a.name.localeCompare(b.name);
    if (sort === "Most used") return b.uses - a.uses;
    if (sort === "By category") return a.cat.localeCompare(b.cat);
    return 0;
  });

  const statusChips = ["All", "Active", "Draft", "Deprecated"];
  const catChips = Object.keys(CATEGORIES);

  return (
    <div className="canvas actions-a" data-theme={theme}>
      {/* ── AppBar with sheet toggles ── */}
      <ActionsAppBar
        garden="Milpa Alta"
        headerSheet={headerSheet}
        onToggleSheet={toggleHeaderSheet}
        unreadCount={3}
      />

      {/* ── Left Sheet — Create wizard ── */}
      <LeftSheet open={wizardOpen} onClose={() => setWizardOpen(false)} width={480}>
        <CreateWizardContent onClose={() => setWizardOpen(false)} theme={theme} />
      </LeftSheet>

      {/* ── Right Sheet — Header-triggered (notifications / settings / profile) ── */}
      <RightSheet open={headerSheet !== null} onClose={() => setHeaderSheet(null)} width={360}>
        {headerSheet === "notifications" && (
          <NotificationsContent onClose={() => setHeaderSheet(null)} />
        )}
        {headerSheet === "settings" && (
          <SettingsContent onClose={() => setHeaderSheet(null)} />
        )}
        {headerSheet === "profile" && (
          <ProfileContent onClose={() => setHeaderSheet(null)} />
        )}
      </RightSheet>

      {/* ── Main content ── */}
      <main className={`mainsheet act-mainsheet ${anySheetOpen ? "is-sheet-open" : ""}`}>

        {/* ── Page header ── */}
        <header className="act-page-header">
          <div className="act-page-header-left">
            <h1 className="act-page-title">Action templates</h1>
            <p className="act-page-sub">Work-types operators enable per garden</p>
          </div>
          <div className="act-page-stats">
            <span className="act-page-stat">{CATALOG_STATS.total} templates</span>
            <span className="act-page-stat-sep">·</span>
            <span className="act-page-stat">{CATALOG_STATS.active} active</span>
            <span className="act-page-stat-sep">·</span>
            <span className="act-page-stat">{CATALOG_STATS.drafts} drafts</span>
          </div>
        </header>

        {/* ── Single toolbar row: search · status chips · cat chips · sort ── */}
        <div className="act-toolbar-row">
          {/* Search */}
          <label className="search search-compact act-search">
            <HI.search />
            <input
              placeholder="Search templates"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>

          <div className="act-toolbar-divider" />

          {/* Status chips */}
          <div className="act-chip-group">
            {statusChips.map(s => (
              <button key={s}
                className={`act-filter-chip ${statusFilter === s ? "is-active" : ""}`}
                onClick={() => setStatusFilter(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="act-toolbar-divider" />

          {/* Category chips */}
          <div className="act-chip-group">
            {catChips.map(c => (
              <button key={c}
                className={`act-filter-chip act-cat-chip ${catFilters.includes(c) ? "is-active" : ""}`}
                onClick={() => toggleCat(c)}>
                {CATEGORIES[c].icon({ width: 12, height: 12 })}
                {c}
              </button>
            ))}
          </div>

          {catFilters.length > 0 && (
            <button className="act-clear-btn" onClick={() => setCatFilters([])}>Clear</button>
          )}

          <div style={{ flex: 1 }} />

          {/* Sort */}
          <div className="act-sort-wrap">
            <label className="act-sort-label">Sort</label>
            <select className="act-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
              {["Recently edited", "Most used", "Alphabetical", "By category"].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Content area — grid + optional template detail ── */}
        <div className={`act-content-area ${selectedTemplate ? "with-sheet" : ""}`}>
          {/* Card grid */}
          <div className="act-grid-wrap">
            {filteredTemplates.length === 0 ? (
              <EmptyState onClear={() => { setStatusFilter("All"); setCatFilters([]); setSearch(""); }} />
            ) : (
              <div className="act-card-grid">
                {filteredTemplates.map(t => (
                  <TemplateCard
                    key={t.id} t={t}
                    onOpen={tmpl => setSelectedTemplate(tmpl)}
                    selected={selectedTemplate?.id === t.id}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Template detail — inline content-scoped right panel */}
          {selectedTemplate && (
            <aside className="act-rightsheet" role="complementary" aria-label="Template detail">
              <TemplateDetailContent
                t={selectedTemplate}
                onClose={() => setSelectedTemplate(null)}
                theme={theme}
              />
            </aside>
          )}
        </div>
      </main>

      {/* ── NavBar + FAB (FAB is direct child of canvas to share axis with navbar pill) ── */}
      <NavBar active="Actions" mode="desktop" showFab={false} />
      <button className="fab act-fab" aria-label="Create template" onClick={() => setWizardOpen(true)}>
        <HI.plus />
      </button>
    </div>
  );
}

window.ActionsA = ActionsA;
