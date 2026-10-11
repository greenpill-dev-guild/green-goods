import Link from "@docusaurus/Link";
import {useLocation} from "@docusaurus/router";
import stewardPath from "@site/src/data/steward-path.json";

import styles from "./styles.module.css";

// The path lives in data so each steward page's Markdown twin prints the same links
// (docs/scripts/llms.mjs).
const STEWARD_PATH_ITEMS = stewardPath as {label: string; href: string}[];

export function StewardPathNav() {
  const {pathname} = useLocation();

  return (
    <nav className={styles.pathNav} aria-label="Steward guide path">
      <span className={styles.pathNavLabel}>Steward path</span>
      <ol className={styles.pathNavList}>
        {STEWARD_PATH_ITEMS.map((item, index) => {
          const active = pathname === item.href;

          return (
            <li className={styles.pathNavItem} key={item.href}>
              <Link
                className={styles.pathNavLink}
                data-active={active ? "true" : undefined}
                to={item.href}
              >
                <span className={styles.pathNavIndex}>{index + 1}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
