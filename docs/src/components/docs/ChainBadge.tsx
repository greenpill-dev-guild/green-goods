import styles from "./styles.module.css";

type ChainBadgeProps = {
  name: string;
  chainId: number;
};

export function ChainBadge({name, chainId}: ChainBadgeProps) {
  return (
    <span className={styles.chainBadge}>
      {name} <code>{chainId}</code>
    </span>
  );
}
