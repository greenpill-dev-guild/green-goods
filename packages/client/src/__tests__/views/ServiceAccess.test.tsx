import {
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  serviceAccessAvailableActions,
} from "@green-goods/shared/commitment-pooling";
import { describe, expect, it, vi } from "vitest";
import { ServiceAccessPanel } from "../../views/Home/Garden/Commitment/ServiceAccessPanel";
import { ServiceConsentSheet } from "../../views/Home/Garden/Commitment/ServiceConsentSheet";
import { formatServiceAccessAmount } from "../../views/Home/Garden/Commitment/serviceAccessPresentation";
import { serviceAccessStorySnapshot } from "../../views/Home/Garden/Commitment/serviceAccessStoryFixtures";
import { VoucherDeliverySheet } from "../../views/Home/Garden/Commitment/VoucherDeliverySheet";
import { VoucherSetupSheet } from "../../views/Home/Garden/Commitment/VoucherSetupSheet";
import { VoucherSetupCard } from "../../views/Home/Garden/Commitment/VoucherSetupCard";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";

const BUYER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0x2222222222222222222222222222222222222222" as const;
const MODULE = "0x3333333333333333333333333333333333333333" as const;
const TOKEN = "0x4444444444444444444444444444444444444444" as const;
const HASH = `0x${"ab".repeat(32)}` as const;
const OTHER_HASH = `0x${"cd".repeat(32)}` as const;
const HOLDER = "0x5555555555555555555555555555555555555555" as const;

function snapshot(overrides: Partial<ServiceAccessSnapshot> = {}): ServiceAccessSnapshot {
  const base = serviceAccessStorySnapshot();
  return {
    ...base,
    key: { sourceChainId: 42161, coreModule: MODULE, commitmentId: 1023n, buyer: BUYER },
    offer: {
      ...base.offer!,
      providerGarden: GARDEN,
      voucher: {
        ...base.offer!.voucher!,
        issuer: MODULE,
        asset: { chainId: 100, token: TOKEN, symbol: "TEST-VOUCHER", decimals: 0 },
      },
    },
    eligibleBuyerGardens: [{ address: GARDEN, name: "Fictional buyer garden" }],
    capabilities: {
      ...base.capabilities,
      sourceBuyer: BUYER,
      gnosisHolder: BUYER,
      canSignCelo: true,
    },
    ...overrides,
  };
}

function presented(overrides: Partial<ServiceAccessSnapshot> = {}): ServiceAccessSnapshot {
  const base = snapshot();
  const row = serviceAccessStorySnapshot(true).voucherSetups[0];
  row.authorizationHash = OTHER_HASH;
  row.asset = base.offer!.voucher!.asset;
  row.authorization = {
    ...row.authorization,
    sourceModule: MODULE,
    coreModule: MODULE,
    commitmentId: 1023n,
    buyer: BUYER,
    holder: BUYER,
    buyerGarden: GARDEN,
    providerGarden: GARDEN,
    issuer: MODULE,
    token: TOKEN,
    claimHash: OTHER_HASH,
  };
  row.source.acceptedEver = {
    ...row.source.acceptedEver!,
    setupModule: MODULE,
    authorizationHash: OTHER_HASH,
    claimHash: OTHER_HASH,
  };
  const state = {
    ...base,
    coreState: "ACCEPTED",
    consent: {
      revision: 1n,
      requestNonce: 1n,
      termsHash: HASH,
      claimHash: OTHER_HASH,
      buyerGarden: GARDEN,
      voucherHolder: BUYER,
      state: "accepted" as const,
    },
    currentVoucherSetupId: row.setupId,
    voucherSetups: [row],
    ...overrides,
  };
  state.availableActions = serviceAccessAvailableActions(state);
  row.availableActions = state.availableActions.filter(
    (kind): kind is ServiceVoucherSetup["availableActions"][number] =>
      [
        "abortVoucherSetup",
        "finalizeVoucherActivation",
        "dispatchVoucherSetupCommand",
        "approveVoucherAllowance",
        "presentVoucherSetup",
        "retryVoucherSetupAction",
        "requestVoucherSetupAbort",
        "retryVoucherSetupAcknowledgment",
        "retryVoucherFinalAcknowledgment",
        "finalizeVoucherAllocation",
        "executeVoucherFinalLeg",
      ].includes(kind)
  );
  return state;
}

function frozen(): ServiceAccessSnapshot {
  const state = presented();
  const row = state.voucherSetups[0];
  row.destination!.finalAllocation = {
    decisionId: HASH,
    activationDecisionId: row.source.decisionId!,
    issuerReturnApprovalAtFreeze: 60n,
    allocation: {
      approvedDeliveredServiceUnits: 3n,
      releaseVoucherUnits: 40n,
      refundVoucherUnits: 60n,
    },
    release: { state: "pending", attempts: 0n, failureHash: null },
    refund: { state: "pending", attempts: 0n, failureHash: null },
    financiallyClosed: false,
  };
  row.availableActions = ["executeVoucherFinalLeg", "retryVoucherSetupAcknowledgment"];
  state.availableActions = serviceAccessAvailableActions(state);
  return state;
}

function renderPanel(state = snapshot()) {
  const onAction = vi.fn().mockResolvedValue({ kind: "local-rehearsal", observationId: "local:1" });
  renderWithProviders(
    <ServiceAccessPanel
      snapshot={state}
      isPending={false}
      onAction={onAction}
      onRefresh={vi.fn()}
    />
  );
  return onAction;
}

function personalPayment(): ServiceAccessSnapshot {
  const state = snapshot();
  const asset = { chainId: 42220, token: TOKEN, symbol: "TEST-G$", decimals: 18 };
  return {
    ...state,
    mode: "personal-gd",
    offer: { ...state.offer!, route: "personal-gd", voucher: null, gdPrice: 100n },
    availableActions: [],
    personalPaymentAccount: { asset, custodySafe: MODULE },
    personalPurchase: {
      sourceModule: MODULE,
      fundingId: 1n,
      purchaseId: HASH,
      claimHash: HASH,
      requestNonce: 1n,
      termsRevision: state.offer!.revision,
      termsHash: state.offer!.termsHash,
      buyer: BUYER,
      recipient: BUYER,
      buyerGarden: GARDEN,
      providerGarden: GARDEN,
      authorizedDepositor: BUYER,
      refundAccount: BUYER,
      asset,
      custodySafe: MODULE,
      price: 100n,
      disclosedGrossAmount: 100n,
      disclosedNetAmount: 100n,
      deposit: null,
      paymentObservation: "observed-awaiting-steward",
      state: "pledged",
      outcome: "none",
      payoutPlanId: 0n,
      refundDisbursementId: 0n,
    },
  };
}

describe("service access presentation", () => {
  it("labels fictional rehearsal without claiming a signed payment or activation", () => {
    renderPanel();
    expect(screen.getByText("Local rehearsal")).toBeInTheDocument();
    expect(
      screen.getByText(/No payment, signature or service activation occurs/)
    ).toBeInTheDocument();
  });

  it("asks for exact terms consent before sending a voucher service request", async () => {
    const onAction = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Review and Request" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /I agree to this exact service/ })
    ).not.toBeChecked();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("submits the reviewed revision, nonce, buyer garden and distinct holder", async () => {
    const onAction = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Review and Request" }));
    const dialog = within(screen.getByRole("dialog"));
    const holder = dialog.getByRole("textbox", { name: "Voucher holder account" });
    await userEvent.clear(holder);
    await userEvent.type(holder, HOLDER);
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Review and Request" }));
    expect(onAction).toHaveBeenCalledWith({
      action: "requestClaim",
      expectedRevision: 1n,
      expectedTermsHash: HASH,
      requestNonce: 1n,
      buyerGarden: GARDEN,
      voucherHolder: HOLDER,
    });
  });

  it("keeps unreviewed live deployment unavailable even when terms exist", () => {
    renderPanel(
      snapshot({
        capabilities: {
          mutation: "unavailable",
          reasons: ["deployment-unreviewed"],
          sourceBuyer: BUYER,
          celoDepositor: null,
          gnosisHolder: null,
          canSignSource: false,
          canSendSource: false,
          canSignCelo: false,
          canSignHolder: false,
          canSendDestination: false,
        },
        availableActions: [],
      })
    );
    expect(screen.getByText("Service access is unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review and Request" })).not.toBeInTheDocument();
  });

  it("does not turn generic core fulfillment into holder delivery approval", () => {
    renderPanel(snapshot({ coreState: "FULFILLED", availableActions: [] }));
    expect(
      screen.getByText("The promise record does not replace your explicit delivery approval.")
    ).toBeInTheDocument();
  });

  it("shows an observed personal payment awaiting steward verification without offering a second send", () => {
    renderPanel(personalPayment());
    expect(
      screen.getByText("Payment observed; waiting for steward verification")
    ).toBeInTheDocument();
    expect(screen.queryByText("Deposit recorded by a steward")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Personal G$" })).not.toBeInTheDocument();
  });

  it("distinguishes a selected refund from a confirmed refund", () => {
    const state = personalPayment();
    renderPanel({
      ...state,
      personalPurchase: {
        ...state.personalPurchase!,
        paymentObservation: "none",
        outcome: "refund",
        state: "closed",
      },
    });
    expect(screen.getByText("Refund selected")).toBeInTheDocument();
    expect(screen.queryByText("Refund confirmed")).not.toBeInTheDocument();
  });

  it("shows durable destination evidence while source acknowledgment remains pending", () => {
    renderPanel(presented());
    expect(
      screen.getByText("Durable destination state: Active on destination")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Destination result recorded; source acknowledgment pending.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deposit Vouchers" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Setup Acknowledgment" })).toBeEnabled();
  });

  it("labels financial closure without declaring the service promise fulfilled", () => {
    const state = frozen();
    const final = state.voucherSetups[0].destination!.finalAllocation!;
    final.release.state = "succeeded";
    final.refund.state = "succeeded";
    final.financiallyClosed = true;
    renderPanel(state);
    expect(screen.getByText("Voucher allocation closed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "All presented vouchers were released or returned. This does not confirm the service promise."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("3 / 10 service units")).toBeInTheDocument();
  });

  it("explains unavailable holder signing and offers no holder final decision", () => {
    const state = presented();
    state.capabilities.canSignHolder = false;
    state.capabilities.reasons = ["signer-unavailable"];
    state.voucherSetups[0].availableActions = ["retryVoucherSetupAcknowledgment"];
    renderPanel(state);
    expect(screen.getByText("This account cannot sign this action here.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Freeze Final Allocation" })
    ).not.toBeInTheDocument();
  });

  it("retries the stored setup action without reconstructing economic amounts", async () => {
    const state = presented();
    const row = state.voucherSetups[0];
    row.destination!.pendingAction = "abort-refund";
    row.destination!.result.failureHash = HASH;
    row.availableActions = ["retryVoucherSetupAction"];
    const onAction = renderPanel(state);
    await userEvent.click(screen.getByRole("button", { name: "Retry Stored Setup Action" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox"));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" })
    );
    expect(onAction).toHaveBeenCalledWith({
      action: "retryVoucherSetupAction",
      sourceChainId: 42161,
      sourceModule: MODULE,
      setupId: HASH,
      expectedAuthorizationHash: OTHER_HASH,
    });
  });
});

describe("service consent", () => {
  it("requires renewed consent when the canonical terms change while open", async () => {
    const state = snapshot();
    const onConfirm = vi.fn();
    const props = {
      open: true,
      mode: "request" as const,
      snapshot: state,
      isPending: false,
      onOpenChange: vi.fn(),
      onConfirm,
    };
    const view = renderWithProviders(<ServiceConsentSheet {...props} />);
    await userEvent.click(screen.getByRole("checkbox"));
    view.rerender(
      <ServiceConsentSheet
        {...props}
        snapshot={{ ...state, offer: { ...state.offer!, revision: 2n, termsHash: OTHER_HASH } }}
      />
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("The terms changed. Review them again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review and Request" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each([
    "fee",
    "claim",
    "custody",
  ] as const)("does not silently reuse funding consent after a changed %s", async (change) => {
    const fee = {
      amount: 100n,
      fee: 0n,
      senderPays: false,
      totalDebit: 100n,
      recipientAmount: 100n,
    };
    const state = snapshot({
      personalFeeQuote: fee,
      personalPaymentAccount: {
        asset: { chainId: 42220, token: TOKEN, symbol: "TEST-G$", decimals: 18 },
        custodySafe: MODULE,
      },
      availableActions: ["pledgePersonal"],
      consent: {
        revision: 1n,
        requestNonce: 1n,
        termsHash: HASH,
        claimHash: HASH,
        buyerGarden: GARDEN,
        voucherHolder: BUYER,
        state: "pending",
      },
    });
    const onConfirm = vi.fn();
    const props = {
      open: true,
      mode: "funding" as const,
      snapshot: state,
      isPending: false,
      onOpenChange: vi.fn(),
      onConfirm,
    };
    const view = renderWithProviders(<ServiceConsentSheet {...props} />);
    await userEvent.click(screen.getByRole("checkbox"));
    const next =
      change === "fee"
        ? { ...state, personalFeeQuote: { ...fee, fee: 2n, totalDebit: 102n, senderPays: true } }
        : change === "claim"
          ? { ...state, consent: { ...state.consent!, claimHash: OTHER_HASH, requestNonce: 2n } }
          : {
              ...state,
              personalPaymentAccount: { ...state.personalPaymentAccount!, custodySafe: GARDEN },
            };
    view.rerender(<ServiceConsentSheet {...props} snapshot={next} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith({
      action: "pledgePersonal",
      expectedClaimHash: next.consent!.claimHash,
      authorizedDepositor: BUYER,
      refundAccount: BUYER,
      reviewedFee: next.personalFeeQuote,
    });
  });
});

describe("one final voucher allocation", () => {
  function sheet(state = presented()) {
    const onConfirm = vi.fn();
    const props = {
      open: true,
      snapshot: state,
      setup: state.voucherSetups[0],
      isPending: false,
      onOpenChange: vi.fn(),
      onConfirm,
    };
    const view = renderWithProviders(<VoucherDeliverySheet {...props} />);
    return { onConfirm, view, props };
  }
  async function enter(service = "3", release = "40") {
    await userEvent.type(
      screen.getByRole("textbox", { name: "Delivered service units you approve" }),
      service
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: /Final vouchers to release/ }),
      release
    );
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Freeze Final Allocation" }));
  }
  it.each([
    "decimals",
    "symbol",
  ] as const)("shows exact base units and blocks input with unknown %s", (field) => {
    const state = presented();
    state.voucherSetups[0].asset = { ...state.voucherSetups[0].asset, [field]: null };
    expect(
      formatServiceAccessAmount(
        1234567890123456789012345n,
        state.voucherSetups[0].asset,
        "en",
        "base units"
      )
    ).toBe("1234567890123456789012345 base units");
    const { onConfirm } = sheet(state);
    expect(screen.getByText("Presented vouchers: 100 Base units")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Freeze Final Allocation" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Final vouchers to release/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("disables an open final review when its exact row action is no longer available", () => {
    const state = presented();
    state.voucherSetups[0].availableActions = [];
    const { onConfirm } = sheet(state);
    expect(screen.getByRole("button", { name: "Freeze Final Allocation" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("freezes service3of10 and vouchers40/60 without executing either transfer", async () => {
    const { onConfirm } = sheet();
    await enter();
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      action: "finalizeVoucherAllocation",
      sourceChainId: 42161,
      sourceModule: MODULE,
      setupId: HASH,
      expectedAuthorizationHash: OTHER_HASH,
      expectedActivationDecisionId: OTHER_HASH,
      allocation: {
        approvedDeliveredServiceUnits: 3n,
        releaseVoucherUnits: 40n,
        refundVoucherUnits: 60n,
      },
    });
    expect(
      screen.getByText(/Freezing records the final decision; it transfers no vouchers/)
    ).toBeInTheDocument();
  });
  it("rejects excess precision instead of rounding", async () => {
    const { onConfirm } = sheet();
    await enter("3", "40.1");
    expect(screen.getByRole("alert")).toHaveTextContent("Check service units");
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("allows a full financial return with zero approved service without claiming non-delivery", async () => {
    const state = presented();
    state.voucherSetups[0].destination!.issuerReturnCeiling = 100n;
    const { onConfirm } = sheet(state);
    await enter("0", "0");
    expect(onConfirm.mock.calls[0][0].allocation).toEqual({
      approvedDeliveredServiceUnits: 0n,
      releaseVoucherUnits: 0n,
      refundVoucherUnits: 100n,
    });
    expect(
      screen.getByText("A voucher return does not prove service delivery or non-delivery.")
    ).toBeInTheDocument();
  });
  it.each([
    ["11", "40"],
    ["0", "40"],
    ["3", "101"],
    ["3", "20"],
  ])("rejects invalid service%s/release%s via Shared", async (service, release) => {
    const { onConfirm } = sheet();
    await enter(service, release);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it.each([
    "actor",
    "authorization",
    "decision",
    "ceiling",
  ] as const)("resets the whole draft after changed %s", async (field) => {
    const state = presented();
    const { view, props, onConfirm } = sheet(state);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Delivered service units you approve" }),
      "3"
    );
    await userEvent.click(screen.getByRole("checkbox"));
    const next = structuredClone(state);
    const row = next.voucherSetups[0];
    if (field === "actor") next.capabilities.gnosisHolder = HOLDER;
    if (field === "authorization") row.authorizationHash = HASH;
    if (field === "decision") row.destination!.result.appliedDecisionId = HASH;
    if (field === "ceiling") row.destination!.issuerReturnCeiling = 100n;
    view.rerender(<VoucherDeliverySheet {...props} snapshot={next} setup={row} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(
      screen.getByRole("textbox", { name: "Delivered service units you approve" })
    ).toHaveValue("");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("voucher v2 boundary", () => {
  it("does not expose incremental delivery or return controls for an active voucher promise", () => {
    const state = presented({
      consent: {
        revision: 1n,
        requestNonce: 1n,
        termsHash: HASH,
        claimHash: OTHER_HASH,
        buyerGarden: GARDEN,
        voucherHolder: BUYER,
        state: "accepted",
      },
    });
    renderPanel({ ...state, availableActions: serviceAccessAvailableActions(state) });

    expect(
      screen.queryByRole("button", { name: "Approve Delivered Service" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return Vouchers" })).not.toBeInTheDocument();
  });

  it("offers setup review for the exact pending claim before provider acceptance", async () => {
    const state = snapshot({
      consent: {
        revision: 1n,
        requestNonce: 1n,
        termsHash: HASH,
        claimHash: OTHER_HASH,
        buyerGarden: GARDEN,
        voucherHolder: BUYER,
        state: "pending",
      },
    });
    const onAction = renderPanel({
      ...state,
      availableActions: serviceAccessAvailableActions(state),
    });

    expect(screen.getByText("Waiting for the provider")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Review Voucher Setup/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("voucher setup and recovery review", () => {
  it("labels a live receipt as confirmed and hides it after the member changes", async () => {
    const state = presented();
    state.evidence = "onchain";
    state.capabilities.mutation = "onchain";
    const row = state.voucherSetups[0];
    row.acknowledgments.setup.pending = true;
    row.availableActions = ["retryVoucherSetupAcknowledgment"];
    const receipt = `100:${HASH}`;
    const onAction = vi.fn().mockResolvedValue({
      kind: "onchain",
      observationId: receipt,
      transactionHash: HASH,
      snapshot: state,
    });
    const view = renderWithProviders(
      <VoucherSetupCard snapshot={state} setup={row} onAction={onAction} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry Setup Acknowledgment" }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText(`Confirmed transaction: ${receipt}`)).toBeInTheDocument();
    expect(screen.queryByText(`Local observation: ${receipt}`)).not.toBeInTheDocument();
    view.rerender(
      <VoucherSetupCard
        snapshot={{ ...state, key: { ...state.key, buyer: HOLDER } }}
        setup={row}
        onAction={onAction}
      />
    );
    expect(screen.queryByText(`Confirmed transaction: ${receipt}`)).not.toBeInTheDocument();
  });

  it("reviews an exact zero allowance and leaves cancellation unsigned", async () => {
    const state = presented();
    state.evidence = "onchain";
    state.capabilities.mutation = "onchain";
    const row = state.voucherSetups[0];
    row.destination!.allowance = 100n;
    row.availableActions = ["revokeVoucherAllowance"];
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <VoucherSetupSheet
        open
        snapshot={state}
        setup={row}
        kind="revokeVoucherAllowance"
        isPending={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Allowance after this action").nextElementSibling).toHaveTextContent(
      `0 Base units · ${row.authorization.token} → ${row.authorization.destinationEscrow} · Destination chain: 100`
    );
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "revokeVoucherAllowance",
        setupId: row.setupId,
        expectedAuthorizationHash: row.authorizationHash,
      })
    );
  });

  it.each([
    ["retryVoucherSetupAcknowledgment", 100],
    ["retryVoucherFinalAcknowledgment", 100],
    ["authorization", 42161],
    ["decision", 42161],
  ] as const)("reviews the native fee on the transaction network for %s", (kind, chainId) => {
    const state = presented();
    const row = state.voucherSetups[0];
    row.acknowledgments.final.pending = true;
    row.availableActions = [
      "dispatchVoucherSetupCommand",
      "retryVoucherSetupAcknowledgment",
      "retryVoucherFinalAcknowledgment",
    ];
    renderWithProviders(
      <VoucherSetupSheet
        open
        snapshot={state}
        setup={row}
        kind={kind}
        isPending={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByText(
        `Exact caller-funded native fee: 0 native base units · Fee network: ${chainId}`
      )
    ).toBeInTheDocument();
    expect(dialog.queryByText(/native base units · Source chain:/)).not.toBeInTheDocument();
    expect(dialog.getByText("Source chain").nextElementSibling).toHaveTextContent("42161");
    expect(dialog.getByText("Destination chain").nextElementSibling).toHaveTextContent("100");
  });

  it("closes setup review by keyboard without issuing an action", async () => {
    const state = snapshot({
      consent: {
        revision: 1n,
        requestNonce: 1n,
        termsHash: HASH,
        claimHash: OTHER_HASH,
        buyerGarden: GARDEN,
        voucherHolder: BUYER,
        state: "pending",
      },
    });
    state.availableActions = serviceAccessAvailableActions(state);
    const onAction = renderPanel(state);
    const trigger = screen.getByRole("button", { name: "Review Voucher Setup" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("submits only the exact pending claim and source-chain cutoff after review", async () => {
    const state = snapshot({
      consent: {
        revision: 1n,
        requestNonce: 7n,
        termsHash: HASH,
        claimHash: OTHER_HASH,
        buyerGarden: GARDEN,
        voucherHolder: HOLDER,
        state: "pending",
      },
    });
    state.availableActions = serviceAccessAvailableActions(state);
    const onAction = renderPanel(state);
    await userEvent.click(screen.getByRole("button", { name: "Review Voucher Setup" }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.type(dialog.getByRole("textbox", { name: /Acceptance cutoff/ }), "2000");
    expect(onAction).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect(onAction).toHaveBeenCalledWith({
      action: "prepareVoucherSetup",
      expectedRevision: 1n,
      expectedTermsHash: HASH,
      expectedClaimHash: OTHER_HASH,
      expectedRequestNonce: 7n,
      acceptanceDeadline: 2000n,
    });
  });
  it("never substitutes the device clock when source time is unknown", () => {
    const state = snapshot({ sourceTimestamp: null });
    const onConfirm = vi.fn();
    renderWithProviders(
      <VoucherSetupSheet
        open
        snapshot={state}
        isPending={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByText(/A timeout alone never returns vouchers/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("requires renewed review when the exact native acknowledgment fee changes", async () => {
    const state = presented();
    const row = state.voucherSetups[0];
    row.fees.setupAcknowledgment = 8n;
    const onConfirm = vi.fn();
    const props = {
      open: true,
      snapshot: state,
      setup: row,
      kind: "retryVoucherSetupAcknowledgment" as const,
      isPending: false,
      onOpenChange: vi.fn(),
      onConfirm,
    };
    const view = renderWithProviders(<VoucherSetupSheet {...props} />);
    await userEvent.click(screen.getByRole("checkbox"));
    const next = structuredClone(state);
    next.voucherSetups[0].fees.setupAcknowledgment = 9n;
    view.rerender(<VoucherSetupSheet {...props} snapshot={next} setup={next.voucherSetups[0]} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      reviewedNativeFee: 9n,
      setupId: HASH,
      expectedAuthorizationHash: OTHER_HASH,
      sourceChainId: 42161,
      sourceModule: MODULE,
    });
  });
  it("preserves unknown destination and acknowledgment observations", () => {
    const state = presented();
    const row = state.voucherSetups[0];
    row.destination = null;
    row.availableActions = [];
    row.acknowledgments.setup = {
      destinationSequence: null,
      sentSequence: null,
      sourceObservedSequence: 0n,
      pending: null,
      sent: false,
    };
    renderPanel(state);
    expect(screen.getByText("Durable destination state: Unknown")).toBeInTheDocument();
    expect(
      screen.getAllByText("Acknowledgment sent: Unknown · Sent sequence: Unknown").length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Authorized; not deposited")).not.toBeInTheDocument();
  });
  it("keeps a sent acknowledgment distinct from an authenticated source observation", () => {
    const state = presented();
    const ack = state.voucherSetups[0].acknowledgments.setup;
    ack.sent = true;
    ack.sentSequence = 3n;
    renderPanel(state);
    expect(screen.getByText("Acknowledgment sent: Yes · Sent sequence: 3")).toBeInTheDocument();
    expect(screen.getByText("Authenticated source-observed sequence: 2")).toBeInTheDocument();
    expect(
      screen.getByText("Destination result recorded; source acknowledgment pending.")
    ).toBeInTheDocument();
  });
  it("keeps a prior abort-return recoverable beside a new Personal G$ route", async () => {
    const old = presented().voucherSetups[0];
    old.relationship = "prior";
    old.source.decision = "abort";
    old.source.decisionId = HASH;
    old.destination!.result.phase = "abort-refund-pending";
    old.destination!.result.decision = "abort";
    old.destination!.pendingAction = "abort-refund";
    old.availableActions = ["retryVoucherSetupAction"];
    const state = personalPayment();
    state.voucherSetups = [old];
    state.currentVoucherSetupId = null;
    const onAction = renderPanel(state);
    expect(
      screen.getByRole("article", { name: "Earlier voucher setup: recovery" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Payment observed; waiting for steward verification")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry Stored Setup Action" }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect(onAction.mock.calls[0][0]).toMatchObject({
      action: "retryVoucherSetupAction",
      setupId: HASH,
      expectedAuthorizationHash: OTHER_HASH,
    });
  });
  it("allows the independent holder leg while the fixed issuer leg is pending", async () => {
    const state = frozen();
    let finish: ((value: unknown) => void) | undefined;
    const onAction = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    renderWithProviders(
      <ServiceAccessPanel snapshot={state} isPending onAction={onAction} onRefresh={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Execute Fixed Issuer Release" }));
    let dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("button", { name: "Execute Fixed Issuer Release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Execute Fixed Holder Return" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Execute Fixed Holder Return" }));
    dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect(onAction.mock.calls.map(([action]) => action.leg)).toEqual(["release", "refund"]);
    expect(onAction.mock.calls[1][0]).toMatchObject({
      expectedDecisionId: HASH,
      expectedAuthorizationHash: OTHER_HASH,
    });
    finish?.({ kind: "local-rehearsal", observationId: "local:refund" });
  });
  it("shows canonical earned consent as unavailable independently of the service route", () => {
    const state = snapshot({ mode: "legacy", knownService: false, offer: null });
    state.acceptancePolicy = {
      ...state.acceptancePolicy,
      kind: "earned",
      knownOptIn: true,
      blockGenericMemberAcceptance: true,
      earned: {
        ...state.acceptancePolicy.earned,
        status: "bound",
        creator: GARDEN,
        participant: BUYER,
        revision: 2n,
        termsHash: HASH,
      },
    };
    state.availableActions = serviceAccessAvailableActions(state);
    renderPanel(state);
    expect(screen.getByText("Earned voucher consent")).toBeInTheDocument();
    expect(screen.getByText(/A steward account cannot substitute/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review and Request" })).not.toBeInTheDocument();
  });
});
