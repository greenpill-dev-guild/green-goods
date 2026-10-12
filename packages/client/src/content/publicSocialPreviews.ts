export const PUBLIC_SOCIAL_PREVIEW_ORIGIN = "https://www.greengoods.app";

export const PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS = [
  "home",
  "fund",
  "impact",
  "actions",
  "gardens",
  "cookies",
] as const;

export type PublicSocialPreviewRouteKey = (typeof PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS)[number];

export interface PublicSocialPreview {
  key: PublicSocialPreviewRouteKey;
  path: string;
  title: string;
  description: string;
  cardTitle: string;
  cardTitleAccent?: string;
  cardTitleLines?: readonly string[];
  cardLede: string;
  cardLedeLines?: readonly string[];
  heroImagePath: string;
  socialImagePath: string;
  socialImageAlt: string;
  canonicalUrl: string;
  socialImageUrl: string;
}

interface PublicSocialPreviewInput {
  path: string;
  title: string;
  description: string;
  cardTitle: string;
  cardTitleAccent?: string;
  cardTitleLines?: readonly string[];
  cardLede: string;
  cardLedeLines?: readonly string[];
  heroImagePath: string;
  socialImagePath?: string;
  socialImageAlt: string;
}

function absoluteUrl(path: string): string {
  return `${PUBLIC_SOCIAL_PREVIEW_ORIGIN}${path}`;
}

function definePreview(
  key: PublicSocialPreviewRouteKey,
  input: PublicSocialPreviewInput
): PublicSocialPreview {
  const socialImagePath = input.socialImagePath ?? `/social/${key}.png`;

  return {
    key,
    ...input,
    socialImagePath,
    canonicalUrl: absoluteUrl(input.path),
    socialImageUrl: absoluteUrl(socialImagePath),
  };
}

export const publicSocialPreviews = {
  home: definePreview("home", {
    path: "/",
    title: "Green Goods",
    description:
      "Green Goods helps community projects document environmental work, have it reviewed by local stewards, and connect with funding.",
    cardTitle: "From good intentions to green outcomes",
    cardTitleAccent: "good",
    cardLede: "Document community work, review it locally, and help fund what comes next.",
    heroImagePath: "/images/hero-home.webp",
    socialImagePath: "/social-home-hero.png",
    socialImageAlt: "Green Goods editorial homepage social preview",
  }),
  fund: definePreview("fund", {
    path: "/fund",
    title: "Fund | Green Goods",
    description:
      "Support community-led environmental work through donations or longer-term endowments.",
    cardTitle: "A small gesture, growing over many seasons",
    cardTitleAccent: "growing",
    cardTitleLines: ["A small gesture,", "growing over", "many seasons"],
    cardLede:
      "Choose a Garden whose work you want to support. Donate to its shared fund, or explore a longer-term endowment. Read its approved work before contributing.",
    cardLedeLines: [
      "Choose a Garden whose work you want to support.",
      "Donate to its shared fund, or explore a longer-term",
      "endowment. Read its approved work before contributing.",
    ],
    heroImagePath: "/images/hero-fund.webp",
    socialImageAlt: "Green Goods Fund route social preview",
  }),
  impact: definePreview("impact", {
    path: "/impact",
    title: "Impact | Green Goods",
    description:
      "Explore work approved by Garden stewards and the assessments supporting its claims.",
    cardTitle: "See how Garden work becomes evidence",
    cardTitleAccent: "evidence",
    cardTitleLines: ["See how Garden", "work becomes", "evidence"],
    cardLede:
      "See the work communities have done and the evidence behind it. Local stewards review submissions, and assessments help explain what changed.",
    cardLedeLines: [
      "See the work communities have done and the evidence",
      "behind it. Local stewards review submissions, and",
      "assessments help explain what changed.",
    ],
    heroImagePath: "/images/hero-impact.webp",
    socialImageAlt: "Green Goods Impact route social preview",
  }),
  actions: definePreview("actions", {
    path: "/actions",
    title: "Actions | Green Goods",
    description:
      "Browse the templates Gardens use to document Work across solar, agroforestry, education, and waste.",
    cardTitle: "A field guide for regenerative work",
    cardTitleAccent: "regenerative work",
    cardTitleLines: ["A field guide for", "regenerative", "work"],
    cardLede:
      "Actions are the templates Gardens use to document Work across solar, agroforestry, education, and waste. Each one names what to do, what to capture, and what proof comes next.",
    cardLedeLines: [
      "Actions are the templates Gardens use to document",
      "Work across solar, agroforestry, education, and waste.",
      "Each one names what to do, what to capture, and",
      "what proof comes next.",
    ],
    heroImagePath: "/images/hero-actions.webp",
    socialImageAlt: "Green Goods Actions route social preview",
  }),
  gardens: definePreview("gardens", {
    path: "/gardens",
    title: "Gardens | Green Goods",
    description:
      "Explore community-led projects working on land restoration, waste, education, and clean energy.",
    cardTitle: "Explore the Gardens growing the public record",
    cardTitleAccent: "Gardens",
    cardTitleLines: ["Explore the", "Gardens growing", "the public record"],
    cardLede:
      "Explore community-led projects working on land restoration, waste, education, and clean energy. Meet the people behind each Garden and discover how to support their work.",
    cardLedeLines: [
      "Explore community-led projects working on land",
      "restoration, waste, education, and clean energy.",
      "Meet the people behind each Garden and discover",
      "how to support their work.",
    ],
    heroImagePath: "/images/hero-garden.webp",
    socialImageAlt: "Green Goods Gardens route social preview",
  }),
  cookies: definePreview("cookies", {
    path: "/cookies",
    title: "Cookie Jars | Green Goods",
    description:
      "Shared cookie jars hold funds for seasonal work, event rewards, and Garden cohort budgets.",
    cardTitle: "Shared cookie jars for seasonal campaign work",
    cardTitleAccent: "cookie jars",
    cardTitleLines: ["Shared cookie jars", "for seasonal", "campaign work"],
    cardLede:
      "Campaign jars hold funds for seasonal work, event rewards, and Garden cohort budgets. Connect a wallet to claim from jars on your allowlist, or add funds to keep the jar full.",
    cardLedeLines: [
      "Campaign jars hold funds for seasonal work, event",
      "rewards, and Garden cohort budgets. Connect a",
      "wallet to claim from jars on your allowlist, or add funds",
      "to keep the jar full.",
    ],
    heroImagePath: "/images/hero-cookie.webp",
    socialImageAlt: "Green Goods Cookie Jars route social preview",
  }),
} as const satisfies Record<PublicSocialPreviewRouteKey, PublicSocialPreview>;

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const normalized = pathOnly.replace(/\/+$/, "");
  return normalized || "/";
}

export function resolvePublicSocialPreview(pathname: string): PublicSocialPreview {
  const normalized = normalizePathname(pathname);

  if (normalized === "/") return publicSocialPreviews.home;
  if (normalized === "/fund") return publicSocialPreviews.fund;
  if (normalized === "/impact") return publicSocialPreviews.impact;
  if (normalized === "/actions") return publicSocialPreviews.actions;
  if (normalized === "/cookies") return publicSocialPreviews.cookies;
  if (normalized === "/gardens" || normalized.startsWith("/gardens/")) {
    return publicSocialPreviews.gardens;
  }

  return publicSocialPreviews.home;
}
