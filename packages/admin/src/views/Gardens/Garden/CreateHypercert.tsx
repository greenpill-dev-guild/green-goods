import { useGardens, useGardenPermissions } from "@green-goods/shared";
import { useNavigate, useParams } from "react-router-dom";
import { useMemo, useCallback } from "react";
import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";
import {
  HypercertWizard,
  type HypercertCompletionData,
} from "@/components/hypercerts/HypercertWizard";

export default function CreateHypercert() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { data: gardens = [] } = useGardens();
  const garden = useMemo(() => gardens.find((item) => item.id === id), [gardens, id]);
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;

  const handleComplete = useCallback(
    (data: HypercertCompletionData) => {
      // Navigate to detail page with optimistic data for immediate rendering
      navigate(`/gardens/${garden?.id}/hypercerts/${data.hypercertId}`, {
        state: {
          optimisticData: {
            id: data.hypercertId,
            title: data.title,
            description: data.description,
            workScopes: data.workScopes,
            imageUri: data.imageUri,
            attestationCount: data.attestationCount,
            mintedAt: data.mintedAt,
            txHash: data.txHash,
          },
        },
      });
    },
    [garden?.id, navigate]
  );

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.hypercerts.create.title" })}
          description={formatMessage({ id: "app.hypercerts.create.notFound" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.hypercerts.backToGardens" }),
          }}
        />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.hypercerts.create.title" })}
          description={formatMessage({ id: "app.hypercerts.create.unauthorized" })}
          backLink={{
            to: `/gardens/${garden.id}`,
            label: formatMessage({ id: "app.hypercerts.backToGarden" }),
          }}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.hypercerts.create.title" })}
        description={formatMessage(
          { id: "app.hypercerts.create.description" },
          { gardenName: garden.name }
        )}
        backLink={{
          to: `/gardens/${garden.id}/hypercerts`,
          label: formatMessage({ id: "app.hypercerts.backToHypercerts" }),
        }}
        sticky
      />
      <HypercertWizard
        gardenId={garden.id}
        gardenName={garden.name}
        onCancel={() => navigate(`/gardens/${garden.id}/hypercerts`)}
        onComplete={handleComplete}
      />
    </div>
  );
}
