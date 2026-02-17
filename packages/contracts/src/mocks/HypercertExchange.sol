// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OrderStructs, IHypercertExchange } from "../interfaces/IHypercertExchange.sol";
import { IHypercertMinter } from "../interfaces/IHypercertExchange.sol";

/// @title MockHypercertExchange
/// @notice Mock exchange that simulates executeTakerBid for testing
/// @dev Decodes taker params, pulls payment from msg.sender, transfers to maker signer (seller)
contract MockHypercertExchange is IHypercertExchange {
    struct ExecutionRecord {
        address recipient;
        uint256 unitAmount;
        uint256 pricePerUnit;
        address seller;
        address currency;
        uint256 totalPayment;
    }

    ExecutionRecord[] public executions;
    bool public shouldRevert;

    function executeTakerBid(
        OrderStructs.Taker calldata takerBid,
        OrderStructs.Maker calldata makerAsk,
        bytes calldata,
        OrderStructs.MerkleTree calldata
    )
        external
        payable
        override
    {
        require(!shouldRevert, "MockHypercertExchange: forced revert");

        // Decode taker additional parameters
        (uint256 unitAmount, uint256 pricePerUnit) = abi.decode(takerBid.additionalParameters, (uint256, uint256));

        uint256 totalPayment = unitAmount * pricePerUnit;

        // Pull payment from caller (the adapter)
        IERC20(makerAsk.currency).transferFrom(msg.sender, makerAsk.signer, totalPayment);

        executions.push(
            ExecutionRecord({
                recipient: takerBid.recipient,
                unitAmount: unitAmount,
                pricePerUnit: pricePerUnit,
                seller: makerAsk.signer,
                currency: makerAsk.currency,
                totalPayment: totalPayment
            })
        );
    }

    function getExecutionCount() external view returns (uint256) {
        return executions.length;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}

/// @title MockHypercertMinter
/// @notice Mock minter that simulates createAllowlist for testing
/// @dev Returns incrementing claim IDs, tracks all mint calls
contract MockHypercertMinter is IHypercertMinter {
    struct MintRecord {
        address account;
        uint256 units;
        bytes32 merkleRoot;
        string uri;
        uint8 restrictions;
    }

    MintRecord[] public mints;
    uint256 private nextClaimId = 1;
    bool public shouldRevert;

    // Approval tracking
    mapping(address owner => mapping(address operator => bool approved)) private _approvals;

    function createAllowlist(
        address account,
        uint256 units,
        bytes32 merkleRoot,
        string calldata uri,
        uint8 restrictions
    )
        external
        override
        returns (uint256 claimID)
    {
        require(!shouldRevert, "MockHypercertMinter: forced revert");

        claimID = nextClaimId++;
        mints.push(
            MintRecord({ account: account, units: units, merkleRoot: merkleRoot, uri: uri, restrictions: restrictions })
        );
    }

    function setApprovalForAll(address operator, bool approved) external override {
        _approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view override returns (bool) {
        return _approvals[owner][operator];
    }

    function getMintCount() external view returns (uint256) {
        return mints.length;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}
