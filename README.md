# Tempt

> Peer-to-peer marketplace for AI agents on Tempo blockchain. Prompts stay encrypted. Payments go on-chain.

[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)](./LICENSE)
[![Network](https://img.shields.io/badge/network-Tempo%20Testnet-blue)](https://explore.tempo.xyz)
[![Chain ID](https://img.shields.io/badge/chain%20ID-42431-blue)](https://docs.tempo.xyz)

---

## What Is Tempt

Tempt is an on-chain marketplace where prompt engineers list and sell AI agents as products. Sellers configure an agent with a hidden system prompt, define its inputs, and set a price. Buyers purchase access through a TIP-20 escrow and interact with the agent via a controlled interface. The underlying prompt is never exposed at any point in the flow.

Payments are held in escrow until the buyer accepts the output or the 7-day window lapses. Every listing requires structured outcome disclosures, not star ratings.

---

## How It Works

```
Buyer purchases agent
        |
        v
TIP-20 funds locked in MarketplaceEscrow contract
        |
        v
Buyer submits input via usage interface
        |
        v
Backend decrypts prompt (server-side only) + calls LLM
        |
        v
Output returned to buyer
        |
        v
Buyer accepts  -->  funds released to seller
Buyer disputes -->  admin reviews, refund or release
No action (7d) -->  auto-release to seller
```

---

## Contracts

All contracts are deployed on **Tempo Testnet (Moderato)**, Chain ID `42431`.

### Marketplace

| Contract | Address |
|---|---|
| AgentRegistry | [`0x6bce4e90bEc7A3d8D9D646D9beA657e700Ad0D11`](https://explore.tempo.xyz/address/0x6bce4e90bEc7A3d8D9D646D9beA657e700Ad0D11) |
| MarketplaceEscrow | [`0xA46B761cEcA718c75BB1Afc1A912672b6bdA720A`](https://explore.tempo.xyz/address/0xA46B761cEcA718c75BB1Afc1A912672b6bdA720A) |

### Trade System

| Contract | Address |
|---|---|
| BondingCurveMarket | [`0x59e85cE7B05d4ec217C4888697401f37eaEa71eF`](https://explore.tempo.xyz/address/0x59e85cE7B05d4ec217C4888697401f37eaEa71eF) |
| TradingVault | [`0xdcF47dD540a09Ef4aEbDfa3cf3501AB3ea71a1ac`](https://explore.tempo.xyz/address/0xdcF47dD540a09Ef4aEbDfa3cf3501AB3ea71a1ac) |
| ShareTokenFactory | [`0x0ecD56d3B7618CcEe2c5108122Fa633a8Dae7e6D`](https://explore.tempo.xyz/address/0x0ecD56d3B7618CcEe2c5108122Fa633a8Dae7e6D) |
| TradeAgentRegistry | [`0xDA08b44Ab0A228e90cE9BD000EF0e91b2C5Cf2A3`](https://explore.tempo.xyz/address/0xDA08b44Ab0A228e90cE9BD000EF0e91b2C5Cf2A3) |
| FeeRouter | [`0x241aA3CD541D042f8233d75Bd6b7bf8497141bAD`](https://explore.tempo.xyz/address/0x241aA3CD541D042f8233d75Bd6b7bf8497141bAD) |
| StakingAndSlashing | [`0xe797c58107d83Bc3F452A4BBc18a24C01b27A4d4`](https://explore.tempo.xyz/address/0xe797c58107d83Bc3F452A4BBc18a24C01b27A4d4) |

### Tempo Testnet Stablecoins

| Token | Address |
|---|---|
| PathUSD | `0x20C0000000000000000000000000000000000000` |
| AlphaUSD (default) | `0x20C0000000000000000000000000000000000001` |
| BetaUSD | `0x20C0000000000000000000000000000000000002` |
| ThetaUSD | `0x20C0000000000000000000000000000000000003` |

Testnet funds: use `tempo_fundAddress` RPC method or the Tempo faucet.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Wallet | wagmi v2, viem, SIWE |
| State | Zustand, TanStack Query |
| Backend | Node.js 20, Express, Prisma, PostgreSQL, Redis, BullMQ |
| Contracts | Solidity, Foundry, OpenZeppelin v4.9.6 |
| Chain | Tempo Testnet (Moderato), TIP-20 tokens |
| Auth | NextAuth.js v5, SIWE |

---

## Repository Layout

```
tempt/
├── apps/
│   ├── web/                    # Next.js app (marketplace, studio, trade, usage interface)
│   │   ├── app/                # App Router pages and API routes
│   │   ├── components/         # Marketplace, agent, studio, trade, layout components
│   │   ├── lib/                # Chain config, auth, DB client, encryption
│   │   ├── hooks/              # wagmi, query, and auth hooks
│   │   └── stores/             # Zustand stores
│   └── server/                 # Express backend (execution service, queue processors)
│       └── prisma/             # Schema and migrations
├── contracts/
│   ├── src/                    # AgentRegistry, MarketplaceEscrow, trade contracts
│   ├── test/                   # Foundry tests (27 passing)
│   └── script/                 # Deployment scripts
└── packages/
    └── types/                  # Shared TypeScript types
```

---

## Local Development

**Prerequisites:** Node.js 20+, PostgreSQL, Redis, [Foundry](https://book.getfoundry.sh)

```bash
# 1. Clone
git clone https://github.com/Forgingalex/tempt.git
cd tempt

# 2. Install
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, PROMPT_ENCRYPTION_KEY, NEXTAUTH_SECRET, LLM API keys

# 4. Database setup
cd apps/server
npx prisma generate
npx prisma db push
cd ../..

# 5. Start frontend (Terminal 1)
npm run dev --workspace=apps/web
# http://localhost:3000

# 6. Start backend (Terminal 2)
npm run dev --workspace=apps/server
```

---

## Smart Contracts

```bash
cd contracts

# Build
forge build

# Run tests
forge test -vv

# Deploy (Tempo Testnet)
# Note: use cast send --create instead of forge script --broadcast
# forge script has gas estimation issues on Tempo
cast send --create $(forge inspect ContractName bytecode) \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --private-key $DEPLOYER_PRIVATE_KEY
```

**Foundry config notes for Tempo:**
- `evm_version = "paris"` in `foundry.toml` (Tempo does not support PUSH0 or MCOPY)
- OpenZeppelin v4.9.6 required (v5+ uses `mcopy` opcode)
- Contract deployments cost 5-10x more gas than Ethereum; set limits accordingly

---

## Tempo Chain Reference

| Property | Value |
|---|---|
| Network | Tempo Testnet (Moderato) |
| Chain ID | `42431` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Explorer | `https://explore.tempo.xyz` |
| Token standard | TIP-20 (6 decimals) |
| Gas token | None; fees paid in TIP-20 stablecoins |
| Docs | `https://docs.tempo.xyz` |

TIP-20 uses **6 decimals**, not 18. Use `parseUnits(amount, 6)` and `formatUnits(amount, 6)` for all token math.

---

## Security

**Prompt confidentiality**

System prompts are encrypted with AES-256-GCM before storage. Decryption happens exclusively on the server, inside the execution route, immediately before the LLM call. The plaintext prompt is never written to logs, never returned in API responses, and never present in any client-side state.

**Execution logging**

Inputs and outputs are stored as SHA-256 hashes. Raw data is retained temporarily during the dispute window only, then purged.

**Payments**

All payments use `transferWithMemo` with the escrow ID as the memo field. This makes every payment traceable for dispute resolution without requiring off-chain coordination.

**Wallet auth**

SIWE with nonce validation, chain ID enforcement, and expiry checks via NextAuth.js v5.

---

## Trust Model

| Layer | Mechanism |
|---|---|
| Pre-listing | Automated execution checks + manual review before any agent goes live |
| Disclosure | Mandatory "what it does NOT do" section on every listing |
| Escrow | Buyer funds held on-chain; released on acceptance or after 7-day auto-release |
| Reviews | Outcome questions only: "Did it do what it claimed?", "Would you use it again?" |

Agents above a 20% dispute rate are flagged for review. Above 40%, they are auto-delisted.

---

## License

All rights reserved.
