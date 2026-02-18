// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @dev Minimal interface for calling ccipReceive on CCIPReceiver-based contracts
interface ICCIPReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

/// @title LocalCCIPRouter
/// @notice Same-chain CCIP message relay for testnet deployments (e.g., Sepolia)
/// @dev Synchronously delivers messages by calling ccipReceive() on the target within the same tx.
///      Used when both GreenGoodsENS (sender) and GreenGoodsENSReceiver (receiver)
///      are deployed on the same chain where real cross-chain CCIP lanes don't exist.
///
///      The receiver's onlyRouter modifier passes because this contract IS the router.
///      Fee is 0 — no CCIP costs on same-chain relay.
contract LocalCCIPRouter {
    uint64 public immutable SOURCE_CHAIN_SELECTOR;
    uint256 private _nonce;

    constructor(uint64 _sourceChainSelector) {
        SOURCE_CHAIN_SELECTOR = _sourceChainSelector;
    }

    /// @notice Returns 0 fee — no CCIP costs on same-chain testnet relay
    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return 0;
    }

    /// @notice Synchronously delivers the message to the receiver via ccipReceive()
    /// @dev Constructs a Client.Any2EVMMessage from the sender's EVM2AnyMessage and calls
    ///      the receiver directly. The receiver's onlyRouter modifier passes because
    ///      msg.sender (this contract) was set as the router in the receiver's constructor.
    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32 messageId) {
        address receiver = abi.decode(message.receiver, (address));
        messageId = keccak256(abi.encodePacked(block.number, msg.sender, ++_nonce));

        Client.Any2EVMMessage memory delivery = Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: SOURCE_CHAIN_SELECTOR,
            sender: abi.encode(msg.sender),
            data: message.data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        ICCIPReceiver(receiver).ccipReceive(delivery);
    }

    /// @notice Accept ETH sent with ccipSend (even though fee is 0)
    receive() external payable { }
}
