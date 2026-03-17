// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ShareToken
 * @notice ERC-20 share token for a single tradeable agent.
 *         Mint and burn are controlled ONLY by BondingCurveMarket.
 *         Deployed via EIP-1167 minimal proxy from ShareTokenFactory.
 */
contract ShareToken is ERC20 {
    /// @notice The BondingCurveMarket — only address that can mint/burn
    address public bondingCurve;

    /// @notice Agent ID this token belongs to
    uint256 public agentId;

    bool private _initialized;

    error Unauthorized();
    error AlreadyInitialized();

    /// @notice Placeholder constructor for proxy pattern — use initialize() instead
    constructor() ERC20("", "") {}

    /**
     * @notice Initialize called by ShareTokenFactory after proxy deployment
     * @param _name Token name
     * @param _symbol Token symbol (max 10 chars recommended)
     * @param _bondingCurve Address of BondingCurveMarket
     * @param _agentId The agent this token represents
     */
    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _bondingCurve,
        uint256 _agentId
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;
        bondingCurve = _bondingCurve;
        agentId = _agentId;
        // ERC20 stores name/symbol immutably in constructor, so we shadow them
        // via _name/_symbol storage slots exposed by OpenZeppelin's ERC20
        _setNameAndSymbol(_name, _symbol);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != bondingCurve) revert Unauthorized();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != bondingCurve) revert Unauthorized();
        _burn(from, amount);
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    string private _tokenName;
    string private _tokenSymbol;

    function _setNameAndSymbol(string calldata _n, string calldata _s) internal {
        _tokenName = _n;
        _tokenSymbol = _s;
    }

    function name() public view override returns (string memory) {
        return _tokenName;
    }

    function symbol() public view override returns (string memory) {
        return _tokenSymbol;
    }
}
