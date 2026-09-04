import { RiAlertLine, RiDeleteBinLine, RiRefreshLine, RiSeedlingLine } from "@remixicon/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AdminButton } from "@/components/AdminButton";

/**
 * The boot surfaces render before any provider exists — no IntlProvider, no
 * query client, no wallet — so their copy is resolved from the browser
 * language against this small table instead of the locale catalogs.
 */
type BootLocale = "en" | "es" | "pt";

const BOOT_COPY: Record<
  BootLocale,
  {
    loading: string;
    failedTitle: string;
    failedBody: string;
    reload: string;
    reset: string;
    details: string;
  }
> = {
  en: {
    loading: "Loading Green Goods Admin…",
    failedTitle: "Green Goods Admin could not start",
    failedBody:
      "Something failed before the workspace could open. Reload to try again, or clear the cached data if a reload does not help.",
    reload: "Reload",
    reset: "Clear Cached Data and Reload",
    details: "Technical details",
  },
  es: {
    loading: "Cargando Green Goods Admin…",
    failedTitle: "Green Goods Admin no pudo iniciarse",
    failedBody:
      "Algo falló antes de que el espacio de trabajo pudiera abrirse. Recarga para intentarlo de nuevo o borra los datos en caché si recargar no ayuda.",
    reload: "Recargar",
    reset: "Borrar datos en caché y recargar",
    details: "Detalles técnicos",
  },
  pt: {
    loading: "Carregando o Green Goods Admin…",
    failedTitle: "O Green Goods Admin não conseguiu iniciar",
    failedBody:
      "Algo falhou antes de o espaço de trabalho abrir. Recarregue para tentar de novo ou limpe os dados em cache se recarregar não ajudar.",
    reload: "Recarregar",
    reset: "Limpar dados em cache e recarregar",
    details: "Detalhes técnicos",
  },
};

function resolveBootLocale(language?: string | null): BootLocale {
  const tag = (language ?? "").toLowerCase();
  if (tag.startsWith("es")) return "es";
  if (tag.startsWith("pt")) return "pt";
  return "en";
}

function bootCopy() {
  return BOOT_COPY[
    resolveBootLocale(typeof navigator !== "undefined" ? navigator.language : undefined)
  ];
}

/** Layout that stands even when the stylesheet failed to arrive. */
const SHELL_STYLE = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  textAlign: "center",
} as const;

/** The first frame: mounted synchronously before any optional service starts. */
export function BootShell() {
  const copy = bootCopy();
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-bg-weak px-6 text-center"
      style={SHELL_STYLE}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-component="AdminBootShell"
    >
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-bg-white shadow-[var(--edge-rest),_var(--m3-elevation-1)]">
        <RiSeedlingLine className="h-7 w-7 text-text-sub" aria-hidden />
      </div>
      <p className="mt-5 text-sm text-text-sub">{copy.loading}</p>
    </div>
  );
}

export interface BootRecoveryProps {
  error: unknown;
  onReload: () => void;
  onReset: () => void;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** The actionable failure state: what happened, reload, and a cache reset. */
export function BootRecovery({ error, onReload, onReset }: BootRecoveryProps) {
  const copy = bootCopy();
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-bg-weak px-6 text-center"
      style={SHELL_STYLE}
      role="alert"
      data-component="AdminBootRecovery"
      data-state="failed"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-lighter">
        <RiAlertLine className="h-7 w-7 text-warning-dark" aria-hidden />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-text-strong">{copy.failedTitle}</h1>
      <p className="mb-6 mt-2 max-w-sm text-sm text-text-sub">{copy.failedBody}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <AdminButton
          type="button"
          variant="filled"
          leadingIcon={<RiRefreshLine />}
          onClick={onReload}
        >
          {copy.reload}
        </AdminButton>
        <AdminButton
          type="button"
          variant="outlined"
          leadingIcon={<RiDeleteBinLine />}
          onClick={onReset}
        >
          {copy.reset}
        </AdminButton>
      </div>
      <details className="mt-6 max-w-lg text-left text-xs text-text-sub">
        <summary className="cursor-pointer">{copy.details}</summary>
        <pre
          className="mt-2 whitespace-pre-wrap break-words rounded-[var(--m3-shape-sm)] bg-bg-white p-3"
          data-testid="admin-boot-error"
        >
          {describeError(error)}
        </pre>
      </details>
    </div>
  );
}

export interface BootErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

/**
 * The outermost boundary. The application tree carries its own boundary
 * inside the query provider; this one catches a provider itself throwing
 * during the first render, which no inner boundary can see.
 */
export class BootErrorBoundary extends Component<BootErrorBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}
