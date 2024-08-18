// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// TOKENBOUND (FUTURE PRIMTIVE)
address constant TOKENBOUND_REGISTRY = 0x002c0c13181038780F552f0eC1B72e8C720147E6; // Same address on all EVM chains
address constant TOKENBOUND_ACCOUNT = 0x9FFDEb36540e1a12b1F27751508715174122C090; // Same address on all EVM chains

// EAS (ETHEREUM ATTESTATION SERVICE)
address constant EAS_ARB = 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458;
address constant EAS_SEPOLIA = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;

bytes32 constant workSchemaUid = 0x0;
bytes32 constant workApprovalSchemaUid = 0x0;

address constant ActionRegistry = 0xa547526412e87fBAD5B483bd17F6540a1dC686fd;
address constant WorkResolver = 0x0000000000000000000000000000000000000000;
address constant WorkApprovalResolver = 0x0000000000000000000000000000000000000000;

// ERROR MESSAGES
error NotGardenAccount();
error NotGardenerAccount();
error NotInActionRegistry();

// ENUMS
enum Capital {
  SOCIAL,
  MATERIAL,
  FINANCIAL,
  LIVING,
  INTELLECTUAL,
  EXPERIENTIAL,
  SPIRITUAL,
  CULTURAL
}


