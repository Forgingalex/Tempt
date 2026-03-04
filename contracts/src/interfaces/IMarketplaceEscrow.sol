// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMarketplaceEscrow
 * @notice Interface for the Marketplace Escrow contract
 */
interface IMarketplaceEscrow {
    // ============ Enums ============

    enum EscrowStatus {
        Active,
        Released,
        Disputed,
        Refunded,
        AutoReleased
    }

    // ============ Structs ============

    struct Escrow {
        uint256 id;
        uint256 agentId;
        address buyer;
        address seller;
        uint256 amount;
        address token; // TIP-20 token address
        EscrowStatus status;
        uint256 createdAt;
        uint256 autoReleaseAt; // Timestamp for auto-release
    }

    // ============ Events ============

    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed agentId,
        address indexed buyer,
        address seller,
        uint256 amount,
        address token,
        uint256 autoReleaseAt
    );

    event EscrowReleased(uint256 indexed escrowId, address indexed seller, uint256 sellerAmount, uint256 platformFee);

    event EscrowDisputed(uint256 indexed escrowId, address indexed buyer, string reason);

    event DisputeResolved(uint256 indexed escrowId, bool refundedToBuyer, address resolver);

    event EscrowAutoReleased(uint256 indexed escrowId, address indexed seller, uint256 sellerAmount);

    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    event AutoReleasePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);

    // ============ Functions ============

    function purchase(uint256 agentId) external returns (uint256 escrowId);

    function acceptAndRelease(uint256 escrowId) external;

    function raiseDispute(uint256 escrowId, string calldata reason) external;

    function resolveDispute(uint256 escrowId, bool refundBuyer) external;

    function autoRelease(uint256 escrowId) external;

    function getEscrow(uint256 escrowId) external view returns (Escrow memory);

    function getEscrowsByBuyer(address buyer) external view returns (uint256[] memory);

    function getEscrowsBySeller(address seller) external view returns (uint256[] memory);

    function getPlatformFeeBps() external view returns (uint256);

    function getAutoReleasePeriod() external view returns (uint256);

    function escrowCount() external view returns (uint256);
}
