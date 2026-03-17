// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ITIP20Staking {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external returns (bool);
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external returns (bool);
}

/**
 * @title StakingAndSlashing
 * @notice Manages creator bonds required before agent registration.
 *
 * Flow:
 *   1. Creator calls postBond() with stablecoin approval
 *   2. Creator calls TradeAgentRegistry.registerAgent() — bond check passes
 *   3. After 6 months with no slashing, creator can call refundBond()
 *   4. Governance multisig can call slash() to penalize bad actors
 *
 * Default bond: $200 USDC equivalent (200_000_000 in 6-decimal TIP-20 units)
 */
contract StakingAndSlashing is Ownable, ReentrancyGuard {
    // ============ Constants ============

    /// @notice Default bond amount: $200 in TIP-20 (6 decimals)
    uint256 public constant DEFAULT_BOND = 200_000_000; // 200 USDC

    /// @notice Lock period before refund is allowed: 6 months in seconds
    uint256 public constant LOCK_PERIOD = 180 days;

    // ============ State ============

    struct Bond {
        uint256 amount;
        uint256 postedAt;
        bool slashed;
        bool refunded;
    }

    /// @notice Stablecoin token used for bonds
    address public bondToken;

    /// @notice Required bond amount (governance-adjustable)
    uint256 public requiredBond = DEFAULT_BOND;

    /// @notice user → bond data
    mapping(address => Bond) private _bonds;

    // ============ Events ============

    event BondPosted(address indexed creator, uint256 amount);
    event BondRefunded(address indexed creator, uint256 amount);
    event BondSlashed(address indexed creator, uint256 amount, address slashedTo);
    event RequiredBondUpdated(uint256 newAmount);

    // ============ Errors ============

    error BondAlreadyPosted();
    error BondNotPosted();
    error LockPeriodNotExpired();
    error AlreadyRefunded();
    error AlreadySlashed();
    error InvalidAmount();

    // ============ Constructor ============

    constructor(address admin, address _bondToken) {
        _transferOwnership(admin);
        bondToken = _bondToken;
    }

    // ============ Configuration ============

    function setRequiredBond(uint256 amount) external onlyOwner {
        requiredBond = amount;
        emit RequiredBondUpdated(amount);
    }

    function setBondToken(address token) external onlyOwner {
        bondToken = token;
    }

    // ============ Bond Operations ============

    /**
     * @notice Post the required bond (must approve this contract first)
     */
    function postBond() external nonReentrant {
        Bond storage b = _bonds[msg.sender];
        if (b.amount > 0 && !b.slashed && !b.refunded) revert BondAlreadyPosted();

        uint256 amount = requiredBond;
        if (amount == 0) revert InvalidAmount();

        bool ok = ITIP20Staking(bondToken).transferFromWithMemo(
            msg.sender, address(this), amount, bytes32("bond")
        );
        require(ok, "StakingAndSlashing: transfer failed");

        _bonds[msg.sender] = Bond({amount: amount, postedAt: block.timestamp, slashed: false, refunded: false});

        emit BondPosted(msg.sender, amount);
    }

    /**
     * @notice Refund bond after lock period with no slashing
     */
    function refundBond() external nonReentrant {
        Bond storage b = _bonds[msg.sender];
        if (b.amount == 0) revert BondNotPosted();
        if (b.slashed) revert AlreadySlashed();
        if (b.refunded) revert AlreadyRefunded();
        if (block.timestamp < b.postedAt + LOCK_PERIOD) revert LockPeriodNotExpired();

        uint256 amount = b.amount;
        b.refunded = true;
        b.amount = 0;

        bool ok = ITIP20Staking(bondToken).transferWithMemo(msg.sender, amount, bytes32("refund"));
        require(ok, "StakingAndSlashing: refund failed");

        emit BondRefunded(msg.sender, amount);
    }

    /**
     * @notice Slash a creator's bond (governance multisig only)
     * @param creator The creator to slash
     * @param slashTo Address to send slashed funds (e.g., treasury)
     */
    function slash(address creator, address slashTo) external onlyOwner nonReentrant {
        Bond storage b = _bonds[creator];
        if (b.amount == 0) revert BondNotPosted();
        if (b.slashed) revert AlreadySlashed();
        if (b.refunded) revert AlreadyRefunded();

        uint256 amount = b.amount;
        b.slashed = true;
        b.amount = 0;

        bool ok = ITIP20Staking(bondToken).transferWithMemo(slashTo, amount, bytes32("slash"));
        require(ok, "StakingAndSlashing: slash transfer failed");

        emit BondSlashed(creator, amount, slashTo);
    }

    // ============ View ============

    /**
     * @notice Check if a user has an active (unslashed, unrefunded) bond of at least `amount`
     */
    function hasBond(address user, uint256 amount) external view returns (bool) {
        Bond storage b = _bonds[user];
        return b.amount >= amount && !b.slashed && !b.refunded;
    }

    function getBond(address user) external view returns (uint256 amount, uint256 postedAt, bool slashed, bool refunded) {
        Bond storage b = _bonds[user];
        return (b.amount, b.postedAt, b.slashed, b.refunded);
    }

    function canRefund(address user) external view returns (bool) {
        Bond storage b = _bonds[user];
        return b.amount > 0 && !b.slashed && !b.refunded && block.timestamp >= b.postedAt + LOCK_PERIOD;
    }
}
