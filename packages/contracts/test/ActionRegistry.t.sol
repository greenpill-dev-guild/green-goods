// SPDX-License-Identifier: UNLICENSED
/* solhint-disable no-console2 */
/* solhint-disable no-console */
/* solhint-disable max-states-count */
pragma solidity ^0.8.25;

import { IEAS, AttestationRequestData, AttestationRequest } from "eas-contracts/IEAS.sol";
import { ISchemaRegistry } from "eas-contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "eas-contracts/resolver/ISchemaResolver.sol";

import { Test, console2 } from "forge-std/Test.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { EAS_ARB } from "../src/Constants.sol";

// import { ActionResolver } from "../src/resolvers/Action.sol";
import { ActionRegistry } from "../src/registries/Action.sol";

// import { ISchemaResolver } from "../src/interfaces/ISchemaResolver.sol";
// import { IEAS, AttestationRequest, AttestationRequestData } from "../src/interfaces/IEAS.sol";

contract MintTest is Test {
    address payable public alice = payable(0x00000000000000000000000000000000000A11cE);
    address payable public bob = payable(0x0000000000000000000000000000000000000B0b);

    IEAS public eas = IEAS(EAS_ARB);
    ISchemaRegistry public easRegistry = ISchemaRegistry(0x4200000000000000000000000000000000000020);

    address[] public team;
    string[] public capitals;

    bytes32 public salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 public actionSchemaUid;

    address public factory = address(this); //0x4e59b44847b379578588920cA78FbF26c0B4956C;

    address public actionResolver;
    address public actionRegistry;
}
