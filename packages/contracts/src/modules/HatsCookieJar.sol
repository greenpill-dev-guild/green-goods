// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CookieJarModule } from "./CookieJar.sol";

interface IHatsJarGardenToken {
    function isGardenAccount(address garden) external view returns (bool);
}

/// @dev ABI of the independently deployed GardenCookieJarFactory v1.
interface IHatsJarFactory {
    struct Policy {
        uint256 maxClaimCeiling;
        uint256 minCooldown;
        uint256 dailyBudget;
        address recoveryRecipient;
    }

    struct Config {
        address garden;
        address asset;
        address hats;
        uint256 gardenerHat;
        uint256 stewardHat;
        uint256 ownerHat;
        Policy policy;
        uint256 maxWithdrawal;
        uint256 withdrawalInterval;
    }

    function FAMILY() external view returns (bytes32);
    function VERSION() external view returns (uint256);
    function HATS() external view returns (address);
    function registrar() external view returns (address);
    function createJar(Config calldata config, uint256 generation) external returns (address);
    function jarFor(address garden, address asset, uint256 generation) external view returns (address);
    function isFactoryJar(address jar) external view returns (bool);
}

/// @notice Adds a bounded Hats jar migration to the Release C CookieJarModule.
/// @dev No new proxy storage. The existing factory still serves the Release C mint path.
contract HatsCookieJarModule is CookieJarModule {
    bytes32 private constant FACTORY_FAMILY = keccak256("GREEN_GOODS_GARDEN_COOKIE_JAR_FACTORY");

    IHatsJarFactory public immutable hatsJarFactory;
    bytes32 public immutable hatsJarFactoryCodeHash;

    error InvalidHatsJarFactory();
    error InvalidJarPair();
    error GardenAlreadyListed(address garden);
    error GardenHatsChanged(address garden);
    error InvalidCreatedJar(address jar);
    error ActiveHatsJar(address jar);

    constructor(IHatsJarFactory factory) {
        if (address(factory).code.length == 0 || factory.FAMILY() != FACTORY_FAMILY || factory.VERSION() != 1) {
            revert InvalidHatsJarFactory();
        }
        hatsJarFactory = factory;
        hatsJarFactoryCodeHash = address(factory).codehash;
    }

    /// @notice Retire legacy entries while preserving active Hats jars and their yield routes.
    function unlistOlderGardenJars(address[] calldata gardens) public override onlyOwner {
        for (uint256 i = 0; i < gardens.length; ++i) {
            address[] storage jars = gardenJarList[gardens[i]];
            for (uint256 j = 0; j < jars.length; ++j) {
                address jar = jars[j];
                if (hatsJarFactory.isFactoryJar(jar)) revert ActiveHatsJar(jar);
            }
        }
        super.unlistOlderGardenJars(gardens);
    }

    /// @notice Create and list both reviewed jars for a canonical garden with an empty registry.
    /// @dev Restricted to the module owner. A change to either registry entry or any role Hat
    ///      invalidates queued calldata. A failure on either asset rolls back both deployments.
    function provisionHatsJarPair(
        IHatsJarFactory.Config calldata first,
        IHatsJarFactory.Config calldata second,
        uint256 generation
    )
        external
        onlyOwner
        nonReentrant
        returns (address firstJar, address secondJar)
    {
        address garden = first.garden;
        if (
            generation == 0 || garden == address(0) || garden != second.garden || first.asset == second.asset
                || !_supportsPair(first.asset, second.asset)
        ) revert InvalidJarPair();
        if (!IHatsJarGardenToken(gardenToken).isGardenAccount(garden)) revert UnsupportedGarden(garden);
        if (
            gardenJarList[garden].length != 0 || gardenJars[garden][first.asset] != address(0)
                || gardenJars[garden][second.asset] != address(0)
        ) revert GardenAlreadyListed(garden);

        IHatsJarFactory factory = hatsJarFactory;
        if (
            address(factory).codehash != hatsJarFactoryCodeHash || factory.HATS() != hatsProtocol
                || factory.registrar() != address(this)
        ) revert InvalidHatsJarFactory();
        (uint256 ownerHat, uint256 stewardHat,, uint256 gardenerHat,,,, bool configured) =
            hatsModule.getGardenHatIds(garden);
        if (
            !configured || !_matchesHats(first, ownerHat, stewardHat, gardenerHat)
                || !_matchesHats(second, ownerHat, stewardHat, gardenerHat)
        ) revert GardenHatsChanged(garden);

        firstJar = factory.createJar(first, generation);
        secondJar = factory.createJar(second, generation);
        if (firstJar == secondJar) revert InvalidCreatedJar(secondJar);
        _listCreatedJar(factory, first, generation, firstJar);
        _listCreatedJar(factory, second, generation, secondJar);
    }

    function _supportsPair(address first, address second) private view returns (bool) {
        bool firstSupported;
        bool secondSupported;
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            if (asset == first) firstSupported = true;
            if (asset == second) secondSupported = true;
        }
        return firstSupported && secondSupported;
    }

    function _matchesHats(
        IHatsJarFactory.Config calldata config,
        uint256 ownerHat,
        uint256 stewardHat,
        uint256 gardenerHat
    )
        private
        view
        returns (bool)
    {
        return config.hats == hatsProtocol && config.ownerHat == ownerHat && config.stewardHat == stewardHat
            && config.gardenerHat == gardenerHat;
    }

    function _listCreatedJar(
        IHatsJarFactory factory,
        IHatsJarFactory.Config calldata config,
        uint256 generation,
        address jar
    )
        private
    {
        if (
            jar.code.length == 0 || !factory.isFactoryJar(jar)
                || factory.jarFor(config.garden, config.asset, generation) != jar
        ) revert InvalidCreatedJar(jar);
        gardenJars[config.garden][config.asset] = jar;
        gardenJarList[config.garden].push(jar);
        emit JarCreated(config.garden, config.asset, jar);
    }
}
