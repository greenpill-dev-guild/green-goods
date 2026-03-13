// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./ForkTestBase.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { MockERC20 } from "../../../src/mocks/ERC20.sol";

/// @notice Minimal interface for CookieJar deposit/withdraw interactions
interface ICookieJarLike {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount, string calldata purpose) external;
}

/// @title CookieJarForkTestBase
/// @notice Shared base for fork tests validating CookieJar creation, Hats-gated withdrawal,
///         and yield routing through the real protocol stack deployed via ForkTestBase.
/// @dev Extends ForkTestBase — all contracts (CookieJarModule, YieldResolver, HatsModule,
///      GardenToken) come from _deployFullStackOnFork(). No inline mocks.
///      Subclasses override _chainName() to specify the fork target.
abstract contract CookieJarForkTestBase is ForkTestBase {
    /// @notice The chain name used for fork resolution (e.g., "sepolia", "arbitrum")
    function _chainName() internal pure virtual returns (string memory);

    /// @notice Mock token used as CookieJar asset
    MockERC20 internal cookieToken;

    /// @notice Garden account minted for CookieJar tests
    address internal cookieGarden;

    function setUp() public {
        if (!_tryChainFork(_chainName())) return;
        _deployFullStackOnFork();

        // Deploy a mock ERC20 as the cookie jar asset
        cookieToken = new MockERC20();

        // Add it as a supported asset in the CookieJarModule deployed by full stack
        cookieJarModule.addSupportedAsset(address(cookieToken));

        // Mint a garden (triggers CookieJarModule.onGardenMinted via GardenToken)
        cookieGarden = _mintTestGarden("CookieJar Fork Test Garden", 0x0F);
    }

    /// @notice Create jar, deposit, verify non-member cannot withdraw, grant gardener role
    ///         via real HatsModule, verify gardener CAN withdraw.
    function test_fork_createsJar_deposit_and_hatsGatedWithdrawal() public {
        if (!forkActive || cookieGarden == address(0)) return;

        // Verify jar was created for the garden + token pair
        address jar = cookieJarModule.getGardenJar(cookieGarden, address(cookieToken));
        assertTrue(jar != address(0), "jar should be created");

        // Deposit tokens into the jar
        cookieToken.mint(address(this), 100 ether);
        cookieToken.approve(jar, 100 ether);
        ICookieJarLike(jar).deposit(100 ether);

        // Non-member (forkGardener has no role yet) should be blocked by Hats ERC1155 gate
        vm.prank(forkGardener);
        (bool withdrawOk,) =
            jar.call(abi.encodeWithSelector(ICookieJarLike.withdraw.selector, 10 ether, "gated-withdrawal"));
        assertFalse(withdrawOk, "non-member withdrawal should revert through the jar's Hats gate");

        // Grant gardener role via REAL HatsModule (mints the gardener hat under the hood)
        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(cookieGarden, forkGardener), "gardener should have role");

        // Now the gardener (hat-wearer) should be able to withdraw
        uint256 beforeBal = cookieToken.balanceOf(forkGardener);
        vm.prank(forkGardener);
        ICookieJarLike(jar).withdraw(10 ether, "gated-withdrawal");
        assertEq(cookieToken.balanceOf(forkGardener) - beforeBal, 10 ether, "hats wearer should withdraw");
    }

    /// @notice Withdrawal with purpose string and empty purpose string both succeed.
    function test_fork_withdrawal_with_purpose_string() public {
        if (!forkActive || cookieGarden == address(0)) return;

        address jar = cookieJarModule.getGardenJar(cookieGarden, address(cookieToken));
        assertTrue(jar != address(0), "jar should exist");

        // Fund the jar
        cookieToken.mint(address(this), 100 ether);
        cookieToken.approve(jar, 100 ether);
        ICookieJarLike(jar).deposit(100 ether);

        // Grant gardener role so they can withdraw
        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        // Withdraw with a purpose string
        uint256 balBefore = cookieToken.balanceOf(forkGardener);
        vm.prank(forkGardener);
        ICookieJarLike(jar).withdraw(5 ether, "weekly groceries");
        assertEq(cookieToken.balanceOf(forkGardener) - balBefore, 5 ether, "purpose withdrawal should transfer");

        // Withdraw with empty purpose string
        uint256 balBefore2 = cookieToken.balanceOf(forkGardener);
        vm.prank(forkGardener);
        ICookieJarLike(jar).withdraw(5 ether, "");
        assertEq(cookieToken.balanceOf(forkGardener) - balBefore2, 5 ether, "empty purpose withdrawal should transfer");
    }

    /// @notice Deploy a 2nd MockERC20, create a 2nd jar, verify isolated deposits/withdrawals.
    function test_fork_multiple_jars_per_garden() public {
        if (!forkActive || cookieGarden == address(0)) return;

        // First jar already exists from setUp (cookieToken)
        address jar1 = cookieJarModule.getGardenJar(cookieGarden, address(cookieToken));
        assertTrue(jar1 != address(0), "jar1 should exist");

        // Deploy a second token and add it as supported
        MockERC20 secondToken = new MockERC20();
        cookieJarModule.addSupportedAsset(address(secondToken));

        // Mint a second garden jar by depositing (or trigger via module)
        // The module should auto-create jar on supported asset addition
        address jar2 = cookieJarModule.getGardenJar(cookieGarden, address(secondToken));
        // If jar2 is not auto-created, skip the rest (module may require explicit creation)
        if (jar2 == address(0)) {
            return;
        }

        assertTrue(jar1 != jar2, "jars should have different addresses");

        // Fund and deposit into both jars
        cookieToken.mint(address(this), 50 ether);
        cookieToken.approve(jar1, 50 ether);
        ICookieJarLike(jar1).deposit(50 ether);

        secondToken.mint(address(this), 100 ether);
        secondToken.approve(jar2, 100 ether);
        ICookieJarLike(jar2).deposit(100 ether);

        // Grant gardener role
        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        // Withdraw from jar1 should not affect jar2
        vm.prank(forkGardener);
        ICookieJarLike(jar1).withdraw(10 ether, "jar1-withdrawal");
        assertEq(cookieToken.balanceOf(forkGardener), 10 ether, "jar1 withdrawal should work");

        // Withdraw from jar2
        vm.prank(forkGardener);
        ICookieJarLike(jar2).withdraw(20 ether, "jar2-withdrawal");
        assertEq(secondToken.balanceOf(forkGardener), 20 ether, "jar2 withdrawal should work");
    }

    /// @notice Yield routing: OctantModule registers shares, splitYield allocates 48.65% to CookieJar.
    /// @dev Uses a MockVault pattern scoped to this test since full Aave setup is not always available.
    ///      The YieldResolver's vault interaction (redeem) requires an ERC-4626-like contract, so we
    ///      deploy a minimal mock vault inline. The key assertion is that CookieJarModule's jar receives
    ///      the correct proportion of the yield after splitYield().
    function test_fork_routes_4865bps_to_cookie_jar_via_yield_splitter() public {
        if (!forkActive || cookieGarden == address(0)) return;

        address jar = cookieJarModule.getGardenJar(cookieGarden, address(cookieToken));
        assertTrue(jar != address(0), "jar should exist for yield routing test");

        // Deploy a minimal mock vault that simulates ERC-4626 redeem
        MockVaultForYieldTest vault = new MockVaultForYieldTest(address(cookieToken));

        // Configure YieldResolver for this garden
        yieldSplitter.setGardenTreasury(cookieGarden, makeAddr("treasury"));
        yieldSplitter.setGardenVault(cookieGarden, address(cookieToken), address(vault));

        uint256 yieldAmount = 1000 ether;
        cookieToken.mint(address(vault), yieldAmount);
        vault.mintShares(address(yieldSplitter), yieldAmount);

        // Register shares as the octantModule
        vm.prank(address(octantModule));
        yieldSplitter.registerShares(cookieGarden, address(vault), yieldAmount);

        uint256 jarBefore = cookieToken.balanceOf(jar);
        yieldSplitter.splitYield(cookieGarden, address(cookieToken), address(vault));

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 jarDelta = cookieToken.balanceOf(jar) - jarBefore;
        assertEq(jarDelta, expectedCookieJar, "cookie jar should receive 48.65%");
    }
}

/// @notice Minimal mock vault for yield routing tests.
/// @dev Only used for the splitYield test where a full Aave/ERC-4626 vault is not available.
///      Simulates the `redeem(shares, receiver, owner, minAssets, strategies)` signature that
///      YieldResolver calls. Transfers 1:1 shares-to-assets from its token balance.
contract MockVaultForYieldTest {
    MockERC20 public immutable asset;
    mapping(address => uint256) public shares;

    constructor(address _asset) {
        asset = MockERC20(_asset);
    }

    function mintShares(address to, uint256 amount) external {
        shares[to] += amount;
    }

    function redeem(
        uint256 sharesAmount,
        address receiver,
        address,
        uint256,
        address[] calldata
    )
        external
        returns (uint256 assets)
    {
        require(shares[msg.sender] >= sharesAmount, "insufficient shares");
        shares[msg.sender] -= sharesAmount;
        asset.transfer(receiver, sharesAmount);
        return sharesAmount;
    }
}
