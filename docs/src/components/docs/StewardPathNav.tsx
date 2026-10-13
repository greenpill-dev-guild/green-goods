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
    <nav className={styles.pathNav} aria-label="Steward tasks">
      <span className={styles.pathNavLabel}>Steward guide</span>
      <ul className={styles.pathNavList}>
        {STEWARD_PATH_ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <li className={styles.pathNavItem} key={item.href}>
              <Link
                className={styles.pathNavLink}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
                to={item.href}
              >
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
