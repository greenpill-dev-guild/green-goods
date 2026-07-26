// Shared types for the hi-fi prototype artifact modules.

export type Surface = "client" | "admin" | "editorial" | "community";
export type FrameKind = "phone" | "desktop" | "browser" | "ascii";

// The guided-flow tabs. Single source of truth: the build generates the tablist
// from this, the player switches panels by the id attribute, and ReviewGroup is
// derived — so a group cannot exist as a tab without a type, or vice versa.
// A flow homes to the surface where its actor acts; consequences landing on
// another surface stay inline as `echo` scenes rather than splitting hairs.
export const FLOW_GROUPS = [
  { id: "client", label: "Client PWA" },
  { id: "admin", label: "Admin console" },
  { id: "editorial", label: "Editorial website" },
] as const;
export type ReviewGroup = (typeof FLOW_GROUPS)[number]["id"];

// Scene surface tokens (what the stagebar pill renders). `pwa` is the client
// dialect's own word for itself and predates the group ids; keeping it avoids
// churning every journey for no reviewer-visible gain.
export const SCENE_SURFACES = ["pwa", "admin", "editorial", "community", "safe"] as const;
export type SceneSurface = (typeof SCENE_SURFACES)[number];

// Which scene surface a flow is "at home" on, by group.
export const HOME_SURFACE: Record<ReviewGroup, SceneSurface> = {
  client: "pwa",
  admin: "admin",
  editorial: "editorial",
};

// Metadata for one registered hotspot (a tappable control on a screen).
// `to` targets: "screen:W2" | "screen:W2@disputed" | "sb5:0".
export type HotMeta = { l: string; to?: string; info?: string };

export type ScreenState = {
  id: string; // kebab id, e.g. "disputed"; first state in the list is the default
  label: string; // chip label in the state switcher
  proposed?: boolean; // amber tag reserved for genuinely unlocked review states
  html: string; // pre-rendered screen body (device inner HTML)
};

export type Screen = {
  id: string; // "W2"
  title: string;
  surface: Surface;
  frame: FrameKind;
  group: string; // Screens-tab group heading
  reviewVisible: boolean; // shown in the presentation catalog; direct hashes stay valid either way
  states: ScreenState[];
};

// The flat hotspot registry: id → meta. Ids are namespaced by screen
// ("w2.confirm" for hi-fi, "W2.h0" for legacy-derived ascii hotspots).
export type HotRegistry = Record<string, HotMeta>;

// Per-screen resolution tables for legacy match-string journey steps.
export type ResolveTables = {
  hotByString: Record<string, Record<string, string>>; // screen → matchString → hid
  markByString: Record<string, Record<string, string>>; // screen → matchString → mark id (or hid when identical)
};

// Normalized (shipped) journey shapes — what PLAYER_DATA carries.
export type ShippedStep = {
  f: string; // screen id
  v: string; // state id
  hot?: { h: string; l: string } | null;
  alts?: { h: string; l: string; to: string }[];
  marks?: string[]; // registered mark/hotspot ids
  who?: string;
  surface?: string;
  // The same moment landing on another surface — drawn in "Meanwhile" chrome so
  // a reviewer never mistakes a consequence for part of the flow they are in.
  echo?: boolean;
  st?: string;
  ev: string;
  cite?: string;
  note?: string;
  skipTargetReason?: string; // audited exception when a canonical hotspot destination is not the next scene
  br?: { l: string; to: string }[];
  mf?: boolean;
};
// `scen` (internal scenario codes) and the flow-level `surface` prose stay in
// the authoring data only: the first must never reach rendered copy, and the
// second is now derived from reviewGroup via HOME_SURFACE.
export type ShippedSB = {
  id: string;
  n: number;
  title: string;
  persona: string;
  reviewVisible: boolean;
  reviewGroup: ReviewGroup;
  steps: ShippedStep[];
};
