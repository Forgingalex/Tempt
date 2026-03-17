// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITradeAgentRegistry
/// @notice Interface for the Trade Agent Registry (ERC-721 NFT identity for tradeable agents)
interface ITradeAgentRegistry {
    // ============ Events ============

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed creator,
        string metadataUri,
        bytes32 codeHash,
        uint256 supplyCap
    );
    event AgentStatusChanged(uint256 indexed agentId, uint8 status);
    event ShareTokenSet(uint256 indexed agentId, address shareToken);

    // ============ Errors ============

    error SupplyCapOutOfRange();
    error CreatorFeeTooHigh();
    error BondNotPosted();
    error AgentNotFound();
    error NotCreatorOrAdmin();
    error InvalidMetadata();
    error ShareTokenAlreadySet();

    // ============ Functions ============

    /// @notice Register a new tradeable agent (caller must have posted bond via StakingAndSlashing)
    /// @param metadataUri IPFS URI for agent metadata JSON
    /// @param codeHash Hash of the agent's system prompt / code for verifiability
    /// @param creatorFeeBps Creator's share of trade fees in basis points (max 500 = 5%)
    /// @param bondAmount Amount of stablecoin posted as bond (must match StakingAndSlashing requirement)
    /// @param supplyCap Immutable share token supply cap (100_000_000e18 – 1_000_000_000e18)
    /// @return agentId The newly minted NFT token ID
    function registerAgent(
        string calldata metadataUri,
        bytes32 codeHash,
        uint32 creatorFeeBps,
        uint256 bondAmount,
        uint256 supplyCap
    ) external returns (uint256 agentId);

    /// @notice Get agent metadata and config
    function getAgent(uint256 agentId)
        external
        view
        returns (
            address creator,
            string memory metadataUri,
            bytes32 codeHash,
            uint32 creatorFeeBps,
            uint256 supplyCap,
            uint8 status
        );

    /// @notice Set the deployed share token address (called by ShareTokenFactory once)
    function setShareToken(uint256 agentId, address shareToken) external;

    /// @notice Get share token address for an agent
    function shareTokenOf(uint256 agentId) external view returns (address);

    /// @notice Update agent status (creator can pause, admin can delist/slash)
    function setAgentStatus(uint256 agentId, uint8 status) external;
}
