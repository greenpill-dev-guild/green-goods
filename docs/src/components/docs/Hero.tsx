import {
  RiHammerLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiWallet3Line,
} from "@remixicon/react";
import rolePaths from "@site/src/data/role-paths.json";

import {RolePathCard, type RoleAccent} from "./RolePathCard";
import styles from "./styles.module.css";

// The role list lives in data so the welcome page's Markdown twin prints the same links
// (docs/scripts/llms.mjs).
const ROLE_ICONS = {
  seedling: RiSeedlingLine,
  shield: RiShieldCheckLine,
  wallet: RiWallet3Line,
  hammer: RiHammerLine,
} as const;

type RolePath = {
  title: string;
  href: string;
  icon: keyof typeof ROLE_ICONS;
  roleAccent: RoleAccent;
  audience: string;
  time: string;
  description: string;
};

const ROLE_PATHS = rolePaths as RolePath[];

export function Hero() {
  return (
    <section className={styles.hero} aria-label="Documentation overview">
      <h1 className={styles.heroHeading}>Green Goods Documentation</h1>
      <p className={styles.heroSubtitle}>
        Document, verify, and fund regenerative work on-chain
      </p>

      <div className={styles.heroRoleGrid} role="list">
        {ROLE_PATHS.map((role, i) => {
          const Icon = ROLE_ICONS[role.icon];

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
