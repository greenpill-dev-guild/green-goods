import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type {
  HatsCookieJarAction,
  useHatsCookieJarAdmin,
} from "@green-goods/shared/hooks/cookie-jar/useCookieJarAdmin";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import { type FormEvent, type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, isAddress, parseUnits, zeroAddress } from "viem";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";

type LiveAdmin = ReturnType<typeof useHatsCookieJarAdmin>;
type JarAdmin = Pick<LiveAdmin, "kind" | "policy" | "pending" | "canOperate" | "canGovern"> & {
  mutation: Pick<LiveAdmin["mutation"], "mutate" | "isPending">;
  submission?: LiveAdmin["submission"];
  confirmation?: Pick<LiveAdmin["confirmation"], "mutate" | "isPending">;
};
type Policy = NonNullable<JarAdmin["policy"]>;
type Review = { action: HatsCookieJarAction; label: string; facts?: ReactNode };

function readAmount(form: FormData, field: string, decimals: number) {
  const value = String(form.get(field) ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(value) || (value.split(".")[1]?.length ?? 0) > decimals)
    throw new Error("Invalid amount");
  return parseUnits(value, decimals);
}

export function HatsCookieJarControls({
  jar,
  symbol,
  admin,
  openLimits,
}: {
  jar: CookieJar;
  symbol: string;
  admin: JarAdmin;
  openLimits?: boolean;
}) {
  const { formatMessage, formatDate, formatTime } = useIntl();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { policy, pending, mutation, canOperate, canGovern, submission, confirmation } = admin;
  const t = (key: string) => formatMessage({ id: `app.cookieJar.hats.${key}` });
  const amount = (value: bigint) => `${formatUnits(value, jar.decimals)} ${symbol}`;
  const showReview = (next: Review) => {
    setError(null);
    setReview(next);
  };

  const facts = (value: Policy) => (
    <FactList frame="inset">
      <FactRow label={t("ceiling")} value={amount(value.maxClaimCeiling)} />
      <FactRow label={t("minCooldown")} value={String(value.minCooldown)} />
      <FactRow label={t("dailyBudget")} value={amount(value.dailyBudget)} />
      <FactRow
        label={t("recipient")}
        value={<EnsAddressText address={value.recoveryRecipient} />}
      />
    </FactList>
  );

  const submit = (event: FormEvent<HTMLFormElement>, prepare: (form: FormData) => Review) => {
    event.preventDefault();
    try {
      showReview(prepare(new FormData(event.currentTarget)));
    } catch {
      setError(t("invalidInput"));
    }
  };

  if (!policy) return <p role="status">{t("policyUnavailable")}</p>;

  const ready = pending ? new Date(Number(pending.readyAt) * 1_000) : null;
  const pauseAction = jar.isPaused ? "unpause" : "pause";
  const isOperatorReview =
    review?.action.functionName === "setOperationalLimits" ||
    review?.action.functionName === "pause";
  return (
    <div className="flex flex-col gap-3">
      {submission ? (
        <div className="flex flex-col gap-2">
          <p role="status">{t("pendingSubmission")}</p>
          {confirmation ? (
            <Button
              size="sm"
              type="button"
              emphasis="secondary"
              disabled={confirmation.isPending || mutation.isPending}
              onClick={() => confirmation.mutate()}
            >
              {t("checkSubmission")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <h4 className="type-label font-medium">{t("policy")}</h4>
      {facts(policy)}
      {pending && ready ? (
        <div className="flex flex-col gap-2">
          <h4 className="type-label font-medium">{t("pendingPolicy")}</h4>
          {facts(pending.policy)}
          <p className="type-meta text-text-sub">
            {formatMessage(
              { id: "app.cookieJar.hats.readyAt" },
              { date: formatDate(ready), time: formatTime(ready, { timeZoneName: "short" }) }
            )}
          </p>
          {canGovern ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                type="button"
                emphasis="secondary"
                onClick={() =>
                  showReview({
                    label: t("cancelPolicy"),
                    action: { functionName: "cancelPolicy", args: [], pendingHash: pending.hash },
                    facts: facts(pending.policy),
                  })
                }
              >
                {t("cancelPolicy")}
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={ready.getTime() > Date.now()}
                onClick={() =>
                  showReview({
                    label: t("applyPolicy"),
                    action: { functionName: "executePolicy", args: [pending.hash] },
                    facts: facts(pending.policy),
                  })
                }
              >
                {t("applyPolicy")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canOperate ? (
        <details open={openLimits || undefined}>
          <summary className="cursor-pointer type-label">{t("updateLimits")}</summary>
          <form
            className="mt-2 space-y-2"
            key={`${jar.maxWithdrawal}:${jar.withdrawalInterval}`}
            onSubmit={(event) =>
              submit(event, (form) => {
                const limit = readAmount(form, "limit", jar.decimals);
                const cooldown = readAmount(form, "cooldown", 0);
                if (limit === 0n || limit > policy.maxClaimCeiling || cooldown < policy.minCooldown)
                  throw new Error("Outside jar policy");
                return {
                  label: t("updateLimits"),
                  action: { functionName: "setOperationalLimits", args: [limit, cooldown] },
                  facts: (
                    <FactList frame="inset">
                      <FactRow
                        label={formatMessage({ id: "app.cookieJar.claimLimit" })}
                        value={amount(limit)}
                      />
                      <FactRow label={t("cooldown")} value={String(cooldown)} />
                    </FactList>
                  ),
                };
              })
            }
          >
            <AdminTextField
              name="limit"
              label={formatMessage({ id: "app.cookieJar.claimLimit" })}
              defaultValue={formatUnits(jar.maxWithdrawal, jar.decimals)}
              required
            />
            <AdminTextField
              name="cooldown"
              label={t("cooldown")}
              defaultValue={String(jar.withdrawalInterval)}
              required
            />
            <Button size="sm" type="submit">
              {t("updateLimits")}
            </Button>
          </form>
        </details>
      ) : submission ? null : (
        <p className="type-meta text-text-sub">{t("stewardOrOwnerOnly")}</p>
      )}

      {canGovern && !pending ? (
        <details>
          <summary className="cursor-pointer type-label">{t("proposePolicy")}</summary>
          <form
            className="mt-2 space-y-2"
            key={`${policy.maxClaimCeiling}:${policy.minCooldown}:${policy.dailyBudget}:${policy.recoveryRecipient}`}
            onSubmit={(event) =>
              submit(event, (form) => {
                const recoveryRecipient = String(form.get("recipient") ?? "").trim();
                if (
                  !isAddress(recoveryRecipient) ||
                  [zeroAddress, jar.gardenAddress, jar.jarAddress].some(
                    (address) => address.toLowerCase() === recoveryRecipient.toLowerCase()
                  )
                )
                  throw new Error("Invalid recipient");
                const nextPolicy = {
                  maxClaimCeiling: readAmount(form, "ceiling", jar.decimals),
                  minCooldown: readAmount(form, "minimum", 0),
                  dailyBudget: readAmount(form, "budget", jar.decimals),
                  recoveryRecipient,
                };
                if (nextPolicy.maxClaimCeiling === 0n || nextPolicy.minCooldown === 0n)
                  throw new Error("Invalid policy");
                return {
                  label: t("proposePolicy"),
                  action: { functionName: "proposePolicy", args: [nextPolicy] },
                  facts: facts(nextPolicy),
                };
              })
            }
          >
            <AdminTextField
              name="ceiling"
              label={t("ceiling")}
              defaultValue={formatUnits(policy.maxClaimCeiling, jar.decimals)}
              required
            />
            <AdminTextField
              name="minimum"
              label={t("minCooldown")}
              defaultValue={String(policy.minCooldown)}
              required
            />
            <AdminTextField
              name="budget"
              label={t("dailyBudget")}
              defaultValue={formatUnits(policy.dailyBudget, jar.decimals)}
              required
            />
            <AdminTextField
              name="recipient"
              label={t("recipient")}
              defaultValue={policy.recoveryRecipient}
              required
            />
            <p className="type-meta text-text-sub">{t("notice")}</p>
            <Button size="sm" type="submit">
              {t("proposePolicy")}
            </Button>
          </form>
        </details>
      ) : null}

      {(jar.isPaused ? canGovern : canOperate) ? (
        <Button
          size="sm"
          type="button"
          emphasis="secondary"
          onClick={() =>
            showReview({
              label: t(pauseAction),
              action: { functionName: pauseAction, args: [] },
            })
          }
        >
          {t(pauseAction)}
        </Button>
      ) : null}
      {canGovern && jar.isPaused ? (
        <details>
          <summary className="cursor-pointer type-label">{t("recovery")}</summary>
          <form
            className="mt-2 space-y-2"
            onSubmit={(event) => {
              const surplus =
                (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "surplus";
              submit(event, (form) => {
                const value = readAmount(form, "recovery", jar.decimals);
                if (value === 0n || (!surplus && value > jar.balance))
                  throw new Error("Invalid recovery amount");
                const recipient = policy.recoveryRecipient;
                return {
                  label: t(surplus ? "recoverSurplus" : "recoverCredit"),
                  action: surplus
                    ? {
                        functionName: "recoverSurplus",
                        args: [jar.assetAddress, value],
                        recipient,
                      }
                    : { functionName: "emergencyWithdraw", args: [value], recipient },
                  facts: (
                    <FactList frame="inset">
                      <FactRow label={t("recoveryAmount")} value={amount(value)} />
                      <FactRow
                        label={t("recipient")}
                        value={<EnsAddressText address={recipient} />}
                      />
                    </FactList>
                  ),
                };
              });
            }}
          >
            <AdminTextField name="recovery" label={t("recoveryAmount")} required />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit" value="credit">
                {t("recoverCredit")}
              </Button>
              <Button size="sm" type="submit" value="surplus" emphasis="secondary">
                {t("recoverSurplus")}
              </Button>
            </div>
          </form>
        </details>
      ) : null}
      {error ? (
        <p role="alert" className="type-meta text-text-sub">
          {error}
        </p>
      ) : null}

      {review ? (
        <AdminConfirmDialog
          isOpen
          title={review.label}
          target={
            <>
              {symbol} · <EnsAddressText address={jar.jarAddress} />
            </>
          }
          description={t("signAsWearer")}
          confirmLabel={review.label}
          variant={"recipient" in review.action ? "danger" : "default"}
          confirmDisabled={!(isOperatorReview ? canOperate : canGovern)}
          isLoading={mutation.isPending}
          onClose={() => setReview(null)}
          onConfirm={() => mutation.mutate(review.action, { onSuccess: () => setReview(null) })}
          tone="community"
        >
          {review.facts}
        </AdminConfirmDialog>
      ) : null}
    </div>
  );
}
