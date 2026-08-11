import type { ParsedOptions } from "../utils/cli-parser";
import { NetworkManager } from "../utils/network";
import { ReleaseDeployer } from "./release";

/**
 * Compatibility facade for callers that construct PoolingDeployer directly. The CLI and this
 * facade both enter the same deterministic release path; the retired plain-new deployment and
 * direct JSON overwrite implementation no longer exist.
 */
export class PoolingDeployer {
  private readonly release: ReleaseDeployer;

  constructor(networkManager = new NetworkManager()) {
    this.release = new ReleaseDeployer(networkManager);
  }

  async deployPooling(options: ParsedOptions): Promise<void> {
    await this.release.run("pooling", options);
  }
}
