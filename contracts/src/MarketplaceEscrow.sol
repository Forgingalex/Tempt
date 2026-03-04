// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMarketplaceEscrow} from "./interfaces/IMarketplaceEscrow.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {ITIP20} from "./interfaces/ITIP20.sol";

/**
 * @title MarketplaceEscrow
 * @notice Holds buyer funds and manages the acceptance/dispute flow
 * @dev Deployed on Tempo Testnet (Moderato)
 *
 * Key features:
 * - Buyers purchase agents, funds held in escrow
 * - Buyers can accept (release to seller) or dispute
 * - Auto-release after configurable period (default 7 days)
 * - Platform fee on successful transactions
 * - Uses transferWithMemo for payment reconciliation
 */
contract MarketplaceEscrow is IMarketplaceEscrow {
    // ============ Constants ============

    /// @notice Maximum platform fee (10%)
    uint256 public constant MAX_FEE_BPS = 1000;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ============ State Variables ============

    /// @notice Counter for escrow IDs
    uint256 private _escrowIdCounter;

    /// @notice Platform admin address
    address public admin;

    /// @notice Address to receive platform fees
    address public feeRecipient;

    /// @notice Agent registry contract
    IAgentRegistry public agentRegistry;

    /// @notice Platform fee in basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBps;

    /// @notice Auto-release period in seconds (default 7 days)
    uint256 public autoReleasePeriod;

    /// @notice Mapping from escrow ID to Escrow struct
    mapping(uint256 => Escrow) private _escrows;

    /// @notice Mapping from buyer address to their escrow IDs
    mapping(address => uint256[]) private _buyerEscrows;

    /// @notice Mapping from seller address to their escrow IDs
    mapping(address => uint256[]) private _sellerEscrows;

    // ============ Errors ============

    error NotAuthorized();
    error NotBuyer();
    error NotAdmin();
    error EscrowNotFound();
    error EscrowNotActive();
    error EscrowNotDisputed();
    error AutoReleaseNotReady();
    error InvalidAgent();
    error AgentNotListed();
    error FeeTooHigh();
    error TransferFailed();

    // ============ Modifiers ============

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyBuyer(uint256 escrowId) {
        if (_escrows[escrowId].buyer != msg.sender) revert NotBuyer();
        _;
    }

    // ============ Constructor ============

    constructor(address _admin, address _feeRecipient, address _agentRegistry, uint256 _feeBps) {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        admin = _admin;
        feeRecipient = _feeRecipient;
        agentRegistry = IAgentRegistry(_agentRegistry);
        platformFeeBps = _feeBps;
        autoReleasePeriod = 7 days;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the platform fee
     * @param newFeeBps New fee in basis points
     */
    function setPlatformFee(uint256 newFeeBps) external onlyAdmin {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();

        uint256 oldFeeBps = platformFeeBps;
        platformFeeBps = newFeeBps;

        emit PlatformFeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Update the auto-release period
     * @param newPeriod New period in seconds
     */
    function setAutoReleasePeriod(uint256 newPeriod) external onlyAdmin {
        uint256 oldPeriod = autoReleasePeriod;
        autoReleasePeriod = newPeriod;

        emit AutoReleasePeriodUpdated(oldPeriod, newPeriod);
    }

    /**
     * @notice Update the fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyAdmin {
        feeRecipient = newRecipient;
    }

    /**
     * @notice Transfer admin role
     * @param newAdmin New admin address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    // ============ Buyer Functions ============

    /**
     * @notice Purchase an agent (creates escrow)
     * @param agentId ID of the agent to purchase
     * @return escrowId The ID of the created escrow
     */
    function purchase(uint256 agentId) external returns (uint256 escrowId) {
        // Get agent details
        IAgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);

        if (agent.status != IAgentRegistry.AgentStatus.Listed) revert AgentNotListed();

        // Create escrow
        escrowId = _escrowIdCounter++;
        uint256 autoReleaseAt = block.timestamp + autoReleasePeriod;

        _escrows[escrowId] = Escrow({
            id: escrowId,
            agentId: agentId,
            buyer: msg.sender,
            seller: agent.seller,
            amount: agent.price,
            token: agent.paymentToken,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            autoReleaseAt: autoReleaseAt
        });

        _buyerEscrows[msg.sender].push(escrowId);
        _sellerEscrows[agent.seller].push(escrowId);

        // Transfer funds from buyer to this contract with memo
        ITIP20 token = ITIP20(agent.paymentToken);
        bytes32 memo = bytes32(escrowId);

        bool success = token.transferFromWithMemo(msg.sender, address(this), agent.price, memo);
        if (!success) revert TransferFailed();

        emit EscrowCreated(
            escrowId,
            agentId,
            msg.sender,
            agent.seller,
            agent.price,
            agent.paymentToken,
            autoReleaseAt
        );
    }

    /**
     * @notice Accept and release payment to seller
     * @param escrowId ID of the escrow
     */
    function acceptAndRelease(uint256 escrowId) external onlyBuyer(escrowId) {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();

        escrow.status = EscrowStatus.Released;

        // Calculate fees and amounts
        uint256 platformFee = (escrow.amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 sellerAmount = escrow.amount - platformFee;

        // Transfer to seller with memo
        ITIP20 token = ITIP20(escrow.token);
        bytes32 memo = bytes32(escrowId);

        bool sellerSuccess = token.transferWithMemo(escrow.seller, sellerAmount, memo);
        if (!sellerSuccess) revert TransferFailed();

        // Transfer fee to platform
        if (platformFee > 0) {
            bool feeSuccess = token.transferWithMemo(feeRecipient, platformFee, memo);
            if (!feeSuccess) revert TransferFailed();
        }

        // Record sale in registry
        agentRegistry.recordSale(escrow.agentId);

        emit EscrowReleased(escrowId, escrow.seller, sellerAmount, platformFee);
    }

    /**
     * @notice Raise a dispute
     * @param escrowId ID of the escrow
     * @param reason Reason for the dispute
     */
    function raiseDispute(uint256 escrowId, string calldata reason) external onlyBuyer(escrowId) {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();

        escrow.status = EscrowStatus.Disputed;

        emit EscrowDisputed(escrowId, msg.sender, reason);
    }

    // ============ Admin Dispute Resolution ============

    /**
     * @notice Resolve a dispute
     * @param escrowId ID of the escrow
     * @param refundBuyer If true, refund buyer; if false, release to seller
     */
    function resolveDispute(uint256 escrowId, bool refundBuyer) external onlyAdmin {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.status != EscrowStatus.Disputed) revert EscrowNotDisputed();

        ITIP20 token = ITIP20(escrow.token);
        bytes32 memo = bytes32(escrowId);

        if (refundBuyer) {
            escrow.status = EscrowStatus.Refunded;

            bool success = token.transferWithMemo(escrow.buyer, escrow.amount, memo);
            if (!success) revert TransferFailed();
        } else {
            escrow.status = EscrowStatus.Released;

            // Calculate fees and transfer
            uint256 platformFee = (escrow.amount * platformFeeBps) / BPS_DENOMINATOR;
            uint256 sellerAmount = escrow.amount - platformFee;

            bool sellerSuccess = token.transferWithMemo(escrow.seller, sellerAmount, memo);
            if (!sellerSuccess) revert TransferFailed();

            if (platformFee > 0) {
                bool feeSuccess = token.transferWithMemo(feeRecipient, platformFee, memo);
                if (!feeSuccess) revert TransferFailed();
            }

            agentRegistry.recordSale(escrow.agentId);
        }

        emit DisputeResolved(escrowId, refundBuyer, msg.sender);
    }

    // ============ Auto-Release ============

    /**
     * @notice Auto-release escrow after the timeout period
     * @param escrowId ID of the escrow
     */
    function autoRelease(uint256 escrowId) external {
        Escrow storage escrow = _escrows[escrowId];
        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();
        if (block.timestamp < escrow.autoReleaseAt) revert AutoReleaseNotReady();

        escrow.status = EscrowStatus.AutoReleased;

        // Calculate fees and amounts
        uint256 platformFee = (escrow.amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 sellerAmount = escrow.amount - platformFee;

        // Transfer to seller with memo
        ITIP20 token = ITIP20(escrow.token);
        bytes32 memo = bytes32(escrowId);

        bool sellerSuccess = token.transferWithMemo(escrow.seller, sellerAmount, memo);
        if (!sellerSuccess) revert TransferFailed();

        // Transfer fee to platform
        if (platformFee > 0) {
            bool feeSuccess = token.transferWithMemo(feeRecipient, platformFee, memo);
            if (!feeSuccess) revert TransferFailed();
        }

        // Record sale in registry
        agentRegistry.recordSale(escrow.agentId);

        emit EscrowAutoReleased(escrowId, escrow.seller, sellerAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get escrow details
     * @param escrowId ID of the escrow
     * @return Escrow struct
     */
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        Escrow memory escrow = _escrows[escrowId];
        if (escrow.buyer == address(0)) revert EscrowNotFound();
        return escrow;
    }

    /**
     * @notice Get all escrow IDs for a buyer
     * @param buyer Address of the buyer
     * @return Array of escrow IDs
     */
    function getEscrowsByBuyer(address buyer) external view returns (uint256[] memory) {
        return _buyerEscrows[buyer];
    }

    /**
     * @notice Get all escrow IDs for a seller
     * @param seller Address of the seller
     * @return Array of escrow IDs
     */
    function getEscrowsBySeller(address seller) external view returns (uint256[] memory) {
        return _sellerEscrows[seller];
    }

    /**
     * @notice Get current platform fee in basis points
     * @return Fee in basis points
     */
    function getPlatformFeeBps() external view returns (uint256) {
        return platformFeeBps;
    }

    /**
     * @notice Get current auto-release period
     * @return Period in seconds
     */
    function getAutoReleasePeriod() external view returns (uint256) {
        return autoReleasePeriod;
    }

    /**
     * @notice Get total number of escrows
     * @return Total escrow count
     */
    function escrowCount() external view returns (uint256) {
        return _escrowIdCounter;
    }
}
