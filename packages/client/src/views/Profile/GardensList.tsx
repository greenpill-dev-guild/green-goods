import {
  type Address,
  ConfirmDialog,
  createPublicClientForChain,
  DEFAULT_CHAIN_ID,
  debugError,
  type Garden,
  GardenAccountABI,
  getDefaultChain,
  hapticLight,
  hapticSuccess,
  isAlreadyGardenerError,
  isGardenMember,
  parseAndFormatError,
  toastService,
  useGardens,
  useJoinGarden,
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
  const [estimatedGas, setEstimatedGas] = useState<bigint | null>(null);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const ensDiscoveryTimeout = useTimeout();

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
  }, [gardens, primaryAddress]);

  const handleJoinGarden = async (garden: Garden) => {
    setPendingGarden(garden);
    setEstimatedGas(null);
    if (!primaryAddress) return;

    setIsEstimatingGas(true);
    try {
      const chainId = Number(getDefaultChain().chainId ?? DEFAULT_CHAIN_ID);
      const publicClient = createPublicClientForChain(chainId);
      const gas = await publicClient.estimateContractGas({
        abi: GardenAccountABI,
        address: garden.id as Address,
        functionName: "joinGarden",
        args: [],
        account: primaryAddress as Address,
      });
      setEstimatedGas(gas);
    } catch {
      setEstimatedGas(null);
    } finally {
      setIsEstimatingGas(false);
    }
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
              defaultMessage: "Claim your .greengoods.eth name",
            }),
            message: intl.formatMessage({
              id: "app.account.ensDiscoveryMessage",
              defaultMessage: "As a protocol member, you can claim a personal ENS subdomain.",
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
                <div className="flex flex-row items-center gap-3 justify-between w-full">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar>
                      <div className="flex items-center justify-center text-center mx-auto text-primary">
                        <RiPlantLine className="w-4" />
                      </div>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{garden.name}</div>
                      {garden.location && (
                        <div className="flex items-center gap-1 text-xs text-text-sub-600">
                          <RiMapPinLine className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-1">{garden.location}</span>
                        </div>
                      )}
                    </div>
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
                      size="xsmall"
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
                {!garden.isMember && (
                  <p className="mt-2 text-xs text-text-sub-600">
                    {intl.formatMessage({
                      id: "app.profile.gardenerRoleDescription",
                      defaultMessage: "Join as a Gardener to submit work in this garden.",
                    })}
                  </p>
                )}
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
                defaultMessage: "Discover Gardens",
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
                    "Garden: {gardenName}. {gardenDescription} You'll join as a Gardener, able to submit work. Estimated gas: {gasEstimate}.",
                },
                {
                  gardenName: pendingGarden.name,
                  gardenDescription: pendingGarden.description
                    ? `${pendingGarden.description}.`
                    : intl.formatMessage({
                        id: "app.profile.joinGardenNoDescription",
                        defaultMessage: "No garden description provided.",
                      }),
                  gasEstimate: isEstimatingGas
                    ? intl.formatMessage({
                        id: "app.profile.joinGardenGasLoading",
                        defaultMessage: "calculating",
                      })
                    : estimatedGas
                      ? intl.formatNumber(estimatedGas)
                      : intl.formatMessage({
                          id: "app.profile.joinGardenGasUnavailable",
                          defaultMessage: "unavailable",
                        }),
                }
              )
            : undefined
        }
        confirmLabel={intl.formatMessage({
          id: "app.profile.joinGardenConfirmAction",
          defaultMessage: "Confirm Join",
        })}
        isLoading={isJoining}
      />
    </>
  );
};
