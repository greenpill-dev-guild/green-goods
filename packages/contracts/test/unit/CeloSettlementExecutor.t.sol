// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { IZodiacRoles, SafeOperation } from "../../src/interfaces/IZodiacRoles.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { CeloSettlementExecutor } from "../../src/modules/CeloSettlementExecutor.sol";

interface ICcipMessageReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

contract ExecutorMockRouter {
    uint256 public fee;
    uint256 public nonce;
    bool public quoteReverts;
    bool public sendReverts;
    uint64 public lastDestinationSelector;
    bytes public lastReceiver;
    bytes public lastData;

    function setFee(uint256 fee_) external {
        fee = fee_;
    }

    function setFailures(bool quoteReverts_, bool sendReverts_) external {
        quoteReverts = quoteReverts_;
        sendReverts = sendReverts_;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        require(!quoteReverts, "quote");
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
        require(!sendReverts, "send");
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
        ICcipMessageReceiver(receiver).ccipReceive(
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
        ICcipMessageReceiver(receiver).ccipReceive(
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

contract ExecutorMockSafe {
    function isOwner(address) external pure returns (bool) {
        return false;
    }
}

contract ExecutorMockGoodDollar {
    mapping(address account => uint256 balance) private _balances;
    mapping(address account => bool fails) public balanceReadFails;
    uint256 public fee;
    bool public senderPays;
    bool public skipDebit;

    function setBalance(address account, uint256 amount) external {
        _balances[account] = amount;
    }

    function setBalanceReadFailure(address account, bool fails) external {
        balanceReadFails[account] = fails;
    }

    function setSkipDebit(bool skipDebit_) external {
        skipDebit = skipDebit_;
    }

    function balanceOf(address account) external view returns (uint256) {
        require(!balanceReadFails[account], "balance read");
        return _balances[account];
    }

    function setFee(uint256 fee_, bool senderPays_) external {
        fee = fee_;
        senderPays = senderPays_;
    }

    function getFees(uint256, address, address) external view returns (uint256, bool) {
        return (fee, senderPays);
    }

    function executeTransfer(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 debit = senderPays ? amount + fee : amount;
        require(_balances[sender] >= debit, "balance");
        if (!skipDebit) _balances[sender] -= debit;
        _balances[recipient] += senderPays ? amount : amount - fee;
        return true;
    }
}

contract ExecutorMockRoles is IZodiacRoles {
    address public override avatar;
    address public override target;
    ExecutorMockGoodDollar public token;
    bytes32 public role;
    mapping(address module => bool enabled) public enabledModules;
    bool public rejectExecution;
    bool public skipTransfer;

    constructor(address safe_, ExecutorMockGoodDollar token_) {
        avatar = safe_;
        target = safe_;
        token = token_;
    }

    function configureMember(address module, bytes32 role_) external {
        enabledModules[module] = true;
        role = role_;
    }

    function setExecutionBehavior(bool rejectExecution_, bool skipTransfer_) external {
        rejectExecution = rejectExecution_;
        skipTransfer = skipTransfer_;
    }

    function isModuleEnabled(address module) external view returns (bool) {
        return enabledModules[module];
    }

    function defaultRoles(address module) external view returns (bytes32) {
        return enabledModules[module] ? role : bytes32(0);
    }

    function execTransactionWithRoleReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        SafeOperation operation,
        bytes32 roleKey,
        bool shouldRevert
    )
        external
        returns (bool success, bytes memory returnData)
    {
        require(to == address(token) && value == 0 && operation == SafeOperation.Call, "authority");
        require(roleKey == role && shouldRevert && enabledModules[msg.sender], "role");
        require(bytes4(data[:4]) == bytes4(keccak256("transfer(address,uint256)")), "selector");
        if (rejectExecution) return (false, bytes(""));
        (address recipient, uint256 amount) = abi.decode(data[4:], (address, uint256));
        success = skipTransfer || token.executeTransfer(avatar, recipient, amount);
        returnData = abi.encode(success);
    }
}

contract CeloSettlementExecutorTest is Test {
    uint64 internal constant SOURCE_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant CELO_SELECTOR = 1_346_049_177_634_351_622;
    uint64 internal constant SOURCE_EVM_CHAIN_ID = 42_161;
    address internal constant OWNER = address(0xA11CE);
    address internal constant SOURCE_MODULE = address(0xBEEF);
    address internal constant GARDEN = address(0x1000);
    address internal constant BENEFICIARY_GARDEN = address(0x2000);
    address internal constant CONTRIBUTOR = address(0x3000);
    bytes32 internal constant ROLE_KEY = keccak256("role");
    bytes32 internal constant ALLOWANCE_KEY = keccak256("allowance");

    ExecutorMockRouter internal router;
    ExecutorMockGoodDollar internal token;
    ExecutorMockSafe internal payerSafe;
    ExecutorMockSafe internal beneficiarySafe;
    ExecutorMockRoles internal payerRoles;
    ExecutorMockRoles internal beneficiaryRoles;
    ICeloSettlementExecutor internal executor;

    function setUp() public {
        router = new ExecutorMockRouter();
        token = new ExecutorMockGoodDollar();
        payerSafe = new ExecutorMockSafe();
        beneficiarySafe = new ExecutorMockSafe();
        payerRoles = new ExecutorMockRoles(address(payerSafe), token);
        beneficiaryRoles = new ExecutorMockRoles(address(beneficiarySafe), token);

        CeloSettlementExecutor implementation =
            new CeloSettlementExecutor(address(router), address(token), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID);
        executor = ICeloSettlementExecutor(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeWithSelector(
                        ICeloSettlementExecutor.initialize.selector, OWNER, SOURCE_SELECTOR, SOURCE_MODULE, uint8(1)
                    )
                )
            )
        );
        payerRoles.configureMember(address(executor), ROLE_KEY);
        beneficiaryRoles.configureMember(address(executor), ROLE_KEY);

        vm.startPrank(OWNER);
        executor.configureGardenRoute(
            GARDEN, address(payerSafe), address(payerRoles), ROLE_KEY, ALLOWANCE_KEY, keccak256("payer-permissions")
        );
        executor.configureGardenRoute(
            BENEFICIARY_GARDEN,
            address(beneficiarySafe),
            address(beneficiaryRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("beneficiary-permissions")
        );
        executor.setCaps(4, 1000 ether, 4000 ether);
        executor.setFeePolicy(1000, 100 ether);
        executor.setPeriodicCap(1 days, 10_000 ether);
        executor.setAcknowledgmentFeeReserveMinimum(1);
        vm.deal(OWNER, 1);
        executor.fundAcknowledgmentFees{ value: 1 }();
        executor.setPaused(false);
        vm.stopPrank();
        token.setBalance(address(payerSafe), 10_000 ether);
    }

    function testSenderPaidFeeDeliversExactNetAndStoresSuccess() public {
        token.setFee(5 ether, true);
        bytes32 messageId = keccak256("success-command");
        router.deliver(
            address(executor),
            messageId,
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 7, 0, 0, _one(CONTRIBUTOR), _oneAmount(100 ether))
        );

        bytes32 key = keccak256(abi.encode(SOURCE_SELECTOR, SOURCE_MODULE, false, uint256(7), uint32(0)));
        ICeloSettlementExecutor.ExecutionResult memory result = executor.executionResultOf(key);
        assertEq(uint8(result.status), uint8(ICeloSettlementExecutor.ResultStatus.Success));
        assertEq(uint8(result.failureCode), uint8(ICeloSettlementExecutor.FailureCode.None));
        assertEq(token.balanceOf(CONTRIBUTOR), 100 ether);
        assertEq(token.balanceOf(address(payerSafe)), 9895 ether);
        assertTrue(result.acknowledgmentSent);
    }

    function testReceiverPaidFeeFailsClosedWithoutTransfer() public {
        token.setFee(5 ether, false);
        bytes32 messageId = keccak256("receiver-pays-command");
        router.deliver(
            address(executor),
            messageId,
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 8, 0, 0, _one(CONTRIBUTOR), _oneAmount(100 ether))
        );

        bytes32 key = keccak256(abi.encode(SOURCE_SELECTOR, SOURCE_MODULE, false, uint256(8), uint32(0)));
        ICeloSettlementExecutor.ExecutionResult memory result = executor.executionResultOf(key);
        assertEq(uint8(result.status), uint8(ICeloSettlementExecutor.ResultStatus.Failed));
        assertEq(uint8(result.failureCode), uint8(ICeloSettlementExecutor.FailureCode.UnsupportedReceiverPaysFee));
        assertEq(token.balanceOf(CONTRIBUTOR), 0);
        assertEq(token.balanceOf(address(payerSafe)), 10_000 ether);
    }

    function testGardenBeneficiaryRequiresRegisteredActiveSafe() public {
        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setGardenRouteActive(BENEFICIARY_GARDEN, false);
        executor.setPaused(false);
        vm.stopPrank();

        router.deliver(
            address(executor),
            keccak256("inactive-beneficiary"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 9, 0, 3, _one(address(beneficiarySafe)), _oneAmount(100 ether))
        );
        bytes32 key = keccak256(abi.encode(SOURCE_SELECTOR, SOURCE_MODULE, false, uint256(9), uint32(0)));
        ICeloSettlementExecutor.ExecutionResult memory result = executor.executionResultOf(key);
        assertEq(uint8(result.failureCode), uint8(ICeloSettlementExecutor.FailureCode.InvalidRecipient));
        assertEq(token.balanceOf(address(beneficiarySafe)), 0);
    }

    function testDuplicateCommandDoesNotPayTwice() public {
        bytes memory payload = _command(false, 10, 0, 0, _one(CONTRIBUTOR), _oneAmount(100 ether));
        router.deliver(address(executor), keccak256("first"), SOURCE_SELECTOR, SOURCE_MODULE, payload);
        router.deliver(address(executor), keccak256("duplicate"), SOURCE_SELECTOR, SOURCE_MODULE, payload);
        assertEq(token.balanceOf(CONTRIBUTOR), 100 ether);
    }

    function testCeloSettlementExecutor_loanPrincipalUsesTheBoundedGDollarTransferPath() public {
        router.deliver(
            address(executor),
            keccak256("loan-principal"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 11, 0, 2, _one(CONTRIBUTOR), _oneAmount(100 ether))
        );

        bytes32 key = keccak256(abi.encode(SOURCE_SELECTOR, SOURCE_MODULE, false, uint256(11), uint32(0)));
        ICeloSettlementExecutor.ExecutionResult memory result = executor.executionResultOf(key);
        assertEq(uint8(result.status), uint8(ICeloSettlementExecutor.ResultStatus.Success));
        assertEq(token.balanceOf(CONTRIBUTOR), 100 ether);
        assertEq(token.balanceOf(address(payerSafe)), 9900 ether);
    }

    /// @notice Measures the executor's compile-time maximum atomic batch with all success-path
    ///         balance, fee, Roles, storage, event, and acknowledgment work enabled.
    /// @dev The mock router's delivery wrapper is included, making this a conservative local
    ///      receiver measurement. The mock Roles module is not a substitute for the final live
    ///      Safe/Zodiac condition tree, so release tooling records this evidence but must keep the
    ///      manifest gas limit at zero until that separately authorized authority is frozen and
    ///      measured on the same candidate.
    function testMeasureHardMaxBatchDestinationGasCandidate() public {
        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setCaps(24, 1000 ether, 24_000 ether);
        executor.setPeriodicCap(1 days, 100_000 ether);
        executor.setPaused(false);
        vm.stopPrank();

        address[] memory recipients = new address[](24);
        uint256[] memory amounts = new uint256[](24);
        for (uint256 index; index < recipients.length; ++index) {
            recipients[index] = address(uint160(0x4000 + index));
            amounts[index] = 100 ether;
        }

        bytes memory payload = _command(true, 12, 0, 0, recipients, amounts);
        uint256 gasBefore = gasleft();
        router.deliver(address(executor), keccak256("hard-max-batch-gas"), SOURCE_SELECTOR, SOURCE_MODULE, payload);
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("settlement destination gas / local hard-max batch (24)", gasUsed);

        bytes32 key = keccak256(abi.encode(SOURCE_SELECTOR, SOURCE_MODULE, true, uint256(12), uint32(0)));
        ICeloSettlementExecutor.ExecutionResult memory result = executor.executionResultOf(key);
        assertEq(uint8(result.status), uint8(ICeloSettlementExecutor.ResultStatus.Success));
        assertTrue(result.acknowledgmentSent);
        assertLt(gasUsed, 5_000_000, "local destination execution exceeded the measurement guardrail");
        for (uint256 index; index < recipients.length; ++index) {
            assertEq(token.balanceOf(recipients[index]), amounts[index]);
        }
    }

    function testMalformedCommandUsesFrozenFailureSelector() public {
        vm.expectRevert(ICeloSettlementExecutor.MalformedSettlementCommand.selector);
        router.deliver(address(executor), keccak256("malformed-command"), SOURCE_SELECTOR, SOURCE_MODULE, hex"01");
    }

    function _command(
        bool isBatch,
        uint256 settlementId,
        uint32 attempt,
        uint8 kind,
        address[] memory recipients,
        uint256[] memory amounts
    )
        internal
        pure
        returns (bytes memory)
    {
        return SettlementMessageCodec.encodeCommand(1, settlementId, isBatch, attempt, GARDEN, kind, recipients, amounts);
    }

    function _one(address account) internal pure returns (address[] memory values) {
        values = new address[](1);
        values[0] = account;
    }

    function _oneAmount(uint256 amount) internal pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = amount;
    }
}
