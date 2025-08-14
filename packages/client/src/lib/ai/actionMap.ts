export const ACTION_SYNONYMS = {
  planting: [
    "planting",
    "plant",
    "sowing",
    "siembra",
    "sembrar",
    "planté",
    "plantei",
    "plantio",
    "plantar",
  ],
  invasive_removal: [
    "weeding",
    "invasive removal",
    "remove invasives",
    "desyerbar",
    "quitar malezas",
    "remoção de invasoras",
    "capina",
  ],
  watering: ["watering", "regar", "riego", "regando", "regar plantas"],
  litter_cleanup: [
    "cleanup",
    "trash pickup",
    "litter",
    "limpieza de basura",
    "limpeza de lixo",
    "coleta de lixo",
  ],
  harvesting: ["harvest", "cosecha", "cosechar", "colheita", "colher"],
} as const;

export const normalizeAction = (utterance: string): keyof typeof ACTION_SYNONYMS | null => {
  const u = utterance.toLowerCase();
  for (const [k, vals] of Object.entries(ACTION_SYNONYMS)) {
    if (vals.some((v) => u.includes(v))) return k as any;
  }
  return null;
};
