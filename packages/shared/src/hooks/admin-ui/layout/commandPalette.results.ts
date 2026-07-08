import { type Action, type Garden, type UserRole, adminRoutes } from "@green-goods/shared";
import { RiSettings3Line, RiUserLine } from "@remixicon/react";
import type { ComponentType } from "react";
import type { IntlShape } from "react-intl";

export interface SearchResult {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  actionId?: "open-profile-sheet" | "open-settings-sheet";
  icon?: ComponentType<{ className?: string }>;
  category: "quick-actions" | "pages" | "gardens" | "actions" | "assessments";
  subtitle?: string;
  /** Match score — higher is a better fuzzy match. Used for ranking. */
  score?: number;
}

interface StaticCommandRoute {
  id: string;
  labelId: string;
  defaultLabel: string;
  href: string;
  roles?: UserRole[];
}

interface AssessmentCommandItem {
  id: string;
  gardenAddress: string;
  title?: string | null;
}

interface BuildCommandPaletteResultsOptions {
  query: string;
  role: UserRole;
  formatMessage: IntlShape["formatMessage"];
  staticRoutes: StaticCommandRoute[];
  eligibleGardens: Garden[];
  actions: Action[];
  assessments: AssessmentCommandItem[];
}

/**
 * Lightweight subsequence-based fuzzy match.
 * Returns a positive score when all query chars appear in order in text,
 * biased toward consecutive matches and matches near the start.
 * Returns 0 when the query doesn't match.
 */
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let qi = 0;
  let lastMatchIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Consecutive match bonus; proximity-to-start bonus
      const consecutive = lastMatchIdx === ti - 1 ? 5 : 0;
      const head = ti < 4 ? 3 - ti : 0;
      score += 1 + consecutive + head;
      lastMatchIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

export function buildCommandPaletteResults({
  query,
  role,
  formatMessage,
  staticRoutes,
  eligibleGardens,
  actions,
  assessments,
}: BuildCommandPaletteResultsOptions): SearchResult[] {
  const rawQuery = query.trim();
  const hasQuery = rawQuery.length > 0;
  const items: SearchResult[] = [];

  const pushIfMatches = (item: Omit<SearchResult, "score">, haystacks: string[]) => {
    if (!hasQuery) {
      items.push(item);
      return;
    }
    const score = haystacks.reduce((max, hay) => Math.max(max, fuzzyScore(rawQuery, hay)), 0);
    if (score > 0) items.push({ ...item, score });
  };

  const quickActions: Array<{
    id: string;
    label: string;
    href?: string;
    actionId?: SearchResult["actionId"];
    icon?: ComponentType<{ className?: string }>;
    roles: UserRole[];
  }> = [
    {
      id: "quick-pending-reviews",
      label: formatMessage({
        id: "app.admin.nav.quickAction.pendingReviews",
        defaultMessage: "Go to Pending Reviews",
      }),
      href: adminRoutes.hubWork(),
      roles: ["deployer", "operator"],
    },
    {
      id: "quick-create-garden",
      label: formatMessage({
        id: "app.admin.nav.quickAction.createGarden",
        defaultMessage: "Create Garden",
      }),
      href: adminRoutes.gardenCreate(),
      roles: ["deployer"],
    },
    {
      id: "open-profile-sheet",
      label: formatMessage({
        id: "cockpit.nav.profile",
        defaultMessage: "Profile",
      }),
      actionId: "open-profile-sheet",
      icon: RiUserLine,
      roles: ["deployer", "operator", "user"],
    },
    {
      id: "open-settings-sheet",
      label: formatMessage({
        id: "cockpit.settings.title",
        defaultMessage: "Settings",
      }),
      actionId: "open-settings-sheet",
      icon: RiSettings3Line,
      roles: ["deployer", "operator", "user"],
    },
  ];

  for (const quickAction of quickActions) {
    if (!quickAction.roles.includes(role)) continue;
    pushIfMatches(
      {
        id: quickAction.id,
        label: quickAction.label,
        href: quickAction.href,
        actionId: quickAction.actionId,
        icon: quickAction.icon,
        category: "quick-actions",
      },
      [quickAction.label]
    );
  }

  for (const route of staticRoutes) {
    if (route.roles && !route.roles.includes(role)) continue;
    const label = formatMessage({ id: route.labelId, defaultMessage: route.defaultLabel });
    pushIfMatches({ id: route.id, label, href: route.href, category: "pages" }, [label]);
  }

  for (const garden of eligibleGardens) {
    pushIfMatches(
      {
        id: `garden-${garden.id}`,
        label: garden.name,
        href: adminRoutes.garden({ gardenId: garden.id }),
        category: "gardens",
        subtitle: garden.location || undefined,
      },
      [garden.name, garden.location ?? ""]
    );
  }

  if (role === "deployer") {
    for (const action of actions) {
      pushIfMatches(
        {
          id: `action-${action.id}`,
          label: action.title,
          href: adminRoutes.actionDetail(action.id),
          category: "actions",
          subtitle: action.startTime
            ? new Date(action.startTime * 1000).toLocaleDateString()
            : undefined,
        },
        [action.title]
      );
    }
  }

  for (const assessment of assessments) {
    const title = assessment.title || `Assessment ${assessment.id.slice(0, 8)}`;
    const matchedGarden = eligibleGardens.find(
      (garden) =>
        (garden.tokenAddress ?? garden.id).toLowerCase() === assessment.gardenAddress.toLowerCase()
    );
    if (!matchedGarden) continue;

    const gardenName = matchedGarden.name;
    pushIfMatches(
      {
        id: `assessment-${assessment.id}`,
        label: title,
        href: adminRoutes.gardenImpact({
          gardenId: matchedGarden.id,
          section: "assessments",
          item: assessment.id,
        }),
        category: "assessments",
        subtitle: gardenName,
      },
      [title, gardenName, assessment.gardenAddress]
    );
  }

  if (hasQuery) {
    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  return items;
}
