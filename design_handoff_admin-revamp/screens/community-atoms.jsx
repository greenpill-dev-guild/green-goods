/* global React, HubAtoms, GardenAtoms */
const { I: CI } = HubAtoms;
const { GIcons: CGIcons } = GardenAtoms;

// ─── Community-specific icons ──────────────────────────────────────────
const CIcons = {
  message: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>
    </svg>
  ),
  trophy: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/>
      <path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3"/>
    </svg>
  ),
  sparkle: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6 8.4 8.4M15.6 15.6l2.8 2.8M5.6 18.4 8.4 15.6M15.6 8.4l2.8-2.8"/>
    </svg>
  ),
  flagPole: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 21V4M5 4l11 3-3 3 3 3-11 0"/>
    </svg>
  ),
  calendar: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
    </svg>
  ),
  external: (p) => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>
    </svg>
  ),
};

// ─── Activity feed events (mixed types, chronological) ─────────────────
const COMMUNITY_EVENTS = [
  // Today
  { day: "Today", date: "May 2",
    items: [
      { type: "work", who: "Ana Lopez", whoId: 4, when: "20m ago",
        title: "Pollinator strip · 6 m²", cat: "Habitat",
        photos: [
          "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=600&auto=format&fit=crop&q=70",
          "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=70",
          "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&auto=format&fit=crop&q=70",
        ],
        photoCount: 6, comments: 2 },
      { type: "discussion", title: "How are folks tracking sapling survival rates?",
        author: "Sofia Reyes", authorId: 3, when: "2h ago",
        comments: 14, lastReplier: "Maria Garcia", lastReplierId: 1, lastWhen: "12m ago" },
      { type: "proposal-decided", id: "GG-021", title: "Q1 distribution split · 60/30/10",
        decision: "Passed", when: "8h ago",
        forV: 18, againstV: 3, abstainV: 2 },
    ] },
  // Yesterday
  { day: "Yesterday", date: "May 1",
    items: [
      { type: "milestone", title: "1,000 saplings planted this cycle", sub: "Habitat domain · cumulative", when: "10:14",
        meta: "Cycle 04 milestone" },
      { type: "work", who: "Carlos Mendez", whoId: 5, when: "16:42",
        title: "Compost bay #3 turned", cat: "Waste",
        photos: [
          "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=70",
          "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop&q=70",
        ],
        photoCount: 2, comments: 0 },
      { type: "proposal-decided", id: "GG-020", title: "Reviewer rotation · Sofia → Marta",
        decision: "Tied", when: "14:08",
        forV: 11, againstV: 11, abstainV: 1 },
      { type: "work", who: "Diego Flores", whoId: 8, when: "09:30",
        title: "Rainwater catchment cleaned · 200 L tank", cat: "Water",
        photos: [
          "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600&auto=format&fit=crop&q=70",
        ],
        photoCount: 1, comments: 1 },
    ] },
  // Apr 30
  { day: "Apr 30", date: "Apr 30",
    items: [
      { type: "discussion", title: "Native seeds — bulk source for next cycle?",
        author: "Marta Vega", authorId: 7, when: "Apr 30 · 13:20",
        comments: 7, lastReplier: "Juan Perez", lastReplierId: 2, lastWhen: "1d ago" },
      { type: "proposal-decided", id: "GG-019", title: "Operator stipend · $1,200 USDC",
        decision: "Rejected", when: "Apr 30 · 11:00",
        forV: 6, againstV: 14, abstainV: 3 },
      { type: "milestone", title: "100 unique supporters reached", sub: "Treasury · all-time", when: "Apr 30 · 08:00",
        meta: "Lifetime supporters" },
    ] },
  // Apr 28
  { day: "Apr 28", date: "Apr 28",
    items: [
      { type: "work", who: "Luis Hernandez", whoId: 6, when: "Apr 28 · 17:11",
        title: "Greywater filter assembled", cat: "Water",
        photos: [
          "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=70",
          "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600&auto=format&fit=crop&q=70",
        ],
        photoCount: 4, comments: 3 },
    ] },
];

// ─── Top contributors (avatar stack) ───────────────────────────────────
const TOP_CONTRIBUTORS = [
  { name: "Maria Garcia", id: 1 },
  { name: "Ana Lopez",    id: 4 },
  { name: "Juan Perez",   id: 2 },
];

// ─── Community proposals ───────────────────────────────────────────────
const PROPOSALS = [
  { id: "GG-022", title: "Open seed-bank pool to external supporters",
    summary: "Allow anyone with an ENS to contribute to a dedicated seed-bank line, separate from main treasury.",
    status: "Voting", creator: "Maria Garcia", creatorId: 1,
    forV: 14, againstV: 4, abstainV: 1, totalEligible: 23,
    timeRemaining: "2d 4h", comments: 11,
    fromTreasuryDraft: true },
  { id: "GG-023", title: "Q2 distribution split · 60 / 30 / 10",
    summary: "60% to gardeners by hypercert weight, 30% to operator stipend, 10% to seed-bank reserve.",
    status: "Voting", creator: "Juan Perez", creatorId: 2,
    forV: 9, againstV: 2, abstainV: 0, totalEligible: 23,
    timeRemaining: "5d 12h", comments: 6,
    fromTreasuryDraft: true },
  { id: "GG-024", title: "Add Solar domain to action catalog",
    summary: "Solar panel installs are happening informally — formalize as a fourth domain alongside Agro / Habitat / Water.",
    status: "Drafting", creator: "Sofia Reyes", creatorId: 3,
    forV: 0, againstV: 0, abstainV: 0, totalEligible: 23,
    timeRemaining: null, comments: 4,
    fromTreasuryDraft: false },
  { id: "GG-025", title: "Quarterly assessment cadence → monthly",
    summary: "Move from quarterly to monthly community assessment cycles. Reduces lag between work and recognition.",
    status: "Drafting", creator: "Ana Lopez", creatorId: 4,
    forV: 0, againstV: 0, abstainV: 0, totalEligible: 23,
    timeRemaining: null, comments: 2,
    fromTreasuryDraft: false },
  { id: "GG-021", title: "Q1 distribution split · 60 / 30 / 10",
    summary: "Final tally — passed with 18 for, 3 against, 2 abstain.",
    status: "Closed", creator: "Maria Garcia", creatorId: 1,
    forV: 18, againstV: 3, abstainV: 2, totalEligible: 23,
    timeRemaining: "Closed 8h ago", comments: 22,
    decision: "Passed", fromTreasuryDraft: true },
  { id: "GG-020", title: "Reviewer rotation · Sofia → Marta",
    summary: "Tied at 11–11 — proposal returns to drafting per garden bylaws.",
    status: "Closed", creator: "Maria Garcia", creatorId: 1,
    forV: 11, againstV: 11, abstainV: 1, totalEligible: 23,
    timeRemaining: "Closed 1d ago", comments: 18,
    decision: "Tied", fromTreasuryDraft: true },
];

// ─── Community people (different lens than Garden Members) ─────────────
// Same underlying people viewed by engagement angle.
const COMMUNITY_PEOPLE = [
  { id: 1,  name: "Maria Garcia",    ens: "mariagarcia.eth",  kind: "Gardener",
    workCount: 47, votesCast: 21, discussions: 4, supportedUSD: null,
    lastActive: "today" },
  { id: 2,  name: "Juan Perez",      ens: "juan.eth",         kind: "Gardener",
    workCount: 52, votesCast: 23, discussions: 6, supportedUSD: null,
    lastActive: "today" },
  { id: 3,  name: "Sofia Reyes",     ens: "sofia-r.eth",      kind: "Gardener",
    workCount: 28, votesCast: 19, discussions: 8, supportedUSD: null,
    lastActive: "1d ago" },
  { id: 4,  name: "Ana Lopez",       ens: "ana.eth",          kind: "Gardener",
    workCount: 19, votesCast: 17, discussions: 3, supportedUSD: null,
    lastActive: "today" },
  { id: 9,  name: "kestrel",         ens: "kestrel.eth",      kind: "Supporter",
    workCount: 0, votesCast: 0, discussions: 1, supportedUSD: 1240,
    lastActive: "2h ago" },
  { id: 10, name: "alma",            ens: "alma.eth",         kind: "Supporter",
    workCount: 0, votesCast: 0, discussions: 0, supportedUSD: 620,
    lastActive: "8h ago" },
  { id: 11, name: "wolf",            ens: "wolf.eth",         kind: "Supporter",
    workCount: 0, votesCast: 0, discussions: 2, supportedUSD: 940,
    lastActive: "2d ago" },
  { id: 12, name: "haru",            ens: "haru.eth",         kind: "Supporter",
    workCount: 0, votesCast: 0, discussions: 0, supportedUSD: 300,
    lastActive: "3d ago" },
  { id: 13, name: "Pedro Alvarez",   ens: "pedro.eth",        kind: "Contributor",
    workCount: 4, votesCast: 0, discussions: 2, supportedUSD: 80,
    lastActive: "today" },
  { id: 14, name: "Camila Souza",    ens: "camila.eth",       kind: "Contributor",
    workCount: 6, votesCast: 0, discussions: 5, supportedUSD: null,
    lastActive: "1d ago" },
  { id: 15, name: "Ines Moreira",    ens: "ines.eth",         kind: "Contributor",
    workCount: 3, votesCast: 0, discussions: 1, supportedUSD: 50,
    lastActive: "4d ago" },
];

const PEOPLE_BREAKDOWN = {
  total: 212,
  gardeners: 23,
  supporters: 142,
  contributors: 47,
  topThisCycle: 8,
};

// ─── Header strip · Activity ────────────────────────────────────────────
const ACTIVITY_HEADER = {
  proposalsOpen: 2,           // chip 2: status
  proposalsDrafting: 2,
  milestonesThisMonth: 3,
};

window.CommunityAtoms = {
  CIcons,
  COMMUNITY_EVENTS, TOP_CONTRIBUTORS, ACTIVITY_HEADER,
  PROPOSALS, COMMUNITY_PEOPLE, PEOPLE_BREAKDOWN,
};
