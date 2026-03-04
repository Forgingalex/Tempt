// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";

/**
 * @title Deploy
 * @notice Deployment script for Tempt marketplace contracts
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url tempo_testnet --broadcast
 */
contract Deploy is Script {
    function run() external {
        // Load deployer private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying from:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AgentRegistry
        AgentRegistry registry = new AgentRegistry(deployer);
        console.log("AgentRegistry deployed at:", address(registry));

        // Deploy MarketplaceEscrow
        // Platform fee: 2.5% (250 basis points)
        MarketplaceEscrow escrow = new MarketplaceEscrow(
            deployer, // admin
            deployer, // feeRecipient (change in production)
            address(registry),
            250 // 2.5% fee
        );
        console.log("MarketplaceEscrow deployed at:", address(escrow));

        // Link registry to escrow
        registry.setEscrowContract(address(escrow));
        console.log("Registry linked to Escrow");

        vm.stopBroadcast();

        // Output deployment info
        console.log("\n=== Deployment Complete ===");
        console.log("Chain ID:", block.chainid);
        console.log("AgentRegistry:", address(registry));
        console.log("MarketplaceEscrow:", address(escrow));
        console.log("\nUpdate your .env with these addresses!");
    }
}
