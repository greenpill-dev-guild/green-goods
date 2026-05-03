/* global React */
const { useMemo } = React;

// ─── Lucide-style inline icons (1.5px stroke at 24px) ────────────────────────
const I = {
  search: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  bell: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  settings: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  user: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  chevDown: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>
  ),
  arrowRight: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
    </svg>
  ),
  plus: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
  ),
  hub: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  garden: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 21V11"/><path d="M12 11c0-3 2-5 5-5-1 3-2 5-5 5Z"/><path d="M12 11c0-3-2-5-5-5 1 3 2 5 5 5Z"/>
    </svg>
  ),
  community: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/>
      <path d="M3 20a6 6 0 0 1 12 0"/><path d="M14 20a4 4 0 0 1 7 0"/>
    </svg>
  ),
  actions: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M13 3 4 14h7l-1 7 9-11h-7Z"/>
    </svg>
  ),
  // Category glyphs (badge prefix)
  leaf: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/>
    </svg>
  ),
  recycle: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 19h10l-2 3"/><path d="m4 13 3-5 3 3"/><path d="m20 13-3-5-3 5"/>
      <path d="M14 22H6a2 2 0 0 1-1.7-3l1.5-2.5"/>
    </svg>
  ),
  sun: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    </svg>
  ),
  droplet: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/>
    </svg>
  ),
  filter: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 5h18M6 12h12M10 19h4"/>
    </svg>
  ),
  sort: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h13M3 12h9M3 18h5"/><path d="m17 16 3 3 3-3"/><path d="M20 19V8"/>
    </svg>
  ),
  bookmark: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-4 7 4Z"/>
    </svg>
  ),
  flag: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 21V4h12l-2 4 2 4H4"/>
    </svg>
  ),
  clock: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  ),
  imageStack: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="6" y="6" width="14" height="14" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>
    </svg>
  ),
};

// ─── Top app bar ─────────────────────────────────────────────────────────────
function AppBar({ garden = "Milpa Alta", connected = true, mode = "desktop" }) {
  if (mode === "mobile") {
    return (
      <header className="appbar appbar-mobile">
        <button className="garden-pill garden-pill-mobile" aria-label="Switch Garden">
          <span className="garden-pill-leaf" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/>
            </svg>
          </span>
          <span className="garden-pill-label">{garden}</span>
          <I.chevDown />
        </button>

        <div className="appbar-trailing">
          {connected && (
            <span className="presence-dot" title="Synced 2 minutes ago" aria-label="Synced">
              <span className="presence-dot-inner" />
            </span>
          )}
          <button className="iconbtn" aria-label="Notifications"><I.bell /></button>
        </div>
      </header>
    );
  }
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
        <I.chevDown />
      </button>

      <div className="appbar-trailing">
        {connected && (
          <span className="presence-dot" title="Synced 2 minutes ago" aria-label="Synced">
            <span className="presence-dot-inner" />
          </span>
        )}
        <button className="iconbtn" aria-label="Notifications"><I.bell /></button>
        <button className="iconbtn" aria-label="Settings"><I.settings /></button>
        <button className="iconbtn" aria-label="Profile"><I.user /></button>
      </div>
    </header>
  );
}

// ─── Bottom navigation pill + FAB ─────────────────────────────────────────────
function NavBar({ active = "Hub", mode = "desktop", showFab = true }) {
  const baseTabs = [
    { id: "Hub",       icon: <I.hub /> },
    { id: "Garden",    icon: <I.garden /> },
    { id: "Community", icon: <I.community /> },
    { id: "Actions",   icon: <I.actions /> },
  ];
  // On mobile, profile moves into the navbar (per spec)
  const tabs = mode === "mobile"
    ? [...baseTabs, { id: "Profile", icon: <I.user /> }]
    : baseTabs;
  return (
    <div className={`navbar-wrap ${mode === "mobile" ? "navbar-wrap-mobile" : ""}`}>
      <nav className={`navbar ${mode === "mobile" ? "navbar-mobile" : ""}`}>
        {tabs.map((t) => (
          <button key={t.id} className={`navbtn ${t.id === active ? "is-active" : ""}`}>
            <span className="navbtn-icon">{t.icon}</span>
            <span className="navbtn-label">{t.id}</span>
          </button>
        ))}
      </nav>
      {showFab && (
        <button className={`fab ${mode === "mobile" ? "fab-mobile" : ""}`} aria-label="New Work">
          <I.plus />
          {mode === "mobile" && <span className="fab-label">New</span>}
        </button>
      )}
    </div>
  );
}

// ─── Status-dot pipeline indicator (Review → Assess → Certify) ───────────────
function PipelineDots({ stage = 1, flagged = false }) {
  // stage: 1 = in review, 2 = approved/assessing, 3 = certifying, 4 = certified
  const dots = [1, 2, 3, 4];
  return (
    <span className="pipe" aria-label={`Pipeline stage ${stage} of 4`}>
      {dots.map((d) => {
        let cls = "pipe-dot";
        if (flagged && d === stage) cls += " is-flagged";
        else if (d < stage) cls += " is-done";
        else if (d === stage) cls += " is-current";
        return <span key={d} className={cls} />;
      })}
    </span>
  );
}

// ─── Category badge (icon prefix) ────────────────────────────────────────────
const CAT = {
  Agro:    { icon: <I.leaf /> },
  Waste:   { icon: <I.recycle /> },
  Solar:   { icon: <I.sun /> },
  Water:   { icon: <I.droplet /> },
  Habitat: { icon: <I.leaf /> },
};
function CategoryBadge({ kind = "Agro", onPhoto = true, compact = false }) {
  return (
    <span className={`cat-badge ${onPhoto ? "on-photo" : "inline"} ${compact ? "compact" : ""}`}>
      {CAT[kind].icon}<span>{kind}</span>
    </span>
  );
}

// ─── Photo collage (1–4 images; counter is opt-in via showCount prop) ───────
function PhotoCollage({ images, count, total, showCount = false }) {
  // images: array of urls, length 1–4
  const layout = images.length === 1 ? "one" : images.length === 2 ? "two" : "three";
  return (
    <div className={`collage collage-${layout}`}>
      {images.slice(0, 3).map((src, i) => (
        <div key={i} className="collage-tile" style={{ backgroundImage: `url(${src})` }} />
      ))}
      {showCount && <span className="collage-counter">{count} / {total}</span>}
    </div>
  );
}

// ─── Status tag — per-tab status vocab ─────────────────────────────────────
// Review:  pending | approved | rejected
// Assess:  draft   | published | evaluated
// Certify: draft   | published | certified
function StatusTag({ status }) {
  const cfg = STATUS[status] || STATUS.pending;
  return (
    <span className={`status-tag status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{cfg.label}</span>
    </span>
  );
}
const STATUS = {
  pending:    { label: "Pending" },
  approved:   { label: "Approved" },
  rejected:   { label: "Rejected" },
  draft:      { label: "Draft" },
  published:  { label: "Published" },
  evaluated:  { label: "Evaluated" },
  certified:  { label: "Certified" },
};

// Status options per tab (canonical order)
const TAB_STATUSES = {
  review:  ["pending", "approved", "rejected"],
  assess:  ["draft", "published", "evaluated"],
  certify: ["draft", "published", "certified"],
  history: [],
};

// ─── Sample data ─────────────────────────────────────────────────────────────
const PHOTOS = {
  saplings: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=70",
  hands:    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop&q=70",
  rows:     "https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?w=800&auto=format&fit=crop&q=70",
  compost:  "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&auto=format&fit=crop&q=70",
  bins:     "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=70",
  workshop: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=70",
  solarA:   "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&auto=format&fit=crop&q=70",
  solarB:   "https://images.unsplash.com/photo-1534710961216-75c88202f43e?w=800&auto=format&fit=crop&q=70",
  beds:     "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&auto=format&fit=crop&q=70",
  bedsB:    "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=800&auto=format&fit=crop&q=70",
  herbs:    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop&q=70",
  potted:   "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=800&auto=format&fit=crop&q=70",
  rain:     "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&auto=format&fit=crop&q=70",
  swale:    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=70",
  pollin:   "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&auto=format&fit=crop&q=70",
  meadow:   "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&auto=format&fit=crop&q=70",
};

const WORK = [
  { id: "w1", title: "Planted 50 native saplings", cat: "Agro",
    author: "Maria Garcia", garden: "Milpa Alta",
    state: "ok", age: "2h ago",
    review: "pending",  assess: "draft",     certify: "draft",
    images: [PHOTOS.saplings, PHOTOS.hands, PHOTOS.rows], count: 1, total: 3 },
  { id: "w2", title: "Composting workshop completed", cat: "Waste",
    author: "Juan Perez", garden: "Xochimilco",
    state: "ok", age: "3h ago",
    review: "approved", assess: "published", certify: "draft",
    images: [PHOTOS.compost, PHOTOS.bins], count: 1, total: 2 },
  { id: "w3", title: "Installed 2 solar panels", cat: "Solar",
    author: "Ana Lopez", garden: "Milpa Alta",
    state: "ok", age: "1d ago",
    review: "approved", assess: "evaluated", certify: "published",
    images: [PHOTOS.solarA, PHOTOS.solarB], count: 1, total: 2 },
  { id: "w4", title: "Built 3 raised garden beds", cat: "Agro",
    author: "Carlos Mendez", garden: "Milpa Alta",
    state: "ok", age: "2d ago",
    review: "approved", assess: "published", certify: "draft",
    images: [PHOTOS.beds, PHOTOS.bedsB], count: 1, total: 2 },
  { id: "w5", title: "Planted herbs in containers", cat: "Agro",
    author: "Diego Flores", garden: "Xochimilco",
    state: "warn", age: "5h ago",
    review: "pending",  assess: "draft",     certify: "draft",
    images: [PHOTOS.herbs, PHOTOS.potted], count: 1, total: 2 },
  { id: "w6", title: "Rainwater catchment installed", cat: "Water",
    author: "Sofia Reyes", garden: "Tepoztlán",
    state: "ok", age: "6h ago",
    review: "pending",  assess: "draft",     certify: "draft",
    images: [PHOTOS.rain, PHOTOS.swale], count: 1, total: 2 },
  { id: "w7", title: "Pollinator strip seeded", cat: "Habitat",
    author: "Luis Hernández", garden: "Milpa Alta",
    state: "flag", age: "1d ago",
    review: "rejected", assess: "draft",     certify: "draft",
    images: [PHOTOS.pollin, PHOTOS.meadow], count: 1, total: 2 },
  { id: "w8", title: "Greywater filter assembled", cat: "Water",
    author: "Marta Vega", garden: "Xochimilco",
    state: "ok", age: "4h ago",
    review: "approved", assess: "evaluated", certify: "certified",
    images: [PHOTOS.swale, PHOTOS.rain], count: 1, total: 2 },
];

window.HubAtoms = {
  AppBar, NavBar, PipelineDots, CategoryBadge, PhotoCollage, StatusTag,
  I, WORK, PHOTOS, STATUS, TAB_STATUSES,
};
