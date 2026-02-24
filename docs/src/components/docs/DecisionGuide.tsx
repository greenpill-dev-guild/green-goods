import styles from "./styles.module.css";

type DecisionItem = {
  when: string;
  do: string;
  next: string;
};

type DecisionGuideProps = {
  title: string;
  items: DecisionItem[];
};

export function DecisionGuide({title, items}: DecisionGuideProps) {
  return (
    <section className={styles.decisionGuide}>
      <h2 className={styles.decisionTitle}>{title}</h2>
      <div className={styles.decisionRows}>
        {items.map((item, index) => (
          <article key={`${item.when}-${index}`} className={styles.decisionRow}>
            <p><strong>If:</strong> {item.when}</p>
            <p><strong>Do:</strong> {item.do}</p>
            <p><strong>Then:</strong> {item.next}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
