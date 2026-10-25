// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { StewardSafeReceiver } from "../../src/accounts/StewardSafeReceiver.sol";
import { IHatsSignerGateV2 } from "../../src/interfaces/IHatsSignerGateV2.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { StewardRoleCodec as Codec } from "../../src/libraries/StewardRoleCodec.sol";

interface IProbeSafe {
    function execTransaction(
        address,
        uint256,
        bytes calldata,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address,
        bytes calldata
    )
        external
        payable
        returns (bool);
    function nonce() external view returns (uint256);
}

contract ProbeSigner {
    function attemptFinalize(StewardSafeReceiver receiver) external returns (bool) {
        (bool ok,) = address(receiver).call(abi.encodeCall(receiver.finalizeBootstrap, ()));
        return ok;
    }

    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) {
        return 0x1626ba7e;
    }

    function isValidSignature(bytes calldata, bytes calldata) external pure returns (bytes4) {
        return 0x20c13b0b;
    }
}

/// @dev Disposable read-only probe: synthetic signers and transport, real pinned Gnosis dependencies.
contract StewardBootstrapProbe is ProbeSigner {
    address private constant MULTISEND = 0x9641d764fc13c8B624c04430C7356C1C7C8102e2;
    address private constant PEER = address(0x1111);
    address private constant GARDEN = address(0x2222);

    function preview(
        address router,
        address publisher,
        address garden,
        uint256 topHat,
        uint256 salt,
        address bootstrap
    )
        external
        returns (address safe, address gate, address receiver)
    {
        StewardSafeReceiver r = new StewardSafeReceiver(router, publisher, garden, topHat, salt, bootstrap);
        require(!r.bootstrapFinalized() && !r.gate().locked(), "bootstrap mode");
        require(r.safe().isOwner(bootstrap) && r.gate().validSignerCount() == 1, "bootstrap owner");
        require(r.safe().getThreshold() == 1, "threshold");
        return (address(r.safe()), address(r.gate()), address(r));
    }

    function prove(uint256 topHat) external returns (address safe, address gate, uint256 nonce) {
        StewardSafeReceiver r = new StewardSafeReceiver(address(this), PEER, GARDEN, topHat, 0, address(this));
        IProbeSafe s = IProbeSafe(address(r.safe()));
        require(r.gate().validSignerCount() == 1 && !r.gate().locked(), "initial owner");
        _exec(s, address(0x4444), "", 0, _one());
        (bool ok,) = address(r).call(abi.encodeCall(r.finalizeBootstrap, ()));
        require(!ok && !r.bootstrapFinalized(), "early finalization");
        _exec(s, MULTISEND, _batch(address(0x4444), ""), 1, _one());
        _rejectBatch(s, abi.encodeWithSignature("setGuard(address)", address(0)), _one());
        _rejectBatch(s, abi.encodeWithSignature("enableModule(address)", address(this)), _one());
        _rejectBatch(s, abi.encodeWithSignature("setFallbackHandler(address)", address(this)), _one());
        ProbeSigner second = new ProbeSigner();
        _rejectBatch(s, abi.encodeWithSignature("addOwnerWithThreshold(address,uint256)", address(second), 1), _one());
        _mirror(r, address(this), 1, true);
        _mirror(r, address(second), 1, true);
        require(r.gate().validSignerCount() == 2, "verified owners");
        require(!second.attemptFinalize(r), "bootstrap controls finalization");
        r.finalizeBootstrap();
        IHatsSignerGateV2.ThresholdConfig memory config = r.gate().thresholdConfig();
        require(r.bootstrapFinalized() && r.gate().locked() && config.min == 2 && config.target == 2, "fixed two");
        bytes memory both = _two(address(second));
        _exec(s, MULTISEND, _batch(address(0x4444), ""), 1, both);
        _rejectBatch(s, abi.encodeWithSignature("changeThreshold(uint256)", 1), both);
        _mirror(r, address(second), 2, false);
        uint256 oldNonce = s.nonce();
        (ok,) = address(s).call(_encoded(address(0x4444), "", 0, _one()));
        require(!ok && s.nonce() == oldNonce, "revocation requires two");
        _mirror(r, address(second), 3, true);
        _exec(s, address(0x4444), "", 0, both);
        (ok,) = address(r).call(abi.encodeCall(r.finalizeBootstrap, ()));
        require(!ok, "one way");
        return (address(s), address(r.gate()), s.nonce());
    }

    function _mirror(StewardSafeReceiver r, address account, uint64 revision, bool eligible) private {
        r.ccipReceive(
            Client.Any2EVMMessage({
                messageId: keccak256(abi.encode(account, revision)),
                sourceChainSelector: Codec.SOURCE_SELECTOR,
                sender: abi.encode(PEER),
                data: Codec.encode(GARDEN, account, revision, eligible),
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
    }

    function _one() private view returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(address(this)))), bytes32(uint256(65)), uint8(0), bytes32(0));
    }

    function _two(address other) private view returns (bytes memory) {
        (address a, address b) = address(this) < other ? (address(this), other) : (other, address(this));
        return abi.encodePacked(
            bytes32(uint256(uint160(a))),
            bytes32(uint256(130)),
            uint8(0),
            bytes32(uint256(uint160(b))),
            bytes32(uint256(162)),
            uint8(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function _batch(address to, bytes memory data) private pure returns (bytes memory) {
        bytes memory transactions = abi.encodePacked(uint8(0), to, uint256(0), uint256(data.length), data);
        return abi.encodeWithSignature("multiSend(bytes)", transactions);
    }

    function _rejectBatch(IProbeSafe s, bytes memory data, bytes memory sig) private {
        uint256 oldNonce = s.nonce();
        (bool ok,) = address(s).call(_encoded(MULTISEND, _batch(address(s), data), 1, sig));
        require(!ok && s.nonce() == oldNonce, "Safe state mutation");
    }

    function _encoded(address to, bytes memory data, uint8 op, bytes memory sig) private pure returns (bytes memory) {
        return abi.encodeCall(IProbeSafe.execTransaction, (to, 0, data, op, 0, 0, 0, address(0), address(0), sig));
    }

    function _exec(IProbeSafe s, address to, bytes memory data, uint8 op, bytes memory sig) private {
        require(s.execTransaction(to, 0, data, op, 0, 0, 0, address(0), address(0), sig), "Safe execution");
    }
}
