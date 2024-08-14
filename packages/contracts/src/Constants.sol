// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

// EAS (ETHEREUM ATTESTATION SERVICE)
address constant EAS_OP = 0x4200000000000000000000000000000000000021; // Any OP Stack deployed

bytes32 constant actionSchemaUid = 0xfcd67741f543211da27d50ef5b1f3d0a648a9760cc84414b037c1c011ed883a6;
bytes32 constant workSchemaUid = 0xb6e2f5905e3cce83d9713559ae8931940ac487fd4467a5134d8501eb2e339e81;
bytes32 constant workApprovalSchemaUid = 0xb6e2f5905e3cce83d9713559ae8931940ac487fd4467a5134d8501eb2e339e81;

address constant ActionResolver = 0xa547526412e87fBAD5B483bd17F6540a1dC686fd;
address constant WorkResolver = 0xd76a4D50F1CcaD941B85692Dc6681b35bC6B480c;
address constant WorkApprovalResolver = 0xd76a4D50F1CcaD941B85692Dc6681b35bC6B480c;

// BASE
address constant BasePaymaster = 0xf5d253B62543C6Ef526309D497f619CeF95aD430;



