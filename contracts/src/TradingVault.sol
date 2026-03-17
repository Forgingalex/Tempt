// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ITradingVault} from "./interfaces/ITradingVault.sol";

/**
 * @title TradingVault
 * @notice Holds user stablecoin balances for trading on BondingCurveMarket.
 *         Only whitelisted TIP-20 tokens can be deposited.
 *         debit() and credit() are restricted to BondingCurveMarket.
 *         Withdrawals are instant — no lockup.
 *
 * Tempo-specific: uses transferWithMemo for all token movements.
 */
interface ITIP20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external returns (bool);
    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external returns (bool);
}

contract TradingVault is ITradingVault, Ownable, ReentrancyGuard {
    // ============ State ============

    /// @notice BondingCurveMarket — only address that can debit
    address public bondingCurve;

    /// @notice FeeRouter — also allowed to call credit (for fee claims)
    address public feeRouter;

    /// @notice Whitelisted TIP-20 tokens
    mapping(address => bool) private _whitelisted;

    /// @notice user → token → balance (6 decimals for TIP-20)
    mapping(address => mapping(address => uint256)) private _balances;

    /// @notice Emergency pause for deposits/withdrawals (debit/credit always work)
    bool public depositsPaused;

    // ============ Constructor ============

    constructor(address admin) {
        _transferOwnership(admin);
    }

    // ============ Configuration ============

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = _bondingCurve;
    }

    function setFeeRouter(address _feeRouter) external onlyOwner {
        feeRouter = _feeRouter;
    }

    function setTokenWhitelist(address token, bool allowed) external onlyOwner {
        _whitelisted[token] = allowed;
        emit TokenWhitelisted(token, allowed);
    }

    function setPause(bool paused) external onlyOwner {
        depositsPaused = paused;
        emit Paused(paused);
    }

    // ============ Deposit / Withdraw ============

    /// @inheritdoc ITradingVault
    function deposit(address token, uint256 amount) external nonReentrant {
        if (depositsPaused) revert DepositsArePaused();
        if (!_whitelisted[token]) revert TokenNotWhitelisted();
        if (amount == 0) revert ZeroAmount();

        // Pull tokens using transferFromWithMemo for Tempo reconciliation
        bool ok = ITIP20(token).transferFromWithMemo(msg.sender, address(this), amount, bytes32("deposit"));
        require(ok, "TradingVault: transfer failed");

        _balances[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    /// @inheritdoc ITradingVault
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (depositsPaused) revert DepositsArePaused();
        if (amount == 0) revert ZeroAmount();
        if (_balances[msg.sender][token] < amount) revert InsufficientBalance();

        // Checks-effects-interactions
        _balances[msg.sender][token] -= amount;

        bool ok = ITIP20(token).transferWithMemo(msg.sender, amount, bytes32("withdraw"));
        require(ok, "TradingVault: transfer failed");

        emit Withdrawn(msg.sender, token, amount);
    }

    // ============ Debit / Credit (BondingCurveMarket only) ============

    /// @inheritdoc ITradingVault
    function debit(address user, address token, uint256 amount, uint256 agentId) external {
        if (msg.sender != bondingCurve) revert Unauthorized();
        if (amount == 0) revert ZeroAmount();
        if (_balances[user][token] < amount) revert InsufficientBalance();

        _balances[user][token] -= amount;

        emit Debited(user, token, amount, agentId);
    }

    /// @inheritdoc ITradingVault
    function credit(address user, address token, uint256 amount, uint256 agentId) external {
        if (msg.sender != bondingCurve && msg.sender != feeRouter) revert Unauthorized();
        if (amount == 0) revert ZeroAmount();

        _balances[user][token] += amount;

        emit Credited(user, token, amount, agentId);
    }

    // ============ View ============

    /// @inheritdoc ITradingVault
    function balanceOf(address user, address token) external view returns (uint256) {
        return _balances[user][token];
    }

    /// @inheritdoc ITradingVault
    function isWhitelisted(address token) external view returns (bool) {
        return _whitelisted[token];
    }
}
