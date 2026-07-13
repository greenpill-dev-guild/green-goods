export function ReviewLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-[rgb(var(--m3-outline-variant))] py-3 last:border-b-0">
      <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">{label}</p>
      <p className="mt-1 break-words text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
        {value}
      </p>
    </div>
  );
}
