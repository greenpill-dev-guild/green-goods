import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Button } from "@green-goods/shared/components/Button";
import { useCopyToClipboard } from "@green-goods/shared/hooks/utils/useCopyToClipboard";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { Address } from "@green-goods/shared/types/domain";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

/** The person and their exact account, with an explicit address-copy action. */
export function MemberIdentity({
  address,
  showName = true,
}: {
  address: Address;
  showName?: boolean;
}) {
  const { formatMessage } = useIntl();
  const { copied, copy, reset } = useCopyToClipboard();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    reset();
    setFailed(false);
  }, [address, reset]);
  const copyAddress = async () => {
    setFailed(false);
    if (!(await copy(address))) {
      setFailed(true);
      logger.warn("Could not copy member address", { source: "MemberIdentity" });
    }
  };
  return (
    <div className="min-w-0 space-y-2">
      {showName ? (
        <AddressDisplay address={address}>
          {(name) => (
            <span className="block break-words type-card-title text-text-strong">{name}</span>
          )}
        </AddressDisplay>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <code className="min-w-0 flex-1 basis-48 break-all type-meta text-text-sub">{address}</code>
        <Button
          type="button"
          emphasis="secondary"
          size="compact"
          className="min-w-36"
          onClick={() => void copyAddress()}
          leadingIcon={
            copied ? <RiCheckLine aria-hidden="true" /> : <RiFileCopyLine aria-hidden="true" />
          }
        >
          {formatMessage({ id: copied ? "admin.members.copied" : "app.common.copyAddress" })}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? formatMessage({ id: "admin.members.addressCopied" }) : ""}
      </span>
      {failed ? (
        <p role="alert" className="type-meta text-error-dark">
          {formatMessage({ id: "admin.members.copyFailed" })}
        </p>
      ) : null}
    </div>
  );
}
