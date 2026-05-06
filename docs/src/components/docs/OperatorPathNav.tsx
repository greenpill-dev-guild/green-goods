import Link from "@docusaurus/Link";
import {useLocation} from "@docusaurus/router";
import styles from "./styles.module.css";

const OPERATOR_PATH_ITEMS = [
  {label: "Create a Garden", href: "/community/operator-guide/creating-a-garden"},
  {label: "Make an Assessment", href: "/community/operator-guide/making-an-assessment"},
  {label: "Review and Approve Work", href: "/community/operator-guide/reviewing-work"},
  {
    label: "Mint Impact Certificate",
    href: "/community/operator-guide/creating-impact-certificates",
  },
];

export function OperatorPathNav() {
  const {pathname} = useLocation();

  return (
    <nav className={styles.pathNav} aria-label="Operator guide path">
      <span className={styles.pathNavLabel}>Operator path</span>
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
