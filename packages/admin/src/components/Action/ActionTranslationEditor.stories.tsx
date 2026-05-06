import {
  getActionSourceHash,
  type ActionInstructionConfig,
  type ActionInstructionTranslationData,
  type ActionTranslationMap,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ActionTranslationEditor } from "./ActionTranslationEditor";

const UPDATED_AT = "2026-01-16T00:00:00.000Z";
const SOURCE_TITLE = "Plant canopy trees";

const SOURCE_CONFIG: ActionInstructionConfig = {
  description: "Record a verified community tree planting session.",
  uiConfig: {
    media: {
      title: "Capture evidence",
      description: "Upload clear before and after photos of the planting site.",
      maxImageCount: 6,
      minImageCount: 2,
      required: true,
      needed: ["Before photo", "After photo"],
      optional: ["Team photo"],
    },
    details: {
      title: "Planting details",
      description: "Log the species, count, and field notes.",
      feedbackPlaceholder: "Describe the planting conditions.",
      inputs: [
        {
          key: "species",
          title: "Primary species",
          placeholder: "Tree species",
          type: "select",
          required: true,
          options: ["Mango", "Avocado", "Neem"],
        },
        {
          key: "treeCount",
          title: "Trees planted",
          placeholder: "Number of trees",
          type: "number",
          required: true,
          options: [],
        },
      ],
    },
    review: {
      title: "Review planting report",
      description: "Confirm the evidence and details before submitting.",
    },
  },
};

const SOURCE_HASH = getActionSourceHash(SOURCE_TITLE, SOURCE_CONFIG);

const COMPLETE_ES_DATA: ActionInstructionTranslationData = {
  title: "Plantar arboles de dosel",
  description: "Registra una jornada verificada de plantacion comunitaria de arboles.",
  uiConfig: {
    media: {
      title: "Capturar evidencia",
      description: "Sube fotos claras de antes y despues del sitio de plantacion.",
      needed: ["Foto antes", "Foto despues"],
      optional: ["Foto del equipo"],
    },
    details: {
      title: "Detalles de plantacion",
      description: "Registra la especie, cantidad y notas de campo.",
      feedbackPlaceholder: "Describe las condiciones de plantacion.",
      inputs: [
        {
          key: "species",
          title: "Especie principal",
          placeholder: "Especie de arbol",
          options: {
            Mango: "Mango",
            Avocado: "Aguacate",
            Neem: "Neem",
          },
        },
        {
          key: "treeCount",
          title: "Arboles plantados",
          placeholder: "Numero de arboles",
        },
      ],
    },
    review: {
      title: "Revisar reporte de plantacion",
      description: "Confirma la evidencia y los detalles antes de enviar.",
    },
  },
};

const COMPLETE_PT_DATA: ActionInstructionTranslationData = {
  title: "Plantar arvores de copa",
  description: "Registre uma sessao verificada de plantio comunitario de arvores.",
  uiConfig: {
    media: {
      title: "Capturar evidencias",
      description: "Envie fotos claras de antes e depois do local de plantio.",
      needed: ["Foto antes", "Foto depois"],
      optional: ["Foto da equipe"],
    },
    details: {
      title: "Detalhes do plantio",
      description: "Registre a especie, quantidade e notas de campo.",
      feedbackPlaceholder: "Descreva as condicoes de plantio.",
      inputs: [
        {
          key: "species",
          title: "Especie principal",
          placeholder: "Especie da arvore",
          options: {
            Mango: "Manga",
            Avocado: "Abacate",
            Neem: "Neem",
          },
        },
        {
          key: "treeCount",
          title: "Arvores plantadas",
          placeholder: "Numero de arvores",
        },
      ],
    },
    review: {
      title: "Revisar relatorio de plantio",
      description: "Confirme as evidencias e os detalhes antes de enviar.",
    },
  },
};

const DRAFT_TRANSLATIONS: ActionTranslationMap = {
  es: {
    status: "draft",
    sourceHash: SOURCE_HASH,
    updatedAt: UPDATED_AT,
    data: {
      title: "Plantar arboles de dosel",
      uiConfig: {
        media: {
          title: "Capturar evidencia",
        },
      },
    },
  },
};

const REVIEWED_TRANSLATIONS: ActionTranslationMap = {
  es: {
    status: "reviewed",
    sourceHash: SOURCE_HASH,
    updatedAt: UPDATED_AT,
    data: COMPLETE_ES_DATA,
  },
  pt: {
    status: "reviewed",
    sourceHash: SOURCE_HASH,
    updatedAt: UPDATED_AT,
    data: COMPLETE_PT_DATA,
  },
};

const STALE_TRANSLATIONS: ActionTranslationMap = {
  es: {
    status: "reviewed",
    sourceHash: "previous-source-hash",
    updatedAt: UPDATED_AT,
    data: COMPLETE_ES_DATA,
  },
};

interface ActionTranslationEditorHarnessProps {
  initialValue?: ActionTranslationMap;
}

function ActionTranslationEditorHarness({
  initialValue = {},
}: ActionTranslationEditorHarnessProps) {
  const [translations, setTranslations] = useState<ActionTranslationMap>(initialValue);

  return (
    <ActionTranslationEditor
      sourceTitle={SOURCE_TITLE}
      sourceConfig={SOURCE_CONFIG}
      value={translations}
      onChange={setTranslations}
    />
  );
}

const meta: Meta<typeof ActionTranslationEditorHarness> = {
  title: "Admin/Workflows/Action/ActionTranslationEditor",
  // storybook-quality-allow state-harness: owns local state while rendering the real ActionTranslationEditor.
  component: ActionTranslationEditorHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Locale review editor for action instructions. English remains canonical while reviewed translations can be published for runtime display.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ActionTranslationEditorHarness>;

export const Missing: Story = {
  args: { initialValue: {} },
};

export const Draft: Story = {
  args: { initialValue: DRAFT_TRANSLATIONS },
};

export const Reviewed: Story = {
  args: { initialValue: REVIEWED_TRANSLATIONS },
};

export const Stale: Story = {
  args: { initialValue: STALE_TRANSLATIONS },
};
