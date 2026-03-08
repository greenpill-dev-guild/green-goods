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
    href: "/community/gardener-guide/joining-a-garden",
    body: "Document regenerative work in the field, submit with the MDR workflow, and track your approvals and attestations.",
    cta: "Start gardener path",
    progress: "5 pages",
    popularStart: "Most started: Uploading Your Work",
  },
  {
    title: "Operator",
    href: "/community/operator-guide/creating-a-garden",
    body: "Create and manage gardens, review work submissions, run assessments, and operate endowment and governance tools.",
    cta: "Start operator path",
    progress: "9 pages",
    popularStart: "Most started: Reviewing Work",
  },
  {
    title: "Evaluator",
    href: "/community/evaluator-guide/joining-a-garden",
    body: "Join garden communities, make assessments, verify impact claims, and create on-chain impact certificates.",
    cta: "Start evaluator path",
    progress: "4 pages",
    popularStart: "Most started: Making Assessments",
  },
  {
    title: "Builders",
    href: "/builders/getting-started",
    body: "Set up your dev environment, explore the architecture, and contribute to the Green Goods open-source codebase.",
    cta: "Open builder hub",
    progress: "8 sections",
    popularStart: "Most started: Getting Started",
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
