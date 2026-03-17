// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBondingCurveMarket
/// @notice Interface for the Bancor-style bonding curve AMM
interface IBondingCurveMarket {
    event Bought(
        uint256 indexed agentId,
        address indexed buyer,
        uint256 stableIn,
        uint256 sharesMinted,
        uint256 fee
    );
    event Sold(
        uint256 indexed agentId,
        address indexed seller,
        uint256 sharesBurned,
        uint256 stableOut,
        uint256 fee
    );

    error AgentNotActive();
    error SupplyCapExceeded();
    error InsufficientShares();
    error ZeroAmount();
    error SlippageExceeded();

    /// @notice Buy shares with stablecoins (pulled from caller's TradingVault balance)
    /// @param agentId The agent's NFT ID
    /// @param stableAmount Amount of stablecoin to spend (6 decimals)
    /// @param receiver Address to receive minted shares
    /// @return minted Number of share tokens minted (18 decimals)
    function buy(
        uint256 agentId,
        uint256 stableAmount,
        address receiver
    ) external returns (uint256 minted);

    /// @notice Sell shares for stablecoins (credited to caller's TradingVault balance)
    /// @param agentId The agent's NFT ID
    /// @param shareAmount Amount of shares to sell (18 decimals)
    /// @param receiver Address to receive stablecoin credit
    /// @return returned Amount of stablecoin returned (6 decimals)
    function sell(
        uint256 agentId,
        uint256 shareAmount,
        address receiver
    ) external returns (uint256 returned);

    /// @notice Get current marginal price per share in stablecoin units (6 decimals per 1e18 shares)
    function currentPrice(uint256 agentId) external view returns (uint256 pricePerShare);

    /// @notice Get current circulating supply of share tokens
    function currentSupply(uint256 agentId) external view returns (uint256 supply);

    /// @notice Get stablecoin reserve backing the curve
    function reserveBalance(uint256 agentId) external view returns (uint256 reserve);

    /// @notice Preview shares received for a given stable amount (no state change)
    function previewBuy(uint256 agentId, uint256 stableAmount) external view returns (uint256 shares, uint256 fee);

    /// @notice Preview stablecoin received for selling a given share amount (no state change)
    function previewSell(uint256 agentId, uint256 shareAmount) external view returns (uint256 stable, uint256 fee);
}
