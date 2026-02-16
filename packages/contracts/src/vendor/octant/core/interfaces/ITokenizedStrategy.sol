// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/**
 * @title Yearn V3 Tokenized Strategy Interface
 * @author yearn.finance; port maintained by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:ported-from https://github.com/yearn/tokenized-strategy/blob/master/src/interfaces/ITokenizedStrategy.sol
 * @notice Interface that implements the 4626 standard and the implementation functions
 * for the TokenizedStrategy contract.
 */
interface ITokenizedStrategy is IERC4626, IERC20Permit {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when a strategy is shutdown.
     */
    event StrategyShutdown();

    /**
     * @notice Emitted on the initialization of any new `strategy` that uses `asset`
     * with this specific `apiVersion`.
     */
    event NewTokenizedStrategy(address indexed strategy, address indexed asset, string apiVersion);

    /**
     * @notice Emitted when the strategy reports `profit` or `loss`.
     */
    event Reported(uint256 profit, uint256 loss);

    /**
     * @notice Emitted when the 'keeper' address is updated to 'newKeeper'.
     */
    event UpdateKeeper(address indexed newKeeper);

    /**
     * @notice Emitted when the 'management' address is updated to 'newManagement'.
     */
    event UpdateManagement(address indexed newManagement);

    /**
     * @notice Emitted when the 'emergencyAdmin' address is updated to 'newEmergencyAdmin'.
     */
    event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);

    /**
     * @notice Emitted when the 'pendingManagement' address is updated to 'newPendingManagement'.
     */
    event UpdatePendingManagement(address indexed newPendingManagement);

    /**
     * @notice Emitted when the dragon router address is updated.
     */
    event UpdateDragonRouter(address indexed newDragonRouter);

    /**
     * @notice Emitted when a pending dragon router change is initiated
     * @param newDragonRouter Proposed dragon router address
     * @param effectiveTimestamp Timestamp when change can be finalized
     */
    event PendingDragonRouterChange(address indexed newDragonRouter, uint256 effectiveTimestamp);

    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Used to initialize storage for a newly deployed strategy
     * @param _asset Underlying asset address
     * @param _name Strategy name
     * @param _symbol Strategy symbol
     * @param _management Management address
     * @param _keeper Keeper address
     * @param _emergencyAdmin Emergency admin address
     * @param _dragonRouter Dragon router address (receives minted shares from yield)
     * @param _enableBurning True to enable burning shares during loss protection
     */
    function initialize(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _management,
        address _keeper,
        address _emergencyAdmin,
        address _dragonRouter,
        bool _enableBurning
    )
        external;

    /*//////////////////////////////////////////////////////////////
                        NON-STANDARD 4626 OPTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Withdraws assets from owner's shares and sends underlying tokens to receiver
     * @dev This includes an added parameter to allow for losses
     * @param assets Amount of underlying to withdraw
     * @param receiver Address to receive assets
     * @param owner Address whose shares are burnt
     * @param maxLoss Maximum acceptable loss in basis points (1 bps = 0.01%)
     * @return shares Actual amount of shares burnt
     */
    function withdraw(uint256 assets, address receiver, address owner, uint256 maxLoss) external returns (uint256);

    /**
     * @notice Redeems exactly shares from owner and sends underlying tokens to receiver
     * @dev This includes an added parameter to allow for losses
     * @param shares Amount of shares burnt
     * @param receiver Address to receive assets
     * @param owner Address whose shares are burnt
     * @param maxLoss Maximum acceptable loss in basis points (1 bps = 0.01%)
     * @return Actual amount of underlying withdrawn
     */
    function redeem(uint256 shares, address receiver, address owner, uint256 maxLoss) external returns (uint256);

    /**
     * @notice Variable maxLoss is ignored
     * @dev Accepts a maxLoss variable in order to match the multi strategy vaults ABI
     * @param owner Address to check maximum withdrawal for
     * @return Maximum withdrawable amount
     */
    function maxWithdraw(address owner, uint256 /*maxLoss*/ ) external view returns (uint256);

    /**
     * @notice Variable maxLoss is ignored
     * @dev Accepts a maxLoss variable in order to match the multi strategy vaults ABI
     * @param owner Address to check maximum redemption for
     * @return Maximum redeemable shares
     */
    function maxRedeem(address owner, uint256 /*maxLoss*/ ) external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                          MODIFIER HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Require a caller is `management`.
     * @param _sender Original msg.sender
     */
    function requireManagement(address _sender) external view;

    /**
     * @notice Require a caller is the `keeper` or `management`.
     * @param _sender Original msg.sender
     */
    function requireKeeperOrManagement(address _sender) external view;

    /**
     * @notice Require a caller is the `management` or `emergencyAdmin`.
     * @param _sender Original msg.sender
     */
    function requireEmergencyAuthorized(address _sender) external view;

    /*//////////////////////////////////////////////////////////////
                          KEEPERS FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice For a 'keeper' to 'tend' the strategy if a custom
     * tendTrigger() is implemented.
     */
    function tend() external;

    /**
     * @notice Function for keepers to harvest and record all profits/losses since last report.
     * @dev Keepers should consider MEV-protected submission. Specialized implementations may
     *      mint shares to the donation destination (dragon router) on profit, and apply
     *      loss-protection via dragon burning (if enabled). The return values are denominated
     *      in the underlying `asset`.
     * @return _profit Gain since last report, in `asset` units.
     * @return _loss Loss since last report, in `asset` units.
     */
    function report() external returns (uint256 _profit, uint256 _loss);

    /*//////////////////////////////////////////////////////////////
                              GETTERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the API version for this TokenizedStrategy.
     * @return API version for this TokenizedStrategy
     */
    function apiVersion() external view returns (string memory);

    /**
     * @notice Get the price per share.
     * @return Price per share
     */
    function pricePerShare() external view returns (uint256);

    /**
     * @notice Get the current address that controls the strategy.
     * @return Address of management
     */
    function management() external view returns (address);

    /**
     * @notice Get the current pending management address if any.
     * @return Address of pendingManagement
     */
    function pendingManagement() external view returns (address);

    /**
     * @notice Get the current address that can call tend and report.
     * @return Address of the keeper
     */
    function keeper() external view returns (address);

    /**
     * @notice Get the current address that can shutdown and emergency withdraw.
     * @return Address of the emergencyAdmin
     */
    function emergencyAdmin() external view returns (address);

    /**
     * @notice Get the current dragon router address that will receive minted shares.
     * @return Address of dragonRouter
     */
    function dragonRouter() external view returns (address);

    /**
     * @notice Get the pending dragon router address if any.
     * @return Address of the pending dragon router
     */
    function pendingDragonRouter() external view returns (address);

    /**
     * @notice Get the timestamp when dragon router change was initiated.
     * @return Timestamp of the dragon router change initiation
     */
    function dragonRouterChangeTimestamp() external view returns (uint256);

    /**
     * @notice The timestamp of the last time protocol fees were charged.
     * @return Last report timestamp in seconds
     */
    function lastReport() external view returns (uint256);

    /**
     * @notice To check if the strategy has been shutdown.
     * @return Whether or not the strategy is shutdown.
     */
    function isShutdown() external view returns (bool);

    /*//////////////////////////////////////////////////////////////
                              SETTERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Step one of two to set a new address to be in charge of the strategy.
     * @param _management New address to set `pendingManagement` to.
     */
    function setPendingManagement(address _management) external;

    /**
     * @notice Step two of two to set a new 'management' of the strategy.
     */
    function acceptManagement() external;

    /**
     * @notice Sets a new address to be in charge of tend and reports.
     * @param _keeper New address to set `keeper` to.
     */
    function setKeeper(address _keeper) external;

    /**
     * @notice Sets a new address to be able to shutdown the strategy.
     * @param _emergencyAdmin New address to set `emergencyAdmin` to.
     */
    function setEmergencyAdmin(address _emergencyAdmin) external;

    /**
     * @notice Initiates a change to a new donation destination (dragon router) with cooldown.
     * @dev Emits PendingDragonRouterChange(new, effectiveTimestamp) and starts a mandatory
     *      cooldown before finalization. Users can exit during the cooldown if they disagree.
     * @param _dragonRouter New address to set as pending `dragonRouter`.
     */
    function setDragonRouter(address _dragonRouter) external;

    /**
     * @notice Finalizes the dragon router change after the cooldown period.
     * @dev Requires cooldown to have elapsed and pending router to be set.
     */
    function finalizeDragonRouterChange() external;

    /**
     * @notice Cancels a pending dragon router change.
     * @dev Resets pending router and timestamp, emitting PendingDragonRouterChange(address(0), 0).
     */
    function cancelDragonRouterChange() external;

    /**
     * @notice Updates the name for the strategy.
     * @dev Disabled to keep the EIP-712 domain stable after initialization.
     */
    function setName(string calldata _newName) external;

    /**
     * @notice Get whether burning of dragon shares is enabled for loss protection.
     * @return Whether burning is enabled
     */
    function enableBurning() external view returns (bool);

    /**
     * @notice Enable or disable burning of dragon router shares during loss protection.
     * @param _enableBurning True to enable, false to disable
     */
    function setEnableBurning(bool _enableBurning) external;

    /**
     * @notice Used to shutdown the strategy preventing any further deposits.
     */
    function shutdownStrategy() external;

    /**
     * @notice To manually withdraw funds from the yield source after a
     * strategy has been shutdown.
     * @param _amount Amount of asset to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external;
}
