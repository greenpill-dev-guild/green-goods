import { adminRoutes, useAdminStore, useGardenPermissions, useGardens } from "@green-goods/shared";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import {
  type HypercertCompletionData,
  HypercertWizard,
} from "@/components/Hypercerts/HypercertWizard";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function CreateHypercert() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const { data: gardens = [] } = useGardens();
  const garden = useMemo(
    () => gardens.find((item) => item.id === selectedGarden?.id),
    [gardens, selectedGarden?.id]
  );
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;

  const handleComplete = useCallback(
    (data: HypercertCompletionData) => {
      // Navigate to detail page with optimistic data for immediate rendering
      navigate(adminRoutes.gardenHypercertDetail(data.hypercertId), {
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
    [navigate]
  );

  if (!garden) {
    return (
      <div className="pb-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <PageHeader
            title={formatMessage({ id: "app.hypercerts.create.title" })}
            description={formatMessage({ id: "app.hypercerts.create.notFound" })}
            variant="canvas"
            backLink={{
              to: adminRoutes.garden(),
              label: formatMessage({ id: "app.hypercerts.backToGardens" }),
            }}
          />
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="pb-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <PageHeader
            title={formatMessage({ id: "app.hypercerts.create.title" })}
            description={formatMessage({ id: "app.hypercerts.create.unauthorized" })}
            variant="canvas"
            backLink={{
              to: adminRoutes.gardenImpact({ section: "hypercerts" }),
              label: formatMessage({ id: "app.hypercerts.backToHypercerts" }),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <PageHeader
          title={formatMessage({ id: "app.hypercerts.create.title" })}
          description={formatMessage(
            { id: "app.hypercerts.create.description" },
            { gardenName: garden.name }
          )}
          variant="canvas"
          backLink={{
            to: adminRoutes.gardenImpact({ section: "hypercerts" }),
            label: formatMessage({ id: "app.hypercerts.backToHypercerts" }),
          }}
          sticky
        />
      </div>
      <HypercertWizard
        gardenId={garden.id}
        gardenName={garden.name}
        onCancel={() => navigate(adminRoutes.gardenImpact({ section: "hypercerts" }))}
        onComplete={handleComplete}
      />
    </div>
  );
}
