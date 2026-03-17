// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

// Marketplace contracts
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";

// Trade contracts
import {FeeRouter} from "../src/FeeRouter.sol";
import {StakingAndSlashing} from "../src/StakingAndSlashing.sol";
import {TradingVault} from "../src/TradingVault.sol";
import {TradeAgentRegistry} from "../src/TradeAgentRegistry.sol";
import {ShareTokenFactory} from "../src/ShareTokenFactory.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

/**
 * @title DeployAll
 * @notice Full deployment of all Tempt contracts on Tempo Testnet (Moderato, Chain ID 42431).
 *
 * Compiled with evm_version = "paris" (no PUSH0/MCOPY) for Tempo EVM compatibility.
 *
 * Deploy order:
 *   1. AgentRegistry
 *   2. MarketplaceEscrow
 *   3. FeeRouter
 *   4. StakingAndSlashing
 *   5. TradingVault
 *   6. TradeAgentRegistry (ERC-721)
 *   7. ShareTokenFactory  (deploys ShareToken impl internally)
 *   8. BondingCurveMarket
 *
 * Run:
 *   cd contracts
 *   forge script script/DeployAll.s.sol \
 *     --rpc-url https://rpc.moderato.tempo.xyz \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --gas-limit 30000000 \
 *     -vvvv
 */
contract DeployAll is Script {
    // ── Testnet stablecoin addresses ─────────────────────────────────────────────
    address constant PATH_USD  = 0x20C0000000000000000000000000000000000000;
    address constant ALPHA_USD = 0x20C0000000000000000000000000000000000001;
    address constant BETA_USD  = 0x20C0000000000000000000000000000000000002;
    address constant THETA_USD = 0x20C0000000000000000000000000000000000003;

    /// @notice Default payment token (AlphaUSD)
    address constant DEFAULT_PAY_TOKEN = ALPHA_USD;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("=== Tempt Full Deployment ===");
        console.log("Deployer:   ", deployer);
        console.log("Chain ID:   ", block.chainid);
        console.log("Nonce:      ", vm.getNonce(deployer));

        vm.startBroadcast(deployerKey);

        // ══════════════════════════════════════════════════════════════════════
        // MARKETPLACE CONTRACTS
        // ══════════════════════════════════════════════════════════════════════

        // 1. AgentRegistry
        AgentRegistry registry = new AgentRegistry(deployer);
        console.log("AgentRegistry deployed at:       ", address(registry));

        // 2. MarketplaceEscrow (depends on AgentRegistry)
        MarketplaceEscrow escrow = new MarketplaceEscrow(
            deployer,       // admin
            deployer,       // feeRecipient (change in production)
            address(registry),
            250             // 2.5% fee in basis points
        );
        console.log("MarketplaceEscrow deployed at:   ", address(escrow));

        // Link registry to escrow
        registry.setEscrowContract(address(escrow));
        console.log("AgentRegistry linked to escrow");

        // ══════════════════════════════════════════════════════════════════════
        // TRADE CONTRACTS
        // ══════════════════════════════════════════════════════════════════════

        // 3. FeeRouter
        FeeRouter feeRouter = new FeeRouter(
            deployer,  // admin
            deployer,  // treasury
            deployer,  // buybackReserve
            deployer   // lpReserve
        );
        console.log("FeeRouter deployed at:           ", address(feeRouter));

        // 4. StakingAndSlashing
        StakingAndSlashing staking = new StakingAndSlashing(
            deployer,
            DEFAULT_PAY_TOKEN
        );
        console.log("StakingAndSlashing deployed at:  ", address(staking));

        // 5. TradingVault
        TradingVault vault = new TradingVault(deployer);
        console.log("TradingVault deployed at:        ", address(vault));

        // 6. TradeAgentRegistry (ERC-721)
        TradeAgentRegistry tradeRegistry = new TradeAgentRegistry(deployer);
        console.log("TradeAgentRegistry deployed at:  ", address(tradeRegistry));

        // 7. ShareTokenFactory
        ShareTokenFactory factory = new ShareTokenFactory(deployer);
        console.log("ShareTokenFactory deployed at:   ", address(factory));
        console.log("  ShareToken implementation:     ", factory.implementation());

        // 8. BondingCurveMarket
        BondingCurveMarket market = new BondingCurveMarket(
            deployer,
            address(tradeRegistry),
            address(factory),
            address(vault),
            address(feeRouter),
            DEFAULT_PAY_TOKEN
        );
        console.log("BondingCurveMarket deployed at:  ", address(market));

        // ══════════════════════════════════════════════════════════════════════
        // POST-DEPLOY WIRING
        // ══════════════════════════════════════════════════════════════════════

        console.log("\n--- Wiring contracts ---");

        tradeRegistry.setStakingContract(address(staking));
        tradeRegistry.setShareTokenFactory(address(factory));

        factory.setBondingCurve(address(market));
        factory.setAgentRegistry(address(tradeRegistry));

        vault.setBondingCurve(address(market));
        vault.setFeeRouter(address(feeRouter));
        vault.setTokenWhitelist(PATH_USD,  true);
        vault.setTokenWhitelist(ALPHA_USD, true);
        vault.setTokenWhitelist(BETA_USD,  true);
        vault.setTokenWhitelist(THETA_USD, true);
        console.log("TradingVault: 4 stablecoins whitelisted");

        feeRouter.setBondingCurve(address(market));
        feeRouter.setAgentRegistry(address(tradeRegistry));
        feeRouter.setVault(address(vault));
        feeRouter.setPaymentToken(DEFAULT_PAY_TOKEN);

        vm.stopBroadcast();

        // ══════════════════════════════════════════════════════════════════════
        // SUMMARY
        // ══════════════════════════════════════════════════════════════════════

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Chain: Tempo Testnet (Moderato), Chain ID 42431");
        console.log("");
        console.log("# Stablecoins (predeployed by Tempo)");
        console.log("PathUSD:                         ", PATH_USD);
        console.log("AlphaUSD (default):              ", ALPHA_USD);
        console.log("BetaUSD:                         ", BETA_USD);
        console.log("ThetaUSD:                        ", THETA_USD);
        console.log("");
        console.log("# Marketplace Contracts");
        console.log("AgentRegistry:                   ", address(registry));
        console.log("MarketplaceEscrow:               ", address(escrow));
        console.log("");
        console.log("# Trade Contracts");
        console.log("FeeRouter:                       ", address(feeRouter));
        console.log("StakingAndSlashing:              ", address(staking));
        console.log("TradingVault:                    ", address(vault));
        console.log("TradeAgentRegistry:              ", address(tradeRegistry));
        console.log("ShareTokenFactory:               ", address(factory));
        console.log("BondingCurveMarket:              ", address(market));
        console.log("");
        console.log("Explorer: https://explore.tempo.xyz");
    }
}
