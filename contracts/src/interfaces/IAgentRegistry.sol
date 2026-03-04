// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAgentRegistry
 * @notice Interface for the Agent Registry contract
 */
interface IAgentRegistry {
    // ============ Enums ============

    enum AgentStatus {
        Listed,
        Delisted,
        UnderReview
    }

    // ============ Structs ============

    struct Agent {
        uint256 id;
        address seller;
        string metadataCID; // IPFS CID pointing to off-chain metadata JSON
        uint256 price; // Price in TIP-20 token units (6 decimals)
        address paymentToken; // Which TIP-20 token to accept
        AgentStatus status;
        uint256 totalSales;
        uint256 createdAt;
    }

    // ============ Events ============

    event AgentListed(
        uint256 indexed agentId,
        address indexed seller,
        string metadataCID,
        uint256 price,
        address paymentToken
    );

    event AgentUpdated(uint256 indexed agentId, string metadataCID, uint256 price);

    event AgentDelisted(uint256 indexed agentId, address indexed by);

    event AgentSaleRecorded(uint256 indexed agentId, uint256 newTotalSales);

    // ============ Functions ============

    function listAgent(
        string calldata metadataCID,
        uint256 price,
        address paymentToken
    ) external returns (uint256 agentId);

    function updateAgent(uint256 agentId, string calldata metadataCID, uint256 price) external;

    function delistAgent(uint256 agentId) external;

    function getAgent(uint256 agentId) external view returns (Agent memory);

    function getAgentsBySeller(address seller) external view returns (uint256[] memory);

    function recordSale(uint256 agentId) external;

    function agentCount() external view returns (uint256);
}
