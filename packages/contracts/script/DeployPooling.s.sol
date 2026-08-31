// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { DeployCommitmentRelease } from "./DeployCommitmentRelease.s.sol";

/// @notice Backward-compatible Foundry contract name. Operator calls stay Bun-wrapped through
///         `deploy.ts pooling`, which supplies the frozen library map, salt, sender, and manifest
///         environment consumed by `DeployCommitmentRelease`.
contract DeployCommitmentPooling is DeployCommitmentRelease { }
