/* global React, HubAtoms */
const { I: AI } = HubAtoms;

// ─── Actions-specific icons ─────────────────────────────────────────────────
const AIcons = {
  // Category glyphs (20px, for card icon slot)
  agro: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/>
    </svg>
  ),
  waste: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  ),
  solar: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    </svg>
  ),
  water: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/>
    </svg>
  ),
  habitat: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
      <path d="M9 22V12h6v10"/>
    </svg>
  ),
  education: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  // UI actions
  close: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  chevDown: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  chevRight: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  ),
  grip: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>
      <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
      <circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>
    </svg>
  ),
  trash: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
    </svg>
  ),
  photo: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
    </svg>
  ),
  text: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 7V5h16v2M9 5v14M15 5v14M9 12h6"/>
    </svg>
  ),
  number: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>
    </svg>
  ),
  location: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>
    </svg>
  ),
  calendar: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
    </svg>
  ),
  select: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6"/>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  ),
  history: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m5 13 4 4L20 6"/>
    </svg>
  ),
  publish: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  ),
  link: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
};

// ─── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = {
  Agro:      { icon: AIcons.agro,      tint: "#16A34A", tintSoft: "rgba(22,163,74,0.10)",  tintDark: "rgba(74,222,128,0.16)" },
  Waste:     { icon: AIcons.waste,     tint: "#D97706", tintSoft: "rgba(217,119,6,0.10)",  tintDark: "rgba(251,191,36,0.16)" },
  Solar:     { icon: AIcons.solar,     tint: "#CA8A04", tintSoft: "rgba(202,138,4,0.10)",  tintDark: "rgba(250,204,21,0.14)" },
  Water:     { icon: AIcons.water,     tint: "#0284C7", tintSoft: "rgba(2,132,199,0.10)",  tintDark: "rgba(56,189,248,0.16)" },
  Habitat:   { icon: AIcons.habitat,   tint: "#059669", tintSoft: "rgba(5,150,105,0.10)",  tintDark: "rgba(52,211,153,0.16)" },
  Education: { icon: AIcons.education, tint: "#7C3AED", tintSoft: "rgba(124,58,237,0.10)", tintDark: "rgba(167,139,250,0.16)" },
};

// ─── Status config ───────────────────────────────────────────────────────────
const STATUSES = {
  Active:     { color: "#1A7544", colorDark: "#2DD27A", label: "Active",     edgeLight: "#1A7544", edgeDark: "#2DD27A" },
  Draft:      { color: "#D97706", colorDark: "#F59E0B", label: "Draft",      edgeLight: "#D97706", edgeDark: "#F59E0B" },
  Deprecated: { color: "#78716C", colorDark: "#A8A29E", label: "Deprecated", edgeLight: "#78716C", edgeDark: "#A8A29E" },
};

// ─── Template data ───────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "t01", name: "Plant native saplings",
    cat: "Agro", status: "Active",
    desc: "Record planting of native tree or shrub saplings, with species, count, and geo-tagged location.",
    uses: 47, gardens: 12, lastUsed: "3d ago",
    created: "Jan 14 2025", edited: "Apr 22 2026", version: "v3",
    fields: [
      { type: "text",     label: "Species name",     required: true  },
      { type: "number",   label: "Count planted",    required: true  },
      { type: "location", label: "Planting location", required: true  },
      { type: "photo",    label: "Before photos",    required: true  },
      { type: "photo",    label: "After photos",     required: false },
      { type: "text",     label: "Notes",            required: false },
    ],
    evidence: { photoMin: 2, photoMax: 6, videoAllowed: false, locationRequired: true, narrativeMin: 50 },
    impact: [
      { dim: "CO₂ sequestered",     unit: "kg / year",  rule: "0.5 kg per sapling" },
      { dim: "sq meters restored",  unit: "m²",         rule: "1 m² per sapling" },
    ],
    recentSubmissions: [
      { who: "Maria Garcia", id: 1, garden: "Milpa Alta", when: "3d ago" },
      { who: "Ana Lopez",    id: 4, garden: "Xochimilco", when: "1w ago" },
    ],
  },
  {
    id: "t02", name: "Composting workshop",
    cat: "Waste", status: "Active",
    desc: "Document a community composting session including attendee count, materials processed, and output weight.",
    uses: 31, gardens: 8, lastUsed: "1w ago",
    created: "Feb 3 2025", edited: "Mar 11 2026", version: "v2",
    fields: [
      { type: "number",   label: "Attendees",         required: true  },
      { type: "number",   label: "Materials in (kg)", required: true  },
      { type: "number",   label: "Compost out (kg)",  required: false },
      { type: "photo",    label: "Session photos",    required: true  },
      { type: "text",     label: "Topics covered",    required: true  },
    ],
    evidence: { photoMin: 1, photoMax: 4, videoAllowed: true, locationRequired: false, narrativeMin: 80 },
    impact: [
      { dim: "Waste diverted",      unit: "kg",  rule: "Materials in weight" },
      { dim: "Hours of education",  unit: "hrs", rule: "Session duration × attendees" },
    ],
    recentSubmissions: [
      { who: "Juan Perez",    id: 2, garden: "Xochimilco", when: "1w ago" },
      { who: "Sofia Reyes",   id: 3, garden: "Tepoztlán",  when: "2w ago" },
    ],
  },
  {
    id: "t03", name: "Install solar panels",
    cat: "Solar", status: "Active",
    desc: "Document solar panel installation — panel count, wattage, installer credentials, and roof or ground mount.",
    uses: 18, gardens: 5, lastUsed: "2w ago",
    created: "Mar 20 2025", edited: "Apr 1 2026", version: "v2",
    fields: [
      { type: "number",   label: "Panel count",       required: true  },
      { type: "number",   label: "Total wattage (W)", required: true  },
      { type: "select",   label: "Mount type",        required: true  },
      { type: "location", label: "Install location",  required: true  },
      { type: "photo",    label: "Installation proof", required: true },
    ],
    evidence: { photoMin: 3, photoMax: 8, videoAllowed: false, locationRequired: true, narrativeMin: 100 },
    impact: [
      { dim: "CO₂ offset",          unit: "kg / year", rule: "0.85 kg per kWh" },
      { dim: "kWh generated",       unit: "kWh / yr",  rule: "Wattage × 4 peak-sun-hours × 365" },
    ],
    recentSubmissions: [
      { who: "Ana Lopez",   id: 4, garden: "Milpa Alta", when: "2w ago" },
    ],
  },
  {
    id: "t04", name: "Rainwater catchment",
    cat: "Water", status: "Active",
    desc: "Record installation or maintenance of a rainwater collection system, with tank capacity and connection details.",
    uses: 22, gardens: 7, lastUsed: "5d ago",
    created: "Jan 30 2025", edited: "Mar 28 2026", version: "v3",
    fields: [
      { type: "number",   label: "Tank capacity (L)", required: true  },
      { type: "select",   label: "System type",       required: true  },
      { type: "location", label: "Location",          required: true  },
      { type: "photo",    label: "System photos",     required: true  },
      { type: "text",     label: "Maintenance notes", required: false },
    ],
    evidence: { photoMin: 2, photoMax: 6, videoAllowed: false, locationRequired: true, narrativeMin: 40 },
    impact: [
      { dim: "Water harvested",     unit: "L / year", rule: "Catchment area × rainfall × 0.85" },
    ],
    recentSubmissions: [
      { who: "Diego Flores", id: 8, garden: "Milpa Alta",  when: "5d ago" },
      { who: "Marta Vega",   id: 7, garden: "Xochimilco",  when: "1w ago" },
    ],
  },
  {
    id: "t05", name: "Pollinator strip seeding",
    cat: "Habitat", status: "Active",
    desc: "Document seeding of a pollinator corridor or strip — species mix, area covered, and local wildlife observations.",
    uses: 14, gardens: 6, lastUsed: "4d ago",
    created: "Apr 5 2025", edited: "Apr 29 2026", version: "v1",
    fields: [
      { type: "number",   label: "Area (m²)",         required: true  },
      { type: "text",     label: "Seed mix used",     required: true  },
      { type: "photo",    label: "Before",            required: true  },
      { type: "photo",    label: "After (30d+)",      required: false },
      { type: "text",     label: "Wildlife observed", required: false },
    ],
    evidence: { photoMin: 1, photoMax: 4, videoAllowed: false, locationRequired: true, narrativeMin: 60 },
    impact: [
      { dim: "sq meters restored",  unit: "m²", rule: "Reported area" },
    ],
    recentSubmissions: [
      { who: "Luis Hernández", id: 6, garden: "Milpa Alta",  when: "4d ago" },
      { who: "Ana Lopez",      id: 4, garden: "Tepoztlán",   when: "10d ago" },
    ],
  },
  {
    id: "t06", name: "Community garden workshop",
    cat: "Education", status: "Active",
    desc: "Log an educational session held at the garden — topic, duration, attendees, and learning outcomes.",
    uses: 9, gardens: 4, lastUsed: "1w ago",
    created: "May 12 2025", edited: "Apr 15 2026", version: "v1",
    fields: [
      { type: "text",     label: "Workshop topic",    required: true  },
      { type: "number",   label: "Attendees",         required: true  },
      { type: "number",   label: "Duration (min)",    required: true  },
      { type: "date",     label: "Date held",         required: true  },
      { type: "photo",    label: "Session photos",    required: true  },
      { type: "text",     label: "Learning outcomes", required: false },
    ],
    evidence: { photoMin: 1, photoMax: 4, videoAllowed: true, locationRequired: false, narrativeMin: 100 },
    impact: [
      { dim: "Hours of education",  unit: "hrs", rule: "Duration × attendees / 60" },
    ],
    recentSubmissions: [
      { who: "Sofia Reyes",  id: 3, garden: "Xochimilco", when: "1w ago" },
    ],
  },
  {
    id: "t07", name: "Greywater filter install",
    cat: "Water", status: "Draft",
    desc: "Document installation of a greywater filtration or recycling system, including capacity and outlet use.",
    uses: 3, gardens: 2, lastUsed: "3w ago",
    created: "Mar 1 2026", edited: "Apr 30 2026", version: "v1",
    fields: [
      { type: "number",   label: "Capacity (L/day)", required: true  },
      { type: "select",   label: "Filter type",      required: true  },
      { type: "photo",    label: "Before photos",    required: true  },
      { type: "photo",    label: "After photos",     required: true  },
    ],
    evidence: { photoMin: 2, photoMax: 6, videoAllowed: false, locationRequired: true, narrativeMin: 50 },
    impact: [
      { dim: "Water recycled",      unit: "L / day", rule: "System capacity" },
    ],
    recentSubmissions: [
      { who: "Marta Vega", id: 7, garden: "Xochimilco", when: "3w ago" },
    ],
  },
  {
    id: "t08", name: "Raised bed construction",
    cat: "Agro", status: "Active",
    desc: "Record construction of raised garden beds including dimensions, materials, and soil composition.",
    uses: 26, gardens: 9, lastUsed: "6d ago",
    created: "Feb 18 2025", edited: "Apr 10 2026", version: "v2",
    fields: [
      { type: "number",   label: "Bed count",         required: true  },
      { type: "number",   label: "Total area (m²)",   required: true  },
      { type: "text",     label: "Materials used",    required: true  },
      { type: "text",     label: "Soil mix",          required: false },
      { type: "photo",    label: "Construction photos", required: true },
    ],
    evidence: { photoMin: 2, photoMax: 6, videoAllowed: false, locationRequired: false, narrativeMin: 40 },
    impact: [
      { dim: "sq meters restored",  unit: "m²", rule: "Total bed area" },
    ],
    recentSubmissions: [
      { who: "Carlos Mendez", id: 5, garden: "Milpa Alta",  when: "6d ago" },
      { who: "Maria Garcia",  id: 1, garden: "Tepoztlán",   when: "2w ago" },
    ],
  },
  {
    id: "t09", name: "Vermicompost unit setup",
    cat: "Waste", status: "Draft",
    desc: "Document setup of a vermicomposting unit — worm species, bedding, initial feed materials.",
    uses: 4, gardens: 2, lastUsed: "2w ago",
    created: "Apr 2 2026", edited: "May 1 2026", version: "v1",
    fields: [
      { type: "text",     label: "Worm species",      required: true  },
      { type: "number",   label: "Unit capacity (L)", required: true  },
      { type: "photo",    label: "Setup photos",      required: true  },
    ],
    evidence: { photoMin: 2, photoMax: 4, videoAllowed: false, locationRequired: false, narrativeMin: 40 },
    impact: [
      { dim: "Waste diverted",  unit: "kg / month", rule: "Processing rate" },
    ],
    recentSubmissions: [
      { who: "Juan Perez", id: 2, garden: "Xochimilco", when: "2w ago" },
    ],
  },
  {
    id: "t10", name: "Seed bank contribution",
    cat: "Agro", status: "Active",
    desc: "Log seeds donated to the garden seed bank — species, quantity, provenance, and storage conditions.",
    uses: 11, gardens: 5, lastUsed: "1w ago",
    created: "Jun 10 2025", edited: "Feb 20 2026", version: "v2",
    fields: [
      { type: "text",     label: "Species / variety", required: true  },
      { type: "number",   label: "Seed count / grams", required: true },
      { type: "text",     label: "Provenance",        required: false },
      { type: "date",     label: "Collection date",   required: true  },
      { type: "photo",    label: "Seed packet photo", required: true  },
    ],
    evidence: { photoMin: 1, photoMax: 3, videoAllowed: false, locationRequired: false, narrativeMin: 30 },
    impact: [
      { dim: "Seed varieties conserved", unit: "varieties", rule: "Unique species contributed" },
    ],
    recentSubmissions: [
      { who: "Sofia Reyes", id: 3, garden: "Milpa Alta",  when: "1w ago" },
      { who: "Ana Lopez",   id: 4, garden: "Xochimilco",  when: "10d ago" },
    ],
  },
  {
    id: "t11", name: "Habitat log — wildlife observation",
    cat: "Habitat", status: "Deprecated",
    desc: "Replaced by Pollinator strip seeding (t05) which captures richer data. Deprecated Apr 2026.",
    uses: 7, gardens: 3, lastUsed: "2mo ago",
    created: "Sep 4 2024", edited: "Apr 1 2026", version: "v1",
    fields: [
      { type: "text",     label: "Species observed",  required: true  },
      { type: "number",   label: "Count",             required: false },
      { type: "photo",    label: "Photo evidence",    required: false },
    ],
    evidence: { photoMin: 0, photoMax: 3, videoAllowed: false, locationRequired: true, narrativeMin: 30 },
    impact: [],
    recentSubmissions: [],
  },
  {
    id: "t12", name: "Biochar production run",
    cat: "Waste", status: "Draft",
    desc: "Record a biochar production batch — input biomass, process temperature, output weight and intended soil application.",
    uses: 0, gardens: 0, lastUsed: null,
    created: "Apr 28 2026", edited: "May 2 2026", version: "v1",
    fields: [
      { type: "number",   label: "Input biomass (kg)", required: true },
      { type: "number",   label: "Process temp (°C)",  required: true },
      { type: "number",   label: "Biochar out (kg)",   required: false },
      { type: "photo",    label: "Process photos",     required: true  },
    ],
    evidence: { photoMin: 2, photoMax: 6, videoAllowed: true, locationRequired: false, narrativeMin: 60 },
    impact: [
      { dim: "CO₂ sequestered",  unit: "kg", rule: "Biochar weight × 3.67" },
      { dim: "Waste diverted",   unit: "kg", rule: "Input biomass" },
    ],
    recentSubmissions: [],
  },
];

const FIELD_ICONS = {
  text:     AIcons.text,
  number:   AIcons.number,
  photo:    AIcons.photo,
  location: AIcons.location,
  date:     AIcons.calendar,
  select:   AIcons.select,
};

const CATALOG_STATS = {
  total: 47, active: 12, drafts: 3,
};

window.ActionsAtoms = { AIcons, CATEGORIES, STATUSES, TEMPLATES, FIELD_ICONS, CATALOG_STATS };
