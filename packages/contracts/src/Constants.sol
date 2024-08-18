// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

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


