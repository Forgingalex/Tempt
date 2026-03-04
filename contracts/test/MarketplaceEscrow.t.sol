// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";
import {IMarketplaceEscrow} from "../src/interfaces/IMarketplaceEscrow.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {MockTIP20} from "./mocks/MockTIP20.sol";

contract MarketplaceEscrowTest is Test {
    AgentRegistry public registry;
    MarketplaceEscrow public escrow;
    MockTIP20 public token;

    address public admin = makeAddr("admin");
    address public feeRecipient = makeAddr("feeRecipient");
    address public seller = makeAddr("seller");
    address public buyer = makeAddr("buyer");

    string constant METADATA_CID = "QmTest123456789";
    uint256 constant PRICE = 10_000_000; // 10 USD (6 decimals)
    uint256 constant FEE_BPS = 250; // 2.5%

    function setUp() public {
        // Deploy token
        token = new MockTIP20();

        // Deploy registry
        vm.prank(admin);
        registry = new AgentRegistry(admin);

        // Deploy escrow
        vm.prank(admin);
        escrow = new MarketplaceEscrow(admin, feeRecipient, address(registry), FEE_BPS);

        // Link registry to escrow
        vm.prank(admin);
        registry.setEscrowContract(address(escrow));

        // Create an agent
        vm.prank(seller);
        registry.listAgent(METADATA_CID, PRICE, address(token));

        // Fund buyer
        token.mint(buyer, PRICE * 10);

        // Approve escrow to spend buyer's tokens
        vm.prank(buyer);
        token.approve(address(escrow), type(uint256).max);
    }

    // ============ Purchase Tests ============

    function test_purchase() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        assertEq(escrowId, 0);

        IMarketplaceEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.id, 0);
        assertEq(e.agentId, 0);
        assertEq(e.buyer, buyer);
        assertEq(e.seller, seller);
        assertEq(e.amount, PRICE);
        assertEq(e.token, address(token));
        assertEq(uint256(e.status), uint256(IMarketplaceEscrow.EscrowStatus.Active));

        // Check funds transferred to escrow
        assertEq(token.balanceOf(address(escrow)), PRICE);
        assertEq(token.balanceOf(buyer), PRICE * 10 - PRICE);
    }

    function test_purchase_emitsEvent() public {
        uint256 expectedAutoRelease = block.timestamp + 7 days;

        vm.expectEmit(true, true, true, true);
        emit IMarketplaceEscrow.EscrowCreated(0, 0, buyer, seller, PRICE, address(token), expectedAutoRelease);

        vm.prank(buyer);
        escrow.purchase(0);
    }

    // ============ Accept and Release Tests ============

    function test_acceptAndRelease() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        uint256 sellerBalanceBefore = token.balanceOf(seller);
        uint256 feeRecipientBalanceBefore = token.balanceOf(feeRecipient);

        vm.prank(buyer);
        escrow.acceptAndRelease(escrowId);

        IMarketplaceEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.status), uint256(IMarketplaceEscrow.EscrowStatus.Released));

        // Check funds distributed correctly
        uint256 expectedFee = (PRICE * FEE_BPS) / 10_000; // 2.5%
        uint256 expectedSellerAmount = PRICE - expectedFee;

        assertEq(token.balanceOf(seller) - sellerBalanceBefore, expectedSellerAmount);
        assertEq(token.balanceOf(feeRecipient) - feeRecipientBalanceBefore, expectedFee);
        assertEq(token.balanceOf(address(escrow)), 0);

        // Check sale recorded in registry
        IAgentRegistry.Agent memory agent = registry.getAgent(0);
        assertEq(agent.totalSales, 1);
    }

    function test_acceptAndRelease_revertNotBuyer() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        vm.prank(seller);
        vm.expectRevert(MarketplaceEscrow.NotBuyer.selector);
        escrow.acceptAndRelease(escrowId);
    }

    function test_acceptAndRelease_revertNotActive() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        vm.prank(buyer);
        escrow.acceptAndRelease(escrowId);

        vm.prank(buyer);
        vm.expectRevert(MarketplaceEscrow.EscrowNotActive.selector);
        escrow.acceptAndRelease(escrowId);
    }

    // ============ Dispute Tests ============

    function test_raiseDispute() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        vm.prank(buyer);
        escrow.raiseDispute(escrowId, "Agent didn't work as described");

        IMarketplaceEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.status), uint256(IMarketplaceEscrow.EscrowStatus.Disputed));
    }

    function test_resolveDispute_refund() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        vm.prank(buyer);
        escrow.raiseDispute(escrowId, "Agent didn't work");

        uint256 buyerBalanceBefore = token.balanceOf(buyer);

        vm.prank(admin);
        escrow.resolveDispute(escrowId, true); // refund buyer

        IMarketplaceEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.status), uint256(IMarketplaceEscrow.EscrowStatus.Refunded));

        // Check buyer received refund
        assertEq(token.balanceOf(buyer) - buyerBalanceBefore, PRICE);
    }

    function test_resolveDispute_releaseToSeller() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        vm.prank(buyer);
        escrow.raiseDispute(escrowId, "Agent didn't work");

        uint256 sellerBalanceBefore = token.balanceOf(seller);

        vm.prank(admin);
        escrow.resolveDispute(escrowId, false); // release to seller

        IMarketplaceEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.status), uint256(IMarketplaceEscrow.EscrowStatus.Released));

        // Check seller received payment (minus fee)
        uint256 expectedFee = (PRICE * FEE_BPS) / 10_000;
        uint256 expectedSellerAmount = PRICE - expectedFee;
        assertEq(token.balanceOf(seller) - sellerBalanceBefore, expectedSellerAmount);
    }

    // ============ Auto-Release Tests ============

    function test_autoRelease() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        // Warp time past auto-release period
        vm.warp(block.timestamp + 7 days + 1);

        uint256 sellerBalanceBefore = token.balanceOf(seller);

        escrow.autoRelease(escrowId);

        IMarketplaceEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.status), uint256(IMarketplaceEscrow.EscrowStatus.AutoReleased));

        // Check seller received payment
        uint256 expectedFee = (PRICE * FEE_BPS) / 10_000;
        uint256 expectedSellerAmount = PRICE - expectedFee;
        assertEq(token.balanceOf(seller) - sellerBalanceBefore, expectedSellerAmount);
    }

    function test_autoRelease_revertTooEarly() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.purchase(0);

        // Try to auto-release before time
        vm.expectRevert(MarketplaceEscrow.AutoReleaseNotReady.selector);
        escrow.autoRelease(escrowId);
    }

    // ============ Admin Functions Tests ============

    function test_setPlatformFee() public {
        vm.prank(admin);
        escrow.setPlatformFee(500); // 5%

        assertEq(escrow.getPlatformFeeBps(), 500);
    }

    function test_setPlatformFee_revertTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(MarketplaceEscrow.FeeTooHigh.selector);
        escrow.setPlatformFee(1001); // >10%
    }

    function test_setAutoReleasePeriod() public {
        vm.prank(admin);
        escrow.setAutoReleasePeriod(14 days);

        assertEq(escrow.getAutoReleasePeriod(), 14 days);
    }

    // ============ View Functions Tests ============

    function test_getEscrowsByBuyer() public {
        vm.startPrank(buyer);
        escrow.purchase(0);
        escrow.purchase(0);
        escrow.purchase(0);
        vm.stopPrank();

        uint256[] memory escrows = escrow.getEscrowsByBuyer(buyer);
        assertEq(escrows.length, 3);
    }

    function test_getEscrowsBySeller() public {
        vm.startPrank(buyer);
        escrow.purchase(0);
        escrow.purchase(0);
        vm.stopPrank();

        uint256[] memory escrows = escrow.getEscrowsBySeller(seller);
        assertEq(escrows.length, 2);
    }

    function test_escrowCount() public {
        assertEq(escrow.escrowCount(), 0);

        vm.prank(buyer);
        escrow.purchase(0);

        assertEq(escrow.escrowCount(), 1);
    }
}
