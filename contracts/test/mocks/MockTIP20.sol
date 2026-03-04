// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "../../src/interfaces/ITIP20.sol";

/**
 * @title MockTIP20
 * @notice Mock TIP-20 token for testing
 */
contract MockTIP20 is ITIP20 {
    string public name = "Mock USD";
    string public symbol = "mUSD";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        return _transfer(from, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferWithMemo(address to, uint256 amount, bytes32 memo) external returns (bool) {
        bool success = _transfer(msg.sender, to, amount);
        if (success) {
            emit TransferWithMemo(msg.sender, to, amount, memo);
        }
        return success;
    }

    function transferFromWithMemo(
        address from,
        address to,
        uint256 amount,
        bytes32 memo
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        bool success = _transfer(from, to, amount);
        if (success) {
            emit TransferWithMemo(from, to, amount, memo);
        }
        return success;
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
