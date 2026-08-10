// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICreditRegistry } from "../../src/interfaces/ICreditRegistry.sol";
import { CreditRegistry } from "../../src/registries/Credit.sol";

/// @dev Frozen first-release storage shell used to prove that the production implementation can
///      read every custom slot after a UUPS upgrade. It intentionally contains no behavior beyond
///      seeding and exposes the exact eleven-entry plus 39-slot layout.
contract CreditRegistryFrozenLayoutV1 is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    address public hatsModule;
    address public commitmentPoolingModule;
    address public settlementModule;
    uint256 public nextLoanId;
    mapping(uint256 loanId => ICreditRegistry.Loan loan) private _loans;
    mapping(uint256 poolId => ICreditRegistry.PoolCreditConfig config) private _poolCreditConfig;
    mapping(uint256 poolId => mapping(address borrower => uint256 amount)) private _borrowerOutstanding;
    mapping(uint256 commitmentId => uint256 loanId) private _commitmentLoan;
    mapping(uint256 poolId => mapping(address executor => bool enabled)) private _executors;
    mapping(bytes32 executionRef => uint256 loanId) private _executionRefLoan;
    bool public paused;
    uint256[39] private __gap;

    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address hats_, address pooling_, address settlement_) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);
        hatsModule = hats_;
        commitmentPoolingModule = pooling_;
        settlementModule = settlement_;
        nextLoanId = 2;
        paused = true;
    }

    function seed(
        uint256 loanId,
        ICreditRegistry.Loan calldata loan,
        uint256 borrowerCap,
        address executor
    )
        external
        onlyOwner
    {
        _loans[loanId] = loan;
        _poolCreditConfig[loan.poolId] = ICreditRegistry.PoolCreditConfig({ borrowerCap: borrowerCap, enabled: true });
        _borrowerOutstanding[loan.poolId][loan.borrower] = loan.principal - loan.repaidAmount;
        _commitmentLoan[loan.commitmentId] = loanId;
        _executors[loan.poolId][executor] = true;
        _executionRefLoan[loan.executionRef] = loanId;
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}

contract CreditRegistryUpgradeTest is Test {
    address internal constant HATS = address(0xA7);
    address internal constant POOLING = address(0xB7);
    address internal constant SETTLEMENT = address(0xC7);
    address internal constant BORROWER = address(0xD7);
    address internal constant EXECUTOR = address(0xE7);
    bytes32 internal constant EXECUTION_REF = keccak256("layout-disbursement");

    function testUpgrade_CreditRegistryPreservesEveryFrozenCustomStorageEntry() public {
        CreditRegistryFrozenLayoutV1 frozen = new CreditRegistryFrozenLayoutV1();
        CreditRegistryFrozenLayoutV1 proxy = CreditRegistryFrozenLayoutV1(
            address(
                new ERC1967Proxy(
                    address(frozen),
                    abi.encodeCall(CreditRegistryFrozenLayoutV1.initialize, (address(this), HATS, POOLING, SETTLEMENT))
                )
            )
        );
        ICreditRegistry.Loan memory seeded = ICreditRegistry.Loan({
            poolId: 9,
            borrower: BORROWER,
            requestedBy: address(this),
            commitmentId: 77,
            token: address(0xDA1),
            principal: 50 ether,
            repaidAmount: 10 ether,
            feeAmount: 0,
            rail: ICreditRegistry.LoanRail.Treasury,
            disbursementId: 0,
            state: ICreditRegistry.LoanState.Disbursed,
            dueDate: uint64(block.timestamp + 1 days),
            installmentsTotal: 5,
            installmentsPaid: 1,
            attempts: 0,
            executionRef: EXECUTION_REF,
            termsCID: "bafy-layout-terms",
            reasonCID: ""
        });
        proxy.seed(1, seeded, 100 ether, EXECUTOR);

        CreditRegistry implementation = new CreditRegistry();
        proxy.upgradeToAndCall(address(implementation), abi.encodeCall(CreditRegistry.setPaused, (true)));
        CreditRegistry upgraded = CreditRegistry(address(proxy));

        assertEq(upgraded.hatsModule(), HATS);
        assertEq(upgraded.commitmentPoolingModule(), POOLING);
        assertEq(upgraded.settlementModule(), SETTLEMENT);
        assertEq(upgraded.nextLoanId(), 2);
        assertTrue(upgraded.paused());
        ICreditRegistry.PoolCreditConfig memory config = upgraded.poolCreditConfig(9);
        assertTrue(config.enabled);
        assertEq(config.borrowerCap, 100 ether);
        assertEq(upgraded.outstandingOf(9, BORROWER), 40 ether);
        assertEq(upgraded.loanOfCommitment(77), 1);
        assertTrue(upgraded.isExecutor(9, EXECUTOR));
        assertEq(upgraded.loanOfExecutionRef(EXECUTION_REF), 1);
        ICreditRegistry.Loan memory loan = upgraded.getLoan(1);
        assertEq(loan.borrower, BORROWER);
        assertEq(loan.principal, 50 ether);
        assertEq(loan.repaidAmount, 10 ether);
        assertEq(loan.executionRef, EXECUTION_REF);
        assertEq(loan.termsCID, "bafy-layout-terms");
    }
}
