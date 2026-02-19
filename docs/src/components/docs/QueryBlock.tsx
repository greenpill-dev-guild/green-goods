import styles from "./styles.module.css";

type QueryBlockProps = {
  title: string;
  endpoint: string;
  language?: string;
  query: string;
  variables?: string;
};

export function QueryBlock({title, endpoint, language = "graphql", query, variables}: QueryBlockProps) {
  return (
    <section className={styles.queryBlock}>
      <h3 className={styles.queryTitle}>{title}</h3>
      <p className={styles.queryEndpoint}>
        <strong>Endpoint:</strong> <code>{endpoint}</code>
      </p>
      <pre className={styles.queryPre}>
        <code className={`language-${language}`}>{query}</code>
      </pre>
      {variables ? (
        <>
          <p className={styles.queryVariablesLabel}>Variables</p>
          <pre className={styles.queryPre}>
            <code className="language-json">{variables}</code>
          </pre>
        </>
      ) : null}
    </section>
  );
}
