// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IShareTokenFactory
/// @notice Interface for deploying per-agent ERC-20 share tokens
interface IShareTokenFactory {
    event ShareTokenCreated(uint256 indexed agentId, address tokenAddress);

    error TokenAlreadyExists();
    error NotBondingCurve();

    /// @notice Deploy a share token for an agent (called by BondingCurveMarket on first trade)
    function createShareToken(
        uint256 agentId,
        string calldata name,
        string calldata symbol
    ) external returns (address tokenAddress);

    /// @notice Get share token address for an agent (returns zero if not yet deployed)
    function shareTokenOf(uint256 agentId) external view returns (address);
}
