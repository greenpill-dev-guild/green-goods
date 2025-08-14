import { RiCloseLine, RiExternalLinkLine, RiFileCopyLine, RiWalletLine } from "@remixicon/react";
import React, { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatEther, getAddress, http, isAddress } from "viem";
import { celo } from "viem/chains";
import { cn } from "@/utils/cn";

export interface CookieJarDashboardProps {
  className?: string;
  onClose?: () => void;
  jarAddress?: string;
}

const DEFAULT_JAR = "0x4E7eBA1BF7b982f4E482d5cE082a7Dd24d12A321" as const;

export const CookieJarDashboard: React.FC<CookieJarDashboardProps> = ({
  className,
  onClose,
  jarAddress,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const address = useMemo(() => {
    const addr = (jarAddress || DEFAULT_JAR).trim();
    try {
      return getAddress(addr);
    } catch (_e) {
      return isAddress(addr) ? (addr as `0x${string}`) : DEFAULT_JAR;
    }
  }, [jarAddress]);

  useEffect(() => {
    let cancelled = false;
    const rpc = celo.rpcUrls.default.http[0];
    const client = createPublicClient({ chain: celo, transport: http(rpc) });
    client
      .getBalance({ address })
      .then((res) => {
        if (!cancelled) setBalanceWei(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load balance");
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose?.(), 300);
  };

  const balanceDisplay = useMemo(() => {
    if (balanceWei === null) return "—";
    try {
      return `${Number(formatEther(balanceWei)).toLocaleString(undefined, { maximumFractionDigits: 4 })} CELO`;
    } catch {
      return "—";
    }
  }, [balanceWei]);

  const explorerUrl = `https://celoscan.io/address/${address}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001] flex items-end justify-center",
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="cookie-jar-modal-overlay"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          "bg-white rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col",
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        style={{ height: "70vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid="cookie-jar-modal"
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 grid place-items-center">
              <RiWalletLine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">Cookie Jar</h2>
              <p className="text-sm text-slate-600 truncate">Celo • {address}</p>
            </div>
          </div>
          <button onClick={handleClose} className="btn-icon rounded-full" aria-label="Close modal">
            <RiCloseLine className="w-5 h-5 focus:text-primary active:text-primary" />
          </button>
        </div>

        <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Jar Address</h3>
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-xs break-all">
                {address}
              </code>
              <button
                className="btn-icon"
                onClick={onCopy}
                title="Copy address"
                aria-label="Copy address"
              >
                <RiFileCopyLine className="w-4 h-4" />
              </button>
              {copied && <span className="text-xs text-emerald-600">Copied!</span>}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Native Balance</h3>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-slate-50">
              <span className="text-lg font-semibold">{balanceDisplay}</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
              >
                <RiExternalLinkLine className="w-4 h-4" />
                Open on explorer
              </a>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Manage & Claim</h3>
            <p className="text-sm text-slate-600">
              Barebones integration: view balance and open external app to manage or claim from this
              jar.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://www.cookiejar.wtf/"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm"
              >
                Open Cookie Jar dApp
              </a>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm"
              >
                View Contract
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
