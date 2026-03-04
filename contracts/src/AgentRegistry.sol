// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";

/**
 * @title AgentRegistry
 * @notice Stores on-chain metadata for each listed AI agent
 * @dev Deployed on Tempo Testnet (Moderato)
 *
 * Key features:
 * - Sellers can list, update, and delist their agents
 * - Admin can delist agents for moderation
 * - Tracks total sales per agent
 * - Metadata stored off-chain via IPFS CID
 */
contract AgentRegistry is IAgentRegistry {
    // ============ State Variables ============

    /// @notice Counter for agent IDs
    uint256 private _agentIdCounter;

    /// @notice Platform admin address
    address public admin;

    /// @notice Escrow contract address (allowed to record sales)
    address public escrowContract;

    /// @notice Mapping from agent ID to Agent struct
    mapping(uint256 => Agent) private _agents;

    /// @notice Mapping from seller address to their agent IDs
    mapping(address => uint256[]) private _sellerAgents;

    // ============ Errors ============

    error NotAgentSeller();
    error NotAdminOrSeller();
    error NotAuthorized();
    error AgentNotFound();
    error AgentNotListed();
    error InvalidPrice();
    error InvalidMetadata();
    error InvalidPaymentToken();

    // ============ Modifiers ============

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAuthorized();
        _;
    }

    modifier onlyAgentSeller(uint256 agentId) {
        if (_agents[agentId].seller != msg.sender) revert NotAgentSeller();
        _;
    }

    modifier onlyAdminOrSeller(uint256 agentId) {
        if (msg.sender != admin && _agents[agentId].seller != msg.sender) {
            revert NotAdminOrSeller();
        }
        _;
    }

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert NotAuthorized();
        _;
    }

    // ============ Constructor ============

    constructor(address _admin) {
        admin = _admin;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the escrow contract address
     * @param _escrowContract Address of the MarketplaceEscrow contract
     */
    function setEscrowContract(address _escrowContract) external onlyAdmin {
        escrowContract = _escrowContract;
    }

    /**
     * @notice Transfer admin role
     * @param newAdmin New admin address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    // ============ Seller Functions ============

    /**
     * @notice List a new agent
     * @param metadataCID IPFS CID pointing to agent metadata JSON
     * @param price Price in TIP-20 token units (6 decimals)
     * @param paymentToken Address of the TIP-20 token for payment
     * @return agentId The ID of the newly listed agent
     */
    function listAgent(
        string calldata metadataCID,
        uint256 price,
        address paymentToken
    ) external returns (uint256 agentId) {
        if (bytes(metadataCID).length == 0) revert InvalidMetadata();
        if (price == 0) revert InvalidPrice();
        if (paymentToken == address(0)) revert InvalidPaymentToken();

        agentId = _agentIdCounter++;

        _agents[agentId] = Agent({
            id: agentId,
            seller: msg.sender,
            metadataCID: metadataCID,
            price: price,
            paymentToken: paymentToken,
            status: AgentStatus.Listed,
            totalSales: 0,
            createdAt: block.timestamp
        });

        _sellerAgents[msg.sender].push(agentId);

        emit AgentListed(agentId, msg.sender, metadataCID, price, paymentToken);
    }

    /**
     * @notice Update an existing agent
     * @param agentId ID of the agent to update
     * @param metadataCID New IPFS CID for metadata
     * @param price New price
     */
    function updateAgent(
        uint256 agentId,
        string calldata metadataCID,
        uint256 price
    ) external onlyAgentSeller(agentId) {
        if (bytes(metadataCID).length == 0) revert InvalidMetadata();
        if (price == 0) revert InvalidPrice();

        Agent storage agent = _agents[agentId];
        if (agent.status == AgentStatus.Delisted) revert AgentNotListed();

        agent.metadataCID = metadataCID;
        agent.price = price;

        emit AgentUpdated(agentId, metadataCID, price);
    }

    /**
     * @notice Delist an agent (seller or admin)
     * @param agentId ID of the agent to delist
     */
    function delistAgent(uint256 agentId) external onlyAdminOrSeller(agentId) {
        Agent storage agent = _agents[agentId];
        if (agent.seller == address(0)) revert AgentNotFound();

        agent.status = AgentStatus.Delisted;

        emit AgentDelisted(agentId, msg.sender);
    }

    // ============ Escrow Functions ============

    /**
     * @notice Record a sale for an agent (only callable by escrow contract)
     * @param agentId ID of the agent that was sold
     */
    function recordSale(uint256 agentId) external onlyEscrow {
        Agent storage agent = _agents[agentId];
        if (agent.seller == address(0)) revert AgentNotFound();

        agent.totalSales++;

        emit AgentSaleRecorded(agentId, agent.totalSales);
    }

    // ============ View Functions ============

    /**
     * @notice Get agent details
     * @param agentId ID of the agent
     * @return Agent struct
     */
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        Agent memory agent = _agents[agentId];
        if (agent.seller == address(0)) revert AgentNotFound();
        return agent;
    }

    /**
     * @notice Get all agent IDs for a seller
     * @param seller Address of the seller
     * @return Array of agent IDs
     */
    function getAgentsBySeller(address seller) external view returns (uint256[] memory) {
        return _sellerAgents[seller];
    }

    /**
     * @notice Get total number of agents
     * @return Total agent count
     */
    function agentCount() external view returns (uint256) {
        return _agentIdCounter;
    }
}
