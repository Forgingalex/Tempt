// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IShareTokenFactory} from "./interfaces/IShareTokenFactory.sol";
import {ITradeAgentRegistry} from "./interfaces/ITradeAgentRegistry.sol";
import {ShareToken} from "./ShareToken.sol";

/**
 * @title ShareTokenFactory
 * @notice Deploys per-agent ERC-20 share tokens using EIP-1167 minimal proxies.
 *         Mint/burn on deployed tokens is restricted to BondingCurveMarket only.
 *         One share token per agent — cannot be redeployed.
 */
contract ShareTokenFactory is IShareTokenFactory, Ownable {
    using Clones for address;

    /// @notice Implementation contract cloned for each agent
    address public immutable implementation;

    /// @notice BondingCurveMarket — only this address can call createShareToken
    address public bondingCurve;

    /// @notice TradeAgentRegistry — used to register the token after deployment
    address public agentRegistry;

    /// @notice agentId → share token address
    mapping(uint256 => address) private _shareTokens;

    // ============ Constructor ============

    constructor(address admin) {
        _transferOwnership(admin);
        implementation = address(new ShareToken());
    }

    // ============ Configuration ============

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = _bondingCurve;
    }

    function setAgentRegistry(address _registry) external onlyOwner {
        agentRegistry = _registry;
    }

    // ============ Deploy ============

    /**
     * @notice Deploy a share token for an agent.
     * @dev Only callable by BondingCurveMarket. Uses EIP-1167 clone.
     */
    function createShareToken(
        uint256 agentId,
        string calldata tokenName,
        string calldata tokenSymbol
    ) external returns (address tokenAddress) {
        if (msg.sender != bondingCurve) revert NotBondingCurve();
        if (_shareTokens[agentId] != address(0)) revert TokenAlreadyExists();

        // Deploy minimal proxy
        tokenAddress = implementation.clone();

        // Initialize
        ShareToken(tokenAddress).initialize(tokenName, tokenSymbol, bondingCurve, agentId);

        _shareTokens[agentId] = tokenAddress;

        // Register token address back in TradeAgentRegistry
        ITradeAgentRegistry(agentRegistry).setShareToken(agentId, tokenAddress);

        emit ShareTokenCreated(agentId, tokenAddress);
    }

    /// @inheritdoc IShareTokenFactory
    function shareTokenOf(uint256 agentId) external view returns (address) {
        return _shareTokens[agentId];
    }
}
