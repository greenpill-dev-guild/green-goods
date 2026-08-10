// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICreditRegistry } from "../../src/interfaces/ICreditRegistry.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { CreditRegistry } from "../../src/registries/Credit.sol";
import { CreditSettlementLookupMock } from "../helpers/CreditSettlementLookupMock.sol";
import { AaveOctantForkBase, IWETH9 } from "./helpers/AaveOctantForkBase.sol";

interface ICreditForkCookieJar {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount, string calldata purpose) external;
}

contract CreditForkPooling {
    ICommitmentPoolingModule.Pool private _pool;

    constructor(address garden) {
        _pool = ICommitmentPoolingModule.Pool({
            garden: garden,
            poolType: ICommitmentPoolingModule.PoolType.Garden,
            state: ICommitmentPoolingModule.PoolState.Open,
            proofEnabled: true,
            settlementEnabled: false,
            charterCID: "bafy-fork-credit",
            openSeasonCycleId: 0,
            settlementAdapter: address(0),
            liveCommitmentCount: 0,
            nonTerminalCycleCount: 0
        });
    }

    function getPool(uint256 poolId) external view returns (ICommitmentPoolingModule.Pool memory) {
        if (poolId == 1) return _pool;
        return ICommitmentPoolingModule.Pool({
            garden: address(0),
            poolType: ICommitmentPoolingModule.PoolType.Protocol,
            state: ICommitmentPoolingModule.PoolState.None,
            proofEnabled: false,
            settlementEnabled: false,
            charterCID: "",
            openSeasonCycleId: 0,
            settlementAdapter: address(0),
            liveCommitmentCount: 0,
            nonTerminalCycleCount: 0
        });
    }
}

contract CreditForkHats {
    address internal immutable steward;
    address internal immutable member;

    constructor(address steward_, address member_) {
        steward = steward_;
        member = member_;
    }

    function isStewardOf(address, address account) external view returns (bool) {
        return account == steward;
    }

    function isOwnerOf(address, address account) external view returns (bool) {
        return account == steward;
    }

    function isGardenerOf(address, address account) external view returns (bool) {
        return account == member;
    }

    function isEvaluatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isFunderOf(address, address) external pure returns (bool) {
        return false;
    }

    function isCommunityOf(address, address) external pure returns (bool) {
        return false;
    }
}

/// @notice Fork-local proof that the records-only registry can follow an actual Cookie Jar
///         withdraw-and-return round trip without ever receiving tokens itself.
contract CreditTreasuryRoundTripForkTest is AaveOctantForkBase {
    uint256 internal constant POOL_ID = 1;
    uint256 internal constant PRINCIPAL = 0.01 ether;

    address internal garden;
    address internal jar;
    CreditRegistry internal credit;

    function setUp() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnForkWithAssets(WETH, WETH);
        cookieJarModule.addSupportedAsset(WETH);
        garden = _mintTestGarden("Credit Fork WETH Garden", 0x0F);
        jar = cookieJarModule.getGardenJar(garden, WETH);
        assertGt(jar.code.length, 0, "live factory must create the WETH jar");
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);

        CreditForkPooling pooling = new CreditForkPooling(garden);
        CreditForkHats hats = new CreditForkHats(address(this), forkGardener);
        CreditSettlementLookupMock settlement = new CreditSettlementLookupMock();
        settlement.configure(address(0), address(hats), address(pooling));
        CreditRegistry implementation = new CreditRegistry();
        credit = CreditRegistry(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        CreditRegistry.initialize, (address(this), address(hats), address(pooling), address(settlement))
                    )
                )
            )
        );
        settlement.configure(address(credit), address(hats), address(pooling));
        credit.setPaused(false);
        credit.configurePoolCredit(POOL_ID, PRINCIPAL, true);
    }

    function testIntegration_creditTreasuryRoundTripRecordsWithoutRegistryCustody() public {
        vm.deal(address(this), PRINCIPAL);
        IWETH9(WETH).deposit{ value: PRINCIPAL }();
        IERC20(WETH).approve(jar, PRINCIPAL);
        ICreditForkCookieJar(jar).deposit(PRINCIPAL);

        ICreditRegistry.RequestLoanParams memory params = ICreditRegistry.RequestLoanParams({
            poolId: POOL_ID,
            commitmentId: 0,
            token: WETH,
            principal: PRINCIPAL,
            dueDate: uint64(block.timestamp + 30 days),
            installmentsTotal: 1,
            termsCID: "bafy-fork-cookie-jar-credit",
            onBehalfOf: address(0)
        });
        vm.prank(forkGardener);
        uint256 loanId = credit.requestLoan(params);
        credit.approveLoan(loanId);

        uint256 jarBefore = IERC20(WETH).balanceOf(jar);
        vm.prank(forkGardener);
        ICreditForkCookieJar(jar).withdraw(PRINCIPAL, "interest-free credit principal");
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Jar, keccak256("fork-jar-withdrawal"));
        assertEq(IERC20(WETH).balanceOf(jar), jarBefore - PRINCIPAL);
        assertEq(IERC20(WETH).balanceOf(address(credit)), 0, "registry must never receive principal");

        vm.startPrank(forkGardener);
        IERC20(WETH).approve(jar, PRINCIPAL);
        ICreditForkCookieJar(jar).deposit(PRINCIPAL);
        vm.stopPrank();
        credit.recordRepayment(loanId, PRINCIPAL, keccak256("fork-jar-return"));

        assertEq(IERC20(WETH).balanceOf(jar), jarBefore);
        assertEq(IERC20(WETH).balanceOf(address(credit)), 0, "registry must never receive repayment");
        assertEq(credit.outstandingOf(POOL_ID, forkGardener), 0);
        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Repaid));
    }
}
