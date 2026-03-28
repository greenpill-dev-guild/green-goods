import { cn } from "../../../utils/styles/cn";

export interface VaultPositionCardProps {
  gardenName: string;
  deposited: string;
  currentValue: string;
  apy: string;
  tokenSymbol?: string;
}

interface StatRowProps {
  label: string;
  value: string;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-soft">{label}</span>
      <span className="text-sm text-text-strong">{value}</span>
    </div>
  );
}

export function VaultPositionCard({
  gardenName,
  deposited,
  currentValue,
  apy,
  tokenSymbol,
}: VaultPositionCardProps) {
  const depositLabel = tokenSymbol ? `${deposited} ${tokenSymbol}` : deposited;
  const valueLabel = tokenSymbol ? `${currentValue} ${tokenSymbol}` : currentValue;

  return (
    <div className={cn("rounded-xl border border-stroke-soft bg-bg-white p-4")}>
      <p className="text-sm font-medium text-text-strong truncate" title={gardenName}>
        {gardenName}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <StatRow label="Deposited" value={depositLabel} />
        <StatRow label="Current Value" value={valueLabel} />
        <StatRow label="APY" value={apy} />
      </div>
    </div>
  );
}
