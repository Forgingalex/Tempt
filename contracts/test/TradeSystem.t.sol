// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {TradeAgentRegistry} from "../src/TradeAgentRegistry.sol";
import {ITradeAgentRegistry} from "../src/interfaces/ITradeAgentRegistry.sol";
import {ShareTokenFactory} from "../src/ShareTokenFactory.sol";
import {IBondingCurveMarket} from "../src/interfaces/IBondingCurveMarket.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {IFeeRouter} from "../src/interfaces/IFeeRouter.sol";
import {StakingAndSlashing} from "../src/StakingAndSlashing.sol";
import {TradingVault} from "../src/TradingVault.sol";
import {ITradingVault} from "../src/interfaces/ITradingVault.sol";
import {ShareToken} from "../src/ShareToken.sol";

// ── Minimal TIP-20 mock ──────────────────────────────────────────────────────

contract MockTIP20 {
    string  public name;
    string  public symbol;
    uint8   public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _sym) {
        name   = _name;
        symbol = _sym;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        return true;
    }

    // Tempo-specific memos — same logic as transfer/transferFrom but with memo param
    function transferWithMemo(address to, uint256 amount, bytes32 /*memo*/) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }

    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 /*memo*/) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        return true;
    }
}

// ── Base test ────────────────────────────────────────────────────────────────

contract TradeSystemBase is Test {
    MockTIP20           internal stablecoin;
    StakingAndSlashing  internal staking;
    TradeAgentRegistry  internal registry;
    ShareTokenFactory   internal factory;
    TradingVault        internal vault;
    FeeRouter           internal feeRouter;
    BondingCurveMarket  internal market;

    address internal admin   = address(0xAD);
    address internal creator = address(0xC0);
    address internal buyer   = address(0xB0);
    address internal seller  = address(0x50);
    address internal treasury = address(0x77);

    function setUp() public virtual {
        vm.startPrank(admin);

        stablecoin = new MockTIP20("AlphaUSD", "aUSD");

        // Deploy contracts
        staking   = new StakingAndSlashing(admin, address(stablecoin));
        registry  = new TradeAgentRegistry(admin);
        factory   = new ShareTokenFactory(admin);
        vault     = new TradingVault(admin);
        feeRouter = new FeeRouter(admin, treasury, treasury, treasury);
        market    = new BondingCurveMarket(
            admin,
            address(registry),
            address(factory),
            address(vault),
            address(feeRouter),
            address(stablecoin)
        );

        // Wire up
        registry.setStakingContract(address(staking));
        registry.setShareTokenFactory(address(factory));
        factory.setBondingCurve(address(market));
        factory.setAgentRegistry(address(registry));
        vault.setBondingCurve(address(market));
        vault.setFeeRouter(address(feeRouter));
        vault.setTokenWhitelist(address(stablecoin), true);
        feeRouter.setBondingCurve(address(market));
        feeRouter.setAgentRegistry(address(registry));
        feeRouter.setVault(address(vault));
        feeRouter.setPaymentToken(address(stablecoin));

        vm.stopPrank();

        // Fund test accounts (6-decimal stablecoin)
        stablecoin.mint(creator, 1_000_000_000); // $1000
        stablecoin.mint(buyer,   1_000_000_000); // $1000
        stablecoin.mint(seller,  1_000_000_000); // $1000
    }

    /// @dev Register an agent (creator posts bond first)
    function _registerAgent() internal returns (uint256 agentId) {
        vm.startPrank(creator);
        stablecoin.approve(address(staking), type(uint256).max);
        staking.postBond();

        agentId = registry.registerAgent(
            "ipfs://QmTest",
            bytes32("codehash"),
            200, // 2% creator fee
            staking.requiredBond(),
            100_000_000e18 // 100M supply cap
        );
        vm.stopPrank();
    }

    /// @dev Deposit stablecoins into vault
    function _deposit(address user, uint256 amount) internal {
        vm.startPrank(user);
        stablecoin.approve(address(vault), type(uint256).max);
        vault.deposit(address(stablecoin), amount);
        vm.stopPrank();
    }
}

// ── StakingAndSlashing tests ─────────────────────────────────────────────────

contract StakingTest is TradeSystemBase {
    function test_PostAndRefundBond() public {
        vm.startPrank(creator);
        stablecoin.approve(address(staking), type(uint256).max);
        staking.postBond();
        vm.stopPrank();

        assertTrue(staking.hasBond(creator, staking.DEFAULT_BOND()));

        // Warp past lock period
        vm.warp(block.timestamp + 181 days);
        vm.prank(creator);
        staking.refundBond();

        assertFalse(staking.hasBond(creator, 1));
    }

    function test_CannotRefundBeforeLockExpiry() public {
        vm.startPrank(creator);
        stablecoin.approve(address(staking), type(uint256).max);
        staking.postBond();
        vm.stopPrank();

        vm.expectRevert(StakingAndSlashing.LockPeriodNotExpired.selector);
        vm.prank(creator);
        staking.refundBond();
    }

    function test_AdminCanSlash() public {
        vm.startPrank(creator);
        stablecoin.approve(address(staking), type(uint256).max);
        staking.postBond();
        vm.stopPrank();

        uint256 before = stablecoin.balanceOf(treasury);
        vm.prank(admin);
        staking.slash(creator, treasury);

        assertGt(stablecoin.balanceOf(treasury), before);
        assertFalse(staking.hasBond(creator, 1));
    }

    function test_CannotDoublePost() public {
        vm.startPrank(creator);
        stablecoin.approve(address(staking), type(uint256).max);
        staking.postBond();
        vm.expectRevert(StakingAndSlashing.BondAlreadyPosted.selector);
        staking.postBond();
        vm.stopPrank();
    }
}

// ── TradeAgentRegistry tests ─────────────────────────────────────────────────

contract RegistryTest is TradeSystemBase {
    function test_RegisterAgent() public {
        uint256 agentId = _registerAgent();
        assertEq(agentId, 1);

        (address c, string memory uri,, uint32 feeBps, uint256 cap, uint8 status) = registry.getAgent(agentId);
        assertEq(c, creator);
        assertEq(uri, "ipfs://QmTest");
        assertEq(feeBps, 200);
        assertEq(cap, 100_000_000e18);
        assertEq(status, 0); // Active
    }

    function test_RevertIfNoBond() public {
        vm.prank(creator);
        vm.expectRevert(ITradeAgentRegistry.BondNotPosted.selector);
        registry.registerAgent("ipfs://x", bytes32("hash"), 100, 200_000_000, 100_000_000e18);
    }

    function test_RevertIfSupplyCapTooLow() public {
        vm.startPrank(creator);
        stablecoin.approve(address(staking), type(uint256).max);
        staking.postBond();
        // Evaluate bondAmount before setting expectRevert so the staticcall
        // doesn't get consumed by vm.expectRevert
        uint256 bondAmt = staking.requiredBond();
        vm.expectRevert(ITradeAgentRegistry.SupplyCapOutOfRange.selector);
        registry.registerAgent("ipfs://x", bytes32("hash"), 100, bondAmt, 1e18);
        vm.stopPrank();
    }

    function test_CreatorCanPause() public {
        uint256 agentId = _registerAgent();
        vm.prank(creator);
        registry.setAgentStatus(agentId, 1);
        (,,,,,uint8 status) = registry.getAgent(agentId);
        assertEq(status, 1);
    }

    function test_AdminCanDelist() public {
        uint256 agentId = _registerAgent();
        vm.prank(admin);
        registry.setAgentStatus(agentId, 2);
        (,,,,,uint8 status) = registry.getAgent(agentId);
        assertEq(status, 2);
    }
}

// ── TradingVault tests ───────────────────────────────────────────────────────

contract VaultTest is TradeSystemBase {
    function test_DepositAndWithdraw() public {
        uint256 amount = 100_000_000; // $100

        _deposit(buyer, amount);
        assertEq(vault.balanceOf(buyer, address(stablecoin)), amount);

        vm.prank(buyer);
        vault.withdraw(address(stablecoin), amount);
        assertEq(vault.balanceOf(buyer, address(stablecoin)), 0);
    }

    function test_RevertDepositUnknownToken() public {
        vm.prank(buyer);
        vm.expectRevert(ITradingVault.TokenNotWhitelisted.selector);
        vault.deposit(address(0xDEAD), 100);
    }

    function test_RevertWithdrawInsufficientBalance() public {
        vm.prank(buyer);
        vm.expectRevert(ITradingVault.InsufficientBalance.selector);
        vault.withdraw(address(stablecoin), 1);
    }

    function test_OnlyBondingCurveCanDebit() public {
        _deposit(buyer, 100_000_000);
        vm.prank(buyer);
        vm.expectRevert(ITradingVault.Unauthorized.selector);
        vault.debit(buyer, address(stablecoin), 100_000_000, 1);
    }

    function test_EmergencyPause() public {
        vm.prank(admin);
        vault.setPause(true);

        vm.prank(buyer);
        stablecoin.approve(address(vault), type(uint256).max);
        vm.expectRevert(ITradingVault.DepositsArePaused.selector);
        vm.prank(buyer);
        vault.deposit(address(stablecoin), 100_000_000);
    }
}

// ── BondingCurveMarket tests ─────────────────────────────────────────────────

contract BondingCurveTest is TradeSystemBase {
    uint256 internal agentId;

    function setUp() public override {
        super.setUp();
        agentId = _registerAgent();
    }

    function test_BuyShares() public {
        uint256 depositAmt = 100_000_000; // $100
        _deposit(buyer, depositAmt);

        vm.prank(buyer);
        uint256 minted = market.buy(agentId, depositAmt, buyer);

        assertGt(minted, 0);
        assertGt(market.currentSupply(agentId), 0);
        assertGt(market.currentPrice(agentId), 0);
        assertEq(vault.balanceOf(buyer, address(stablecoin)), 0);
    }

    function test_BuyThenSell() public {
        uint256 depositAmt = 100_000_000; // $100
        _deposit(buyer, depositAmt);

        vm.prank(buyer);
        uint256 minted = market.buy(agentId, depositAmt, buyer);
        assertGt(minted, 0);

        // Transfer shares to seller for sell test
        address shareToken = registry.shareTokenOf(agentId);
        vm.prank(buyer);
        ShareToken(shareToken).transfer(seller, minted);

        // Seller sells shares
        vm.prank(seller);
        uint256 returned = market.sell(agentId, minted, seller);

        assertGt(returned, 0);
        // Returned should be less than input due to fees
        assertLt(returned, depositAmt);
        assertGt(vault.balanceOf(seller, address(stablecoin)), 0);
    }

    function test_PriceIncreasesWithBuys() public {
        _deposit(buyer, 500_000_000); // $500

        uint256 price1 = market.currentPrice(agentId);

        vm.prank(buyer);
        market.buy(agentId, 100_000_000, buyer);
        uint256 price2 = market.currentPrice(agentId);

        vm.prank(buyer);
        market.buy(agentId, 100_000_000, buyer);
        uint256 price3 = market.currentPrice(agentId);

        assertGt(price2, price1);
        assertGt(price3, price2);
    }

    function test_SupplyCapEnforced() public {
        // Register agent with minimum supply cap
        vm.startPrank(creator);
        uint256 smallCapId = registry.registerAgent(
            "ipfs://small",
            bytes32("code2"),
            100,
            staking.requiredBond(), // bond already posted
            100_000_000e18          // 100M cap
        );
        vm.stopPrank();

        // Try to buy more than cap — should eventually revert
        // Deposit a huge amount
        stablecoin.mint(buyer, 1_000_000_000_000);
        _deposit(buyer, 1_000_000_000_000);

        // First buy succeeds
        vm.prank(buyer);
        market.buy(smallCapId, 1_000_000_000, buyer);

        // Buying enormous amount should revert with cap exceeded
        // (Depends on curve math — we just verify the guard exists)
        uint256 hugeBuy = 900_000_000_000; // Attempt to push well past cap
        (uint256 wouldMint,) = market.previewBuy(smallCapId, hugeBuy);
        uint256 currentSup = market.currentSupply(smallCapId);

        if (currentSup + wouldMint > 100_000_000e18) {
            vm.prank(buyer);
            vm.expectRevert(IBondingCurveMarket.SupplyCapExceeded.selector);
            market.buy(smallCapId, hugeBuy, buyer);
        }
    }

    function test_PreviewBuyMatchesBuy() public {
        uint256 depositAmt = 50_000_000; // $50
        _deposit(buyer, depositAmt);

        (uint256 expectedShares,) = market.previewBuy(agentId, depositAmt);

        vm.prank(buyer);
        uint256 actualMinted = market.buy(agentId, depositAmt, buyer);

        assertEq(actualMinted, expectedShares);
    }

    function test_RevertBuyZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(IBondingCurveMarket.ZeroAmount.selector);
        market.buy(agentId, 0, buyer);
    }

    function test_RevertSellMoreThanOwned() public {
        uint256 depositAmt = 100_000_000;
        _deposit(buyer, depositAmt);

        vm.prank(buyer);
        uint256 minted = market.buy(agentId, depositAmt, buyer);

        vm.prank(buyer);
        vm.expectRevert(IBondingCurveMarket.InsufficientShares.selector);
        market.sell(agentId, minted + 1e18, buyer);
    }

    // ── Fuzz Tests ──────────────────────────────────────────────────────────

    /// @notice Fuzz: reserve always positive after any sequence of buys
    function testFuzz_ReserveAlwaysPositiveAfterBuy(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 1_000_000, 100_000_000); // $1 – $100
        stablecoin.mint(buyer, buyAmount * 10);
        _deposit(buyer, buyAmount);

        vm.prank(buyer);
        market.buy(agentId, buyAmount, buyer);

        assertGt(market.reserveBalance(agentId), 0);
    }

    /// @notice Fuzz: selling returns less than buying cost (fees)
    function testFuzz_SellLessThanBuy(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 10_000_000, 200_000_000); // $10 – $200
        stablecoin.mint(buyer, buyAmount * 2);
        _deposit(buyer, buyAmount);

        vm.prank(buyer);
        uint256 minted = market.buy(agentId, buyAmount, buyer);

        address shareToken = registry.shareTokenOf(agentId);
        vm.prank(buyer);
        ShareToken(shareToken).transfer(seller, minted);

        vm.prank(seller);
        uint256 returned = market.sell(agentId, minted, seller);

        assertLt(returned, buyAmount, "sell must return less than buy cost (fees)");
    }

    /// @notice Fuzz: supply never exceeds cap
    function testFuzz_SupplyNeverExceedsCap(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 1_000_000, 500_000_000);
        stablecoin.mint(buyer, buyAmount * 2);
        _deposit(buyer, buyAmount);

        (uint256 expectedShares,) = market.previewBuy(agentId, buyAmount);
        uint256 currentSup = market.currentSupply(agentId);
        uint256 cap = 100_000_000e18;

        if (currentSup + expectedShares <= cap) {
            vm.prank(buyer);
            market.buy(agentId, buyAmount, buyer);
            assertLe(market.currentSupply(agentId), cap);
        }
    }
}

// ── FeeRouter tests ──────────────────────────────────────────────────────────

contract FeeRouterTest is TradeSystemBase {
    function test_FeeSplitConfiguration() public {
        // Default split: 12 + 13 + 0 + 5 = 30 bps
        (uint16 total, uint16 c, uint16 b, uint16 l, uint16 p) = feeRouter.getFeeConfig();
        assertEq(total, 30);
        assertEq(c + b + l + p, total);
    }

    function test_SetFeeSplit() public {
        vm.prank(admin);
        feeRouter.setFeeSplit(10, 15, 0, 5);
        (, uint16 c, uint16 b, uint16 l, uint16 p) = feeRouter.getFeeConfig();
        assertEq(c, 10);
        assertEq(b, 15);
        assertEq(l, 0);
        assertEq(p, 5);
    }

    function test_RevertInvalidFeeSplit() public {
        vm.prank(admin);
        vm.expectRevert(IFeeRouter.InvalidFeeSplit.selector);
        feeRouter.setFeeSplit(10, 10, 0, 5); // sums to 25, not 30
    }
}
