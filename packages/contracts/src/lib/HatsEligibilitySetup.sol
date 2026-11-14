// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IHatsModuleFactory } from "../interfaces/IHatsModuleFactory.sol";
import { ZeroAddress } from "../CommonErrors.sol";

/// @notice Clone and attach garden eligibility modules in the calling HatsModule context.
library HatsEligibilitySetup {
    struct Config {
        IHats hats;
        IHatsModuleFactory hatsModuleFactory;
        address funderEligibilityModule;
        address communityEligibilityModule;
        uint256 communityMinBalance;
    }

    function configure(
        Config memory config,
        uint256 funderHatId,
        uint256 communityHatIdParam,
        uint256 operatorHatId,
        address communityToken
    )
        internal
    {
        if (config.funderEligibilityModule != address(0)) {
            address funderModule = config.funderEligibilityModule;
            if (address(config.hatsModuleFactory) != address(0)) {
                bytes memory initData = abi.encode(operatorHatId, operatorHatId);
                try config.hatsModuleFactory
                .createHatsModule(config.funderEligibilityModule, funderHatId, "", initData, 0) returns (
                    address createdModule
                ) {
                    funderModule = createdModule;
                } catch {
                    emit IHatsModule.EligibilityModuleCreationFailed(funderHatId, "funder");
                    funderModule = address(0);
                }
            }
            if (funderModule != address(0)) {
                try config.hats.changeHatEligibility(funderHatId, funderModule) { }
                catch {
                    emit IHatsModule.EligibilityModuleCreationFailed(funderHatId, "funder");
                }
            }
        }

        if (config.communityEligibilityModule != address(0)) {
            address communityModule = config.communityEligibilityModule;
            if (address(config.hatsModuleFactory) != address(0)) {
                if (communityToken == address(0)) revert ZeroAddress();
                bytes memory otherArgs = abi.encodePacked(communityToken, config.communityMinBalance);
                try config.hatsModuleFactory
                    .createHatsModule(config.communityEligibilityModule, communityHatIdParam, otherArgs, "", 0) returns (
                    address createdModule
                ) {
                    communityModule = createdModule;
                } catch {
                    emit IHatsModule.EligibilityModuleCreationFailed(communityHatIdParam, "community");
                    communityModule = address(0);
                }
            }
            if (communityModule != address(0)) {
                try config.hats.changeHatEligibility(communityHatIdParam, communityModule) { }
                catch {
                    emit IHatsModule.EligibilityModuleCreationFailed(communityHatIdParam, "community");
                }
            }
        }
    }
}
