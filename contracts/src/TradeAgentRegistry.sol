// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ITradeAgentRegistry} from "./interfaces/ITradeAgentRegistry.sol";

/**
 * @title TradeAgentRegistry
 * @notice ERC-721 NFT identity and immutable config store for tradeable agents.
 *         Separate from the marketplace AgentRegistry — agents can exist in both systems.
 * @dev Deployed on Tempo Testnet (Moderato). All payments use TIP-20 stablecoins (6 decimals).
 *      Share tokens are ERC-20 with 18 decimals.
 */
contract TradeAgentRegistry is ITradeAgentRegistry, ERC721, Ownable, ReentrancyGuard {
    // ============ Constants ============

    /// @notice Minimum share token supply cap (100M with 18 decimals)
    uint256 public constant MIN_SUPPLY_CAP = 100_000_000e18;

    /// @notice Maximum share token supply cap (1B with 18 decimals)
    uint256 public constant MAX_SUPPLY_CAP = 1_000_000_000e18;

    /// @notice Maximum creator fee in basis points (5%)
    uint32 public constant MAX_CREATOR_FEE_BPS = 500;

    // ============ State ============

    struct AgentData {
        address creator;
        string metadataUri;
        bytes32 codeHash;
        uint32 creatorFeeBps;
        uint256 supplyCap; // IMMUTABLE after registration
        uint8 status; // 0=Active, 1=Paused, 2=Delisted, 3=Slashed
        address shareToken; // Set once by ShareTokenFactory
    }

    /// @notice Token ID counter
    uint256 private _nextAgentId;

    /// @notice Agent data keyed by token ID
    mapping(uint256 => AgentData) private _agents;

    /// @notice StakingAndSlashing contract — must confirm bond before registration
    address public stakingContract;

    /// @notice ShareTokenFactory — the only address that can set share tokens
    address public shareTokenFactory;

    // ============ Errors (additional) ============

    error StakingContractNotSet();
    error ShareTokenFactoryNotSet();

    // ============ Constructor ============

    constructor(address admin) ERC721("Tempt Trade Agent", "TTAGENT") {
        _transferOwnership(admin);
        _nextAgentId = 1;
    }

    // ============ Configuration ============

    /// @notice Set the StakingAndSlashing contract address
    function setStakingContract(address _staking) external onlyOwner {
        stakingContract = _staking;
    }

    /// @notice Set the ShareTokenFactory contract address
    function setShareTokenFactory(address _factory) external onlyOwner {
        shareTokenFactory = _factory;
    }

    // ============ Registration ============

    /**
     * @notice Register a new tradeable agent.
     * @dev Caller must have posted bond via StakingAndSlashing first.
     *      supplyCap is immutable after this call.
     */
    function registerAgent(
        string calldata metadataUri,
        bytes32 codeHash,
        uint32 creatorFeeBps,
        uint256 bondAmount,
        uint256 supplyCap
    ) external nonReentrant returns (uint256 agentId) {
        if (bytes(metadataUri).length == 0) revert InvalidMetadata();
        if (supplyCap < MIN_SUPPLY_CAP || supplyCap > MAX_SUPPLY_CAP) revert SupplyCapOutOfRange();
        if (creatorFeeBps > MAX_CREATOR_FEE_BPS) revert CreatorFeeTooHigh();

        // Verify bond has been posted
        if (stakingContract == address(0)) revert StakingContractNotSet();
        if (!IStakingCheck(stakingContract).hasBond(msg.sender, bondAmount)) revert BondNotPosted();

        agentId = _nextAgentId++;

        _agents[agentId] = AgentData({
            creator: msg.sender,
            metadataUri: metadataUri,
            codeHash: codeHash,
            creatorFeeBps: creatorFeeBps,
            supplyCap: supplyCap,
            status: 0,
            shareToken: address(0)
        });

        _safeMint(msg.sender, agentId);

        emit AgentRegistered(agentId, msg.sender, metadataUri, codeHash, supplyCap);
    }

    // ============ View ============

    /// @inheritdoc ITradeAgentRegistry
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
        )
    {
        if (!_exists(agentId)) revert AgentNotFound();
        AgentData storage a = _agents[agentId];
        return (a.creator, a.metadataUri, a.codeHash, a.creatorFeeBps, a.supplyCap, a.status);
    }

    /// @inheritdoc ITradeAgentRegistry
    function shareTokenOf(uint256 agentId) external view returns (address) {
        return _agents[agentId].shareToken;
    }

    // ============ Share Token ============

    /// @inheritdoc ITradeAgentRegistry
    function setShareToken(uint256 agentId, address shareToken) external {
        if (msg.sender != shareTokenFactory) revert NotCreatorOrAdmin();
        if (!_exists(agentId)) revert AgentNotFound();
        if (_agents[agentId].shareToken != address(0)) revert ShareTokenAlreadySet();
        _agents[agentId].shareToken = shareToken;
        emit ShareTokenSet(agentId, shareToken);
    }

    // ============ Status ============

    /// @inheritdoc ITradeAgentRegistry
    function setAgentStatus(uint256 agentId, uint8 status) external {
        if (!_exists(agentId)) revert AgentNotFound();
        AgentData storage a = _agents[agentId];
        // Creator can pause (1) their own agent; admin can do anything
        if (msg.sender == a.creator) {
            if (status != 1) revert NotCreatorOrAdmin();
        } else if (msg.sender != owner()) {
            revert NotCreatorOrAdmin();
        }
        a.status = status;
        emit AgentStatusChanged(agentId, status);
    }

    // ============ Internal ============

    function _exists(uint256 tokenId) internal view override returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}

/// @dev Minimal interface for bond verification
interface IStakingCheck {
    function hasBond(address user, uint256 amount) external view returns (bool);
}
