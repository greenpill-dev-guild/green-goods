import {
  type Address,
  ConfirmDialog,
  debugError,
  type Garden,
  hapticLight,
  hapticSuccess,
  isAlreadyGardenerError,
  isGardenMember,
  parseAndFormatError,
  toastService,
  useGardens,
  useJoinGarden,
  usePendingJoinsVersion,
  useTimeout,
} from "@green-goods/shared";
import { RiCheckLine, RiMapPinLine, RiPlantLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

interface GardensListProps {
  primaryAddress: Address | undefined;
}

export const GardensList: React.FC<GardensListProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { joinGarden, isJoining, joiningGardenId } = useJoinGarden();
  const [pendingGarden, setPendingGarden] = useState<Garden | null>(null);
  const ensDiscoveryTimeout = useTimeout();
  const pendingJoinsVersion = usePendingJoinsVersion();

  const allGardens = useMemo(() => {
    if (!primaryAddress || !gardens.length) return [];

    return gardens
      .filter((garden) => {
        const isOpen = garden.openJoining === true;
        const isMember = isGardenMember(
          primaryAddress,
          garden.gardeners,
          garden.operators,
          garden.id
        );
        return isOpen || isMember;
      })
      .map((garden) => ({
        ...garden,
        isMember: isGardenMember(primaryAddress, garden.gardeners, garden.operators, garden.id),
      }));
    // pendingJoinsVersion retriggers when a join confirms or expires in-tab,
    // so the Member badge updates without waiting for an unrelated re-render.
  }, [gardens, primaryAddress, pendingJoinsVersion]);

  const handleJoinGarden = (garden: Garden) => {
    setPendingGarden(garden);
  };

  const handleConfirmJoinGarden = async () => {
    if (!pendingGarden) return;

    hapticLight();
    try {
      await joinGarden(pendingGarden.id);

      hapticSuccess();
      toastService.success({
        title: intl.formatMessage(
          {
            id: "app.account.joinedGarden",
            defaultMessage: "Joined {gardenName}",
          },
          { gardenName: pendingGarden.name }
        ),
        message: intl.formatMessage({
          id: "app.account.joinedGardenMessage",
          defaultMessage: "Welcome to the garden!",
        }),
        context: "joinGarden",
      });

      const wasFirstJoin = allGardens.filter((g) => g.isMember).length === 0;
      if (wasFirstJoin) {
        ensDiscoveryTimeout.set(() => {
          toastService.info({
            title: intl.formatMessage({
              id: "app.account.ensDiscovery",
              defaultMessage: "Claim your Green Goods name",
            }),
            message: intl.formatMessage({
              id: "app.account.ensDiscoveryMessage",
              defaultMessage: "Pick a personal name so other gardeners can find you.",
            }),
            context: "ensDiscovery",
          });
        }, 2000);
      }
    } catch (err) {
      if (isAlreadyGardenerError(err)) {
        toastService.success({
          title: intl.formatMessage({
            id: "app.account.alreadyMember",
            defaultMessage: "Already a member",
          }),
          message: intl.formatMessage(
            {
              id: "app.account.alreadyMemberMessage",
              defaultMessage: "You're already a member of {gardenName}",
            },
            { gardenName: pendingGarden.name }
          ),
          context: "joinGarden",
        });
        setPendingGarden(null);
        return;
      }

      debugError(`Failed to join garden ${pendingGarden.id}`, err);

      const { title, message } = parseAndFormatError(err);

      toastService.error({
        title,
        message,
        context: "joinGarden",
        error: err,
      });
    } finally {
      setPendingGarden(null);
    }
  };

  if (!primaryAddress) return null;

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.gardens",
          defaultMessage: "Gardens",
        })}
      </h5>

      {gardensLoading ? (
        <Card>
          <div className="flex flex-row items-center justify-center w-full py-2">
            <span className="text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.profile.loadingGardens",
                defaultMessage: "Loading gardens...",
              })}
            </span>
          </div>
        </Card>
      ) : allGardens.length > 0 ? (
        <div className="flex flex-col gap-2">
          {allGardens.map((garden) => {
            const isJoiningThis = isJoining && joiningGardenId === garden.id;

            return (
              <Card key={garden.id}>
                <div className="flex min-w-0 items-center gap-3 w-full">
                  <Avatar>
                    <div className="flex items-center justify-center text-center mx-auto text-primary">
                      <RiPlantLine className="w-4" />
                    </div>
                  </Avatar>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1 overflow-hidden">
                    <div
                      className="line-clamp-2 min-w-0 max-w-full text-sm font-medium leading-snug [overflow-wrap:anywhere]"
                      title={garden.name}
                    >
                      {garden.name}
                    </div>
                    {garden.location && (
                      <div className="flex min-w-0 max-w-full items-center gap-1 text-xs text-text-sub-600">
                        <RiMapPinLine className="w-3 h-3 shrink-0" />
                        <span className="min-w-0 truncate" title={garden.location}>
                          {garden.location}
                        </span>
                      </div>
                    )}
                  </div>
                  {garden.isMember ? (
                    <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                      <RiCheckLine className="w-4 h-4" />
                      <span>
                        {intl.formatMessage({
                          id: "app.profile.member",
                          defaultMessage: "Member",
                        })}
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      mode="filled"
                      size="small"
                      onClick={() => handleJoinGarden(garden)}
                      label={intl.formatMessage({
                        id: "app.profile.join",
                        defaultMessage: "Join",
                      })}
                      disabled={isJoiningThis}
                      className="shrink-0"
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 w-full py-4">
            <RiPlantLine className="w-8 h-8 text-text-soft-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-text-strong-950">
                {intl.formatMessage({
                  id: "app.profile.noGardensTitle",
                  defaultMessage: "No gardens yet",
                })}
              </p>
              <p className="text-xs text-text-sub-600 mt-1">
                {intl.formatMessage({
                  id: "app.profile.noGardensDescription",
                  defaultMessage: "Discover and join gardens to start submitting work",
                })}
              </p>
            </div>
            <Button
              variant="primary"
              mode="filled"
              size="xsmall"
              onClick={() => navigate("/home")}
              leadingIcon={<RiPlantLine className="w-4" />}
              label={intl.formatMessage({
                id: "app.profile.discoverGardens",
                defaultMessage: "Open Gardens",
              })}
            />
          </div>
        </Card>
      )}

      <ConfirmDialog
        isOpen={pendingGarden !== null}
        onClose={() => setPendingGarden(null)}
        onConfirm={handleConfirmJoinGarden}
        title={intl.formatMessage({
          id: "app.profile.joinGardenConfirmTitle",
          defaultMessage: "Join Garden",
        })}
        description={
          pendingGarden
            ? intl.formatMessage(
                {
                  id: "app.profile.joinGardenConfirmDescription",
                  defaultMessage:
                    "Garden: {gardenName}. {gardenDescription} You'll join as a Gardener and be able to submit work.",
                },
                {
                  gardenName: pendingGarden.name,
                  gardenDescription: pendingGarden.description
                    ? `${pendingGarden.description}.`
                    : intl.formatMessage({
                        id: "app.profile.joinGardenNoDescription",
                        defaultMessage: "No garden description provided.",
                      }),
                }
              )
            : undefined
        }
        confirmLabel={intl.formatMessage({
          id: "app.profile.joinGardenConfirmAction",
          defaultMessage: "Join",
        })}
        isLoading={isJoining}
      />
    </>
  );
};
