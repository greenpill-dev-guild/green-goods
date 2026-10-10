// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { CookieJarModule } from "../../src/modules/CookieJar.sol";
import { CookieJarAssetLimits } from "../../script/CookieJarAssetLimits.sol";

contract NamedToken is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory symbol_, uint8 decimals_) ERC20(symbol_, symbol_) {
        _DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }
}

/// @notice A supported asset with no ERC-20 metadata must never stop an upgrade run.
contract SymbolLessToken { }

contract CookieJarAssetLimitsTest is Test {
    CookieJarModule private module;
    address private dai;
    address private weth;
    address private usdc;
    address private bare;

    function setUp() public {
        dai = address(new NamedToken("DAI", 18));
        weth = address(new NamedToken("WETH", 18));
        usdc = address(new NamedToken("USDC", 6));
        bare = address(new SymbolLessToken());

        address[] memory assets = new address[](5);
        assets[0] = weth;
        assets[1] = dai;
        assets[2] = usdc;
        assets[3] = bare;
        assets[4] = address(0xC0DE1E55); // no code at all

        bytes memory initData = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            address(this),
            address(0xA),
            address(0xB),
            address(0xC),
            address(0xD),
            assets
        );
        module = CookieJarModule(address(new ERC1967Proxy(address(new CookieJarModule()), initData)));
    }

    function testCookieJarAssetLimits_givesDaiTenAndWethOneHundredth() public {
        uint256 changed = CookieJarAssetLimits.applyTo(module);

        assertEq(changed, 2, "only the two recognised assets should be written");
        assertEq(module.assetMaxWithdrawal(dai), 10 ether, "DAI jars should allow 10 DAI per claim");
        assertEq(module.assetMaxWithdrawal(weth), 0.01 ether, "WETH jars should allow 0.01 WETH per claim");
        assertEq(module.assetMaxWithdrawal(usdc), 0, "an asset with no ruled limit keeps the default");
        assertEq(module.assetMaxWithdrawal(bare), 0, "an asset without a symbol keeps the default");
        assertEq(module.assetMaxWithdrawal(address(0xC0DE1E55)), 0, "an address without code keeps the default");
    }

    function testCookieJarAssetLimits_secondRunWritesNothing() public {
        CookieJarAssetLimits.applyTo(module);

        assertEq(CookieJarAssetLimits.applyTo(module), 0, "a settled module needs no transactions");
    }

    function testCookieJarAssetLimits_scalesToTheAssetsDecimals() public {
        address sixDecimalDai = address(new NamedToken("DAI", 6));

        assertEq(CookieJarAssetLimits.limitFor(sixDecimalDai), 10e6, "10 DAI in a 6-decimal asset");
    }
}
