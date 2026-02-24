import { zodResolver } from "@hookform/resolvers/zod";
import { parseUnits } from "viem";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { validateDecimalInput } from "../../utils/blockchain/vaults";

interface UseDepositFormOptions {
  decimals: number;
  balance?: bigint;
}

interface DepositFormValues {
  amount: string;
}

function createDepositFormSchema(decimals: number, balance?: bigint) {
  return z.object({
    amount: z.string().superRefine((rawValue, ctx) => {
      const value = rawValue.trim();
      if (!value) return;

      const decimalError = validateDecimalInput(value, decimals);
      if (decimalError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: decimalError,
        });
        return;
      }

      let parsed: bigint;
      try {
        parsed = parseUnits(value, decimals);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "app.treasury.invalidAmount",
        });
        return;
      }

      if (parsed <= 0n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "app.treasury.amountMustBeGreaterThanZero",
        });
        return;
      }

      if (typeof balance === "bigint" && parsed > balance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "app.treasury.insufficientBalance",
        });
      }
    }),
  });
}

export function useDepositForm({ decimals, balance }: UseDepositFormOptions) {
  const schema = useMemo(() => createDepositFormSchema(decimals, balance), [decimals, balance]);

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
    mode: "onChange",
  });

  const amount = form.watch("amount") ?? "";

  const amountBigInt = useMemo(() => {
    const value = amount.trim();
    if (!value) return 0n;
    if (validateDecimalInput(value, decimals)) return 0n;

    try {
      return parseUnits(value, decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  const amountErrorKey = form.formState.errors.amount?.message ?? null;

  const resetAmount = useCallback(() => {
    form.reset({ amount: "" });
  }, [form]);

  return {
    form,
    amount,
    amountBigInt,
    amountErrorKey,
    hasBlockingError: Boolean(amountErrorKey),
    resetAmount,
  };
}

export type UseDepositFormResult = ReturnType<typeof useDepositForm>;
