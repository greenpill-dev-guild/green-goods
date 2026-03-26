import {RolePathCard} from "./RolePathCard";
import styles from "./styles.module.css";

const ROLE_PATHS = [
  {
    title: "Gardener",
    href: "/community/gardener-guide/joining-a-garden",
    icon: "\uD83C\uDF31",
    audience: "Field workers",
    time: "5 min quickstart",
    description:
      "Document regenerative work in the field with photos and structured evidence capture.",
  },
  {
    title: "Operator",
    href: "/community/operator-guide/creating-a-garden",
    icon: "\u2699\uFE0F",
    audience: "Garden managers",
    time: "15 min setup",
    description:
      "Create and manage your garden community, approve work, and configure actions.",
  },
  {
    title: "Evaluator",
    href: "/community/evaluator-guide/joining-a-garden",
    icon: "\uD83D\uDCCA",
    audience: "Impact assessors",
    time: "10 min overview",
    description:
      "Verify impact claims, create assessments, and certify work into Hypercerts.",
  },
  {
    title: "Funder",
    href: "/community/funder-guide/getting-started",
    icon: "\uD83D\uDCB0",
    audience: "Capital allocators",
    time: "10 min overview",
    description:
      "Deposit into impact vaults that route harvested yield to garden funding flows, and purchase Hypercerts to fund verified impact.",
  },
  {
    title: "Community",
    href: "/community/community-member-guide/getting-involved",
    icon: "\uD83E\uDD1D",
    audience: "Community members",
    time: "5 min overview",
    description:
      "Participate in garden governance through conviction voting and signal support for regenerative work.",
  },
  {
    title: "Builder",
    href: "/builders/getting-started",
    icon: "\uD83D\uDEE0\uFE0F",
    audience: "Developers",
    time: "30 min setup",
    description:
      "Integrate with Green Goods contracts, APIs, and the shared component library.",
  },
] as const;

export function Hero() {
  return (
    <section className={styles.hero} aria-label="Documentation overview">
      <h1 className={styles.heroHeading}>Green Goods Documentation</h1>
      <p className={styles.heroSubtitle}>
        Document, verify, and fund regenerative work on-chain
      </p>

      <div className={styles.heroRoleGrid} role="list">
        {ROLE_PATHS.map((role, i) => (
          <div
            key={role.title}
            className={styles.heroRoleItem}
            style={{"--card-delay": `${i * 80}ms`} as React.CSSProperties}
            role="listitem"
          >
            <RolePathCard
              title={role.title}
              href={role.href}
              icon={role.icon}
              audience={role.audience}
              time={role.time}
              description={role.description}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
