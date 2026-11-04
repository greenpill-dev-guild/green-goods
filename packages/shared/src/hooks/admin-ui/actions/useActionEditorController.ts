import { toastService } from "../../../components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { logger } from "../../../modules/app/logger";
import { getFileByHash } from "../../../modules/data/ipfs/resolve";
import { uploadFileToIPFS } from "../../../modules/data/ipfs/upload";
import { useSheetOrchestratorStore } from "../../../stores/useSheetOrchestratorStore";
import type { ActionInstructionConfig, ActionTranslationMap } from "../../../types/domain";
import { defaultTemplate, instructionTemplates } from "../../../utils/action/templates";
import {
  buildActionInstructionsV2,
  normalizeActionTranslations,
} from "../../../utils/action/translations";
import { parseContractError } from "../../../utils/errors/contract-errors";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { toSafeDate } from "../../../utils/time";
import {
  ACTION_EDIT_WRITES,
  type ActionEditChange,
  actionEditArgs,
} from "../../../modules/action/action-edit";
import {
  fingerprintActionArguments,
  type ActionOperationResult,
} from "../../../modules/action/action-operation-command";
import { TransactionConfirmationPendingError } from "../../../modules/transactions/types";
import { useActionEditBatch } from "../../action/useActionEditBatch";
import { useActionOperations } from "../../action/useActionOperations";
import { useActions } from "../../blockchain/useBaseLists";
import { useAsyncEffect } from "../../utils/useAsyncEffect";
import {
  type EditActionSaveAttempt,
  getActionEditDraftPath,
  restoreEditActionDraft,
  serializeEditActionDraft,
} from "./actionDrafts";
import { getActionsListSearch } from "./actions.utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

const editActionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.date(),
  endTime: z.date(),
});

export type EditActionFormData = z.infer<typeof editActionSchema>;
const INSTRUCTION_LOAD_TIMEOUT_MS = 8_000;

function cloneInstructionConfig(config: ActionInstructionConfig): ActionInstructionConfig {
  return {
    description: config.description,
    uiConfig: {
      media: {
        ...config.uiConfig.media,
        needed: [...config.uiConfig.media.needed],
        optional: [...config.uiConfig.media.optional],
      },
      details: { ...config.uiConfig.details, inputs: [...config.uiConfig.details.inputs] },
      review: { ...config.uiConfig.review },
    },
  };
}

async function parseInstructionMetadata(data: Blob | string) {
  const candidate = JSON.parse(typeof data === "string" ? data : await data.text()) as unknown;
  const record =
    candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
  const config = candidate as Partial<ActionInstructionConfig> | null;
  const validConfig = Boolean(
    config?.uiConfig?.media && config.uiConfig.details && config.uiConfig.review
  );
  return {
    config: validConfig ? (candidate as ActionInstructionConfig) : null,
    translations: normalizeActionTranslations(record.translations),
  };
}

export function useActionEditorController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading: actionsLoading } = useActions(DEFAULT_CHAIN_ID);
  const action = actions.find((candidate) => candidate.id === id);
  const actionUID = id?.split("-")[1];
  const uid = actionUID && /^\d+$/.test(actionUID) ? BigInt(actionUID) : null;
  const operations = useActionOperations(DEFAULT_CHAIN_ID, actionUID);
  const batch = useActionEditBatch(DEFAULT_CHAIN_ID, uid);
  const isPendingEdit = operations.pendingEdits.length > 0;
  const [isCheckingConfirmation, setIsCheckingConfirmation] = useState(false);
  // The owning draft retains this attempt across remounts; consuming it expires the receipts.
  const completedWrites = useRef(new Map<string, string>());
  const saveAttempt = useRef<EditActionSaveAttempt | undefined>(undefined);
  const editScope = `${operations.registrationScope}:${id}`;
  const activeEditScope = useRef(editScope);
  activeEditScope.current = editScope;
  useEffect(() => {
    completedWrites.current.clear();
    saveAttempt.current = undefined;
    const path = getActionEditDraftPath(id);
    const saved = path
      ? useSheetOrchestratorStore.getState().restoreViewState(path)?.formState
      : null;
    const attempt = restoreEditActionDraft(saved)?.saveAttempt;
    if (attempt?.scope === editScope) {
      saveAttempt.current = { ...attempt, completedWrites: { ...attempt.completedWrites } };
      completedWrites.current = new Map(Object.entries(attempt.completedWrites));
    }
  }, [editScope, id]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const form = useForm<EditActionFormData>({
    resolver: zodResolver(editActionSchema),
    defaultValues: { title: "", startTime: new Date(), endTime: new Date() },
  });
  const [instructionConfig, setInstructionConfig] =
    useState<ActionInstructionConfig>(defaultTemplate);
  const [translations, setTranslations] = useState<ActionTranslationMap>({});
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [translationsDirty, setTranslationsDirty] = useState(false);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);
  const setDraftFormState = useSheetOrchestratorStore((state) => state.setFormState);
  const clearDraftFormState = useSheetOrchestratorStore((state) => state.clearViewState);
  const restoredDraftPathRef = useRef<string | null>(null);
  const listSearch = useMemo(
    () => getActionsListSearch(new URLSearchParams(location.search)),
    [location.search]
  );
  const actionsListHref = useMemo(() => adminRoutes.actions(listSearch), [listSearch]);
  const actionDetailHref = id ? adminRoutes.actionDetail(id, listSearch) : actionsListHref;
  const draftPath = useMemo(() => getActionEditDraftPath(id), [id]);

  useAsyncEffect(
    async ({ isMounted }) => {
      if (!action) return;
      const fallbackConfig = cloneInstructionConfig(
        instructionTemplates[action.slug] ?? defaultTemplate
      );
      const fallbackTranslations = normalizeActionTranslations(action.translations);
      const restoreDraft = (
        resolvedConfig: ActionInstructionConfig,
        resolvedTranslations: ActionTranslationMap
      ) => {
        if (!draftPath || restoredDraftPathRef.current === draftPath) return false;
        restoredDraftPathRef.current = draftPath;
        const saved =
          useSheetOrchestratorStore.getState().restoreViewState(draftPath)?.formState ?? null;
        const restored = restoreEditActionDraft(saved);
        if (!restored) return false;
        if (restored.saveAttempt?.scope === editScope) {
          saveAttempt.current = {
            ...restored.saveAttempt,
            completedWrites: { ...restored.saveAttempt.completedWrites },
          };
          completedWrites.current = new Map(Object.entries(restored.saveAttempt.completedWrites));
        }
        form.reset({
          title: restored.title || action.title || "",
          startTime: restored.startTime,
          endTime: restored.endTime,
        });
        setInstructionConfig(restored.instructionConfig ?? resolvedConfig);
        setTranslations(restored.translations ?? resolvedTranslations);
        setIsEditingInstructions(restored.isEditingInstructions);
        setTranslationsDirty(restored.translationsDirty);
        return true;
      };

      form.reset({
        title: action.title || "",
        startTime: toSafeDate(action.startTime) ?? new Date(),
        endTime: toSafeDate(action.endTime) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      if (isMounted()) {
        setInstructionConfig(fallbackConfig);
        setTranslations(fallbackTranslations);
        setTranslationsDirty(false);
      }
      const didRestore = isMounted() ? restoreDraft(fallbackConfig, fallbackTranslations) : false;
      if (!action.instructions) return;

      setIsLoadingInstructions(true);
      let resolvedConfig = fallbackConfig;
      let resolvedTranslations = fallbackTranslations;
      try {
        const file = await getFileByHash(action.instructions, {
          timeoutMs: INSTRUCTION_LOAD_TIMEOUT_MS,
        });
        const metadata = await parseInstructionMetadata(file.data);
        if (isMounted() && !didRestore) {
          resolvedConfig = metadata.config ?? fallbackConfig;
          resolvedTranslations = metadata.config ? metadata.translations : fallbackTranslations;
          setInstructionConfig(resolvedConfig);
          setTranslations(resolvedTranslations);
          setTranslationsDirty(false);
        }
      } catch (error) {
        if (isMounted()) {
          logger.error("Failed to load instructions", { error });
          toastService.error({
            title: formatMessage({ id: "app.actions.edit.loadInstructionsFailed" }),
            description: formatMessage({ id: "app.actions.edit.usingDefault" }),
          });
        }
      } finally {
        if (isMounted()) {
          setIsLoadingInstructions(false);
          if (!didRestore) restoreDraft(resolvedConfig, resolvedTranslations);
        }
      }
    },
    [action?.id, action?.instructions, draftPath]
  );

  useEffect(() => {
    if (!draftPath || !action || restoredDraftPathRef.current !== draftPath) return;
    const subscription = form.watch((value) => {
      setDraftFormState(
        draftPath,
        serializeEditActionDraft(
          value,
          instructionConfig,
          isEditingInstructions,
          translations,
          translationsDirty,
          saveAttempt.current
        )
      );
    });
    return () => subscription.unsubscribe();
  }, [
    action,
    draftPath,
    form,
    instructionConfig,
    isEditingInstructions,
    setDraftFormState,
    translations,
    translationsDirty,
  ]);

  useEffect(() => {
    if (!draftPath || !action || restoredDraftPathRef.current !== draftPath) return;
    setDraftFormState(
      draftPath,
      serializeEditActionDraft(
        form.getValues(),
        instructionConfig,
        isEditingInstructions,
        translations,
        translationsDirty,
        saveAttempt.current
      )
    );
  }, [
    action,
    draftPath,
    form,
    instructionConfig,
    isEditingInstructions,
    setDraftFormState,
    translations,
    translationsDirty,
  ]);

  const persistAttempt = (data = form.getValues()) => {
    if (!draftPath || !saveAttempt.current) return;
    saveAttempt.current.completedWrites = Object.fromEntries(completedWrites.current);
    setDraftFormState(
      draftPath,
      serializeEditActionDraft(
        data,
        instructionConfig,
        isEditingInstructions,
        translations,
        translationsDirty,
        saveAttempt.current
      )
    );
  };

  const finishSave = () => {
    if (!mounted.current || activeEditScope.current !== editScope) return;
    toastService.success({ title: formatMessage({ id: "app.actions.edit.success" }) });
    operations.clearCompletedEdits();
    completedWrites.current.clear();
    saveAttempt.current = undefined;
    if (draftPath) clearDraftFormState(draftPath);
    navigate(actionDetailHref);
  };

  /** The title and window changes in the form, against what the action showed. */
  const formChanges = (data: EditActionFormData): ActionEditChange[] => {
    if (!action) return [];
    const changes: ActionEditChange[] = [];
    if (data.title !== action.title) changes.push({ field: "title", value: data.title });
    if (data.startTime.getTime() !== action.startTime)
      changes.push({ field: "startTime", value: Math.floor(data.startTime.getTime() / 1000) });
    if (data.endTime.getTime() !== action.endTime)
      changes.push({ field: "endTime", value: Math.floor(data.endTime.getTime() / 1000) });
    return changes;
  };
  const needsInstructions = (data: EditActionFormData) =>
    isEditingInstructions ||
    translationsDirty ||
    (Object.keys(translations).length > 0 && data.title !== action?.title);
  const fingerprintOf = (change: ActionEditChange) =>
    uid === null ? null : fingerprintActionArguments(actionEditArgs(uid, change));
  /** Whether this save attempt has seen this exact write land. */
  const landed = (change: ActionEditChange) =>
    completedWrites.current.get(ACTION_EDIT_WRITES[change.field]) === fingerprintOf(change);
  const markLanded = (changes: readonly ActionEditChange[]) => {
    for (const change of changes) {
      const fingerprint = fingerprintOf(change);
      if (fingerprint) completedWrites.current.set(ACTION_EDIT_WRITES[change.field], fingerprint);
    }
  };

  /** Whether everything the form holds has landed in this save attempt. */
  const everythingLanded = async (data: EditActionFormData) => {
    if (formChanges(data).some((change) => !landed(change))) return false;
    if (!needsInstructions(data)) return true;
    const fingerprint = completedWrites.current.get(ACTION_EDIT_WRITES.instructions);
    if (!fingerprint) return false;
    try {
      const [, cid] = JSON.parse(fingerprint) as [string, string];
      const file = await getFileByHash(cid, { timeoutMs: INSTRUCTION_LOAD_TIMEOUT_MS });
      const raw = typeof file.data === "string" ? file.data : await file.data.text();
      return (
        JSON.stringify(JSON.parse(raw)) ===
        JSON.stringify(buildActionInstructionsV2(data.title, instructionConfig, translations))
      );
    } catch (error) {
      // The edit stays open; saving again skips the writes that already landed.
      logger.warn("Could not check the uploaded instructions", { error });
      return false;
    }
  };

  const sendOne = (change: ActionEditChange) => {
    const target = actionUID!;
    switch (change.field) {
      case "title":
        return operations.updateActionTitle(target, change.value);
      case "startTime":
        return operations.updateActionStartTime(target, change.value);
      case "endTime":
        return operations.updateActionEndTime(target, change.value);
      case "instructions":
        return operations.updateActionInstructions(target, change.value);
    }
  };

  const submit = async (data: EditActionFormData) => {
    if (
      !action ||
      !id ||
      uid === null ||
      isPendingEdit ||
      operations.isLoading ||
      isCheckingConfirmation ||
      batch.hold ||
      batch.isSettlingHold ||
      batch.isSending
    )
      return;
    try {
      await operations.assertReady();
      saveAttempt.current ??= { id: crypto.randomUUID(), scope: editScope, completedWrites: {} };
      persistAttempt(data);
      const requireSuccess = (result: ActionOperationResult) => {
        if (result.confirmation === "pending") throw new TransactionConfirmationPendingError();
        if (!result.success) throw new Error(result.error?.message ?? "Action update failed");
      };
      const inScope = () => mounted.current && activeEditScope.current === editScope;
      const changes = formChanges(data);
      // The instructions go up before anything is written, so a failed upload saves nothing.
      if (needsInstructions(data)) {
        toastService.loading({
          title: formatMessage({ id: "app.actions.edit.uploadingInstructions" }),
        });
        const metadata = buildActionInstructionsV2(data.title, instructionConfig, translations);
        const file = new File([JSON.stringify(metadata, null, 2)], "instructions.json", {
          type: "application/json",
        });
        const upload = await uploadFileToIPFS(file);
        toastService.dismiss();
        changes.push({ field: "instructions", value: upload.cid });
      }
      const remaining = changes.filter((change) => !landed(change));
      if (!inScope()) throw new Error("Action editor scope changed");
      if (remaining.length > 0 && batch.available) {
        const outcome = await batch.send(remaining);
        if (!inScope()) return;
        if (outcome.status === "saved") return finishSave();
        // An unknown outcome is held and shown, and a failure is explained where it was sent.
        if (outcome.status !== "not-batchable") return;
      }
      const perform = async (change: ActionEditChange) => {
        if (!inScope()) throw new Error("Action editor scope changed");
        const result = await sendOne(change);
        if (!inScope()) throw new Error("Action editor scope changed");
        requireSuccess(result);
        markLanded([change]);
        persistAttempt(data);
      };
      if (remaining.length > 0)
        for (const change of await batch.order(remaining)) await perform(change);
      finishSave();
    } catch (error) {
      if (!mounted.current || activeEditScope.current !== editScope) return;
      if (error instanceof TransactionConfirmationPendingError) return;
      logger.error("Failed to update action", { error });
      // A window the registry would refuse stops before anything is sent; say which rule.
      const parsed = parseContractError(error);
      toastService.error({
        title: formatMessage({ id: "app.actions.edit.failed" }),
        message: parsed.isKnown ? parsed.message : undefined,
      });
    }
  };

  // Once per read of a held save: what it proved joins this save attempt, which is done when
  // nothing it holds is left to send. A read can settle a send by itself, so act on each read.
  const lastAppliedRead = useRef(0);
  useEffect(() => {
    if (!batch.lastReadAt || lastAppliedRead.current === batch.lastReadAt) return;
    lastAppliedRead.current = batch.lastReadAt;
    if (batch.saved.length === 0 || !saveAttempt.current) return;
    markLanded(batch.saved);
    persistAttempt();
    if (!batch.hold)
      void everythingLanded(form.getValues()).then((done) => {
        if (done) finishSave();
      });
  });

  const checkConfirmation = async () => {
    if (isCheckingConfirmation) return;
    setIsCheckingConfirmation(true);
    try {
      const outcome = await operations.reconcileEdits();
      if (!mounted.current || activeEditScope.current !== editScope || !outcome || !action || !id)
        return;
      saveAttempt.current ??= { id: crypto.randomUUID(), scope: editScope, completedWrites: {} };
      for (const edit of outcome.confirmed)
        completedWrites.current.set(edit.key.split(":").at(-2)!, edit.fingerprint);
      persistAttempt();
      operations.clearCompletedEdits();
      if (outcome.unresolved || outcome.reverted) return;
      if (await everythingLanded(form.getValues())) finishSave();
    } finally {
      setIsCheckingConfirmation(false);
    }
  };

  return {
    action,
    actionDetailHref,
    actionsListHref,
    actionsLoading,
    cancel: () => navigate(actionDetailHref),
    form,
    instructionConfig,
    isEditingInstructions,
    isLoading:
      operations.isLoading ||
      isPendingEdit ||
      isCheckingConfirmation ||
      batch.isSending ||
      batch.isSettlingHold,
    isPendingEdit,
    isCheckingConfirmation,
    checkConfirmation,
    /** An earlier save whose outcome is unknown; saving waits until it is settled. */
    holdFeedback: batch.holdFeedback,
    isLoadingInstructions,
    setInstructionConfig,
    setIsEditingInstructions,
    setTranslations,
    setTranslationsDirty,
    submit,
    translations,
  };
}
