// Shared types for the hi-fi prototype artifact modules.

export type Surface = "client" | "admin" | "public" | "community";
export type FrameKind = "phone" | "desktop" | "browser" | "ascii";

// Metadata for one registered hotspot (a tappable control on a screen).
// `to` targets: "screen:W2" | "screen:W2@disputed" | "sb5:0".
export type HotMeta = { l: string; to?: string; info?: string };

export type ScreenState = {
  id: string; // kebab id, e.g. "disputed"; first state in the list is the default
  label: string; // chip label in the state switcher
  proposed?: boolean; // amber "proposed" tag (still-open MF descendants)
  html: string; // pre-rendered screen body (device inner HTML)
};

export type Screen = {
  id: string; // "W2"
  title: string;
  surface: Surface;
  frame: FrameKind;
  group: string; // Screens-tab group heading
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
  st?: string;
  ev: string;
  cite?: string;
  note?: string;
  br?: { l: string; to?: string }[];
  mf?: boolean;
};
export type ShippedSB = {
  id: string;
  n: number;
  title: string;
  persona: string;
  scen: string;
  surface: string;
  steps: ShippedStep[];
};
