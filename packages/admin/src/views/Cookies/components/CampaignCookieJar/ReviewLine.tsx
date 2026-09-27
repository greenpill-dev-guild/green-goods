export function ReviewLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-stroke-soft py-3 last:border-b-0">
      <p className="text-label-sm text-text-sub">{label}</p>
      <p className="mt-1 break-words text-title-sm font-semibold text-text-strong">{value}</p>
    </div>
  );
}
