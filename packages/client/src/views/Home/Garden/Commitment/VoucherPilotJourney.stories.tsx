import type { ServiceAccessSnapshot } from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { fn } from "storybook/test";
import { withRouter } from "../../../../../../shared/.storybook/decorators";
import { createServiceAccessPilotStory } from "../../../../../../shared/.storybook/serviceAccessPilotFixtures";
import { ServiceAccessPanel } from "./ServiceAccessPanel";
import { servicePilotStorySnapshot } from "./serviceAccessStoryFixtures";
import { VoucherPilotJourney } from "./VoucherPilotJourney";

const meta: Meta<typeof VoucherPilotJourney> = {
  title: "Client/Commitments/VoucherPilotJourney",
  component: VoucherPilotJourney,
  tags: ["autodocs"],
  decorators: [withRouter(["/home/fictional-garden/commitments/1025"])],
  parameters: { layout: "padded" },
  argTypes: { snapshot: { control: false } },
  args: {
    snapshot: servicePilotStorySnapshot(),
    busy: false,
    onAction: fn().mockResolvedValue(undefined),
  },
};
export default meta;
type Story = StoryObj<typeof VoucherPilotJourney>;
export const VoucherOnly: Story = {};
export const VoucherAndMonetaryReward: Story = {
  args: { snapshot: servicePilotStorySnapshot(true) },
};
export const WaitingForObservation: Story = { args: { busy: true } };
export const FailedVoucherPaidMoney: Story = {
  args: {
    snapshot: (() => {
      const s = servicePilotStorySnapshot(true);
      s.pilot!.reward!.voucher.state = "failed";
      s.pilot!.reward!.gd!.state = "delivered";
      s.pilot!.reward!.gd!.acknowledgment = "pending";
      return s;
    })(),
  },
};
export const CorrectVoucherHeld: Story = {
  args: {
    snapshot: (() => {
      const s = servicePilotStorySnapshot();
      s.pilot!.holdings.b = 1_000_000n;
      return s;
    })(),
  },
};
export const LiveUnavailable: Story = {
  args: {
    snapshot: (() => {
      const s = servicePilotStorySnapshot();
      s.evidence = "onchain";
      s.capabilities.mutation = "unavailable";
      return s;
    })(),
  },
};
export const NoPilot: Story = {
  args: {
    snapshot: (() => {
      const s = servicePilotStorySnapshot();
      delete s.pilot;
      return s;
    })(),
  },
};

export const InteractiveRehearsal: Story = {
  render: function InteractivePilot() {
    const { formatMessage } = useIntl();
    const text = (key: string) => formatMessage({ id: `app.serviceAccess.pilot.${key}` });
    const [fixture] = useState(createServiceAccessPilotStory);
    const [id, setId] = useState(1026n);
    const [snapshot, setSnapshot] = useState<ServiceAccessSnapshot | null>(null);
    const [pending, setPending] = useState(false);
    const key = { ...fixture.key, commitmentId: id };
    useEffect(() => {
      let active = true;
      void fixture.adapter.read({ ...fixture.key, commitmentId: id }).then((s) => {
        if (active) setSnapshot(s);
      });
      return () => {
        active = false;
      };
    }, [fixture, id]);
    const choose = (next: bigint) => {
      setSnapshot(null);
      setId(next);
    };
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || id === 1025n}
            emphasis="secondary"
            onClick={() => choose(1025n)}
          >
            {text("requestOnly")}
          </Button>
          <Button
            type="button"
            disabled={pending || id === 1026n}
            emphasis="secondary"
            onClick={() => choose(1026n)}
          >
            {text("requestWithMoney")}
          </Button>
          <Button
            type="button"
            disabled={pending || id === 1023n}
            emphasis="secondary"
            onClick={() => choose(1023n)}
          >
            {text("serviceView")}
          </Button>
        </div>
        {snapshot ? (
          <ServiceAccessPanel
            snapshot={snapshot}
            isPending={pending}
            onRefresh={() => {
              void fixture.adapter.read(key).then(setSnapshot);
            }}
            onAction={async (action) => {
              setPending(true);
              try {
                const result = await fixture.adapter.execute(key, action);
                setSnapshot(result.snapshot);
                return result;
              } finally {
                setPending(false);
              }
            }}
          />
        ) : (
          <p role="status">{text("loading")}</p>
        )}
      </div>
    );
  },
};
