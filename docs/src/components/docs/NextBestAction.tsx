import Link from "@docusaurus/Link";
import {RiArrowRightLine} from "@remixicon/react";
import styles from "./styles.module.css";

type NextBestActionProps = {
  title: string;
  why: string;
  actionLabel: string;
  actionHref: string;
  alternatives?: Array<{label: string; href: string}>;
  markerLabel?: string;
};

export function NextBestAction({
  title,
  why,
  actionLabel,
  actionHref,
  alternatives = [],
  markerLabel = "Next page",
}: NextBestActionProps) {
  return (
    <section className={styles.nextAction} aria-label={markerLabel}>
      <p className={styles.nextActionMarker}>{markerLabel}</p>
      <h2 className={styles.nextActionTitle}>{title}</h2>
      <p className={styles.nextActionWhy}>{why}</p>
      <Link to={actionHref} className={styles.nextActionPrimary}>
        <span>{actionLabel}</span>
        <RiArrowRightLine aria-hidden="true" />
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
