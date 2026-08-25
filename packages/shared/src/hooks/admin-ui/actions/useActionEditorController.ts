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
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { toSafeDate } from "../../../utils/time";
import { useActionOperations } from "../../action/useActionOperations";
import { useActions } from "../../blockchain/useBaseLists";
import { useAsyncEffect } from "../../utils/useAsyncEffect";
import {
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
  const operations = useActionOperations(DEFAULT_CHAIN_ID);
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
          translationsDirty
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
        translationsDirty
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

  const submit = async (data: EditActionFormData) => {
    if (!action || !id) return;
    try {
      const actionUID = id.split("-")[1];
      if (data.title !== action.title) await operations.updateActionTitle(actionUID, data.title);
      if (data.startTime.getTime() !== action.startTime) {
        await operations.updateActionStartTime(
          actionUID,
          Math.floor(data.startTime.getTime() / 1000)
        );
      }
      if (data.endTime.getTime() !== action.endTime) {
        await operations.updateActionEndTime(actionUID, Math.floor(data.endTime.getTime() / 1000));
      }
      const shouldUpload =
        isEditingInstructions ||
        translationsDirty ||
        (Object.keys(translations).length > 0 && data.title !== action.title);
      if (shouldUpload) {
        toastService.loading({
          title: formatMessage({ id: "app.actions.edit.uploadingInstructions" }),
        });
        const metadata = buildActionInstructionsV2(data.title, instructionConfig, translations);
        const file = new File([JSON.stringify(metadata, null, 2)], "instructions.json", {
          type: "application/json",
        });
        const upload = await uploadFileToIPFS(file);
        toastService.dismiss();
        await operations.updateActionInstructions(actionUID, upload.cid);
      }
      toastService.success({ title: formatMessage({ id: "app.actions.edit.success" }) });
      if (draftPath) clearDraftFormState(draftPath);
      navigate(actionDetailHref);
    } catch (error) {
      logger.error("Failed to update action", { error });
      toastService.error({ title: formatMessage({ id: "app.actions.edit.failed" }) });
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
    isLoading: operations.isLoading,
    isLoadingInstructions,
    setInstructionConfig,
    setIsEditingInstructions,
    setTranslations,
    setTranslationsDirty,
    submit,
    translations,
  };
}
