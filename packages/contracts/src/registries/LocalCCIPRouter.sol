// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @dev Minimal interface for calling ccipReceive on CCIPReceiver-based contracts.
interface ICCIPReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

/// @title LocalCCIPRouter
/// @notice Same-chain CCIP message relay for testnet deployments such as Sepolia.
/// @dev Synchronously delivers messages by calling ccipReceive() on the target within one tx.
///      Used when both GreenGoodsENS sender and receiver are deployed on the same chain where
///      real cross-chain CCIP lanes do not apply.
contract LocalCCIPRouter {
    uint64 public immutable SOURCE_CHAIN_SELECTOR;
    uint256 private _nonce;

    constructor(uint64 _sourceChainSelector) {
        SOURCE_CHAIN_SELECTOR = _sourceChainSelector;
    }

    /// @notice Returns zero because same-chain testnet relay has no CCIP fee.
    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return 0;
    }

    /// @notice Synchronously delivers the message to the receiver via ccipReceive().
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

    /// @notice Accept ETH sent with ccipSend even though getFee returns zero.
    receive() external payable { }
}
