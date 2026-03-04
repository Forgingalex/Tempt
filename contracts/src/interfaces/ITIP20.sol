// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITIP20
 * @notice Interface for TIP-20 tokens on Tempo blockchain
 * @dev TIP-20 is an enshrined ERC-20 extension with native support for memos
 *
 * Key differences from ERC-20:
 * - Uses 6 decimals (not 18)
 * - Supports `transferWithMemo` for payment reconciliation
 * - No native gas token on Tempo - fees paid in TIP-20 stablecoins
 */
interface ITIP20 {
    // Standard ERC-20 events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // TIP-20 specific event
    event TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 memo);

    // Standard ERC-20 functions
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /**
     * @notice Transfer tokens with an attached memo for reconciliation
     * @param to Recipient address
     * @param amount Amount to transfer (6 decimals)
     * @param memo 32-byte memo for payment reference (e.g., escrow ID)
     * @return bool Success
     */
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external returns (bool);

    /**
     * @notice Transfer tokens from an approved address with memo
     * @param from Source address
     * @param to Recipient address
     * @param amount Amount to transfer (6 decimals)
     * @param memo 32-byte memo for payment reference
     * @return bool Success
     */
    function transferFromWithMemo(
        address from,
        address to,
        uint256 amount,
        bytes32 memo
    ) external returns (bool);
}
