import { getAddress, isAddress } from "viem";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { DistributionMode } from "../lib/hypercerts/distribution";
import { logger } from "../modules/app/logger";
import type {
  AllowlistEntry,
  CapitalType,
  HypercertDraft,
  OutcomeMetrics,
} from "../types/hypercerts";
import {
  loadHypercertDraftTransition,
  nextHypercertStepTransition,
  previousHypercertStepTransition,
  resetHypercertWizardTransition,
  setHypercertDraftMetaTransition,
  setHypercertStepTransition,
  setMintingStateTransition,
  setSelectedAttestationsTransition,
  toggleAttestationTransition,
  updateHypercertMetadataTransition,
} from "./transitions/hypercert-wizard";

/**
 * Session storage key for minting state persistence.
 * Allows recovery of in-progress mints after page refresh.
 */
const MINTING_STATE_STORAGE_KEY = "hypercert-minting-state";

/** Minimum step number in the wizard (1-indexed) */
const MIN_STEP = 1;
/** Maximum step number in the wizard (4-step wizard: attestations, metadata, distribution, preview+mint) */
const MAX_STEP = 4;

/**
 * Validates a draft object before loading it into the store.
 * Prevents corrupted or malformed IndexedDB data from crashing the wizard.
 *
 * @returns Validated draft if valid, null if invalid
 */
function validateDraft(draft: unknown): HypercertDraft | null {
  if (!draft || typeof draft !== "object") {
    logger.warn("[HypercertWizardStore] Invalid draft: not an object");
    return null;
  }

  const d = draft as Record<string, unknown>;

  // Required string fields
  if (typeof d.id !== "string" || !d.id) {
    logger.warn("[HypercertWizardStore] Invalid draft: missing id");
    return null;
  }

  if (typeof d.gardenId !== "string" || !d.gardenId) {
    logger.warn("[HypercertWizardStore] Invalid draft: missing gardenId");
    return null;
  }

  if (typeof d.stewardAddress !== "string" || !isAddress(d.stewardAddress)) {
    logger.warn("[HypercertWizardStore] Invalid draft: invalid stewardAddress");
    return null;
  }

  // Step number bounds check - reject drafts with invalid step numbers
  if (typeof d.stepNumber !== "number" || d.stepNumber < MIN_STEP || d.stepNumber > MAX_STEP) {
    logger.warn("[HypercertWizardStore] Invalid draft: stepNumber out of bounds", {
      stepNumber: d.stepNumber,
      validRange: `${MIN_STEP}-${MAX_STEP}`,
    });
    return null;
  }

  // Arrays should be arrays
  if (!Array.isArray(d.attestationIds)) {
    logger.warn("[HypercertWizardStore] Invalid draft: attestationIds not an array");
    return null;
  }

  if (!Array.isArray(d.workScopes)) {
    logger.warn("[HypercertWizardStore] Invalid draft: workScopes not an array");
    return null;
  }

  if (!Array.isArray(d.allowlist)) {
    logger.warn("[HypercertWizardStore] Invalid draft: allowlist not an array");
    return null;
  }

  // Validate and normalize allowlist entries
  const normalizedAllowlist: AllowlistEntry[] = [];
  for (const entry of d.allowlist as unknown[]) {
    if (!entry || typeof entry !== "object") {
      logger.warn("[HypercertWizardStore] Invalid draft: malformed allowlist entry");
      return null;
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.address !== "string" || !isAddress(e.address)) {
      logger.warn("[HypercertWizardStore] Invalid draft: allowlist entry has invalid address");
      return null;
    }
    // Units should be convertible to bigint
    if (e.units === undefined || e.units === null) {
      logger.warn("[HypercertWizardStore] Invalid draft: allowlist entry missing units");
      return null;
    }
    // Convert units to bigint (IndexedDB may serialize as string or number)
    let units: bigint;
    try {
      units = BigInt(e.units as string | number | bigint);
    } catch {
      logger.warn(
        "[HypercertWizardStore] Invalid draft: allowlist entry units not convertible to bigint"
      );
      return null;
    }
    normalizedAllowlist.push({
      address: getAddress(e.address),
      units,
      label: typeof e.label === "string" ? e.label : undefined,
    });
  }

  // All validations passed, return with normalized allowlist
  return {
    ...(draft as Omit<HypercertDraft, "allowlist">),
    allowlist: normalizedAllowlist,
  } as HypercertDraft;
}

export type MintingStatus =
  | "idle"
  | "uploading_metadata"
  | "uploading_allowlist"
  | "building_userop"
  | "awaiting_signature"
  | "submitting"
  | "pending"
  | "registering_proposal"
  | "confirmed"
  | "failed";

export interface MintingState {
  status: MintingStatus;
  metadataCid: string | null;
  allowlistCid: string | null;
  merkleRoot: string | null;
  userOpHash: string | null;
  txHash: string | null;
  hypercertId: string | null;
  error: string | null;
  poolRegistered: boolean | null;
  signalPoolAddress: string | null;
}

export const HYPERCERT_MINTING_IN_PROGRESS_STATUSES: readonly MintingStatus[] = [
  "uploading_metadata",
  "uploading_allowlist",
  "building_userop",
  "awaiting_signature",
  "submitting",
  "pending",
  "registering_proposal",
] as const;

export function isHypercertMintingInProgress(status: MintingState["status"]): boolean {
  return HYPERCERT_MINTING_IN_PROGRESS_STATUSES.includes(status);
}

export interface HypercertWizardStore {
  currentStep: number;
  selectedAttestationIds: string[];
  title: string;
  description: string;
  workScopes: string[];
  impactScopes: string[];
  workTimeframeStart: number;
  workTimeframeEnd: number;
  impactTimeframeStart: number;
  impactTimeframeEnd: number | null;
  sdgs: number[];
  capitals: CapitalType[];
  /**
   * Aggregated outcome metrics from selected attestations.
   *
   * @planned Future enhancement to aggregate quantitative impact data
   * (e.g., trees planted, kg recycled) from attestation metrics into
   * the hypercert metadata. Currently initialized empty and not used
   * in the wizard UI.
   *
   * @todo Create tracking issue for outcome metrics aggregation
   */
  outcomes: OutcomeMetrics;
  externalUrl: string;
  distributionMode: DistributionMode;
  allowlist: AllowlistEntry[];
  mintingState: MintingState;
  draftId: string | null;
  lastSavedAt: number | null;

  setStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  setSelectedAttestations: (ids: string[]) => void;
  toggleAttestation: (id: string) => void;
  updateMetadata: (
    updates: Partial<
      Pick<
        HypercertWizardStore,
        | "title"
        | "description"
        | "workScopes"
        | "impactScopes"
        | "workTimeframeStart"
        | "workTimeframeEnd"
        | "impactTimeframeStart"
        | "impactTimeframeEnd"
        | "sdgs"
        | "capitals"
        | "outcomes"
        | "externalUrl"
      >
    >
  ) => void;
  setDistributionMode: (mode: DistributionMode) => void;
  setAllowlist: (entries: AllowlistEntry[]) => void;
  setMintingState: (state: Partial<MintingState>) => void;
  setDraftMeta: (draftId: string | null, savedAt?: number | null) => void;
  reset: () => void;
  /**
   * Loads a draft from persistent storage (IndexedDB).
   * @returns true if draft loaded successfully, false if validation failed
   */
  loadDraft: (draft: HypercertDraft) => boolean;
  toDraft: (gardenId: string, stewardAddress: string) => HypercertDraft;
}

const emptyOutcomes: OutcomeMetrics = {
  predefined: {},
  custom: {},
};

const emptyMintingState: MintingState = {
  status: "idle",
  metadataCid: null,
  allowlistCid: null,
  merkleRoot: null,
  userOpHash: null,
  txHash: null,
  hypercertId: null,
  error: null,
  poolRegistered: null,
  signalPoolAddress: null,
};

/**
 * Persists minting state to sessionStorage for recovery after page refresh.
 * Only persists if minting is in progress (not idle, confirmed, or failed).
 */
function persistMintingState(state: MintingState): void {
  if (typeof window === "undefined") return;

  if (isHypercertMintingInProgress(state.status)) {
    try {
      sessionStorage.setItem(MINTING_STATE_STORAGE_KEY, JSON.stringify(state));
      logger.debug("[HypercertWizardStore] Minting state persisted to sessionStorage", {
        status: state.status,
      });
    } catch {
      logger.warn("[HypercertWizardStore] Failed to persist minting state to sessionStorage");
    }
  } else {
    // Clear persisted state when minting is complete or reset
    try {
      sessionStorage.removeItem(MINTING_STATE_STORAGE_KEY);
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Restores minting state from sessionStorage if available.
 * This allows recovery of in-progress mints after accidental page refresh.
 */
function restoreMintingState(): MintingState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(MINTING_STATE_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as MintingState;

    // Validate the restored state has required fields
    if (!parsed.status || typeof parsed.status !== "string") {
      logger.warn("[HypercertWizardStore] Invalid minting state in sessionStorage");
      sessionStorage.removeItem(MINTING_STATE_STORAGE_KEY);
      return null;
    }

    logger.info("[HypercertWizardStore] Restored minting state from sessionStorage", {
      status: parsed.status,
      txHash: parsed.txHash,
    });

    return parsed;
  } catch {
    logger.warn("[HypercertWizardStore] Failed to restore minting state from sessionStorage");
    return null;
  }
}

/**
 * Gets the initial minting state, checking for persisted state first.
 */
function getInitialMintingState(): MintingState {
  const restored = restoreMintingState();
  return restored ?? emptyMintingState;
}

const initialState = {
  currentStep: 1,
  selectedAttestationIds: [],
  title: "",
  description: "",
  workScopes: [],
  impactScopes: [],
  workTimeframeStart: 0,
  workTimeframeEnd: 0,
  impactTimeframeStart: 0,
  impactTimeframeEnd: null,
  sdgs: [],
  capitals: [],
  outcomes: emptyOutcomes,
  externalUrl: "",
  distributionMode: "equal" as DistributionMode,
  allowlist: [],
  mintingState: getInitialMintingState(), // Restore from sessionStorage if available
  draftId: null,
  lastSavedAt: null,
};

export const useHypercertWizardStore = create<HypercertWizardStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    setStep: (step) => set((state) => setHypercertStepTransition(state, step)),
    nextStep: () => set((state) => nextHypercertStepTransition(state)),
    previousStep: () => set((state) => previousHypercertStepTransition(state)),
    setSelectedAttestations: (ids) => set((state) => setSelectedAttestationsTransition(state, ids)),
    toggleAttestation: (id) => set((state) => toggleAttestationTransition(state, id)),
    updateMetadata: (updates) => set((state) => updateHypercertMetadataTransition(state, updates)),
    setDistributionMode: (mode) => set({ distributionMode: mode }),
    setAllowlist: (entries) => set({ allowlist: entries }),
    setMintingState: (state) =>
      set((current) => {
        const transition = setMintingStateTransition(current, state);
        const newMintingState = transition.mintingState as MintingState;
        // Persist to sessionStorage for recovery after page refresh
        persistMintingState(newMintingState);
        return transition;
      }),
    // When savedAt is not provided, default to current timestamp.
    // If explicitly passed null, store null (allowing clearing of lastSavedAt).
    setDraftMeta: (draftId, savedAt) =>
      set((state) =>
        setHypercertDraftMetaTransition(state, {
          draftId,
          savedAt: savedAt === undefined ? Date.now() : savedAt,
        })
      ),
    // Reset to initial state completely - initialState already includes outcomes and mintingState
    reset: () => set((state) => resetHypercertWizardTransition(state, initialState)),
    /**
     * Loads a draft from persistent storage (IndexedDB).
     * Validates the draft structure before applying to prevent corrupted data
     * from crashing the wizard.
     *
     * @returns true if draft was loaded successfully, false if validation failed
     */
    loadDraft: (draft) => {
      const validated = validateDraft(draft);
      if (!validated) {
        logger.error("[HypercertWizardStore] Draft validation failed, not loading", {
          draftId: (draft as unknown as Record<string, unknown>)?.id ?? "unknown",
        });
        return false;
      }

      set((state) => loadHypercertDraftTransition(state, validated));
      return true;
    },
    /**
     * Converts the current wizard state to a HypercertDraft for persistence.
     *
     * Draft ID format: `hypercert_draft_{gardenId}_{checksummedStewardAddress}`
     *
     * @throws Error if stewardAddress is not a valid Ethereum address
     */
    toDraft: (gardenId, stewardAddress) => {
      // Validate stewardAddress is a valid Ethereum address
      if (!isAddress(stewardAddress)) {
        throw new Error(`Invalid steward address: ${stewardAddress}`);
      }

      // Normalize/canonicalize the address to checksum format
      const canonicalAddress = getAddress(stewardAddress);

      const state = get();
      return {
        id: state.draftId || `hypercert_draft_${gardenId}_${canonicalAddress}`,
        gardenId,
        stewardAddress: canonicalAddress,
        stepNumber: state.currentStep,
        attestationIds: state.selectedAttestationIds,
        title: state.title,
        description: state.description,
        workScopes: state.workScopes,
        impactScopes: state.impactScopes,
        workTimeframeStart: state.workTimeframeStart,
        workTimeframeEnd: state.workTimeframeEnd,
        impactTimeframeStart: state.impactTimeframeStart,
        impactTimeframeEnd: state.impactTimeframeEnd,
        sdgs: state.sdgs,
        capitals: state.capitals,
        outcomes: state.outcomes,
        allowlist: state.allowlist,
        externalUrl: state.externalUrl,
        createdAt: state.lastSavedAt ?? Date.now(),
        updatedAt: Date.now(),
      };
    },
  }))
);
