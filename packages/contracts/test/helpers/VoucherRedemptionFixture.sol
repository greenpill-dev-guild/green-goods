// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers } from "../../src/interfaces/ICommitmentServiceOffers.sol";

interface IVoucherRedemptionReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

/// @dev Deterministic local transport only, never a live CCIP or DON receipt.
contract VoucherRedemptionRouter {
    uint256 public nonce;
    bytes public lastData;
    bytes32 public lastMessageId;
    uint256 public lastGasLimit;
    uint256 public fee;
    bool public quoteFails;
    bool public sendFails;
    error MockTransportFailure();

    function configure(uint256 fee_, bool quoteFails_, bool sendFails_) external {
        fee = fee_;
        quoteFails = quoteFails_;
        sendFails = sendFails_;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        if (quoteFails) revert MockTransportFailure();
        return fee;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        if (sendFails || msg.value != fee || message.tokenAmounts.length != 0) revert MockTransportFailure();
        lastData = message.data;
        (lastGasLimit,) = abi.decode(message.extraArgs[4:], (uint256, bool));
        lastMessageId = keccak256(abi.encode(address(this), ++nonce));
        return lastMessageId;
    }

    function deliver(address receiver, Client.Any2EVMMessage memory message) external {
        IVoucherRedemptionReceiver(receiver).ccipReceive(message);
    }

    function deliverBounded(
        address receiver,
        Client.Any2EVMMessage memory message,
        uint256 gasLimit
    )
        external
        returns (bool success, uint256 gasUsed)
    {
        uint256 beforeCall = gasleft();
        (success,) = receiver.call{ gas: gasLimit }(abi.encodeCall(IVoucherRedemptionReceiver.ccipReceive, (message)));
        gasUsed = beforeCall - gasleft();
    }
}

/// @dev Fictional owner-bearing ERC20. Actual GiftableToken conformance is a separate fork proof.
contract VoucherRedemptionToken is IERC20 {
    address public owner;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    error InsufficientFixtureBalance();
    error InsufficientFixtureAllowance();
    error FixtureTransferFailure();
    address public failingRecipient;
    uint256 public transferFee;
    bool public skipDebit;
    bool public skipAllowanceDebit;
    address public reentryTarget;
    bytes public reentryData;
    bool public reentrySucceeded;

    function configureFailure(address recipient, uint256 fee_, bool skipDebit_) external {
        failingRecipient = recipient;
        transferFee = fee_;
        skipDebit = skipDebit_;
    }

    function configureAllowanceDebit(bool skip) external {
        skipAllowanceDebit = skip;
    }

    function rotateOwnerFixture(address nextOwner) external {
        owner = nextOwner;
    }

    function configureReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryData = data;
    }

    constructor(address issuer) {
        owner = issuer;
    }

    function mintFixture(address account, uint256 units) external {
        balanceOf[account] += units;
        totalSupply += units;
    }

    /// @dev Deliberately hostile fixture-only loss; not an authority granted by the escrow.
    function removeFixtureBalance(address account, uint256 units) external {
        balanceOf[account] -= units;
        totalSupply -= units;
    }

    function approve(address spender, uint256 units) external returns (bool) {
        allowance[msg.sender][spender] = units;
        emit Approval(msg.sender, spender, units);
        return true;
    }

    function transfer(address recipient, uint256 units) external returns (bool) {
        _transfer(msg.sender, recipient, units);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 units) external returns (bool) {
        if (allowance[sender][msg.sender] < units) revert InsufficientFixtureAllowance();
        if (!skipAllowanceDebit) allowance[sender][msg.sender] -= units;
        _transfer(sender, recipient, units);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 units) private {
        if (recipient == failingRecipient) revert FixtureTransferFailure();
        if (balanceOf[sender] < units || units < transferFee) revert InsufficientFixtureBalance();
        if (reentryTarget != address(0)) (reentrySucceeded,) = reentryTarget.call(reentryData);
        if (!skipDebit) balanceOf[sender] -= units;
        balanceOf[recipient] += units - transferFee;
        emit Transfer(sender, recipient, units - transferFee);
    }
}

    /// @dev Selector-compatible accepted-view fixture; real core integration is a separate test lane.
    contract VoucherRedemptionCoreMock {
        ICommitmentServiceOffers.AcceptedServiceTerms private _accepted;
        ICommitmentPoolingModule.Commitment private _commitment;

        function serviceOfferProtocolVersion() external pure returns (uint16) {
            return 1;
        }

        function configure(
            ICommitmentServiceOffers.AcceptedServiceTerms memory accepted,
            ICommitmentPoolingModule.Commitment memory commitment
        )
            external
        {
            _accepted = accepted;
            // Copy only fields exercised by this selector-compatible fixture. The full core tuple
            // includes nested dynamic requirements that the default non-IR compiler cannot copy.
            _commitment.poolId = commitment.poolId;
            _commitment.creator = commitment.creator;
            _commitment.counterparty = commitment.counterparty;
            _commitment.direction = commitment.direction;
            _commitment.state = commitment.state;
            _commitment.claimType = commitment.claimType;
            _commitment.claimMode = commitment.claimMode;
            _commitment.providerGarden = commitment.providerGarden;
            _commitment.payerGarden = commitment.payerGarden;
            _commitment.targetUnits = commitment.targetUnits;
            _commitment.unitLabel = commitment.unitLabel;
            _commitment.consideration = commitment.consideration;
        }

        function getAcceptedServiceTerms(uint256)
            external
            view
            returns (ICommitmentServiceOffers.AcceptedServiceTerms memory)
        {
            return _accepted;
        }

        function getCommitment(uint256) external view returns (ICommitmentPoolingModule.Commitment memory) {
            return _commitment;
        }
    }
