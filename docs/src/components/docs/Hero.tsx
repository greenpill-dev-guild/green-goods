import {
  RiClipboardLine,
  RiHammerLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiWallet3Line,
} from "@remixicon/react";
import rolePaths from "@site/src/data/role-paths.json";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

// The role list lives in data so the welcome page's Markdown twin prints the same links
// (docs/scripts/llms.mjs).
const ROLE_ICONS = {
  seedling: RiSeedlingLine,
  shield: RiShieldCheckLine,
  clipboard: RiClipboardLine,
  wallet: RiWallet3Line,
  hammer: RiHammerLine,
} as const;

type RolePath = {
  title: string;
  href: string;
  icon: keyof typeof ROLE_ICONS;
  description: string;
};

const ROLE_PATHS = rolePaths as RolePath[];

export function Hero() {
  return (
    <nav aria-label="Choose your guide">
      <ul className={styles.heroRoleGrid}>
        {ROLE_PATHS.map((role) => {
          const Icon = ROLE_ICONS[role.icon];

          return (
            <li key={role.title}>
              <Link className={styles.heroRoleLink} to={role.href}>
                <Icon className={styles.heroRoleIcon} aria-hidden="true" />
                <span>
                  <strong>{role.title}</strong>
                  <span className={styles.heroRoleDescription}>{role.description}</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
