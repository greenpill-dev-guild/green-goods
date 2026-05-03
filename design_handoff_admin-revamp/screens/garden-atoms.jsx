/* global React, HubAtoms */
const { I: GI } = HubAtoms;

// ─── Garden-specific icons ──────────────────────────────────────────────
const GIcons = {
  edit: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  ),
  external: (p) => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m5 13 4 4L20 6"/>
    </svg>
  ),
  more: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/>
    </svg>
  ),
  members: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/>
      <path d="M3 20a6 6 0 0 1 12 0"/><path d="M14 20a4 4 0 0 1 7 0"/>
    </svg>
  ),
  overview: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  ),
  settings: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>
    </svg>
  ),
  vault: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>
      <path d="M12 9v.01M12 15v.01M9 12h.01M15 12h.01"/>
    </svg>
  ),
  heart: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z"/>
    </svg>
  ),
  award: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="9" r="6"/><path d="m9 14-2 7 5-3 5 3-2-7"/>
    </svg>
  ),
  vote: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 11 11 13 15 9"/><rect x="3" y="3" width="18" height="14" rx="2"/>
      <path d="M7 21h10"/>
    </svg>
  ),
  arrowRight: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
    </svg>
  ),
  pinMap: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>
    </svg>
  ),
  send: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/>
    </svg>
  ),
  warn: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.41 0Z"/>
      <path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
};

// ─── Garden Avatar (initials block, deterministic warm tint) ───────────
function GardenAvatar({ name = "RR", size = 40 }) {
  return (
    <span className="g-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/>
      </svg>
    </span>
  );
}

// ─── Member avatar (initials, deterministic) ───────────────────────────
const AVATAR_TONES = [
  { bg: "#E8DFD0", fg: "#5A4A2E" },
  { bg: "#D8E4D0", fg: "#345C28" },
  { bg: "#E0D8E8", fg: "#4A3C5A" },
  { bg: "#E8D8D0", fg: "#5C3828" },
  { bg: "#D0DEE4", fg: "#284A5C" },
  { bg: "#E4DCC8", fg: "#5A4824" },
];
function MemberAvatar({ name = "AB", id = 0, size = 32 }) {
  const tone = AVATAR_TONES[id % AVATAR_TONES.length];
  const initials = name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <span className="m-avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, background: tone.bg, color: tone.fg }}
      data-tone-idx={id % AVATAR_TONES.length}>
      {initials}
    </span>
  );
}

// ─── Role chip ─────────────────────────────────────────────────────────
function RoleChip({ role }) {
  return <span className={`role-chip role-${role.toLowerCase()}`}>{role}</span>;
}

// ─── Visibility chip (Public · Unlisted · Archived) ────────────────────
function VisibilityChip({ value = "Public" }) {
  return <span className={`vis-chip vis-${value.toLowerCase()}`}>{value}</span>;
}

// ─── Numeric strip cell ────────────────────────────────────────────────
function NumStrip({ items }) {
  return (
    <ul className="num-strip">
      {items.map((it, i) => (
        <li key={i} className="num-strip-item">
          <span className="num-strip-value">{it.value}</span>
          <span className="num-strip-label">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Sparkline (12-week, hand-rolled) ──────────────────────────────────
function Sparkline({ values, width = 100, height = 28, stroke = "currentColor" }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = `0,${height} ${pts.join(" ")} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <polygon points={fillPts} fill="currentColor" opacity="0.10" />
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Vote-tally bar (For / Against / Abstain) ──────────────────────────
function TallyBar({ forV = 0, againstV = 0, abstainV = 0, height = 6 }) {
  const total = forV + againstV + abstainV || 1;
  return (
    <span className="tally-bar" style={{ height }}>
      <span className="tally-for"     style={{ width: `${(forV/total)*100}%` }} />
      <span className="tally-against" style={{ width: `${(againstV/total)*100}%` }} />
      <span className="tally-abstain" style={{ width: `${(abstainV/total)*100}%` }} />
    </span>
  );
}

// ─── Sample garden data ────────────────────────────────────────────────
const GARDEN = {
  name: "Rio Rainforest Lab",
  ens: "rio-rainforest.eth",
  location: "Manaus, Brazil",
  founded: "Mar 2024",
  visibility: "Public",
  count: 23,
  openWork: 12,
  pool: "$4.8k",
  hypercertCount: 47,
  proposalsOpen: 3,
  season: "Wet season · Cycle 04",
  daysIntoCycle: 42,
  nextAssessment: "in 14 days",
  lastDistribution: "Apr 1, 2026",
  domains: ["Agro", "Habitat", "Water"],
  description:
    "A community of practice restoring degraded riverine forest through agroforestry, native seed banking, and pollinator corridor design.",
  treasuryWallet: "0xa3c8…d471",
};

const MEMBERS = [
  { id: 1, name: "Maria Garcia",  ens: "mariagarcia.eth", role: "Operator", active: "today",  work: 47, joined: "Mar 2024" },
  { id: 2, name: "Juan Perez",    ens: "juan.eth",        role: "Operator", active: "today",  work: 52, joined: "Mar 2024" },
  { id: 3, name: "Sofia Reyes",   ens: "sofia-r.eth",     role: "Reviewer", active: "1d ago", work: 28, joined: "Apr 2024" },
  { id: 4, name: "Ana Lopez",     ens: "ana.eth",         role: "Gardener", active: "today",  work: 19, joined: "May 2024" },
  { id: 5, name: "Carlos Mendez", ens: "cmendez.eth",     role: "Gardener", active: "2d ago", work: 14, joined: "Jun 2024" },
  { id: 6, name: "Luis Hernandez",ens: "luis-h.eth",      role: "Gardener", active: "3d ago", work: 11, joined: "Jul 2024" },
  { id: 7, name: "Marta Vega",    ens: "martavega.eth",   role: "Reviewer", active: "1w ago", work: 22, joined: "Aug 2024" },
  { id: 8, name: "Diego Flores",  ens: "diego.eth",       role: "Gardener", active: "today",  work: 9,  joined: "Sep 2024" },
];

const ROLE_DIST = { Operator: 4, Reviewer: 2, Gardener: 23, Pending: 1 };

const PENDING_INVITES = [
  { ens: "0xea…41bc",       sentBy: "Maria Garcia",  sent: "2d ago",  role: "Reviewer" },
  { ens: "lucia.eth",       sentBy: "Juan Perez",    sent: "5d ago",  role: "Gardener" },
];

const ACTIVITY = [
  { who: "Ana Lopez",      what: "submitted Work · pollinator strip",          when: "20m ago",  type: "work",     tone: "neutral" },
  { who: "Sofia Reyes",    what: "joined as Reviewer",                          when: "2h ago",   type: "member",   tone: "neutral" },
  { who: "Maria Garcia",   what: "published proposal · Q2 distribution split", when: "8h ago",   type: "proposal", tone: "info" },
  { who: "Juan Perez",     what: "minted hypercert · 0x4a…f23c",                when: "1d ago",   type: "hypercert",tone: "green" },
  { who: "Treasury",       what: "executed Q1 distribution · 8.2 ETH",          when: "3d ago",   type: "distribution", tone: "green" },
];

const SUPPORTERS = [
  { ens: "kestrel.eth",  amount: "0.42 ETH", lifetime: "1.2 ETH", last: "2h ago" },
  { ens: "alma.eth",     amount: "0.20 ETH", lifetime: "0.6 ETH", last: "8h ago" },
  { ens: "0xbf…2914",    amount: "0.05 ETH", lifetime: "0.05 ETH",last: "1d ago" },
  { ens: "wolf.eth",     amount: "0.18 ETH", lifetime: "0.94 ETH",last: "2d ago" },
  { ens: "haru.eth",     amount: "0.10 ETH", lifetime: "0.30 ETH",last: "3d ago" },
  { ens: "0x73…c12a",    amount: "0.08 ETH", lifetime: "0.08 ETH",last: "4d ago" },
];

const TREASURY_TOKENS = [
  { token: "ETH",  balance: "12.4",   usd: "$38,400", delta: "+1.8 ETH (30d)", spark: [4,8,10,12,15,18,16,14,16,18,20,22] },
  { token: "USDC", balance: "1,840",  usd: "$1,840",  delta: "+240 (30d)",     spark: [10,12,11,13,14,15,14,16,18,20,19,21] },
  { token: "GG",   balance: "62k",    usd: "$3,200",  delta: "+4k (30d)",      spark: [20,24,28,32,30,32,36,40,44,48,52,56] },
];

const DISTRIBUTIONS = [
  { date: "Apr 1, 2026",  amount: "8.2 ETH",  recipient: "23 gardeners",      proposal: "GG-021" },
  { date: "Mar 1, 2026",  amount: "1,200 USDC", recipient: "Operator stipend", proposal: "GG-019" },
  { date: "Feb 1, 2026",  amount: "6.4 ETH",  recipient: "23 gardeners",      proposal: "GG-018" },
  { date: "Jan 1, 2026",  amount: "920 USDC", recipient: "Seed bank pool",    proposal: "GG-014" },
];

const PROPOSAL_DRAFTS = [
  { id: "GG-024", title: "Q2 distribution split · 60/30/10",           updated: "1h ago",  status: "Ready" },
  { id: "GG-025", title: "Rotate Reviewer seat · Sofia → community",   updated: "2d ago",  status: "Draft" },
  { id: "GG-026", title: "Open seed-bank pool to external supporters", updated: "1w ago",  status: "Draft" },
];

const SETTINGS_BLOCKS = [
  {
    group: "Identity",
    rows: [
      { label: "Garden name",     value: "Rio Rainforest Lab",                      editable: true },
      { label: "Description",     value: "A community of practice restoring degraded riverine forest…", editable: true, muted: true },
      { label: "Avatar / emoji",  value: "🌿  Leaf glyph",                          editable: true },
    ],
  },
  {
    group: "Domain",
    rows: [
      { label: "ENS domain",      value: "rio-rainforest.eth",  mono: true,  editable: true, sub: "8 subdomains issued · Manage" },
    ],
  },
  {
    group: "Location",
    rows: [
      { label: "Coordinates",     value: "−3.1190, −60.0217",   mono: true,  editable: true },
      { label: "Region tag",      value: "Amazonas · Brazil",                  editable: true },
    ],
  },
  {
    group: "Visibility",
    rows: [
      { label: "Visibility",      value: "Public",   editable: true,
        sub: "Public — discoverable, anyone can support · Unlisted — link-only · Archived — read-only" },
    ],
  },
  {
    group: "Action catalog",
    rows: [
      { label: "Action templates", value: "Agro · Habitat · Water",    editable: true, sub: "Browse all in /actions →" },
      { label: "Review threshold", value: "2 of 3 reviewers",           editable: true },
      { label: "Assessment cadence", value: "Quarterly",                editable: true },
    ],
  },
];

window.GardenAtoms = {
  GIcons, GardenAvatar, MemberAvatar, RoleChip, VisibilityChip, NumStrip, Sparkline, TallyBar,
  GARDEN, MEMBERS, ROLE_DIST, PENDING_INVITES, ACTIVITY, SUPPORTERS, TREASURY_TOKENS,
  DISTRIBUTIONS, PROPOSAL_DRAFTS, SETTINGS_BLOCKS,
};
