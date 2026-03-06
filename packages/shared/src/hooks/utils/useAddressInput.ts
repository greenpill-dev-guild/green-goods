import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { resolveEnsAddress } from "../../utils/blockchain/ens";

import { useEnsAddress } from "../blockchain/useEnsAddress";

type FormatMessage = (descriptor: { id: string; defaultMessage?: string }) => string;

type AddAddress = (address: string) => { success: boolean; error?: string };

export function useAddressInput(addMember: AddAddress, formatMessage: FormatMessage) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const trimmedInput = input.trim();
  const isHexAddress = useMemo(
    () => (trimmedInput ? isAddress(trimmedInput) : false),
    [trimmedInput]
  );
  const shouldResolveEns = trimmedInput.length > 2 && !isHexAddress;

  const { data: resolvedAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmedInput : null,
    { enabled: shouldResolveEns }
  );

  const handleAdd = useCallback(async () => {
    if (!trimmedInput) {
      setError(
        formatMessage({
          id: "app.admin.garden.create.enterAddress",
          defaultMessage: "Enter a wallet address or ENS name",
        })
      );
      return;
    }

    setError(null);
    let addressToAdd = trimmedInput;

    if (!isAddress(addressToAdd)) {
      try {
        const lookup = resolvedAddress ?? (await resolveEnsAddress(addressToAdd));
        if (!isMountedRef.current) return;
        if (!lookup || !isAddress(lookup)) {
          setError(
            formatMessage({
              id: "app.admin.garden.create.ensResolveFailed",
              defaultMessage: "Could not resolve ENS name",
            })
          );
          return;
        }
        addressToAdd = lookup;
      } catch {
        if (!isMountedRef.current) return;
        setError(
          formatMessage({
            id: "app.admin.garden.create.ensResolveFailed",
            defaultMessage: "Could not resolve ENS name",
          })
        );
        return;
      }
    }

    if (!isMountedRef.current) return;
    const result = addMember(addressToAdd);
    if (!result.success) {
      setError(
        result.error ??
          formatMessage({
            id: "app.admin.roles.error.invalidAddress",
            defaultMessage: "Invalid address",
          })
      );
      return;
    }
    setInput("");
    setError(null);
  }, [trimmedInput, resolvedAddress, addMember, formatMessage]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError(null);
  }, []);

  return {
    input,
    setInput: handleInputChange,
    error,
    trimmedInput,
    isHexAddress,
    shouldResolveEns,
    resolvedAddress,
    resolvingEns,
    handleAdd,
  };
}
