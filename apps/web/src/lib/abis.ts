/**
 * Contract ABIs for Tempt marketplace
 *
 * TIP-20 is the enshrined ERC-20 extension on Tempo.
 * It extends ERC-20 with transferWithMemo and transferFromWithMemo
 * for payment reconciliation. Standard approve/allowance/balanceOf work normally.
 */

export const TIP20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Approval',
    type: 'event',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

export const ESCROW_ABI = [
  {
    name: 'purchase',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'escrowId', type: 'uint256' }],
  },
  {
    name: 'acceptAndRelease',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'raiseDispute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'autoRelease',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getEscrow',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'agentId', type: 'uint256' },
          { name: 'buyer', type: 'address' },
          { name: 'seller', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'autoReleaseAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getPlatformFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'EscrowCreated',
    type: 'event',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: false },
      { name: 'autoReleaseAt', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'EscrowReleased',
    type: 'event',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'sellerAmount', type: 'uint256', indexed: false },
      { name: 'platformFee', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'EscrowDisputed',
    type: 'event',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    name: 'EscrowAutoReleased',
    type: 'event',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'sellerAmount', type: 'uint256', indexed: false },
    ],
  },
] as const
