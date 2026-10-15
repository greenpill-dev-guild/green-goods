import Link from "@docusaurus/Link";
import DocItemPaginator from "@theme/DocItem/Paginator";
import {NextActionContext} from "./NextActionContext";
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
    <section className={styles.nextAction} aria-label={title}>
      <p className={styles.nextActionWhy}>{why}</p>
      <NextActionContext.Provider value={{title: actionLabel, permalink: actionHref}}>
        <DocItemPaginator />
      </NextActionContext.Provider>
      {alternatives.length ? (
        <ul className={styles.nextActionAlternatives} aria-label="Related guides">
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
