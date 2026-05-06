import {
  RiHammerLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiWallet3Line,
} from "@remixicon/react";
import {RolePathCard} from "./RolePathCard";
import styles from "./styles.module.css";

const ROLE_PATHS = [
  {
    title: "Gardener",
    href: "/community/gardener-guide/",
    icon: RiSeedlingLine,
    roleAccent: "gardener",
    audience: "Field workers",
    time: "5 min quickstart",
    description:
      "Document regenerative work in the field with photos and structured evidence capture.",
  },
  {
    title: "Operator",
    href: "/community/operator-guide/",
    icon: RiShieldCheckLine,
    roleAccent: "operator",
    audience: "Garden managers",
    time: "15 min operator setup",
    description:
      "Create and manage your garden community, approve work, and configure actions.",
  },
  {
    title: "Funder",
    href: "/community/funder-guide/",
    icon: RiWallet3Line,
    roleAccent: "funder",
    audience: "Capital allocators",
    time: "10 min first deposit",
    description:
      "Support garden operations through vault deposits and keep withdrawal controls close at hand.",
  },
  {
    title: "Builder",
    href: "/builders/getting-started",
    icon: RiHammerLine,
    roleAccent: "builder",
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
        {ROLE_PATHS.map((role, i) => {
          const Icon = role.icon;

          return (
            <div
              key={role.title}
              className={styles.heroRoleItem}
              style={{"--card-delay": `${i * 80}ms`} as React.CSSProperties}
              role="listitem"
            >
              <RolePathCard
                title={role.title}
                href={role.href}
                icon={<Icon />}
                roleAccent={role.roleAccent}
                audience={role.audience}
                time={role.time}
                description={role.description}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
