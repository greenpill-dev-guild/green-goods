/**
 * A setting's title in the Profile's settings list. It stays on one line, so a long
 * translation never makes its row taller than its neighbors.
 */
export function SettingTitle({ children }: { children: string }) {
  return (
    <span className="min-w-0 truncate" title={children}>
      {children}
    </span>
  );
}
