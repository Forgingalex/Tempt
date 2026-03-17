// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITradingVault
/// @notice Interface for the stablecoin vault that holds user trading balances
interface ITradingVault {
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Debited(address indexed user, address indexed token, uint256 amount, uint256 agentId);
    event Credited(address indexed user, address indexed token, uint256 amount, uint256 agentId);
    event TokenWhitelisted(address indexed token, bool whitelisted);
    event Paused(bool depositsPaused);

    error TokenNotWhitelisted();
    error InsufficientBalance();
    error Unauthorized();
    error DepositsArePaused();
    error ZeroAmount();

    /// @notice Deposit whitelisted TIP-20 stablecoin into vault
    function deposit(address token, uint256 amount) external;

    /// @notice Withdraw stablecoin from vault (instant, no lockup)
    function withdraw(address token, uint256 amount) external;

    /// @notice Get user's vault balance for a token
    function balanceOf(address user, address token) external view returns (uint256);

    /// @notice Debit user's vault balance for a trade purchase (BondingCurveMarket only)
    function debit(address user, address token, uint256 amount, uint256 agentId) external;

    /// @notice Credit user's vault balance from a trade sale (BondingCurveMarket only)
    function credit(address user, address token, uint256 amount, uint256 agentId) external;

    /// @notice Check if a token is whitelisted for deposit
    function isWhitelisted(address token) external view returns (bool);
}
