import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

type NextBestActionProps = {
  title: string;
  why: string;
  actionLabel: string;
  actionHref: string;
  alternatives?: Array<{label: string; href: string}>;
};

export function NextBestAction({
  title,
  why,
  actionLabel,
  actionHref,
  alternatives = [],
}: NextBestActionProps) {
  return (
    <section className={styles.nextAction}>
      <h2 className={styles.nextActionTitle}>{title}</h2>
      <p className={styles.nextActionWhy}>{why}</p>
      <Link to={actionHref} className={styles.nextActionPrimary}>
        {actionLabel}
      </Link>
      {alternatives.length ? (
        <ul className={styles.nextActionAlternatives}>
          {alternatives.map((item) => (
            <li key={`${item.label}-${item.href}`}>
              <Link to={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
