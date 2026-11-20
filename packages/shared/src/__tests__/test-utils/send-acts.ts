import { registerTelemetrySink } from "../../modules/app/telemetry-sink";

/**
 * Collects the `send_act_*` records made while `run` runs (PRD-1553, PRD-1571): each as
 * `[event, act, outcome]`, plus everything sent, lowercased, to check no address or hash leaked.
 */
export async function captureSendActs(run: () => Promise<unknown>): Promise<{
  acts: Array<[string, unknown, unknown]>;
  sent: string;
}> {
  const captured: Array<[string, Record<string, unknown>]> = [];
  const unregister = registerTelemetrySink({
    capture: (event, properties) => {
      if (event.startsWith("send_act_")) captured.push([event, properties]);
    },
  });
  try {
    await run();
  } finally {
    unregister();
  }
  return {
    acts: captured.map(([event, { act, outcome }]) => [event, act, outcome]),
    sent: JSON.stringify(captured).toLowerCase(),
  };
}
