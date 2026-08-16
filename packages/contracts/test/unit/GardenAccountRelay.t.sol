// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { GardenActionRouter } from "../../src/accounts/GardenActionRouter.sol";
import { CeloGardenAccountRelay } from "../../src/accounts/CeloGardenAccountRelay.sol";
import { GardenSafeActionCodec } from "../../src/libraries/GardenSafeActionCodec.sol";

interface ICcipReceiverLike {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

interface IERC1271RelayMock {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
}

contract GardenRelayMockRecoverySafe {
    bytes4 private constant MAGIC_VALUE = 0x1626ba7e;

    function isValidSignature(bytes32, bytes calldata signature) external pure returns (bytes4) {
        if (keccak256(signature) == keccak256(hex"123456")) return MAGIC_VALUE;
        return 0xffffffff;
    }
}

contract GardenRelayMockCcipRouter {
    uint256 public fee = 1;
    uint256 public nonce;
    uint64 public lastDestinationSelector;
    bytes public lastReceiver;
    bytes public lastData;

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        return fee;
    }

    function ccipSend(
        uint64 destinationSelector,
        Client.EVM2AnyMessage calldata message
    )
        external
        payable
        returns (bytes32 messageId)
    {
        require(msg.value == fee, "fee");
        lastDestinationSelector = destinationSelector;
        lastReceiver = message.receiver;
        lastData = message.data;
        messageId = keccak256(abi.encode(address(this), ++nonce));
    }

    function deliver(
        address receiver,
        bytes32 messageId,
        uint64 sourceSelector,
        address sender,
        bytes calldata data
    )
        external
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        ICcipReceiverLike(receiver)
            .ccipReceive(
                Client.Any2EVMMessage({
                    messageId: messageId,
                    sourceChainSelector: sourceSelector,
                    sender: abi.encode(sender),
                    data: data,
                    destTokenAmounts: noTokens
                })
            );
    }

    function deliverWithToken(
        address receiver,
        bytes32 messageId,
        uint64 sourceSelector,
        address sender,
        bytes calldata data
    )
        external
    {
        Client.EVMTokenAmount[] memory tokens = new Client.EVMTokenAmount[](1);
        tokens[0] = Client.EVMTokenAmount({ token: address(0xDEAD), amount: 1 });
        ICcipReceiverLike(receiver)
            .ccipReceive(
                Client.Any2EVMMessage({
                    messageId: messageId,
                    sourceChainSelector: sourceSelector,
                    sender: abi.encode(sender),
                    data: data,
                    destTokenAmounts: tokens
                })
            );
    }
}

contract GardenRelayMockRegistry {
    mapping(bytes32 key => address account_) private _accounts;

    function setAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        address account_
    )
        external
    {
        _accounts[keccak256(abi.encode(implementation, salt, chainId, tokenContract, tokenId))] = account_;
    }

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    )
        external
        view
        returns (address)
    {
        return _accounts[keccak256(abi.encode(implementation, salt, chainId, tokenContract, tokenId))];
    }
}

contract GardenRelayMockTarget {
    uint256 public calls;

    function record() external {
        calls++;
    }

    function fail() external pure {
        revert("target failure");
    }
}

contract GardenRelayMockSafe {
    uint256 private constant SAFE_CHAIN_ID = 42_220;

    address public immutable gardenAccount;
    address public immutable recoveryOne;
    address public immutable recoveryTwo;
    uint256 public nonce;
    bytes public lastSignatures;

    constructor(address gardenAccount_, address recoveryOne_, address recoveryTwo_) {
        gardenAccount = gardenAccount_;
        recoveryOne = recoveryOne_;
        recoveryTwo = recoveryTwo_;
    }

    function isOwner(address candidate) external view returns (bool) {
        return candidate == gardenAccount || candidate == recoveryOne || candidate == recoveryTwo;
    }

    function getOwners() external view returns (address[] memory owners) {
        owners = new address[](3);
        owners[0] = gardenAccount;
        owners[1] = recoveryOne;
        owners[2] = recoveryTwo;
    }

    function getThreshold() external pure returns (uint256) {
        return 2;
    }

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 safeNonce
    )
        external
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                address(this),
                SAFE_CHAIN_ID,
                to,
                value,
                keccak256(data),
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                safeNonce
            )
        );
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes calldata signatures
    )
        external
        payable
        returns (bool success)
    {
        require(msg.sender == gardenAccount, "garden caller");
        require(operation == 0, "operation");
        bytes32 transactionHash = this.getTransactionHash(
            to,
            value,
            data,
            operation,
            0,
            0,
            0,
            address(0),
            address(0),
            nonce
        );
        _checkSignatures(transactionHash, signatures);
        lastSignatures = signatures;
        nonce++;
        (success,) = to.call{ value: value }(data);
    }

    function _checkSignatures(bytes32 transactionHash, bytes calldata signatures) private view {
        require(signatures.length >= 162, "signature length");
        address previousOwner;
        bool gardenSeen;
        bool recoverySeen;

        for (uint256 i; i < 2; ++i) {
            uint256 offset = i * 65;
            bytes32 r;
            bytes32 s;
            assembly {
                r := calldataload(add(signatures.offset, offset))
                s := calldataload(add(add(signatures.offset, offset), 32))
            }
            uint8 v = uint8(signatures[offset + 64]);
            address owner = address(uint160(uint256(r)));
            require(owner > previousOwner, "owner order");
            previousOwner = owner;

            if (v == 1) {
                require(owner == gardenAccount && uint256(s) == 0 && msg.sender == owner, "prevalidated");
                gardenSeen = true;
            } else if (v == 0) {
                require(owner == recoveryOne || owner == recoveryTwo, "recovery owner");
                require(_isValidRecoverySignature(owner, transactionHash, signatures, uint256(s)), "EIP-1271");
                recoverySeen = true;
            } else {
                revert("signature type");
            }
        }
        require(gardenSeen && recoverySeen, "threshold");
    }

    function _isValidRecoverySignature(
        address owner,
        bytes32 transactionHash,
        bytes calldata signatures,
        uint256 dynamicOffset
    )
        private
        view
        returns (bool)
    {
        require(dynamicOffset == 130, "dynamic offset");
        uint256 signatureLength;
        assembly {
            signatureLength := calldataload(add(signatures.offset, dynamicOffset))
        }
        require(dynamicOffset + 32 + signatureLength <= signatures.length, "dynamic bounds");
        bytes calldata contractSignature = signatures[dynamicOffset + 32:dynamicOffset + 32 + signatureLength];
        return IERC1271RelayMock(owner).isValidSignature(transactionHash, contractSignature) == 0x1626ba7e;
    }
}

contract GardenRelayMockAccount {
    address public relay;

    function setRelay(address relay_) external {
        relay = relay_;
    }

    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    )
        external
        payable
        returns (bytes memory result)
    {
        require(msg.sender == relay, "relay");
        require(operation == 0 && value == 0, "outer call");
        (bool success, bytes memory returnData) = to.call(data);
        require(success, "safe call");
        return returnData;
    }
}

contract GardenAccountRelayTest is Test {
    uint64 private constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 private constant CELO_SELECTOR = 1_346_049_177_634_351_622;
    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    uint256 private constant CELO_CHAIN_ID = 42_220;
    address private constant IMPLEMENTATION = 0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692;
    address private constant GARDEN_TOKEN = 0xe1Da335110b1ed48e7df63209f5D424d02276593;
    bytes32 private constant SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
    address private constant GREEN_GOODS_SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    address private constant DEV_GUILD_SAFE = 0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C;
    uint256 private constant TOKEN_ID = 7;

    GardenRelayMockCcipRouter private sourceCcip;
    GardenRelayMockCcipRouter private destinationCcip;
    GardenRelayMockRegistry private registry;
    GardenRelayMockAccount private gardenAccount;
    GardenRelayMockSafe private gardenSafe;
    GardenRelayMockTarget private target;
    GardenActionRouter private sourceRouter;
    CeloGardenAccountRelay private relay;

    function setUp() public {
        sourceCcip = new GardenRelayMockCcipRouter();
        destinationCcip = new GardenRelayMockCcipRouter();
        registry = new GardenRelayMockRegistry();
        gardenAccount = new GardenRelayMockAccount();
        GardenRelayMockRecoverySafe recoveryImplementation = new GardenRelayMockRecoverySafe();
        vm.etch(GREEN_GOODS_SAFE, address(recoveryImplementation).code);
        vm.etch(DEV_GUILD_SAFE, address(recoveryImplementation).code);
        gardenSafe = new GardenRelayMockSafe(address(gardenAccount), GREEN_GOODS_SAFE, DEV_GUILD_SAFE);
        target = new GardenRelayMockTarget();

        address[] memory accounts = new address[](1);
        accounts[0] = address(gardenAccount);
        address[] memory safes = new address[](1);
        safes[0] = address(gardenSafe);

        vm.chainId(ARBITRUM_CHAIN_ID);
        sourceRouter = new GardenActionRouter(
            address(sourceCcip),
            ARBITRUM_SELECTOR,
            CELO_SELECTOR,
            address(destinationCcip),
            address(this),
            address(registry),
            IMPLEMENTATION,
            GARDEN_TOKEN,
            500_000,
            accounts,
            safes
        );

        vm.chainId(CELO_CHAIN_ID);
        relay = new CeloGardenAccountRelay(
            address(destinationCcip),
            ARBITRUM_SELECTOR,
            CELO_SELECTOR,
            address(sourceRouter),
            address(registry),
            IMPLEMENTATION,
            GARDEN_TOKEN,
            GREEN_GOODS_SAFE,
            DEV_GUILD_SAFE,
            accounts,
            safes
        );

        vm.chainId(ARBITRUM_CHAIN_ID);
        sourceRouter.bindDestinationRelay(address(relay));

        gardenAccount.setRelay(address(relay));
        registry.setAccount(IMPLEMENTATION, SALT, ARBITRUM_CHAIN_ID, GARDEN_TOKEN, TOKEN_ID, address(gardenAccount));
        vm.deal(address(gardenAccount), 100 ether);
    }

    function testRouter_destinationRelayBindingIsRequiredAndPermanent() public {
        address[] memory accounts = new address[](1);
        accounts[0] = address(gardenAccount);
        address[] memory safes = new address[](1);
        safes[0] = address(gardenSafe);

        vm.chainId(ARBITRUM_CHAIN_ID);
        GardenActionRouter unbound = new GardenActionRouter(
            address(sourceCcip),
            ARBITRUM_SELECTOR,
            CELO_SELECTOR,
            address(destinationCcip),
            address(this),
            address(registry),
            IMPLEMENTATION,
            GARDEN_TOKEN,
            500_000,
            accounts,
            safes
        );

        GardenSafeActionCodec.Action memory action = _action(hex"123456");
        action.sourceRouter = address(unbound);

        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.DestinationRelayUnbound.selector);
        unbound.propose{ value: 1 }(action);

        vm.prank(address(0xBAD));
        vm.expectRevert(GardenActionRouter.UnauthorizedBinding.selector);
        unbound.bindDestinationRelay(address(relay));

        unbound.bindDestinationRelay(address(relay));
        assertEq(unbound.destinationRelay(), address(relay));

        vm.expectRevert(GardenActionRouter.DestinationRelayAlreadyBound.selector);
        unbound.bindDestinationRelay(address(0xBEEF));
    }

    function testRelay_proposeFinalizeExecuteBindsExactGardenSafeAction() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);

        bytes32 actionId = _propose(action);
        _deliverLatest(bytes32(uint256(1)));
        assertEq(uint8(relay.actionStatus(actionId)), uint8(GardenSafeActionCodec.ActionStatus.Proposed));

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        sourceRouter.finalize{ value: 1 }(actionId, action);
        _deliverLatest(bytes32(uint256(2)));
        assertEq(uint8(relay.actionStatus(actionId)), uint8(GardenSafeActionCodec.ActionStatus.Finalized));

        vm.chainId(CELO_CHAIN_ID);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);

        assertEq(target.calls(), 1);
        assertEq(gardenSafe.nonce(), 1);
        assertEq(uint8(relay.actionStatus(actionId)), uint8(GardenSafeActionCodec.ActionStatus.Executed));
        assertGt(gardenSafe.lastSignatures().length, 130, "nested owner signatures missing");
    }

    function testRelay_rejectsWrongSourceSenderGardenSafeAndTokenDelivery() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.expectRevert(GardenActionRouter.UnauthorizedGarden.selector);
        sourceRouter.propose{ value: 1 }(action);

        action.destinationSafe = address(0xBEEF);
        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.InvalidAction.selector);
        sourceRouter.propose{ value: 1 }(action);

        action = _action(recoverySignature);
        bytes32 actionId = _propose(action);
        actionId;
        vm.chainId(CELO_CHAIN_ID);
        bytes memory proposedMessage = sourceCcip.lastData();
        vm.expectRevert(CeloGardenAccountRelay.InvalidCcipSender.selector);
        destinationCcip.deliver(address(relay), bytes32(uint256(3)), ARBITRUM_SELECTOR, address(0xBAD), proposedMessage);
        vm.expectRevert(CeloGardenAccountRelay.CcipTokensNotAllowed.selector);
        destinationCcip.deliverWithToken(
            address(relay), bytes32(uint256(4)), ARBITRUM_SELECTOR, address(sourceRouter), proposedMessage
        );
    }

    function testRelay_rejectsSafeCalldataAboveBoundAtBothEnds() public {
        bytes memory oversizedData = new bytes(sourceRouter.MAX_SAFE_CALLDATA_BYTES() + 1);
        GardenSafeActionCodec.Action memory action = _actionWithData(hex"123456", oversizedData);

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.InvalidAction.selector);
        sourceRouter.propose{ value: 1 }(action);

        bytes memory forgedMessage =
            GardenSafeActionCodec.encode(GardenSafeActionCodec.MessageKind.Proposal, action);
        vm.chainId(CELO_CHAIN_ID);
        vm.expectRevert(CeloGardenAccountRelay.InvalidAction.selector);
        destinationCcip.deliver(
            address(relay), bytes32(uint256(40)), ARBITRUM_SELECTOR, address(sourceRouter), forgedMessage
        );
    }

    function testRelay_maxCalldataDestinationReceivesFitConfiguredGasLimit() public {
        bytes memory maxData = new bytes(sourceRouter.MAX_SAFE_CALLDATA_BYTES());
        GardenSafeActionCodec.Action memory action = _actionWithData(hex"123456", maxData);
        bytes32 actionId = _propose(action);

        vm.chainId(CELO_CHAIN_ID);
        bytes memory proposalMessage = sourceCcip.lastData();
        uint256 gasBefore = gasleft();
        destinationCcip.deliver(
            address(relay), bytes32(uint256(41)), ARBITRUM_SELECTOR, address(sourceRouter), proposalMessage
        );
        uint256 proposalGas = gasBefore - gasleft();

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        sourceRouter.finalize{ value: 1 }(actionId, action);

        vm.chainId(CELO_CHAIN_ID);
        bytes memory finalizationMessage = sourceCcip.lastData();
        gasBefore = gasleft();
        destinationCcip.deliver(
            address(relay), bytes32(uint256(42)), ARBITRUM_SELECTOR, address(sourceRouter), finalizationMessage
        );
        uint256 finalizationGas = gasBefore - gasleft();

        emit log_named_uint("max-calldata proposal destination gas", proposalGas);
        emit log_named_uint("max-calldata finalization destination gas", finalizationGas);
        assertLt(proposalGas, sourceRouter.DESTINATION_GAS_LIMIT());
        assertLt(finalizationGas, sourceRouter.DESTINATION_GAS_LIMIT());
    }

    function testRelay_cancelBeforeFinalizeIsPermanent() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);
        bytes32 actionId = _propose(action);
        _deliverLatest(bytes32(uint256(5)));

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        sourceRouter.cancel{ value: 1 }(actionId, action);
        _deliverLatest(bytes32(uint256(6)));
        assertEq(uint8(relay.actionStatus(actionId)), uint8(GardenSafeActionCodec.ActionStatus.Cancelled));

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.InvalidActionState.selector);
        sourceRouter.finalize{ value: 1 }(actionId, action);

        vm.chainId(CELO_CHAIN_ID);
        vm.expectRevert(CeloGardenAccountRelay.InvalidActionState.selector);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);
    }

    function testRelay_rejectsWrongRecoveryIdentitySignatureAndExecutionReplay() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);
        bytes32 actionId = _proposeAndFinalize(action);

        vm.chainId(CELO_CHAIN_ID);
        vm.expectRevert(CeloGardenAccountRelay.InvalidRecoveryOwner.selector);
        relay.execute(actionId, action, address(0xBEEF), recoverySignature);
        vm.expectRevert(CeloGardenAccountRelay.InvalidRecoverySignature.selector);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, hex"9999");

        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);
        vm.expectRevert(CeloGardenAccountRelay.InvalidActionState.selector);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);
        assertEq(target.calls(), 1);
    }

    function testRelay_executeRejectsActionThatDoesNotMatchAuthenticatedProposal() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);
        bytes32 actionId = _proposeAndFinalize(action);
        action.deadline++;

        vm.chainId(CELO_CHAIN_ID);
        vm.expectRevert(CeloGardenAccountRelay.ActionHashMismatch.selector);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);
    }

    function testRelay_rejectsNonceReplayAndMismatchedFinalization() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);
        bytes32 actionId = _propose(action);
        _deliverLatest(bytes32(uint256(10)));

        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.InvalidActionNonce.selector);
        sourceRouter.propose{ value: 1 }(action);

        action.safeTransaction.data = abi.encodeCall(target.record, ());
        action.safeTransaction.gasPrice = 1;
        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.ActionHashMismatch.selector);
        sourceRouter.finalize{ value: 1 }(actionId, action);
    }

    function testRelay_failedSafeActionRollsBackRelayAndSafeState() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action =
            _actionWithData(recoverySignature, abi.encodeCall(target.fail, ()));
        bytes32 actionId = _proposeAndFinalize(action);

        vm.chainId(CELO_CHAIN_ID);
        vm.expectRevert(CeloGardenAccountRelay.SafeExecutionFailed.selector);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);

        assertEq(gardenSafe.nonce(), 0);
        assertEq(target.calls(), 0);
        assertEq(uint8(relay.actionStatus(actionId)), uint8(GardenSafeActionCodec.ActionStatus.Finalized));
    }

    function testRelay_expiredActionCannotFinalizeOrExecute() public {
        bytes memory recoverySignature = hex"123456";
        GardenSafeActionCodec.Action memory action = _action(recoverySignature);
        action.deadline = uint64(block.timestamp + 1);
        bytes32 actionId = _propose(action);
        _deliverLatest(bytes32(uint256(11)));

        vm.warp(block.timestamp + 2);
        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        vm.expectRevert(GardenActionRouter.ActionExpired.selector);
        sourceRouter.finalize{ value: 1 }(actionId, action);

        vm.chainId(CELO_CHAIN_ID);
        relay.expire(actionId, action);
        assertEq(uint8(relay.actionStatus(actionId)), uint8(GardenSafeActionCodec.ActionStatus.Expired));
        vm.expectRevert(CeloGardenAccountRelay.InvalidActionState.selector);
        relay.execute(actionId, action, GREEN_GOODS_SAFE, recoverySignature);
    }

    function _action(bytes memory recoverySignature)
        private
        view
        returns (GardenSafeActionCodec.Action memory action)
    {
        return _actionWithData(recoverySignature, abi.encodeCall(target.record, ()));
    }

    function _actionWithData(
        bytes memory recoverySignature,
        bytes memory safeData
    )
        private
        view
        returns (GardenSafeActionCodec.Action memory action)
    {
        GardenSafeActionCodec.SafeTransaction memory safeTransaction = GardenSafeActionCodec.SafeTransaction({
            to: address(target),
            value: 0,
            data: safeData,
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: address(0),
            refundReceiver: address(0),
            nonce: gardenSafe.nonce()
        });
        bytes32 safeTxHash = gardenSafe.getTransactionHash(
            safeTransaction.to,
            safeTransaction.value,
            safeTransaction.data,
            safeTransaction.operation,
            safeTransaction.safeTxGas,
            safeTransaction.baseGas,
            safeTransaction.gasPrice,
            safeTransaction.gasToken,
            safeTransaction.refundReceiver,
            safeTransaction.nonce
        );
        action = GardenSafeActionCodec.Action({
            version: 1,
            sourceEvmChainId: ARBITRUM_CHAIN_ID,
            sourceChainSelector: ARBITRUM_SELECTOR,
            sourceRouter: address(sourceRouter),
            gardenToken: GARDEN_TOKEN,
            tokenId: TOKEN_ID,
            gardenAccount: address(gardenAccount),
            destinationEvmChainId: CELO_CHAIN_ID,
            destinationChainSelector: CELO_SELECTOR,
            destinationRouter: address(destinationCcip),
            destinationRelay: address(relay),
            destinationSafe: address(gardenSafe),
            safeTransaction: safeTransaction,
            safeTransactionHash: safeTxHash,
            recoverySignatureHash: keccak256(abi.encode(GREEN_GOODS_SAFE, recoverySignature)),
            actionNonce: sourceRouter.nextActionNonce(address(gardenAccount)),
            deadline: uint64(block.timestamp + 1 days)
        });
    }

    function _propose(GardenSafeActionCodec.Action memory action) private returns (bytes32 actionId) {
        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        actionId = sourceRouter.propose{ value: 1 }(action);
    }

    function _proposeAndFinalize(GardenSafeActionCodec.Action memory action) private returns (bytes32 actionId) {
        actionId = _propose(action);
        _deliverLatest(bytes32(uint256(20)));
        vm.chainId(ARBITRUM_CHAIN_ID);
        vm.prank(address(gardenAccount));
        sourceRouter.finalize{ value: 1 }(actionId, action);
        _deliverLatest(bytes32(uint256(21)));
    }

    function _deliverLatest(bytes32 messageId) private {
        vm.chainId(CELO_CHAIN_ID);
        destinationCcip.deliver(
            address(relay), messageId, ARBITRUM_SELECTOR, address(sourceRouter), sourceCcip.lastData()
        );
    }
}
