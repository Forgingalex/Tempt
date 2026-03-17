// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {StakingAndSlashing} from "../src/StakingAndSlashing.sol";
import {TradingVault} from "../src/TradingVault.sol";
import {TradeAgentRegistry} from "../src/TradeAgentRegistry.sol";
import {ShareTokenFactory} from "../src/ShareTokenFactory.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

/**
 * @title DeployTrade
 * @notice Full deployment script for the Tempt Trade system on Tempo Testnet (Moderato).
 *
 * Deploy order (respects dependencies):
 *   1. FeeRouter
 *   2. StakingAndSlashing
 *   3. TradingVault
 *   4. TradeAgentRegistry (ERC-721)
 *   5. ShareTokenFactory  (deploys ShareToken implementation inside constructor)
 *   6. BondingCurveMarket
 *
 * Post-deploy setup:
 *   - Wire all contracts together via setter calls
 *   - Whitelist 4 testnet stablecoins on TradingVault
 *
 * Run:
 *   cd contracts
 *   forge script script/DeployTrade.s.sol \
 *     --rpc-url https://rpc.moderato.tempo.xyz \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --gas-limit 30000000 \
 *     -vvvv
 */
contract DeployTrade is Script {
    // ─── Testnet stablecoin addresses (discovered from tempo_fundAddress) ───────
    address constant PATH_USD  = 0x20C0000000000000000000000000000000000000;
    address constant ALPHA_USD = 0x20C0000000000000000000000000000000000001;
    address constant BETA_USD  = 0x20C0000000000000000000000000000000000002;
    address constant THETA_USD = 0x20C0000000000000000000000000000000000003;

    // ─── Default payment token for the trade system ──────────────────────────────
    // Using AlphaUSD as primary trade token (matches marketplace default)
    address constant DEFAULT_PAY_TOKEN = ALPHA_USD;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("=== Tempt Trade System Deployment ===");
        console.log("Deployer:   ", deployer);
        console.log("Chain ID:   ", block.chainid);
        console.log("Block:      ", block.number);

        vm.startBroadcast(deployerKey);

        // ── 1. FeeRouter ─────────────────────────────────────────────────────────
        // treasury, buybackReserve, lpReserve all set to deployer for now
        FeeRouter feeRouter = new FeeRouter(
            deployer,  // admin / owner
            deployer,  // treasury (protocol fee recipient)
            deployer,  // buybackReserve  — update post-launch
            deployer   // lpReserve       — reserved for v2
        );
        console.log("FeeRouter deployed at:           ", address(feeRouter));

        // ── 2. StakingAndSlashing ────────────────────────────────────────────────
        // Bond token = AlphaUSD. Default bond = $200 (200_000_000 in 6-decimal units)
        StakingAndSlashing staking = new StakingAndSlashing(
            deployer,       // admin
            DEFAULT_PAY_TOKEN // bond token = AlphaUSD
        );
        console.log("StakingAndSlashing deployed at:  ", address(staking));

        // ── 3. TradingVault ──────────────────────────────────────────────────────
        TradingVault vault = new TradingVault(deployer);
        console.log("TradingVault deployed at:        ", address(vault));

        // ── 4. TradeAgentRegistry ────────────────────────────────────────────────
        TradeAgentRegistry tradeRegistry = new TradeAgentRegistry(deployer);
        console.log("TradeAgentRegistry deployed at:  ", address(tradeRegistry));

        // ── 5. ShareTokenFactory ─────────────────────────────────────────────────
        // Constructor deploys a ShareToken implementation contract internally
        ShareTokenFactory factory = new ShareTokenFactory(deployer);
        console.log("ShareTokenFactory deployed at:   ", address(factory));
        console.log("  ShareToken implementation:     ", factory.implementation());

        // ── 6. BondingCurveMarket ────────────────────────────────────────────────
        BondingCurveMarket market = new BondingCurveMarket(
            deployer,
            address(tradeRegistry),
            address(factory),
            address(vault),
            address(feeRouter),
            DEFAULT_PAY_TOKEN
        );
        console.log("BondingCurveMarket deployed at:  ", address(market));

        // ═══════════════════════════════════════════════════════════════════════════
        // POST-DEPLOY SETUP
        // ═══════════════════════════════════════════════════════════════════════════

        console.log("\n--- Wiring contracts ---");

        // Wire TradeAgentRegistry
        tradeRegistry.setStakingContract(address(staking));
        console.log("TradeAgentRegistry.stakingContract set");

        tradeRegistry.setShareTokenFactory(address(factory));
        console.log("TradeAgentRegistry.shareTokenFactory set");

        // Wire ShareTokenFactory
        factory.setBondingCurve(address(market));
        console.log("ShareTokenFactory.bondingCurve set");

        factory.setAgentRegistry(address(tradeRegistry));
        console.log("ShareTokenFactory.agentRegistry set");

        // Wire TradingVault
        vault.setBondingCurve(address(market));
        console.log("TradingVault.bondingCurve set");

        vault.setFeeRouter(address(feeRouter));
        console.log("TradingVault.feeRouter set");

        // Whitelist all 4 testnet stablecoins on TradingVault
        vault.setTokenWhitelist(PATH_USD,  true);
        console.log("TradingVault: PathUSD whitelisted");

        vault.setTokenWhitelist(ALPHA_USD, true);
        console.log("TradingVault: AlphaUSD whitelisted");

        vault.setTokenWhitelist(BETA_USD,  true);
        console.log("TradingVault: BetaUSD whitelisted");

        vault.setTokenWhitelist(THETA_USD, true);
        console.log("TradingVault: ThetaUSD whitelisted");

        // Wire FeeRouter
        feeRouter.setBondingCurve(address(market));
        console.log("FeeRouter.bondingCurve set");

        feeRouter.setAgentRegistry(address(tradeRegistry));
        console.log("FeeRouter.agentRegistry set");

        feeRouter.setVault(address(vault));
        console.log("FeeRouter.vault set");

        feeRouter.setPaymentToken(DEFAULT_PAY_TOKEN);
        console.log("FeeRouter.paymentToken set to AlphaUSD");

        vm.stopBroadcast();

        // ═══════════════════════════════════════════════════════════════════════════
        // DEPLOYMENT SUMMARY
        // ═══════════════════════════════════════════════════════════════════════════

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Chain: Tempo Testnet (Moderato), Chain ID 42431");
        console.log("");
        console.log("# Stablecoins");
        console.log("PathUSD:                         ", PATH_USD);
        console.log("AlphaUSD (default pay token):    ", ALPHA_USD);
        console.log("BetaUSD:                         ", BETA_USD);
        console.log("ThetaUSD:                        ", THETA_USD);
        console.log("");
        console.log("# Trade Contracts");
        console.log("FeeRouter:                       ", address(feeRouter));
        console.log("StakingAndSlashing:              ", address(staking));
        console.log("TradingVault:                    ", address(vault));
        console.log("TradeAgentRegistry:              ", address(tradeRegistry));
        console.log("ShareTokenFactory:               ", address(factory));
        console.log("  ShareToken implementation:     ", factory.implementation());
        console.log("BondingCurveMarket:              ", address(market));
        console.log("");
        console.log("Update .env with the addresses above!");
        console.log("Explorer: https://explore.tempo.xyz/address/<address>");
    }
}
