/**
 * A simulation that failed. `definitive` when the chain itself refused, so the
 * same send would revert; otherwise the answer never arrived and a later check
 * may pass. `reason` names the refusal where the chain gave one.
 *
 * It lives apart from the simulation so a caller can recognise it without
 * loading the simulation and its encoders.
 */
export class SimulationRejected extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly definitive: boolean,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "SimulationRejected";
  }
}
