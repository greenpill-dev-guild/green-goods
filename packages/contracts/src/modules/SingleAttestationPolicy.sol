// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev ABI matches Kernel v3.1 src/interfaces/{PackedUserOperation,IERC7579Modules}.sol.
/// The checked-in lib/kernel is an older incompatible Kernel and is deliberately not imported.
struct ReportingPackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/// @notice Adds a single-call boundary to Kernel's CallPolicy, which permits batches.
/// EAS target/schema/garden checks belong to CallPolicy; expiry/count/cost use separate policies.
contract SingleAttestationPolicy {
    error InvalidInstallData();
    error PermissionAlreadyUsed();
    error PermissionNotActive();
    error InvalidExecution();
    error MessageSigningForbidden();
    error SponsorshipRequired();
    error CostBudgetExceeded();

    bytes4 private constant EXECUTE_SELECTOR = bytes4(keccak256("execute(bytes32,bytes)"));
    uint256 private constant MAX_EXECUTION_BYTES = 65_536;
    // 0 = unused, 1 = active, 2 = permanently retired for this account/permission.
    mapping(bytes32 id => mapping(address account => uint8 state)) public status;
    mapping(address account => uint256 count) private activePermissions;
    mapping(bytes32 id => mapping(address account => uint256 remainingWei)) public remainingCostWei;
    mapping(bytes32 id => mapping(address account => address paymaster)) public approvedPaymaster;

    function onInstall(bytes calldata data) external payable {
        if (data.length != 96) revert InvalidInstallData();
        bytes32 id = bytes32(data[0:32]);
        (uint128 cap, address paymaster) = abi.decode(data[32:], (uint128, address));
        if (cap == 0 || paymaster == address(0)) revert InvalidInstallData();
        if (status[id][msg.sender] != 0) revert PermissionAlreadyUsed();
        status[id][msg.sender] = 1;
        remainingCostWei[id][msg.sender] = cap;
        approvedPaymaster[id][msg.sender] = paymaster;
        activePermissions[msg.sender]++;
    }

    function onUninstall(bytes calldata data) external payable {
        if (data.length != 32) revert InvalidInstallData();
        bytes32 id = bytes32(data);
        if (status[id][msg.sender] != 1) revert PermissionNotActive();
        status[id][msg.sender] = 2;
        remainingCostWei[id][msg.sender] = 0;
        activePermissions[msg.sender]--;
    }

    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == 5;
    }

    function isInitialized(address account) external view returns (bool) {
        return activePermissions[account] != 0;
    }

    function checkUserOpPolicy(bytes32 id, ReportingPackedUserOperation calldata userOp)
        external
        payable
        returns (uint256)
    {
        if (status[id][msg.sender] != 1 || userOp.sender != msg.sender) revert PermissionNotActive();
        _validateExecution(userOp.callData);
        // EntryPoint 0.7 PackedUserOperation prefund: verification + call + preverification +
        // paymaster verification/post-op limits, all multiplied by maxFeePerGas. The SDK's
        // GasPolicy omits paymaster limits; this additional cumulative cap includes them.
        bytes calldata sponsorship = userOp.paymasterAndData;
        if (sponsorship.length < 52 || address(bytes20(sponsorship[0:20])) != approvedPaymaster[id][msg.sender]) {
            revert SponsorshipRequired();
        }
        uint256 gasLimit = uint128(bytes16(userOp.accountGasLimits)) + uint256(uint128(uint256(userOp.accountGasLimits)))
            + userOp.preVerificationGas + uint128(bytes16(sponsorship[20:36])) + uint128(bytes16(sponsorship[36:52]));
        uint256 cost = gasLimit * uint128(uint256(userOp.gasFees));
        if (cost > remainingCostWei[id][msg.sender]) revert CostBudgetExceeded();
        remainingCostWei[id][msg.sender] -= cost;
        return 0;
    }

    function _validateExecution(bytes calldata call) private pure {
        // canonical execute(bytes32(0), abi.encodePacked(target, uint256(0), calldata))
        if (call.length < 164 || bytes4(call[0:4]) != EXECUTE_SELECTOR) revert InvalidExecution();
        if (bytes32(call[4:36]) != bytes32(0) || uint256(bytes32(call[36:68])) != 64) {
            revert InvalidExecution();
        }
        uint256 length = uint256(bytes32(call[68:100]));
        if (length < 56 || length > MAX_EXECUTION_BYTES || call.length != 100 + ((length + 31) / 32) * 32) {
            revert InvalidExecution();
        }
        if (uint256(bytes32(call[120:152])) != 0) revert InvalidExecution();
        // Reject alternate trailing/padding bytes so the approved and executed encodings coincide.
        for (uint256 i = 100 + length; i < call.length; i++) {
            if (call[i] != 0) revert InvalidExecution();
        }
    }

    function checkSignaturePolicy(bytes32, address, bytes32, bytes calldata) external pure returns (uint256) {
        revert MessageSigningForbidden();
    }
}
