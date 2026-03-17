// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBondingCurveMarket} from "./interfaces/IBondingCurveMarket.sol";
import {ITradeAgentRegistry} from "./interfaces/ITradeAgentRegistry.sol";
import {IShareTokenFactory} from "./interfaces/IShareTokenFactory.sol";
import {ITradingVault} from "./interfaces/ITradingVault.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {ShareToken} from "./ShareToken.sol";

/**
 * @title BondingCurveMarket
 * @notice Bancor-style continuous token bonding curve for agent share tokens.
 *
 * Formula (Bancor):
 *   price = reserveBalance / (supply * CRR)
 *   where CRR = connector weight ratio (fixed at 50% = 500_000 / 1_000_000)
 *
 * Simplified buy: minted = supply * ((1 + stableIn / reserve)^CRR - 1)
 * Simplified sell: returned = reserve * (1 - (1 - shareIn / supply)^(1/CRR))
 *
 * For CRR = 0.5 (square-root bonding curve):
 *   price = reserve / supply  (price doubles with each supply doubling)
 *   buy:  minted = supply * (sqrt(1 + stableIn/reserve) - 1)
 *   sell: returned = reserve * (1 - ((supply - shareIn)/supply)^2)
 *
 * All reserve amounts in TIP-20 (6 decimals).
 * All share amounts in ERC-20 (18 decimals).
 *
 * @dev Uses integer square root for the curve calculations.
 *      Decimal conversions: stableIn (6 dec) is scaled to 18 dec for math, then back.
 */
contract BondingCurveMarket is IBondingCurveMarket, Ownable, ReentrancyGuard {
    // ============ Constants ============

    /// @notice Fee in basis points (30 bps = 0.30%)
    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Initial virtual reserve to seed the curve (avoids division by zero)
    /// 10 USDC (6 decimals)
    uint256 public constant INITIAL_RESERVE = 10_000_000;

    /// @notice Initial virtual supply to match the initial reserve price
    /// 1000 shares (18 decimals) — initial price = 10 USDC / 1000 = 0.01 USDC/share
    uint256 public constant INITIAL_SUPPLY = 1_000e18;

    /// @notice Decimal scale factor: 1e12 converts 6-decimal to 18-decimal
    uint256 public constant DECIMAL_SCALE = 1e12;

    // ============ State ============

    struct CurveState {
        uint256 reserve;      // TIP-20 stablecoin reserve (6 decimals)
        uint256 supply;       // Circulating share supply (18 decimals)
        address shareToken;   // ERC-20 share token
        address payToken;     // TIP-20 stablecoin used for this agent
        bool initialized;
    }

    /// @notice agentId → curve state
    mapping(uint256 => CurveState) private _curves;

    // ── Contracts ──────────────────────────────────────────────────────────────
    ITradeAgentRegistry public registry;
    IShareTokenFactory  public factory;
    ITradingVault       public vault;
    IFeeRouter          public feeRouter;

    /// @notice Default payment token (TIP-20 stablecoin, 6 decimals)
    address public defaultPayToken;

    // ============ Constructor ============

    constructor(
        address admin,
        address _registry,
        address _factory,
        address _vault,
        address _feeRouter,
        address _defaultPayToken
    ) {
        _transferOwnership(admin);
        registry  = ITradeAgentRegistry(_registry);
        factory   = IShareTokenFactory(_factory);
        vault     = ITradingVault(_vault);
        feeRouter = IFeeRouter(_feeRouter);
        defaultPayToken = _defaultPayToken;
    }

    // ============ Trade Functions ============

    /// @inheritdoc IBondingCurveMarket
    function buy(
        uint256 agentId,
        uint256 stableAmount,
        address receiver
    ) external nonReentrant returns (uint256 minted) {
        if (stableAmount == 0) revert ZeroAmount();

        CurveState storage curve = _getOrInitCurve(agentId);

        // Deduct fee
        uint256 fee = (stableAmount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 netStable = stableAmount - fee;

        // Calculate shares to mint using square-root bonding curve
        minted = _calcBuyShares(curve.reserve, curve.supply, netStable);
        if (minted == 0) revert ZeroAmount();

        // Enforce supply cap
        (,,,, uint256 supplyCap,) = registry.getAgent(agentId);
        if (curve.supply + minted > supplyCap) revert SupplyCapExceeded();

        // Debit buyer's vault balance
        vault.debit(msg.sender, curve.payToken, stableAmount, agentId);

        // Update curve state
        curve.reserve += netStable;
        curve.supply  += minted;

        // Mint share tokens to receiver
        ShareToken(curve.shareToken).mint(receiver, minted);

        // Route fees (vault holds the fee amount; transfer to FeeRouter)
        // Fees stay in vault as credit to FeeRouter address for simplicity in v1
        // In production, vault would transfer fee tokens to FeeRouter directly
        _routeFees(agentId, fee, curve.payToken);

        emit Bought(agentId, msg.sender, stableAmount, minted, fee);
    }

    /// @inheritdoc IBondingCurveMarket
    function sell(
        uint256 agentId,
        uint256 shareAmount,
        address receiver
    ) external nonReentrant returns (uint256 returned) {
        if (shareAmount == 0) revert ZeroAmount();

        CurveState storage curve = _curves[agentId];
        if (!curve.initialized) revert AgentNotActive();
        if (shareAmount > curve.supply) revert InsufficientShares();
        if (ShareToken(curve.shareToken).balanceOf(msg.sender) < shareAmount) revert InsufficientShares();

        // Calculate stable returned using square-root curve
        uint256 grossReturned = _calcSellStable(curve.reserve, curve.supply, shareAmount);

        // Deduct fee
        uint256 fee = (grossReturned * FEE_BPS) / BPS_DENOMINATOR;
        returned = grossReturned - fee;

        // Burn seller's share tokens
        ShareToken(curve.shareToken).burn(msg.sender, shareAmount);

        // Update curve state
        curve.reserve -= grossReturned;
        curve.supply  -= shareAmount;

        // Credit seller's vault balance
        vault.credit(receiver, curve.payToken, returned, agentId);

        // Route fees
        _routeFees(agentId, fee, curve.payToken);

        emit Sold(agentId, msg.sender, shareAmount, returned, fee);
    }

    // ============ Preview Functions ============

    /// @inheritdoc IBondingCurveMarket
    function previewBuy(
        uint256 agentId,
        uint256 stableAmount
    ) external view returns (uint256 shares, uint256 fee) {
        if (stableAmount == 0) return (0, 0);
        CurveState storage curve = _curves[agentId];
        uint256 r = curve.initialized ? curve.reserve : INITIAL_RESERVE;
        uint256 s = curve.initialized ? curve.supply  : INITIAL_SUPPLY;

        fee = (stableAmount * FEE_BPS) / BPS_DENOMINATOR;
        shares = _calcBuyShares(r, s, stableAmount - fee);
    }

    /// @inheritdoc IBondingCurveMarket
    function previewSell(
        uint256 agentId,
        uint256 shareAmount
    ) external view returns (uint256 stable, uint256 fee) {
        if (shareAmount == 0) return (0, 0);
        CurveState storage curve = _curves[agentId];
        if (!curve.initialized) return (0, 0);

        uint256 gross = _calcSellStable(curve.reserve, curve.supply, shareAmount);
        fee = (gross * FEE_BPS) / BPS_DENOMINATOR;
        stable = gross - fee;
    }

    // ============ View Functions ============

    /// @inheritdoc IBondingCurveMarket
    function currentPrice(uint256 agentId) external view returns (uint256) {
        CurveState storage curve = _curves[agentId];
        if (!curve.initialized || curve.supply == 0) return 0;
        // Price = reserve(6dec) * 1e18 / supply(18dec) → result in 6 decimals per share
        return (curve.reserve * 1e18) / curve.supply;
    }

    /// @inheritdoc IBondingCurveMarket
    function currentSupply(uint256 agentId) external view returns (uint256) {
        return _curves[agentId].supply;
    }

    /// @inheritdoc IBondingCurveMarket
    function reserveBalance(uint256 agentId) external view returns (uint256) {
        return _curves[agentId].reserve;
    }

    // ============ Internal — Curve Math ============

    /**
     * @notice Calculate shares minted for a given net stable input.
     * @dev Square-root bonding curve (CRR = 0.5):
     *      minted = supply * (sqrt(1 + netStable/reserve) - 1)
     *      Rearranged to avoid division:
     *      minted = supply * (sqrt(reserve + netStable * SCALE) - sqrt(reserve * SCALE)) / sqrt(reserve * SCALE)
     *
     *      reserve is in 6 decimals, supply in 18 decimals.
     *      We scale reserve to 18 decimals for the sqrt to preserve precision.
     */
    function _calcBuyShares(
        uint256 reserve,
        uint256 supply,
        uint256 netStable // 6 decimals
    ) internal pure returns (uint256 shares) {
        // Scale reserve to 18 decimals for sqrt precision
        uint256 r18 = reserve * DECIMAL_SCALE;         // 18 dec
        uint256 n18 = netStable * DECIMAL_SCALE;       // 18 dec

        uint256 sqrtBefore = _sqrt(r18);               // sqrt of 18-dec value
        uint256 sqrtAfter  = _sqrt(r18 + n18);

        // shares = supply * (sqrtAfter - sqrtBefore) / sqrtBefore
        if (sqrtBefore == 0) return 0;
        shares = (supply * (sqrtAfter - sqrtBefore)) / sqrtBefore;
    }

    /**
     * @notice Calculate stable returned for selling shares.
     * @dev Inverse of buy formula:
     *      returned = reserve * (1 - ((supply - shares) / supply)^2)
     *      returned = reserve * (supply^2 - (supply - shares)^2) / supply^2
     *               = reserve * shares * (2*supply - shares) / supply^2
     */
    function _calcSellStable(
        uint256 reserve,  // 6 decimals
        uint256 supply,   // 18 decimals
        uint256 shares    // 18 decimals
    ) internal pure returns (uint256 returned) {
        if (supply == 0) return 0;
        // returned = reserve * shares * (2*supply - shares) / supply^2
        // To avoid overflow, compute in steps
        // (2*supply - shares) is in 18 dec, shares is in 18 dec → product is 36 dec
        // divide by supply^2 (36 dec) → result is 0 dec, multiply by reserve (6 dec) → 6 dec
        uint256 numerator = shares * (2 * supply - shares); // 36 dec
        uint256 denominator = supply * supply;              // 36 dec
        returned = (reserve * numerator) / denominator;    // 6 dec
    }

    // ============ Internal — Helpers ============

    /**
     * @notice Initialize curve state for an agent on first trade.
     *         Also deploys the share token via factory.
     */
    function _getOrInitCurve(uint256 agentId) internal returns (CurveState storage curve) {
        curve = _curves[agentId];
        if (curve.initialized) {
            // Verify agent is still active
            (,,,,,uint8 activeStatus) = registry.getAgent(agentId);
            if (activeStatus != 0) revert AgentNotActive();
            return curve;
        }

        // First trade — initialize
        (address creator, string memory metaUri,,,,uint8 initStatus) = registry.getAgent(agentId);
        if (initStatus != 0) revert AgentNotActive();

        // Deploy share token
        // Parse name/symbol from metaUri is complex — use agentId-based defaults
        // In practice, the frontend passes name/symbol at registration time stored off-chain
        string memory tokenName   = string(abi.encodePacked("Agent #", _uintToStr(agentId)));
        string memory tokenSymbol = string(abi.encodePacked("AGT", _uintToStr(agentId)));

        address shareToken = factory.createShareToken(agentId, tokenName, tokenSymbol);

        curve.shareToken  = shareToken;
        curve.payToken    = defaultPayToken;
        curve.reserve     = INITIAL_RESERVE;
        curve.supply      = INITIAL_SUPPLY;
        curve.initialized = true;

        // Suppress unused variable warning
        creator;
        metaUri;
    }

    function _routeFees(uint256 agentId, uint256 fee, address /*payToken*/) internal {
        // In v1, fees are accumulated in vault as a credit to the FeeRouter.
        // We call distributeFees to handle the accounting.
        if (fee > 0) {
            feeRouter.distributeFees(agentId, fee);
        }
    }

    /// @notice Integer square root using Babylonian method
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _uintToStr(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 digits;
        uint256 temp = v;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + (v % 10))); v /= 10; }
        return string(buf);
    }
}
