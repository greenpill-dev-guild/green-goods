import Link from "@docusaurus/Link";
import {useLocation} from "@docusaurus/router";
import styles from "./styles.module.css";

const OPERATOR_PATH_ITEMS = [
  {label: "Create a Garden", href: "/community/steward-guide/creating-a-garden"},
  {label: "Make an Assessment", href: "/community/steward-guide/making-an-assessment"},
  {label: "Review and Approve Work", href: "/community/steward-guide/reviewing-work"},
  {
    label: "Mint Impact Certificate",
    href: "/community/steward-guide/creating-impact-certificates",
  },
];

export function StewardPathNav() {
  const {pathname} = useLocation();

  return (
    <nav className={styles.pathNav} aria-label="Steward guide path">
      <span className={styles.pathNavLabel}>Steward path</span>
      <ol className={styles.pathNavList}>
        {OPERATOR_PATH_ITEMS.map((item, index) => {
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
