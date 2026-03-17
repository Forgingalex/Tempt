// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {ITradeAgentRegistry} from "./interfaces/ITradeAgentRegistry.sol";
import {ITradingVault} from "./interfaces/ITradingVault.sol";

/**
 * @title FeeRouter
 * @notice Tracks and distributes trade fees using a pull-payment (claims) pattern.
 *
 * Physical tokens stay in TradingVault. FeeRouter tracks accumulated fee credits
 * for each recipient (creator, buyback reserve, lp reserve, protocol treasury).
 * Recipients claim their owed amounts by calling claimFees(), which calls vault.credit().
 *
 * Defaults (governance-adjustable):
 *   Total fee: 30 bps (0.30%)
 *   Creator:   12 bps
 *   Buyback:   13 bps
 *   LP:         0 bps (reserved for v2)
 *   Protocol:   5 bps
 */
contract FeeRouter is IFeeRouter, Ownable, ReentrancyGuard {
    // ============ State ============

    /// @notice BondingCurveMarket — only caller allowed to call distributeFees
    address public bondingCurve;

    /// @notice Contracts
    address public agentRegistry;
    address public vault;
    address public paymentToken;

    /// @notice Protocol treasury address
    address public treasury;

    /// @notice Buyback reserve address
    address public buybackReserve;

    /// @notice LP reserve address
    address public lpReserve;

    // Fee config
    uint16 public totalFeeBps = 30;
    uint16 public creatorBps  = 12;
    uint16 public buybackBps  = 13;
    uint16 public lpBps       = 0;
    uint16 public protocolBps = 5;

    /// @notice Accumulated unclaimed fees per address per token
    mapping(address => uint256) public accruedFees;

    event FeesClaimed(address indexed recipient, uint256 amount);

    // ============ Constructor ============

    constructor(
        address admin,
        address _treasury,
        address _buybackReserve,
        address _lpReserve
    ) {
        _transferOwnership(admin);
        treasury       = _treasury;
        buybackReserve = _buybackReserve;
        lpReserve      = _lpReserve;
    }

    // ============ Configuration ============

    function setBondingCurve(address _bc) external onlyOwner {
        bondingCurve = _bc;
    }

    function setAgentRegistry(address _registry) external onlyOwner {
        agentRegistry = _registry;
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setPaymentToken(address _token) external onlyOwner {
        paymentToken = _token;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    // ============ Fee Distribution (pull pattern) ============

    /**
     * @notice Record fee distribution. Tokens stay in vault; we track owed amounts.
     *         Called by BondingCurveMarket after each trade.
     */
    function distributeFees(uint256 agentId, uint256 totalFeeAmount) external {
        if (msg.sender != bondingCurve) revert NotGovernance();
        if (totalFeeAmount == 0) return;

        // Fetch creator address
        (address creator,,,,,) = ITradeAgentRegistry(agentRegistry).getAgent(agentId);

        uint256 creatorAmount  = (totalFeeAmount * creatorBps)  / totalFeeBps;
        uint256 buybackAmount  = (totalFeeAmount * buybackBps)  / totalFeeBps;
        uint256 lpAmount       = (totalFeeAmount * lpBps)       / totalFeeBps;
        uint256 protocolAmount = totalFeeAmount - creatorAmount - buybackAmount - lpAmount;

        // Accumulate credits (tokens stay in vault)
        if (creatorAmount > 0 && creator != address(0)) {
            accruedFees[creator] += creatorAmount;
        }
        if (buybackAmount > 0 && buybackReserve != address(0)) {
            accruedFees[buybackReserve] += buybackAmount;
        }
        if (lpAmount > 0 && lpReserve != address(0)) {
            accruedFees[lpReserve] += lpAmount;
        }
        if (protocolAmount > 0 && treasury != address(0)) {
            accruedFees[treasury] += protocolAmount;
        }

        emit FeesDistributed(agentId, creatorAmount, buybackAmount, lpAmount, protocolAmount);
    }

    /**
     * @notice Claim accumulated fees — vault credits caller's trading balance.
     *         Caller can then withdraw from vault normally.
     */
    function claimFees() external nonReentrant {
        uint256 owed = accruedFees[msg.sender];
        if (owed == 0) return;

        accruedFees[msg.sender] = 0;

        // Credit the claimant's vault balance so they can withdraw
        ITradingVault(vault).credit(msg.sender, paymentToken, owed, 0);

        emit FeesClaimed(msg.sender, owed);
    }

    // ============ Governance ============

    /// @inheritdoc IFeeRouter
    function setDefaultFeeBps(uint16 _totalFeeBps) external onlyOwner {
        totalFeeBps = _totalFeeBps;
    }

    /// @inheritdoc IFeeRouter
    function setFeeSplit(
        uint16 _creatorBps,
        uint16 _buybackBps,
        uint16 _lpBps,
        uint16 _protocolBps
    ) external onlyOwner {
        if (_creatorBps + _buybackBps + _lpBps + _protocolBps != totalFeeBps) revert InvalidFeeSplit();
        creatorBps  = _creatorBps;
        buybackBps  = _buybackBps;
        lpBps       = _lpBps;
        protocolBps = _protocolBps;
        emit FeeSplitUpdated(_creatorBps, _buybackBps, _lpBps, _protocolBps);
    }

    /// @inheritdoc IFeeRouter
    function getFeeConfig()
        external
        view
        returns (uint16, uint16, uint16, uint16, uint16)
    {
        return (totalFeeBps, creatorBps, buybackBps, lpBps, protocolBps);
    }
}
