import type {ReactNode} from "react";
import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type Pathway = {
  title: string;
  href: string;
  body: string;
  cta: string;
  progress: string;
  popularStart: string;
};

const pathways: Pathway[] = [
  {
    title: "Gardener",
    href: "/gardener/get-started",
    body: "Document work in the field, submit with MDR, and track approvals and attestations.",
    cta: "Start gardener path",
    progress: "5 pages",
    popularStart: "Most started: Submit Work with MDR",
  },
  {
    title: "Operator",
    href: "/operator/get-started-and-roles",
    body: "Manage gardens, review work, run assessments, and operate treasury and governance tools.",
    cta: "Start operator path",
    progress: "11 pages",
    popularStart: "Most started: Review Work",
  },
  {
    title: "Evaluator",
    href: "/evaluator/get-started",
    body: "Query indexer and EAS data, verify attestation chains, and export analysis-ready datasets.",
    cta: "Start evaluator path",
    progress: "7 pages",
    popularStart: "Most started: Query EAS",
  },
  {
    title: "Developers",
    href: "/developers/getting-started",
    body: "Use architecture, patterns, integrations, and operations docs to build and ship safely.",
    cta: "Open developer hub",
    progress: "5 core guides",
    popularStart: "Most started: Developer Getting Started",
  },
];

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className={styles.heading}>
          Explore Your Path
        </Heading>
        <p className={styles.subhead}>
          Choose a role, start with the most-used entrypoint, and follow a guided journey.
        </p>
        <div className={styles.grid}>
          {pathways.map((pathway, index) => (
            <article key={pathway.title} className={styles.card} style={{animationDelay: `${index * 80}ms`}}>
              <header className={styles.cardHeader}>
                <Heading as="h3" className={styles.cardTitle}>
                  {pathway.title}
                </Heading>
                <span className={styles.progressBadge}>{pathway.progress}</span>
              </header>
              <p className={styles.cardBody}>{pathway.body}</p>
              <p className={styles.popularStart}>{pathway.popularStart}</p>
              <Link className={styles.cardLink} to={pathway.href}>
                {pathway.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
