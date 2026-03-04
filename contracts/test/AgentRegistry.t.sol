// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;

    address public admin = makeAddr("admin");
    address public seller1 = makeAddr("seller1");
    address public seller2 = makeAddr("seller2");
    address public escrow = makeAddr("escrow");
    address public paymentToken = makeAddr("paymentToken");

    string constant METADATA_CID = "QmTest123456789";
    uint256 constant PRICE = 10_000_000; // 10 USD (6 decimals)

    function setUp() public {
        vm.prank(admin);
        registry = new AgentRegistry(admin);

        vm.prank(admin);
        registry.setEscrowContract(escrow);
    }

    // ============ List Agent Tests ============

    function test_listAgent() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        assertEq(agentId, 0);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.id, 0);
        assertEq(agent.seller, seller1);
        assertEq(agent.metadataCID, METADATA_CID);
        assertEq(agent.price, PRICE);
        assertEq(agent.paymentToken, paymentToken);
        assertEq(uint256(agent.status), uint256(IAgentRegistry.AgentStatus.Listed));
        assertEq(agent.totalSales, 0);
    }

    function test_listAgent_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IAgentRegistry.AgentListed(0, seller1, METADATA_CID, PRICE, paymentToken);

        vm.prank(seller1);
        registry.listAgent(METADATA_CID, PRICE, paymentToken);
    }

    function test_listAgent_multipleSellers() public {
        vm.prank(seller1);
        uint256 agent1 = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(seller2);
        uint256 agent2 = registry.listAgent("QmTest987654321", PRICE * 2, paymentToken);

        assertEq(agent1, 0);
        assertEq(agent2, 1);
        assertEq(registry.agentCount(), 2);
    }

    function test_listAgent_revertInvalidMetadata() public {
        vm.prank(seller1);
        vm.expectRevert(AgentRegistry.InvalidMetadata.selector);
        registry.listAgent("", PRICE, paymentToken);
    }

    function test_listAgent_revertInvalidPrice() public {
        vm.prank(seller1);
        vm.expectRevert(AgentRegistry.InvalidPrice.selector);
        registry.listAgent(METADATA_CID, 0, paymentToken);
    }

    function test_listAgent_revertInvalidPaymentToken() public {
        vm.prank(seller1);
        vm.expectRevert(AgentRegistry.InvalidPaymentToken.selector);
        registry.listAgent(METADATA_CID, PRICE, address(0));
    }

    // ============ Update Agent Tests ============

    function test_updateAgent() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        string memory newCID = "QmUpdated123";
        uint256 newPrice = 20_000_000;

        vm.prank(seller1);
        registry.updateAgent(agentId, newCID, newPrice);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.metadataCID, newCID);
        assertEq(agent.price, newPrice);
    }

    function test_updateAgent_revertNotSeller() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(seller2);
        vm.expectRevert(AgentRegistry.NotAgentSeller.selector);
        registry.updateAgent(agentId, "QmNew", PRICE);
    }

    // ============ Delist Agent Tests ============

    function test_delistAgent_bySeller() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(seller1);
        registry.delistAgent(agentId);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(uint256(agent.status), uint256(IAgentRegistry.AgentStatus.Delisted));
    }

    function test_delistAgent_byAdmin() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(admin);
        registry.delistAgent(agentId);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(uint256(agent.status), uint256(IAgentRegistry.AgentStatus.Delisted));
    }

    function test_delistAgent_revertNotAuthorized() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(seller2);
        vm.expectRevert(AgentRegistry.NotAdminOrSeller.selector);
        registry.delistAgent(agentId);
    }

    // ============ Record Sale Tests ============

    function test_recordSale() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(escrow);
        registry.recordSale(agentId);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.totalSales, 1);

        vm.prank(escrow);
        registry.recordSale(agentId);

        agent = registry.getAgent(agentId);
        assertEq(agent.totalSales, 2);
    }

    function test_recordSale_revertNotEscrow() public {
        vm.prank(seller1);
        uint256 agentId = registry.listAgent(METADATA_CID, PRICE, paymentToken);

        vm.prank(seller1);
        vm.expectRevert(AgentRegistry.NotAuthorized.selector);
        registry.recordSale(agentId);
    }

    // ============ View Functions Tests ============

    function test_getAgentsBySeller() public {
        vm.startPrank(seller1);
        registry.listAgent(METADATA_CID, PRICE, paymentToken);
        registry.listAgent("QmSecond", PRICE, paymentToken);
        registry.listAgent("QmThird", PRICE, paymentToken);
        vm.stopPrank();

        uint256[] memory agents = registry.getAgentsBySeller(seller1);
        assertEq(agents.length, 3);
        assertEq(agents[0], 0);
        assertEq(agents[1], 1);
        assertEq(agents[2], 2);
    }

    function test_getAgent_revertNotFound() public {
        vm.expectRevert(AgentRegistry.AgentNotFound.selector);
        registry.getAgent(999);
    }

    function test_agentCount() public {
        assertEq(registry.agentCount(), 0);

        vm.prank(seller1);
        registry.listAgent(METADATA_CID, PRICE, paymentToken);

        assertEq(registry.agentCount(), 1);
    }

    // ============ Admin Functions Tests ============

    function test_transferAdmin() public {
        address newAdmin = makeAddr("newAdmin");

        vm.prank(admin);
        registry.transferAdmin(newAdmin);

        assertEq(registry.admin(), newAdmin);
    }

    function test_transferAdmin_revertNotAdmin() public {
        vm.prank(seller1);
        vm.expectRevert(AgentRegistry.NotAuthorized.selector);
        registry.transferAdmin(seller1);
    }
}
