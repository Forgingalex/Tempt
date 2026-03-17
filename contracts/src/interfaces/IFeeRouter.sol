// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFeeRouter
/// @notice Interface for distributing trade fees to creator, buyback, LP, and protocol
interface IFeeRouter {
    event FeesDistributed(
        uint256 indexed agentId,
        uint256 creatorAmount,
        uint256 buybackAmount,
        uint256 lpAmount,
        uint256 protocolAmount
    );
    event FeeSplitUpdated(uint16 creatorBps, uint16 buybackBps, uint16 lpBps, uint16 protocolBps);

    error InvalidFeeSplit();
    error NotGovernance();

    /// @notice Distribute fees for a trade (called by BondingCurveMarket)
    function distributeFees(uint256 agentId, uint256 totalFeeAmount) external;

    /// @notice Set total fee in basis points (governance only, via timelock)
    function setDefaultFeeBps(uint16 totalFeeBps) external;

    /// @notice Set fee split percentages (must sum to 10000 bps)
    function setFeeSplit(uint16 creatorBps, uint16 buybackBps, uint16 lpBps, uint16 protocolBps) external;

    /// @notice Get current fee configuration
    function getFeeConfig()
        external
        view
        returns (uint16 totalFeeBps, uint16 creatorBps, uint16 buybackBps, uint16 lpBps, uint16 protocolBps);
}
